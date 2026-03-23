# DevForge

一个模块化、可扩展的个人开发工具集合平台，支持 AI 自动生成工具页面。

## 特性

- **AI 工具生成** - 对话式描述需求，AI 自动生成完整工具页面
- **模块化架构** - 每个工具独立运行，互不干扰
- **快速扩展** - 手动添加或 AI 生成，灵活扩展
- **统一界面** - 侧边栏导航，iframe 加载，体验一致
- **配置持久化** - 工具配置、数据独立存储
- **本地优先** - 静态资源本地化，响应快速
- **可导出部署** - 一键导出完整程序包

## 内置工具

| 工具 | 说明 |
|------|------|
| AI 工具生成 | 对话式生成工具页面，AI 自动编写代码 |
| 数据库导出 | MySQL/PostgreSQL 可视化导出 SQL |
| 密钥生成器 | 随机密码/密钥生成 |
| 笔记本 | Markdown 笔记管理 |
| JSON 格式化 | JSON 格式化、压缩、去转义 |
| 时间戳转换 | 时间戳与日期互转 |
| 网站收藏 | 分类收藏网站，站内打开 |
| 工具管理 | 配置侧边栏显示的工具 |
| 颜色选择器 | 颜色选择与格式转换 |
| 图片 Base64 | 图片与 Base64 编码互转 |
| 时区时钟 | 多时区时间显示 |
| 数独游戏 | 经典数独游戏 |
| SSH 远程 | SSH 连接管理 |

## 快速开始

```bash
# 安装依赖
npm install

# 启动服务
npm start

# 访问
http://localhost:3000
```

## 如何扩展新工具

### 第一步：创建工具页面

在 `public/tools/` 目录下创建 HTML 文件：

```html
<!-- public/tools/my-tool.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>我的工具</title>
  <script src="/assets/js/tailwind.js"></script>
  <link rel="stylesheet" href="/assets/css/fontawesome.min.css">
  <style>
    body { opacity: 0; transition: opacity 0.1s; }
    body.ready { opacity: 1; }
  </style>
</head>
<body class="bg-gray-50 min-h-screen p-6">
  <h1 class="text-2xl font-bold">我的工具</h1>
  <!-- 工具内容 -->
  
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      // 初始化逻辑
      document.body.classList.add('ready');
    });
  </script>
</body>
</html>
```

### 第二步：注册工具（可选）

编辑 `server.js` 中的 `DEFAULT_TOOLS`：

```javascript
const DEFAULT_TOOLS = {
  registry: [
    // ... 现有工具
    { 
      id: 'my-tool',           // 唯一标识
      name: '我的工具',         // 显示名称
      icon: 'fa-wrench',       // Font Awesome 图标
      color: 'blue',           // 主题色
      desc: '工具描述',         // 简短描述
      url: '/tools/my-tool.html'  // 页面路径
    }
  ],
  sidebar: ['db-export', 'keygen', 'my-tool']  // 侧边栏显示
};
```

### 第三步：添加数据存储（如需）

如果工具需要持久化数据：

```javascript
// 1. 定义目录和文件
const MY_TOOL_DIR = path.join(DATA_DIR, 'my-tool');
const MY_TOOL_FILE = path.join(MY_TOOL_DIR, 'data.json');

// 2. 确保目录存在
[DATA_DIR, ..., MY_TOOL_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// 3. 添加 API
app.get('/api/my-tool', (req, res) => {
  const data = JSON.parse(fs.readFileSync(MY_TOOL_FILE, 'utf8'));
  res.json({ success: true, data });
});

app.post('/api/my-tool', (req, res) => {
  fs.writeFileSync(MY_TOOL_FILE, JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});
```

## 目录结构

```
dev-toolbox/
├── public/
│   ├── index.html          # 主页面（侧边栏 + iframe）
│   ├── assets/             # 静态资源
│   │   ├── css/            # 样式文件
│   │   ├── js/             # JS 文件
│   │   └── webfonts/       # 字体文件
│   └── tools/              # 工具页面
│       ├── tool-generator.html  # AI 工具生成器
│       ├── db-export.html
│       ├── keygen.html
│       └── ...
├── agent/                  # AI Agent 服务
│   ├── core/
│   │   ├── agent.js        # Agent 核心逻辑
│   │   ├── llm.js          # LLM 调用封装
│   │   └── memory.js       # 对话记忆管理
│   ├── tools/
│   │   ├── plan-generator.js   # 计划生成
│   │   ├── code-generator.js   # 代码生成
│   │   ├── code-reviewer.js    # 代码审查
│   │   ├── validate-code.js    # 代码验证
│   │   ├── file-writer.js      # 文件写入
│   │   └── write-preview-file.js # 预览文件
│   ├── prompts/
│   │   └── system.md       # 系统提示词
│   └── server.js           # Agent 服务入口
├── data/                   # 数据存储（按工具隔离）
│   ├── ai/
│   │   ├── config.json     # AI 配置（API Key 等）
│   │   ├── tasks.json      # 生成任务记录
│   │   ├── logs/           # 任务日志
│   │   ├── previews/       # 预览文件
│   │   └── versions/       # 版本存档
│   ├── db-export/          # 数据库导出配置
│   ├── notebook/           # 笔记数据
│   ├── bookmarks/          # 网站收藏
│   └── system/             # 系统配置
├── server.js               # 主服务端
├── package.json
└── README.md
```

## AI 工具生成器

DevForge 内置 AI 工具生成功能，通过对话式交互自动生成工具页面。

### 启动 Agent 服务

AI 工具生成需要独立运行 Agent 服务：

```bash
# 主服务（端口 3000）
npm start

# Agent 服务（端口 3001）
cd agent && npm install && npm start
```

### 使用方式

1. 打开主页面，点击侧边栏「AI 工具生成」
2. 点击「新建」创建任务
3. 在对话框描述你需要的工具功能，例如：
   - "创建一个颜色选择器，支持 HEX、RGB、HSL 格式互转"
   - "做一个数独游戏，支持难度选择和自动验证"
4. AI 会自动生成完整代码，并显示预览
5. 确认无误后点击「采纳并部署」，工具即可使用

### 生成流程

```
用户输入 → 计划生成 → 代码生成 → 代码验证 → LLM 审核 → 预览 → 采纳部署
```

1. **计划生成** - 分析需求，生成工具元数据（ID、名称、图标等）
2. **代码生成** - 根据计划生成完整 HTML 页面代码
3. **代码验证** - 检查 HTML 语法、JS 运行、功能可用性
4. **LLM 审核** - AI 审查代码质量和安全性
5. **预览** - 实时预览生成的工具页面
6. **采纳部署** - 确认后将工具文件写入 `public/tools/` 目录

### 配置 AI

点击左下角「AI 配置」按钮，配置 LLM API：

| 配置项 | 说明 |
|--------|------|
| API Endpoint | LLM API 地址（如 DeepSeek、OpenAI） |
| API Key | API 密钥 |
| 模型 | 模型名称（如 deepseek-chat） |
| Temperature | 生成温度（建议 0-0.7） |

支持 OpenAI 兼容的 API 接口。

### 版本管理

每次采纳部署都会自动创建版本存档：

- 存档位置：`data/ai/versions/{tool-id}/`
- 包含 `meta.json`（元数据）和 `v{n}.html`（代码文件）
- 可追溯历史版本

## 可用图标

工具图标使用 Font Awesome，常用图标：

| 图标 | 类名 | 适用场景 |
|------|------|----------|
| <i class="fas fa-database"></i> | `fa-database` | 数据库 |
| <i class="fas fa-key"></i> | `fa-key` | 密钥/安全 |
| <i class="fas fa-book"></i> | `fa-book` | 文档/笔记 |
| <i class="fas fa-code"></i> | `fa-code` | 代码/开发 |
| <i class="fas fa-clock"></i> | `fa-clock` | 时间 |
| <i class="fas fa-bookmark"></i> | `fa-bookmark` | 收藏 |
| <i class="fas fa-tools"></i> | `fa-tools` | 工具 |
| <i class="fas fa-cog"></i> | `fa-cog` | 设置 |
| <i class="fas fa-chart-line"></i> | `fa-chart-line` | 图表/数据 |
| <i class="fas fa-image"></i> | `fa-image` | 图片 |
| <i class="fas fa-file"></i> | `fa-file` | 文件 |
| <i class="fas fa-robot"></i> | `fa-robot` | AI/机器人 |

## 可用主题色

```
blue, green, purple, orange, red, cyan, pink, gray
```

## 技术栈

- **前端**: HTML + Tailwind CSS + Font Awesome
- **后端**: Node.js + Express
- **数据**: JSON 文件存储

## 导出程序

点击侧边栏「更多 → 导出程序」可下载完整程序包（含/不含数据）。

---

**开发者**: nielz
