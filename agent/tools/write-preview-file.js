/**
 * 预览文件写入工具
 * 代码生成后写入预览文件，支持历史版本
 * 
 * 目录结构:
 * data/ai/previews/{taskId}/
 *   ├── latest.html      # 最新预览
 *   └── history/         # 历史预览
 *       └── {timestamp}.html
 */

const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'write_preview_file',
  description: '将生成的代码写入预览文件，供前端实时预览',
  parameters: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: '任务 ID'
      },
      code: {
        type: 'string',
        description: '要写入的 HTML 代码'
      },
      toolId: {
        type: 'string',
        description: '工具 ID（可选）'
      }
    },
    required: ['taskId', 'code']
  },

  async execute({ taskId, code, toolId }, context) {
    // 参数校验
    if (!taskId || typeof taskId !== 'string') {
      return {
        success: false,
        error: '缺少有效的任务 ID'
      };
    }

    if (!code || typeof code !== 'string') {
      return {
        success: false,
        error: '缺少有效的代码内容'
      };
    }

    try {
      // 新路径: data/ai/previews/{taskId}/
      const baseDir = path.join(__dirname, '..', '..', 'data', 'ai', 'previews', taskId);
      const historyDir = path.join(baseDir, 'history');
      const latestPath = path.join(baseDir, 'latest.html');
      
      console.log('[write_preview_file] 任务ID:', taskId);
      console.log('[write_preview_file] 预览目录:', baseDir);
      console.log('[write_preview_file] 代码长度:', code.length);

      // 确保目录存在
      if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
      }
      if (!fs.existsSync(historyDir)) {
        fs.mkdirSync(historyDir, { recursive: true });
      }

      // 如果已存在 latest.html，先备份到 history
      if (fs.existsSync(latestPath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const historyPath = path.join(historyDir, `${timestamp}.html`);
        fs.copyFileSync(latestPath, historyPath);
        console.log('[write_preview_file] 备份历史版本:', historyPath);
      }

      // 写入最新预览文件
      fs.writeFileSync(latestPath, code, 'utf8');
      
      // 验证写入
      const stats = fs.statSync(latestPath);
      console.log('[write_preview_file] 写入成功，文件大小:', stats.size);

      return {
        success: true,
        message: '预览文件已写入',
        previewPath: `/api/ai/previews/${taskId}/latest`,
        absolutePath: latestPath,
        toolId: toolId || null
      };
    } catch (err) {
      console.error('[write_preview_file] 写入失败:', err);
      return {
        success: false,
        error: `写入预览文件失败: ${err.message}`
      };
    }
  }
};
