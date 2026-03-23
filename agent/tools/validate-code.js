/**
 * 代码验证工具
 * 验证生成的代码是否有效：HTML 语法、JS 语法、功能可用性
 */

module.exports = {
  name: 'validate_code',
  description: '验证生成的工具代码是否有效（HTML/JS语法、功能可用性）',
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: '要验证的 HTML 代码'
      }
    },
    required: ['code']
  },

  async execute({ code }, context) {
    // 空值检查
    if (!code || typeof code !== 'string') {
      return {
        valid: false,
        htmlValid: false,
        jsValid: false,
        functionalValid: false,
        errors: ['未提供代码内容'],
        summary: '未提供有效的代码内容'
      };
    }

    const errors = [];
    const warnings = [];

    // ========== 1. HTML 语法验证 ==========
    const htmlChecks = {
      hasDoctype: /<!DOCTYPE\s+html>/i.test(code),
      hasHtmlTag: /<html[\s>]/i.test(code) && /<\/html>/i.test(code),
      hasHead: /<head[\s>]/i.test(code) && /<\/head>/i.test(code),
      hasBody: /<body[\s>]/i.test(code) && /<\/body>/i.test(code),
      hasCharset: /charset\s*=\s*["']?utf-8["']?/i.test(code),
      tagsBalanced: checkTagBalance(code)
    };

    if (!htmlChecks.hasDoctype) errors.push('缺少 DOCTYPE 声明');
    if (!htmlChecks.hasHtmlTag) errors.push('缺少 html 标签');
    if (!htmlChecks.hasHead) errors.push('缺少 head 标签');
    if (!htmlChecks.hasBody) errors.push('缺少 body 标签');
    if (!htmlChecks.hasCharset) warnings.push('建议添加 UTF-8 字符集声明');
    if (!htmlChecks.tagsBalanced.valid) {
      errors.push(`HTML 标签不匹配: ${htmlChecks.tagsBalanced.message}`);
    }

    const htmlValid = errors.length === 0;

    // ========== 2. JavaScript 语法验证 ==========
    const jsErrors = [];
    
    // 提取 script 标签内容
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    let scriptIndex = 0;
    
    while ((match = scriptRegex.exec(code)) !== null) {
      scriptIndex++;
      const jsCode = match[1]?.trim() || '';
      if (jsCode) {
        const syntaxCheck = checkJsSyntax(jsCode);
        if (!syntaxCheck.valid) {
          jsErrors.push(`Script #${scriptIndex}: ${syntaxCheck.error}`);
        }
      }
    }

    // 检查内联事件处理器
    const inlineHandlers = code.match(/on\w+\s*=\s*["'][^"']+["']/gi) || [];
    for (const handler of inlineHandlers) {
      const jsMatch = handler.match(/=\s*["']([^"']+)["']/);
      if (jsMatch) {
        const inlineJs = jsMatch[1];
        // 简单检查明显的语法错误
        if (inlineJs.includes('((') || inlineJs.includes('))') || inlineJs.includes(';;')) {
          jsErrors.push(`内联事件可能有语法问题: ${handler.substring(0, 50)}`);
        }
      }
    }

    if (jsErrors.length > 0) {
      errors.push(...jsErrors);
    }

    const jsValid = jsErrors.length === 0;

    // ========== 3. 功能可用性验证 ==========
    const functionalChecks = {
      hasInteractiveElements: /<(button|input|select|textarea|a\s)/i.test(code),
      hasEventListeners: /addEventListener|onclick|onchange|onsubmit|on\w+\s*=/i.test(code),
      hasFunctions: /function\s+\w+|const\s+\w+\s*=\s*\(|=>\s*{/i.test(code),
      hasDomManipulation: /getElementById|querySelector|innerHTML|textContent|appendChild/i.test(code)
    };

    // 功能性警告（不阻塞）
    if (!functionalChecks.hasInteractiveElements) {
      warnings.push('未检测到交互元素（按钮、输入框等）');
    }
    if (!functionalChecks.hasEventListeners && !functionalChecks.hasFunctions) {
      warnings.push('未检测到事件监听或函数定义');
    }

    // 功能性视为有效（只要没有致命错误）
    const functionalValid = functionalChecks.hasInteractiveElements || 
                           functionalChecks.hasEventListeners || 
                           functionalChecks.hasFunctions;

    // ========== 汇总结果 ==========
    const valid = htmlValid && jsValid;

    return {
      valid,
      htmlValid,
      jsValid,
      functionalValid,
      errors,
      warnings,
      details: {
        html: htmlChecks,
        functional: functionalChecks
      },
      summary: valid 
        ? '代码验证通过' + (warnings.length > 0 ? `，有 ${warnings.length} 个建议` : '')
        : `验证失败: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`
    };
  }
};

/**
 * 检查 HTML 标签是否平衡
 */
function checkTagBalance(html) {
  const tagStack = [];
  // 自闭合标签
  const selfClosing = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr'
  ]);

  // 匹配标签
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*\/?>/g;
  let match;

  while ((match = tagRegex.exec(html)) !== null) {
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();

    // 跳过自闭合标签
    if (selfClosing.has(tagName) || fullTag.endsWith('/>')) {
      continue;
    }

    // 跳过注释、DOCTYPE、script/style 内容
    if (fullTag.startsWith('<!') || fullTag.startsWith('<?')) {
      continue;
    }

    if (fullTag.startsWith('</')) {
      // 闭合标签
      if (tagStack.length === 0) {
        return { valid: false, message: `多余的闭合标签 </${tagName}>` };
      }
      const lastTag = tagStack.pop();
      if (lastTag !== tagName) {
        return { valid: false, message: `标签不匹配: <${lastTag}> 与 </${tagName}>` };
      }
    } else {
      // 开启标签
      tagStack.push(tagName);
    }
  }

  if (tagStack.length > 0) {
    return { valid: false, message: `未闭合的标签: <${tagStack[tagStack.length - 1]}>` };
  }

  return { valid: true };
}

/**
 * 检查 JavaScript 语法
 */
function checkJsSyntax(jsCode) {
  // 常见语法错误检查
  const errors = [];

  // 1. 括号平衡
  const brackets = { '(': ')', '[': ']', '{': '}' };
  const stack = [];
  let inString = false;
  let stringChar = '';
  let inComment = false;
  let inMultiComment = false;

  for (let i = 0; i < jsCode.length; i++) {
    const char = jsCode[i];
    const nextChar = jsCode[i + 1];
    const prevChar = jsCode[i - 1];

    // 处理字符串
    if (!inComment && !inMultiComment) {
      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (inString && char === stringChar) {
          inString = false;
        } else if (!inString) {
          inString = true;
          stringChar = char;
        }
      }
    }

    // 处理注释
    if (!inString) {
      if (char === '/' && nextChar === '/') {
        inComment = true;
      } else if (char === '/' && nextChar === '*') {
        inMultiComment = true;
      } else if (char === '\n') {
        inComment = false;
      } else if (char === '*' && nextChar === '/') {
        inMultiComment = false;
        i++; // 跳过 /
      }
    }

    // 检查括号
    if (!inString && !inComment && !inMultiComment) {
      if (brackets[char]) {
        stack.push(char);
      } else if (Object.values(brackets).includes(char)) {
        const expected = stack.pop();
        if (brackets[expected] !== char) {
          return { valid: false, error: `括号不匹配: 期望 ${brackets[expected] || '无'} 但得到 ${char}` };
        }
      }
    }
  }

  if (stack.length > 0) {
    return { valid: false, error: `括号未闭合: ${stack.join(', ')}` };
  }

  // 2. 常见语法错误模式
  const syntaxPatterns = [
    { pattern: /\bfunction\s*\(\s*\)\s*\)/, error: '函数定义语法错误' },
    { pattern: /\bif\s*\([^)]*\)\s*\)/, error: 'if 语句语法错误' },
    { pattern: /,\s*\)/, error: '多余的逗号' },
    { pattern: /,\s*\]/, error: '数组末尾多余的逗号可能导致问题' },
    { pattern: /\(\s*\)/, warning: true }, // 空括号可能是正常的
  ];

  for (const { pattern, error, warning } of syntaxPatterns) {
    if (pattern.test(jsCode) && !warning) {
      errors.push(error);
    }
  }

  if (errors.length > 0) {
    return { valid: false, error: errors[0] };
  }

  return { valid: true };
}
