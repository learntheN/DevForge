/**
 * 工具注册中心
 * 管理所有可用工具
 */

const planGenerator = require('./plan-generator');
const codeGenerator = require('./code-generator');
const codeReviewer = require('./code-reviewer');
const validateCode = require('./validate-code');
const writePreviewFile = require('./write-preview-file');
const fileWriter = require('./file-writer');
const toolRegister = require('./tool-register');

class ToolRegistry {
  constructor() {
    this.tools = new Map();
    
    // 注册所有工具（按执行顺序）
    this.register(planGenerator);      // 计划生成（首先调用）
    this.register(codeGenerator);      // 代码生成
    this.register(validateCode);       // 功能验证
    this.register(codeReviewer);       // LLM 智能审核
    this.register(writePreviewFile);   // 预览文件写入
    this.register(fileWriter);
    this.register(toolRegister);
  }

  /**
   * 注册工具
   */
  register(tool) {
    this.tools.set(tool.name, tool);
  }

  /**
   * 获取工具定义（用于发送给 LLM）
   * 返回 OpenAI 工具格式
   */
  getDefinitions() {
    return Array.from(this.tools.values()).map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
  }

  /**
   * 执行工具
   */
  async execute(toolName, args, context) {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return { error: `工具 "${toolName}" 不存在` };
    }
    
    try {
      console.log(`[Tool] 执行工具: ${toolName}`);
      console.log(`[Tool] 参数:`, JSON.stringify(args, null, 2).slice(0, 200));
      
      const result = await tool.execute(args, context);
      
      console.log(`[Tool] 结果:`, JSON.stringify(result, null, 2).slice(0, 200));
      return result;
    } catch (err) {
      console.error(`[Tool] 执行失败:`, err);
      return { error: err.message };
    }
  }

  /**
   * 获取所有工具名称
   */
  getToolNames() {
    return Array.from(this.tools.keys());
  }
}

module.exports = ToolRegistry;
