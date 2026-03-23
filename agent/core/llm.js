/**
 * LLM 调用封装
 * 支持 OpenAI 兼容 API（DeepSeek 等）
 */

class LLMClient {
  constructor(config) {
    this.endpoint = config.endpoint || 'https://api.deepseek.com/v1/chat/completions';
    this.apiKey = config.apiKey;
    this.model = config.model || 'deepseek-chat';
    this.temperature = config.temperature || 0.7;
  }

  /**
   * 聊天接口 - 支持工具调用
   */
  async chat({ messages, tools = null, systemPrompt = '' }) {
    const requestMessages = [];
    
    if (systemPrompt) {
      requestMessages.push({ role: 'system', content: systemPrompt });
    }
    
    requestMessages.push(...messages);

    const body = {
      model: this.model,
      messages: requestMessages,
      temperature: this.temperature,
      max_tokens: 8192  // DeepSeek API 上限为 8192
    };

    // 如果有工具定义，添加到请求
    // 工具定义已经是 OpenAI 格式 { type: 'function', function: { name, description, parameters } }
    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    try {
      // 设置超时（生成长代码可能需要较长时间）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 分钟超时
      
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      const choice = data.choices[0];
      const message = choice.message;

      // 检查是否因 token 限制被截断
      if (choice.finish_reason === 'length') {
        console.warn('[LLM] 输出因 token 限制被截断，finish_reason: length');
      }

      return {
        content: message.content || '',
        tool_calls: message.tool_calls || null,
        finish_reason: choice.finish_reason
      };
    } catch (err) {
      if (err.name === 'AbortError') {
        console.error('LLM 调用超时（180秒）');
        throw new Error('API 请求超时，请稍后重试');
      }
      console.error('LLM 调用失败:', err.message || err);
      throw err;
    }
  }

  /**
   * 简单生成接口
   */
  async generate({ prompt, systemPrompt = '' }) {
    const result = await this.chat({
      messages: [{ role: 'user', content: prompt }],
      systemPrompt
    });
    // 返回完整结果，包含 content 和 finish_reason
    return result;
  }
}

module.exports = LLMClient;
