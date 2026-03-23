/**
 * 文件写入工具
 * 调用主服务 API 写入工具文件
 */

module.exports = {
  name: 'write_tool_file',
  description: '将生成的工具代码写入文件（调用主服务 API）',
  parameters: {
    type: 'object',
    properties: {
      toolId: { 
        type: 'string', 
        description: '工具ID' 
      },
      code: { 
        type: 'string', 
        description: 'HTML 代码内容' 
      }
    },
    required: ['toolId', 'code']
  },

  async execute({ toolId, code }, context) {
    // 校验代码内容
    if (!code || typeof code !== 'string') {
      return { success: false, error: '未提供有效的代码内容' };
    }
    
    // 确保是有效的 HTML 代码（必须包含基本 HTML 结构）
    if (!code.includes('<!DOCTYPE') && !code.includes('<html')) {
      return { 
        success: false, 
        error: '代码内容无效，必须是完整的 HTML 代码（以 <!DOCTYPE html> 开头）' 
      };
    }

    try {
      const response = await fetch(`${context.mainServiceUrl}/api/tools/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId,
          html: code
        })
      });

      const data = await response.json();
      
      if (data.success) {
        return {
          success: true,
          message: `工具文件已创建: /tools/${toolId}.html`,
          path: data.data?.path
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
        error: `写入文件失败: ${err.message}`
      };
    }
  }
};
