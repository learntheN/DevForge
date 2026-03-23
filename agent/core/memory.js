/**
 * 对话记忆管理
 */

class Memory {
  constructor() {
    this.messages = [];
    this.toolResults = new Map();
  }

  /**
   * 添加消息
   */
  addMessage(role, content) {
    this.messages.push({ role, content });
  }

  /**
   * 添加工具调用结果
   */
  addToolResult(toolCallId, result) {
    this.toolResults.set(toolCallId, result);
    this.messages.push({
      role: 'tool',
      tool_call_id: toolCallId,
      content: typeof result === 'string' ? result : JSON.stringify(result)
    });
  }

  /**
   * 添加带工具调用的助手消息
   */
  addAssistantWithToolCalls(content, toolCalls) {
    this.messages.push({
      role: 'assistant',
      content: content || '',
      tool_calls: toolCalls
    });
  }

  /**
   * 获取所有消息
   */
  getMessages() {
    return [...this.messages];
  }

  /**
   * 获取最近 N 条消息
   */
  getRecentMessages(n) {
    return this.messages.slice(-n);
  }

  /**
   * 清空记忆
   */
  clear() {
    this.messages = [];
    this.toolResults.clear();
  }

  /**
   * 导出记忆（用于持久化）
   */
  export() {
    return {
      messages: this.messages,
      toolResults: Object.fromEntries(this.toolResults)
    };
  }

  /**
   * 导入记忆（从持久化恢复）
   */
  import(data) {
    this.messages = data.messages || [];
    this.toolResults = new Map(Object.entries(data.toolResults || {}));
  }
}

module.exports = Memory;
