/**
 * Dev Toolbox Agent 服务
 * 独立运行的智能 Agent，处理工具生成任务
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const ToolboxAgent = require('./core/agent');
const ToolRegistry = require('./tools');

const app = express();
const PORT = process.env.AGENT_PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 加载配置
function loadConfig() {
  const configPath = path.join(__dirname, '..', 'data', 'ai', 'config.json');
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (err) {
    console.error('加载配置失败:', err);
  }
  // 默认配置
  return {
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    apiKey: '',
    model: 'deepseek-chat',
    temperature: 0.7
  };
}

// 初始化 Agent
const config = loadConfig();
const tools = new ToolRegistry();
const agent = new ToolboxAgent(config, tools);

console.log('Agent 配置:', {
  endpoint: config.endpoint,
  model: config.model,
  hasApiKey: !!config.apiKey
});

// ========== API 路由 ==========

/**
 * 启动 Agent 处理任务
 * POST /agent/run
 * Body: { taskId, message }
 */
app.post('/agent/run', async (req, res) => {
  const { taskId, message } = req.body;
  
  if (!taskId || !message) {
    return res.json({ success: false, error: '缺少 taskId 或 message' });
  }

  // 检查配置
  if (!config.apiKey) {
    return res.json({ success: false, error: '未配置 API Key，请先在主服务中配置' });
  }

  console.log(`\n[Agent] 开始处理任务: ${taskId}`);
  console.log(`[Agent] 用户消息: ${message.slice(0, 100)}...`);

  try {
    const result = await agent.run(taskId, message);
    console.log(`[Agent] 任务完成: ${taskId}`);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error(`[Agent] 任务失败: ${taskId}`, err);
    res.json({ success: false, error: err.message });
  }
});

/**
 * 流式执行 Agent 任务 (SSE)
 * POST /agent/run/stream
 * Body: { taskId, message }
 */
app.post('/agent/run/stream', async (req, res) => {
  const { taskId, message } = req.body;
  
  if (!taskId || !message) {
    return res.status(400).json({ success: false, error: '缺少 taskId 或 message' });
  }

  // 检查配置
  if (!config.apiKey) {
    return res.status(400).json({ success: false, error: '未配置 API Key' });
  }

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 禁用 nginx 缓冲

  console.log(`\n[Agent:SSE] 开始流式处理任务: ${taskId}`);

  // 发送 SSE 事件
  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // 进度回调
  const onProgress = (progress) => {
    sendEvent(progress.event, progress);
  };

  try {
    sendEvent('start', { taskId, message: '开始处理...' });
    
    const result = await agent.run(taskId, message, onProgress);
    
    sendEvent('complete', { success: true, ...result });
    console.log(`[Agent:SSE] 任务完成: ${taskId}`);
  } catch (err) {
    console.error(`[Agent:SSE] 任务失败: ${taskId}`, err);
    sendEvent('error', { success: false, error: err.message });
  } finally {
    res.end();
  }
});

/**
 * 获取任务状态
 * GET /agent/status/:taskId
 */
app.get('/agent/status/:taskId', (req, res) => {
  const { taskId } = req.params;
  const status = agent.getStatus(taskId);
  res.json({ success: true, data: status });
});

/**
 * 停止任务
 * POST /agent/stop/:taskId
 */
app.post('/agent/stop/:taskId', (req, res) => {
  const { taskId } = req.params;
  agent.stop(taskId);
  res.json({ success: true, message: '任务已停止' });
});

/**
 * 获取可用工具列表
 * GET /agent/tools
 */
app.get('/agent/tools', (req, res) => {
  res.json({
    success: true,
    data: tools.getDefinitions()
  });
});

/**
 * 重新加载配置
 * POST /agent/reload-config
 */
app.post('/agent/reload-config', (req, res) => {
  const newConfig = loadConfig();
  Object.assign(config, newConfig);
  agent.llm.endpoint = newConfig.endpoint;
  agent.llm.apiKey = newConfig.apiKey;
  agent.llm.model = newConfig.model;
  agent.llm.temperature = newConfig.temperature || 0.7;
  
  res.json({ 
    success: true, 
    message: '配置已重新加载',
    data: {
      endpoint: newConfig.endpoint,
      model: newConfig.model,
      hasApiKey: !!newConfig.apiKey
    }
  });
});

/**
 * 健康检查
 * GET /agent/health
 */
app.get('/agent/health', (req, res) => {
  res.json({
    success: true,
    status: 'running',
    tools: tools.getToolNames(),
    config: {
      endpoint: config.endpoint,
      model: config.model,
      hasApiKey: !!config.apiKey
    }
  });
});

// 启动服务
app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  Dev Toolbox Agent 服务已启动`);
  console.log(`  端口: ${PORT}`);
  console.log(`  地址: http://localhost:${PORT}`);
  console.log(`========================================\n`);
  console.log('可用工具:', tools.getToolNames().join(', '));
});
