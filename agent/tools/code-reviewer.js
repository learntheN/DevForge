/**
 * 代码审查工具（LLM 智能审核版）
 * 使用大模型审核生成的代码是否符合规范
 */

module.exports = {
  name: 'review_code',
  description: '使用 LLM 智能审查生成的工具代码是否符合 Dev Toolbox 规范',
  parameters: {
    type: 'object',
    properties: {
      code: { 
        type: 'string', 
        description: '要审查的 HTML 代码' 
      }
    },
    required: ['code']
  },

  async execute({ code }, context) {
    // 空值检查
    if (!code || typeof code !== 'string') {
      return {
        passed: false,
        issues: ['未提供代码内容'],
        warnings: [],
        suggestions: [],
        summary: '未提供有效的代码内容'
      };
    }

    const { llm } = context;

    // 如果没有 LLM 实例，回退到规则检查
    if (!llm) {
      console.warn('[review_code] 未提供 LLM 实例，使用规则检查模式');
      return fallbackRuleCheck(code);
    }

    try {
      // 构建审核提示词
      const reviewPrompt = buildReviewPrompt(code);

      // 调用 LLM 进行审核
      const response = await llm.chat({
        messages: [{ role: 'user', content: reviewPrompt }],
        systemPrompt: '你是一个专业的前端代码审查专家，负责审核 HTML 工具代码的质量和规范性。请严格按照要求返回 JSON 格式结果。'
      });

      // 解析 LLM 返回的结果
      const result = parseReviewResult(response.content);
      
      return {
        passed: result.passed,
        issues: result.issues || [],
        warnings: result.warnings || [],
        suggestions: result.suggestions || [],
        summary: result.summary || (result.passed ? '代码审查通过' : '代码审查未通过'),
        reviewedBy: 'llm'
      };

    } catch (err) {
      console.error('[review_code] LLM 审核失败，回退到规则检查:', err.message);
      // LLM 调用失败时回退到规则检查
      const fallbackResult = fallbackRuleCheck(code);
      fallbackResult.reviewedBy = 'fallback';
      fallbackResult.llmError = err.message;
      return fallbackResult;
    }
  }
};

/**
 * 构建审核提示词
 */
function buildReviewPrompt(code) {
  return `请审核以下 HTML 工具代码，检查是否符合 Dev Toolbox 规范。

## 审核要点

### 1. 必须项（不符合则 passed=false）
- DOCTYPE 声明：必须有 <!DOCTYPE html>
- HTML lang 属性：必须有 lang="zh-CN" 或类似
- UTF-8 字符集：必须声明 charset="UTF-8"
- 本地资源：
  - Tailwind CSS 必须使用 /assets/js/tailwind.js
  - FontAwesome 必须使用 /assets/css/fontawesome.min.css
  - 不能使用 CDN 资源（cdn.*, unpkg.*, cdnjs.*）
- 防闪烁样式：
  - 必须有 body { opacity: 0 }
  - 必须有 body.ready { opacity: 1 }
  - 必须有 document.body.classList.add('ready')
- DOMContentLoaded：必须监听此事件

### 2. 代码质量（不符合添加到 warnings）
- 是否有未使用的变量
- 是否有明显的逻辑错误
- 是否有安全风险（eval、innerHTML 等）
- 代码是否清晰易读

### 3. 用户体验（不符合添加到 suggestions）
- 是否有页面标题
- 是否有 Toast 提示
- 交互反馈是否完善
- 样式是否美观

## 待审核代码

\`\`\`html
${code}
\`\`\`

## 返回格式

请严格返回以下 JSON 格式（不要有其他文字）：

\`\`\`json
{
  "passed": true/false,
  "issues": ["必须修复的问题1", "必须修复的问题2"],
  "warnings": ["建议修复的问题1"],
  "suggestions": ["优化建议1"],
  "summary": "简短的审核结论"
}
\`\`\``;
}

/**
 * 解析 LLM 返回的审核结果
 */
function parseReviewResult(content) {
  try {
    // 尝试提取 JSON
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                     content.match(/\{[\s\S]*"passed"[\s\S]*\}/);
    
    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(jsonStr);
    }

    // 如果没有找到 JSON，尝试直接解析整个内容
    return JSON.parse(content);
  } catch (e) {
    // 解析失败，返回一个保守的结果
    return {
      passed: false,
      issues: ['无法解析 LLM 审核结果'],
      warnings: [],
      suggestions: [],
      summary: 'LLM 审核结果解析失败，请检查代码'
    };
  }
}

/**
 * 回退规则检查（当 LLM 不可用时）
 */
function fallbackRuleCheck(code) {
  const issues = [];
  const warnings = [];

  // 必须检查项
  const requiredChecks = [
    {
      check: () => code.includes('<!DOCTYPE html>') || code.includes('<!doctype html>'),
      error: '缺少 DOCTYPE 声明'
    },
    {
      check: () => code.includes('<html') && (code.includes('lang=') || code.includes('lang =')),
      error: '缺少 html lang 属性'
    },
    {
      check: () => code.toLowerCase().includes('charset') && code.toLowerCase().includes('utf-8'),
      error: '缺少 UTF-8 字符集声明'
    },
    {
      check: () => code.includes('/assets/js/tailwind.js'),
      error: '未使用本地 Tailwind 资源，应使用 /assets/js/tailwind.js'
    },
    {
      check: () => code.includes('/assets/css/fontawesome'),
      error: '未使用本地 FontAwesome 资源'
    },
    {
      check: () => code.includes('opacity: 0') || code.includes('opacity:0'),
      error: '缺少防闪烁样式 body { opacity: 0 }'
    },
    {
      check: () => code.includes('.ready') && code.includes('opacity'),
      error: '缺少 body.ready 样式定义'
    },
    {
      check: () => code.includes("classList.add") && code.includes("ready"),
      error: '缺少 document.body.classList.add("ready") 调用'
    },
    {
      check: () => code.includes('DOMContentLoaded'),
      error: '缺少 DOMContentLoaded 事件监听'
    }
  ];

  // 警告检查项
  const warningChecks = [
    {
      check: () => code.includes('<title>'),
      warning: '建议添加页面标题'
    },
    {
      check: () => !code.includes('cdn.') && !code.includes('cdnjs.') && !code.includes('unpkg.'),
      warning: '检测到 CDN 资源引用，应使用本地资源'
    }
  ];

  // 执行必须检查
  for (const item of requiredChecks) {
    if (!item.check()) {
      issues.push(item.error);
    }
  }

  // 执行警告检查
  for (const item of warningChecks) {
    if (!item.check()) {
      warnings.push(item.warning);
    }
  }

  // 安全检查
  if (code.includes('eval(')) {
    issues.push('检测到 eval() 使用，存在安全风险');
  }

  const passed = issues.length === 0;

  return {
    passed,
    issues,
    warnings,
    suggestions: [],
    summary: passed 
      ? '代码审查通过' + (warnings.length > 0 ? `，但有 ${warnings.length} 个建议` : '')
      : `发现 ${issues.length} 个问题需要修复`
  };
}
