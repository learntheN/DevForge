/**
 * 计划生成工具
 * 分析用户需求，输出结构化的工具生成计划
 */

module.exports = {
  name: 'plan_tool',
  description: '分析用户需求，制定工具生成计划。必须首先调用此工具，确定工具的 ID、名称、图标、颜色和功能特性。',
  parameters: {
    type: 'object',
    properties: {
      toolId: { 
        type: 'string', 
        description: '工具ID，只能包含小写字母、数字、连字符，如 "json-formatter"' 
      },
      toolName: { 
        type: 'string', 
        description: '工具显示名称，如 "JSON 格式化"' 
      },
      icon: { 
        type: 'string', 
        description: 'Font Awesome 图标类名，如 "fa-code"、"fa-clock"' 
      },
      color: { 
        type: 'string', 
        description: '主题色，可选: blue, green, red, yellow, purple, pink, indigo, teal, orange, gray' 
      },
      desc: {
        type: 'string',
        description: '工具简短描述，一句话说明功能'
      },
      features: {
        type: 'array',
        items: { type: 'string' },
        description: '工具需要实现的核心功能特性列表（最多 3-5 个，保持精简）'
      },
      apiNeeds: {
        type: 'array',
        items: { type: 'string' },
        description: '需要后端 API 支持的功能，如 "数据持久化"、"文件读写"，无则为空数组'
      },
      uiLayout: {
        type: 'string',
        description: 'UI 布局描述，如 "单栏居中"、"左右分栏"、"上下分栏"'
      }
    },
    required: ['toolId', 'toolName', 'icon', 'color', 'desc', 'features']
  },

  async execute(args, context) {
    const { toolId, toolName, icon, color, desc, features, apiNeeds, uiLayout } = args;
    
    // 验证 toolId 格式
    if (!/^[a-z0-9-]+$/.test(toolId)) {
      return {
        success: false,
        error: '工具ID只能包含小写字母、数字、连字符'
      };
    }
    
    // 验证 color
    const validColors = ['blue', 'green', 'red', 'yellow', 'purple', 'pink', 'indigo', 'teal', 'orange', 'gray'];
    if (!validColors.includes(color)) {
      return {
        success: false,
        error: `颜色必须是: ${validColors.join(', ')}`
      };
    }
    
    // 返回结构化的计划
    const plan = {
      toolId,
      toolName,
      icon: icon || 'fa-tools',
      color: color || 'gray',
      desc: desc || '',
      features: features || [],
      apiNeeds: apiNeeds || [],
      uiLayout: uiLayout || '单栏居中',
      timestamp: new Date().toISOString()
    };
    
    console.log('[Plan] 生成计划:', JSON.stringify(plan, null, 2));
    
    return {
      success: true,
      plan,
      message: `计划已制定: ${toolName} (${toolId})`
    };
  }
};
