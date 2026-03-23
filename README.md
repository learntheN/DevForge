# 开发工具箱 (Dev Toolbox)

一个模块化、可扩展的个人开发工具集合平台。

## 特性

- **模块化架构** - 每个工具独立运行，互不干扰
- **快速扩展** - 只需 3 步即可添加新工具
- **统一界面** - 侧边栏导航，iframe 加载，体验一致
- **配置持久化** - 工具配置、数据独立存储
- **本地优先** - 静态资源本地化，响应快速
- **可导出部署** - 一键导出完整程序包

## 内置工具

| 工具 | 说明 |
|------|------|
| 数据库导出 | MySQL/PostgreSQL 可视化导出 SQL |
| 密钥生成器 | 随机密码/密钥生成 |
| 笔记本 | Markdown 笔记管理 |
| JSON 格式化 | JSON 格式化、压缩、去转义 |
| 时间戳转换 | 时间戳与日期互转 |
| 网站收藏 | 分类收藏网站，站内打开 |
| 工具管理 | 配置侧边栏显示的工具 |

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
│       ├── db-export.html
│       ├── keygen.html
│       ├── notebook.html
│       ├── json-format.html
│       ├── timestamp.html
│       ├── bookmarks.html
│       └── tool-manager.html
├── data/                   # 数据存储（按工具隔离）
│   ├── db-export/          # 数据库导出配置
│   ├── notebook/           # 笔记数据
│   ├── bookmarks/          # 网站收藏
│   └── system/             # 系统配置
├── server.js               # 服务端
├── package.json
└── README.md
```

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
