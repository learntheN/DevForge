/**
 * 工具注册工具
 * 调用主服务 API 注册工具到列表
 */

module.exports = {
  name: 'register_tool',
  description: '将工具注册到 Dev Toolbox 工具列表（调用主服务 API）',
  parameters: {
    type: 'object',
    properties: {
      toolId: { 
        type: 'string', 
        description: '工具ID' 
      },
      toolName: { 
        type: 'string', 
        description: '工具显示名称' 
      },
      icon: { 
        type: 'string', 
        description: 'Font Awesome 图标类名' 
      },
      color: { 
        type: 'string', 
        description: '主题色' 
      },
      desc: { 
        type: 'string', 
        description: '工具描述' 
      }
    },
    required: ['toolId', 'toolName']
  },

  async execute({ toolId, toolName, icon, color, desc }, context) {
    try {
      const response = await fetch(`${context.mainServiceUrl}/api/tools/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: {
            id: toolId,
            name: toolName,
            icon: icon || 'fa-tools',
            color: color || 'gray',
            desc: desc || ''
          }
        })
      });

      const data = await response.json();
      
      if (data.success) {
        return {
          success: true,
          message: `工具 "${toolName}" 已注册成功`
        };
      } else {
        return {
          success: false,
          error: data.message
        };
      }
    } catch (err) {
      return {
        success: false,
        error: `注册工具失败: ${err.message}`
      };
    }
  }
};
