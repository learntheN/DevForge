/**
 * Agent 核心类
 * 实现分阶段执行：Plan → Generate → Validate → Fix
 * 支持并行验证和流式进度回调
 */

const LLMClient = require('./llm');
const Memory = require('./memory');
const fs = require('fs');
const path = require('path');

// 加载系统提示词
const SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, '..', 'prompts', 'system.md'), 
  'utf8'
);

// 加载 SKILL 规范
let SKILL_CONTENT = '';
const skillPath = path.join(__dirname, '..', '..', '.qoder', 'skills', 'dev-toolbox-generator.md');
if (fs.existsSync(skillPath)) {
  SKILL_CONTENT = fs.readFileSync(skillPath, 'utf8');
}

// 执行阶段枚举
const Phase = {
  PLAN: 'plan',
  GENERATE: 'generate',
  VALIDATE: 'validate',
  FIX: 'fix',
  COMPLETE: 'complete'
};

class ToolboxAgent {
  constructor(config, tools) {
    this.llm = new LLMClient(config);
    this.tools = tools;
    this.sessions = new Map(); // taskId -> { memory, status, phase, plan, ... }
    this.mainServiceUrl = config.mainServiceUrl || 'http://localhost:3000';
  }

  /**
   * 获取或创建会话
   */
  getSession(taskId) {
    if (!this.sessions.has(taskId)) {
      this.sessions.set(taskId, {
        memory: new Memory(),
        status: 'idle',
        phase: Phase.PLAN,
        plan: null,
        steps: [],
        result: null
      });
    }
    return this.sessions.get(taskId);
  }

  /**
   * 记录步骤
   */
  addStep(taskId, step) {
    const session = this.getSession(taskId);
    session.steps.push({
      ...step,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 获取任务状态
   */
  getStatus(taskId) {
    const session = this.sessions.get(taskId);
    if (!session) {
      return { status: 'not_found' };
    }
    return {
      status: session.status,
      phase: session.phase,
      plan: session.plan,
      steps: session.steps,
      result: session.result
    };
  }

  /**
   * 运行 Agent (支持流式进度回调)
   * @param {string} taskId - 任务 ID
   * @param {string} userMessage - 用户消息
   * @param {function} onProgress - 进度回调函数 (可选)
   */
  async run(taskId, userMessage, onProgress = null) {
    const session = this.getSession(taskId);
    session.status = 'running';
    session.phase = Phase.PLAN;
    session.memory.addMessage('user', userMessage);

    // 进度上报辅助函数
    const emit = (event, data) => {
      this.addStep(taskId, { type: event, ...data });
      if (onProgress) {
        try { onProgress({ event, ...data }); } catch (e) { /* ignore */ }
      }
    };

    emit('user_input', { content: userMessage });
    emit('phase_change', { phase: Phase.PLAN, message: '制定计划中...' });

    const systemPrompt = `${SYSTEM_PROMPT}\n\n## SKILL 规范\n${SKILL_CONTENT}`;
    let maxIterations = 10;
    let iteration = 0;
    let generateCount = 0;
    const maxGenerateCount = 2;

    try {
      while (iteration < maxIterations) {
        iteration++;

        emit('thinking', { content: `推理中 (第 ${iteration} 轮, 阶段: ${session.phase})...`, iteration, phase: session.phase });

        // 根据阶段获取可用工具
        const availableTools = this.getToolsForPhase(session.phase);
        
        // 记录 LLM 调用信息
        const messages = session.memory.getMessages();
        emit('llm_call', { 
          phase: session.phase,
          messageCount: messages.length,
          tools: availableTools.map(t => t.function.name)
        });

        // 调用 LLM
        const response = await this.llm.chat({
          messages,
          tools: availableTools,
          systemPrompt
        });

        // 检查是否有工具调用
        if (response.tool_calls && response.tool_calls.length > 0) {
          session.memory.addAssistantWithToolCalls(response.content, response.tool_calls);

          // 执行工具调用
          for (const toolCall of response.tool_calls) {
            const toolName = toolCall.function.name;
            let args;
            
            try {
              args = JSON.parse(toolCall.function.arguments);
            } catch (e) {
              args = {};
            }

            // 检查代码生成次数限制
            if (toolName === 'generate_tool_code') {
              generateCount++;
              if (generateCount > maxGenerateCount && session.generatedCode) {
                emit('tool_result', { 
                  tool: toolName, 
                  result: { 
                    success: true, 
                    message: `已达到最大生成次数(${maxGenerateCount}次)`,
                    code: session.generatedCode,
                    ...session.generatedTool
                  }, 
                  success: true 
                });
                session.memory.addToolResult(toolCall.id, {
                  success: true,
                  message: '已达到最大生成次数，请使用已有代码',
                  code: session.generatedCode
                });
                continue;
              }
            }

            emit('tool_call', { tool: toolName, args, phase: session.phase });

            // 执行工具
            const result = await this.tools.execute(toolName, args, {
              llm: this.llm,
              mainServiceUrl: this.mainServiceUrl,
              taskId
            });

            emit('tool_result', { tool: toolName, result, success: !result.error });

            // 处理不同工具的结果
            await this.handleToolResult(session, toolName, result, emit, taskId);

            session.memory.addToolResult(toolCall.id, result);
          }
        } else {
          // 无工具调用，返回最终结果
          session.memory.addMessage('assistant', response.content);
          session.status = 'completed';
          session.phase = Phase.COMPLETE;

          // 解析工具信息
          const toolInfo = this.parseToolInfo(response.content);
          if (toolInfo) {
            session.generatedTool = toolInfo.tool;
            session.generatedCode = toolInfo.html;
          }

          // 确保预览文件已写入
          if (session.generatedCode && session.generatedTool) {
            await this.ensurePreviewWritten(session, taskId, emit);
          }

          emit('phase_change', { phase: Phase.COMPLETE, message: '任务完成' });
          emit('final_response', { 
            content: response.content,
            tool: session.generatedTool,
            code: session.generatedCode,
            plan: session.plan,
            previewPath: session.previewPath
          });

          return {
            success: true,
            content: response.content,
            tool: session.generatedTool,
            code: session.generatedCode,
            plan: session.plan,
            previewPath: session.previewPath
          };
        }
      }

      // 超过最大迭代次数
      session.status = 'failed';
      session.result = '超过最大推理次数限制';
      emit('error', { content: session.result });
      return { success: false, error: session.result };

    } catch (err) {
      session.status = 'failed';
      session.result = err.message;
      emit('error', { content: err.message });
      return { success: false, error: err.message };
    }
  }

  /**
   * 根据阶段获取可用工具
   */
  getToolsForPhase(phase) {
    const allTools = this.tools.getDefinitions();
    
    switch (phase) {
      case Phase.PLAN:
        // Plan 阶段只能调用 plan_tool
        return allTools.filter(t => t.function.name === 'plan_tool');
      
      case Phase.GENERATE:
        // Generate 阶段可以生成代码
        return allTools.filter(t => ['generate_tool_code'].includes(t.function.name));
      
      case Phase.VALIDATE:
      case Phase.FIX:
        // Validate 和 Fix 阶段可以重新生成
        return allTools.filter(t => ['generate_tool_code'].includes(t.function.name));
      
      default:
        return allTools.filter(t => !['validate_code', 'review_code', 'write_preview_file'].includes(t.function.name));
    }
  }

  /**
   * 处理工具执行结果
   */
  async handleToolResult(session, toolName, result, emit, taskId) {
    const autoContext = {
      llm: this.llm,
      mainServiceUrl: this.mainServiceUrl,
      taskId
    };

    // Plan 工具 - 记录计划，进入 Generate 阶段
    if (toolName === 'plan_tool' && result.success && result.plan) {
      session.plan = result.plan;
      session.phase = Phase.GENERATE;
      emit('phase_change', { 
        phase: Phase.GENERATE, 
        message: `计划已制定: ${result.plan.toolName}`,
        plan: result.plan
      });
    }

    // 代码生成工具 - 执行并行验证
    if (toolName === 'generate_tool_code' && result.success && result.code) {
      session.generatedCode = result.code;
      session.generatedTool = {
        id: result.toolId,
        name: result.toolName,
        icon: result.icon,
        color: result.color,
        desc: result.desc || ''
      };
      session.phase = Phase.VALIDATE;

      emit('phase_change', { 
        phase: Phase.VALIDATE, 
        message: '验证代码中...' 
      });

      // ===== 并行执行：写入预览 + 语法验证 =====
      emit('tool_call', { tool: 'validate_code (并行)', args: { code: '(语法验证)' } });
      emit('tool_call', { tool: 'write_preview_file (并行)', args: { taskId, toolId: result.toolId } });

      const [validateResult, previewResult] = await Promise.all([
        this.tools.execute('validate_code', { code: result.code }, autoContext),
        this.tools.execute('write_preview_file', { 
          taskId, 
          code: result.code, 
          toolId: result.toolId 
        }, autoContext)
      ]);

      emit('tool_result', { tool: 'validate_code', result: validateResult, success: validateResult.valid });
      emit('tool_result', { tool: 'write_preview_file', result: previewResult, success: previewResult.success });

      if (previewResult.success) {
        result.previewPath = previewResult.previewPath;
        session.previewPath = previewResult.previewPath;
      }

      // ===== LLM 审核 =====
      emit('tool_call', { tool: 'review_code', args: { code: '(LLM 智能审核)' } });
      const reviewResult = await this.tools.execute('review_code', { 
        code: result.code 
      }, autoContext);
      emit('tool_result', { tool: 'review_code', result: reviewResult, success: reviewResult.passed });

      // 综合判断
      const hasValidationErrors = !validateResult.valid;
      const hasReviewIssues = !reviewResult.passed && reviewResult.issues?.length > 0;

      if (hasValidationErrors || hasReviewIssues) {
        session.phase = Phase.FIX;
        result.needFix = true;
        const allIssues = [
          ...(validateResult.errors || []),
          ...(reviewResult.issues || [])
        ];
        result.fixHint = `代码验证/审核未通过，问题：${allIssues.slice(0, 5).join('; ')}。请根据计划中的功能特性修复后重新生成。`;
        
        emit('phase_change', { 
          phase: Phase.FIX, 
          message: '需要修复代码',
          issues: allIssues
        });
      } else {
        session.phase = Phase.COMPLETE;
        result.needFix = false;
        
        emit('phase_change', { 
          phase: Phase.COMPLETE, 
          message: '验证通过' 
        });
      }

      result.validation = validateResult;
      result.review = reviewResult;
    }
  }

  /**
   * 确保预览文件已写入
   */
  async ensurePreviewWritten(session, taskId, emit) {
    if (session.previewPath) return; // 已写入

    const autoContext = {
      llm: this.llm,
      mainServiceUrl: this.mainServiceUrl,
      taskId
    };

    emit('tool_call', { tool: 'write_preview_file', args: { taskId, toolId: session.generatedTool.id } });
    const previewResult = await this.tools.execute('write_preview_file', { 
      taskId, 
      code: session.generatedCode, 
      toolId: session.generatedTool.id 
    }, autoContext);
    emit('tool_result', { tool: 'write_preview_file', result: previewResult, success: previewResult.success });

    if (previewResult.success) {
      session.previewPath = previewResult.previewPath;
    }
  }

  /**
   * 解析工具信息
   */
  parseToolInfo(content) {
    try {
      const match = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*"tool"[\s\S]*"html"[\s\S]*\}/);
      if (match) {
        const jsonStr = match[1] || match[0];
        return JSON.parse(jsonStr);
      }
    } catch (e) {
      // 解析失败
    }
    return null;
  }

  /**
   * 停止任务
   */
  stop(taskId) {
    const session = this.sessions.get(taskId);
    if (session) {
      session.status = 'stopped';
      this.addStep(taskId, { type: 'stopped', content: '用户停止任务' });
    }
  }

  /**
   * 清理会话
   */
  clearSession(taskId) {
    this.sessions.delete(taskId);
  }
}

module.exports = ToolboxAgent;
