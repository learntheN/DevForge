/**
 * 代码生成工具
 * 根据需求生成工具页面代码
 */

const fs = require('fs');
const path = require('path');

// 加载 SKILL 规范
let SKILL_CONTENT = '';
const skillPath = path.join(__dirname, '..', '..', '.qoder', 'skills', 'dev-toolbox-generator.md');
if (fs.existsSync(skillPath)) {
  SKILL_CONTENT = fs.readFileSync(skillPath, 'utf8');
}

module.exports = {
  name: 'generate_tool_code',
  description: '根据需求生成工具页面的完整 HTML 代码',
  parameters: {
    type: 'object',
    properties: {
      toolId: { type: 'string', description: '工具ID，如 color-picker' },
      toolName: { type: 'string', description: '工具名称，如 颜色选择器' },
      icon: { type: 'string', description: 'Font Awesome 图标，如 fa-palette' },
      color: { type: 'string', description: '主题色：blue/green/purple/orange/red/cyan' },
      requirements: { type: 'string', description: '功能需求描述' },
      fixIssues: { type: 'string', description: '需要修复的问题（可选，用于修复时传入）' }
    },
    required: ['toolId', 'toolName', 'requirements']
  },

  async execute({ toolId, toolName, icon, color, requirements, fixIssues }, context) {
    // 构建 prompt
    let prompt = `生成一个精简的工具页面 HTML 代码。

## 重要限制
- 代码总长度控制在 500 行以内
- 只实现核心功能，避免冗余代码
- 使用简洁的 CSS 类名，避免重复样式
- JS 代码要精简，避免过度封装

## SKILL 规范
${SKILL_CONTENT}

## 工具信息
- ID: ${toolId}
- 名称: ${toolName}
- 图标: ${icon || '自动选择'}
- 颜色: ${color || 'blue'}

## 功能需求
${requirements}

## 必须包含
1. <!DOCTYPE html> 开头
2. 防闪烁: body { opacity: 0 } 和 body.ready { opacity: 1; transition: opacity 0.3s }
3. 本地资源: /assets/js/tailwind.js, /assets/css/fontawesome.min.css
4. DOMContentLoaded 中调用 document.body.classList.add('ready')
5. Toast 提示功能

## 代码精简技巧
- 使用 Tailwind 内联类，减少自定义 CSS
- 合并相似函数，减少代码重复
- 只实现必要的交互，移除装饰性代码
- 使用简短的变量名和函数名

直接输出 HTML 代码，不要 markdown 包装。确保代码完整，包含 </body></html> 结束标签。`;

    // 如果有需要修复的问题，添加到 prompt
    if (fixIssues) {
      prompt += `\n\n## 需要修复的问题\n${fixIssues}\n\n请确保修复以上问题！`;
    }

    try {
      const result = await context.llm.generate({ prompt });
      const code = result.content;
      
      // 检查是否有内容返回
      if (!code) {
        console.error('[code-generator] LLM 返回空内容, result:', JSON.stringify(result));
        return {
          success: false,
          error: 'LLM 返回空内容，请重试'
        };
      }
      
      // 检查是否因 token 限制被截断
      if (result.finish_reason === 'length') {
        console.warn('[code-generator] LLM 输出被截断，代码可能不完整');
      }
      
      // 清理代码
      let cleanCode = code.trim();
      
      // 1. 尝试解析 JSON 格式（LLM 可能返回 JSON 对象）
      if (cleanCode.startsWith('{') || cleanCode.startsWith('```json')) {
        try {
          let jsonStr = cleanCode;
          // 提取 JSON 代码块
          if (cleanCode.includes('```json')) {
            const match = cleanCode.match(/```json\s*([\s\S]*?)\s*```/);
            if (match) jsonStr = match[1];
          }
          
          const parsed = JSON.parse(jsonStr);
          // 提取 HTML 代码字段（可能是 code, html, 或 content）
          if (parsed.code || parsed.html || parsed.content) {
            cleanCode = parsed.code || parsed.html || parsed.content;
            console.log('[code-generator] 从 JSON 中提取 HTML 代码，长度:', cleanCode.length);
          }
        } catch (e) {
          // JSON 解析失败，继续尝试其他方式
          console.log('[code-generator] JSON 解析失败，尝试其他方式');
        }
      }
      
      // 2. 处理 markdown 代码块
      if (cleanCode.includes('```html')) {
        const match = cleanCode.match(/```html\s*([\s\S]*?)\s*```/);
        if (match) cleanCode = match[1];
      } else if (cleanCode.includes('```')) {
        const match = cleanCode.match(/```\s*([\s\S]*?)\s*```/);
        if (match) cleanCode = match[1];
      }
      
      // 3. 确保以 DOCTYPE 开头（截取第一个 <!DOCTYPE 之前的内容）
      const htmlStart = cleanCode.indexOf('<!DOCTYPE');
      if (htmlStart > 0) {
        cleanCode = cleanCode.substring(htmlStart);
      } else if (htmlStart === -1) {
        // 如果没有 DOCTYPE，检查是否是代码片段被错误返回
        console.warn('[code-generator] 未找到 DOCTYPE，代码可能不完整');
      }
      cleanCode = cleanCode.trim();
      
      // 完整性检查：确保 HTML 结构完整
      const hasDoctype = cleanCode.toLowerCase().includes('<!doctype html>');
      const hasHtmlClose = cleanCode.includes('</html>');
      const hasBodyClose = cleanCode.includes('</body>');
      const hasScriptClose = !cleanCode.includes('<script') || cleanCode.includes('</script>');
      
      if (!hasDoctype || !hasHtmlClose || !hasBodyClose || !hasScriptClose) {
        console.warn('[code-generator] 代码可能不完整:', {
          hasDoctype, hasHtmlClose, hasBodyClose, hasScriptClose,
          codeLength: cleanCode.length
        });
        
        // 如果代码不完整，返回错误提示让 Agent 重试
        if (!hasHtmlClose || !hasBodyClose) {
          return {
            success: false,
            error: `生成的代码不完整（缺少 ${!hasHtmlClose ? '</html>' : ''} ${!hasBodyClose ? '</body>' : ''} 闭合标签），请重新生成`,
            partialCode: cleanCode.substring(0, 500) + '...'
          };
        }
      }
      
      return {
        success: true,
        toolId,
        toolName,
        icon: icon || 'fa-tools',
        color: color || 'blue',
        desc: requirements.slice(0, 50) + (requirements.length > 50 ? '...' : ''),
        code: cleanCode
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
