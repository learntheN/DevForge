/**
 * 开发工具箱 - 服务端
 * 提供多种开发辅助工具：数据库导出、密钥生成、笔记本等
 * 
 * 开发者: nielz
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// 数据存储目录 - 按工具/场景分类
const DATA_DIR = path.join(__dirname, 'data');
const DB_EXPORT_DIR = path.join(DATA_DIR, 'db-export');
const NOTEBOOK_DIR = path.join(DATA_DIR, 'notebook');
const BOOKMARKS_DIR = path.join(DATA_DIR, 'bookmarks');
const SYSTEM_DIR = path.join(DATA_DIR, 'system');
const AI_DIR = path.join(DATA_DIR, 'ai');

// 各工具的数据文件
const CONNECTIONS_FILE = path.join(DB_EXPORT_DIR, 'connections.json');
const CONFIGS_FILE = path.join(DB_EXPORT_DIR, 'configs.json');
const NOTES_FILE = path.join(NOTEBOOK_DIR, 'notes.json');
const BOOKMARKS_FILE = path.join(BOOKMARKS_DIR, 'bookmarks.json');
const TOOLS_FILE = path.join(SYSTEM_DIR, 'tools.json');
const AI_CONFIG_FILE = path.join(AI_DIR, 'config.json');
const AI_TASKS_FILE = path.join(AI_DIR, 'tasks.json');
const AI_LOGS_DIR = path.join(AI_DIR, 'logs');
const SKILL_FILE = path.join(__dirname, '.qoder', 'skills', 'dev-toolbox-generator.md');

// 确保日志目录存在
if (!fs.existsSync(AI_LOGS_DIR)) fs.mkdirSync(AI_LOGS_DIR, { recursive: true });

// 默认工具注册表
const DEFAULT_TOOLS = {
  registry: [
    { id: 'db-export', name: '数据库导出', icon: 'fa-database', color: 'blue', desc: '可视化数据库初始化语句导出', url: '/tools/db-export.html' },
    { id: 'keygen', name: '密钥生成器', icon: 'fa-key', color: 'green', desc: '生成安全的随机密码和密钥', url: '/tools/keygen.html' },
    { id: 'notebook', name: '笔记本', icon: 'fa-book', color: 'purple', desc: '支持 Markdown 的笔记管理工具', url: '/tools/notebook.html' },
    { id: 'json-format', name: 'JSON格式化', icon: 'fa-code', color: 'orange', desc: 'JSON 格式化、压缩、去除转义', url: '/tools/json-format.html' },
    { id: 'timestamp', name: '时间戳转换', icon: 'fa-clock', color: 'cyan', desc: '时间戳与日期时间互转', url: '/tools/timestamp.html' },
    { id: 'bookmarks', name: '网站收藏', icon: 'fa-bookmark', color: 'pink', desc: '收藏常用网站，支持分类管理', url: '/tools/bookmarks.html' }
  ],
  sidebar: ['db-export', 'keygen', 'notebook', 'json-format', 'timestamp', 'bookmarks']
};

// 确保数据目录存在
[DATA_DIR, DB_EXPORT_DIR, NOTEBOOK_DIR, BOOKMARKS_DIR, SYSTEM_DIR, AI_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 初始化存储文件
function initStorage() {
  if (!fs.existsSync(CONNECTIONS_FILE)) {
    fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(CONFIGS_FILE)) {
    fs.writeFileSync(CONFIGS_FILE, JSON.stringify({}, null, 2));
  }
  if (!fs.existsSync(NOTES_FILE)) {
    fs.writeFileSync(NOTES_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(BOOKMARKS_FILE)) {
    fs.writeFileSync(BOOKMARKS_FILE, JSON.stringify({ categories: [], bookmarks: [] }, null, 2));
  }
  if (!fs.existsSync(TOOLS_FILE)) {
    fs.writeFileSync(TOOLS_FILE, JSON.stringify(DEFAULT_TOOLS, null, 2));
  }
  if (!fs.existsSync(AI_CONFIG_FILE)) {
    fs.writeFileSync(AI_CONFIG_FILE, JSON.stringify({
      apiType: 'openai',
      endpoint: 'https://api.deepseek.com/v1/chat/completions',
      apiKey: 'sk-a8969567f6a046c49a5ba2f81826b66f',
      model: 'deepseek-chat',
      temperature: 1.5
    }, null, 2));
  }
  if (!fs.existsSync(AI_TASKS_FILE)) {
    fs.writeFileSync(AI_TASKS_FILE, JSON.stringify([], null, 2));
  }
}

initStorage();

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));  // 增大请求体限制，支持大代码文件
app.use(express.static(path.join(__dirname, 'public')));

// 数据操作辅助函数
function getConnections() {
  try {
    const connections = JSON.parse(fs.readFileSync(CONNECTIONS_FILE, 'utf8'));
    // 确保每个连接都有有效的 ID，并保存修复后的数据
    let needSave = false;
    const fixedConnections = connections.map(conn => {
      if (!conn.id) {
        needSave = true;
        return { ...conn, id: uuidv4() };
      }
      return conn;
    });
    if (needSave) {
      fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(fixedConnections, null, 2));
    }
    return fixedConnections;
  } catch {
    return [];
  }
}

function saveConnections(connections) {
  fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(connections, null, 2));
}

function getConfigs() {
  try {
    return JSON.parse(fs.readFileSync(CONFIGS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveConfigs(configs) {
  fs.writeFileSync(CONFIGS_FILE, JSON.stringify(configs, null, 2));
}

// 笔记数据操作
function getNotes() {
  try {
    return JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveNotes(notes) {
  fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2));
}

// 工具配置操作
function getTools() {
  try {
    const tools = JSON.parse(fs.readFileSync(TOOLS_FILE, 'utf8'));
    // 确保有完整的 registry（合并默认值）
    const registryIds = tools.registry.map(t => t.id);
    DEFAULT_TOOLS.registry.forEach(defaultTool => {
      if (!registryIds.includes(defaultTool.id)) {
        tools.registry.push(defaultTool);
      }
    });
    return tools;
  } catch {
    return DEFAULT_TOOLS;
  }
}

function saveTools(tools) {
  fs.writeFileSync(TOOLS_FILE, JSON.stringify(tools, null, 2));
}

// 创建数据库连接
async function createConnection(connConfig) {
  const { type, host, port, user, password, database } = connConfig;
  
  if (type === 'mysql') {
    const mysql = require('mysql2/promise');
    return await mysql.createConnection({
      host,
      port: port || 3306,
      user,
      password,
      database
    });
  } else if (type === 'postgresql') {
    const { Client } = require('pg');
    const client = new Client({
      host,
      port: port || 5432,
      user,
      password,
      database
    });
    await client.connect();
    return client;
  } else if (type === 'sqlite') {
    try {
      const sqlite3 = require('sqlite3').verbose();
      return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(database, (err) => {
          if (err) reject(err);
          else resolve(db);
        });
      });
    } catch (err) {
      throw new Error('SQLite3 模块未安装，请运行: npm install sqlite3');
    }
  }
  
  throw new Error(`不支持的数据库类型: ${type}`);
}

// 关闭数据库连接
async function closeConnection(connection, type) {
  try {
    if (type === 'mysql') {
      await connection.end();
    } else if (type === 'postgresql') {
      await connection.end();
    } else if (type === 'sqlite') {
      connection.close();
    }
  } catch (err) {
    console.error('关闭连接失败:', err);
  }
}

// 获取表列表
async function getTables(connection, type, database) {
  if (type === 'mysql') {
    const [rows] = await connection.execute(
      `SELECT TABLE_NAME as name, TABLE_COMMENT as comment, TABLE_ROWS as rowCount, 
       ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) as sizeMB 
       FROM information_schema.TABLES 
       WHERE TABLE_SCHEMA = ?`,
      [database]
    );
    return rows.map(r => ({
      name: r.name,
      comment: r.comment || '',
      rows: r.rowCount || 0,
      size: r.sizeMB ? `${r.sizeMB} MB` : '-'
    }));
  } else if (type === 'postgresql') {
    const result = await connection.query(`
      SELECT 
        t.tablename as name,
        obj_description(pgc.oid, 'pg_class') as comment,
        0 as rowCount
      FROM pg_tables t
      LEFT JOIN pg_class pgc ON pgc.relname = t.tablename
      WHERE t.schemaname = 'public'
    `);
    return result.rows.map(r => ({
      name: r.name,
      comment: r.comment || '',
      rows: parseInt(r.rowcount) || 0,
      size: '-'
    }));
  } else if (type === 'sqlite') {
    return new Promise((resolve, reject) => {
      const tables = [];
      connection.each(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
        (err, row) => {
          if (err) reject(err);
          else tables.push({ name: row.name, comment: '', rows: 0, size: '-' });
        },
        (err) => {
          if (err) reject(err);
          else resolve(tables);
        }
      );
    });
  }
  return [];
}

// 生成 CREATE TABLE 语句
async function getCreateTableSQL(connection, type, tableName) {
  if (type === 'mysql') {
    const [rows] = await connection.execute(`SHOW CREATE TABLE \`${tableName}\``);
    return rows[0]['Create Table'];
  } else if (type === 'postgresql') {
    // 简化版，实际项目中可能需要更复杂的逻辑
    return `-- PostgreSQL table: ${tableName}`;
  } else if (type === 'sqlite') {
    return new Promise((resolve, reject) => {
      connection.get(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name=?",
        [tableName],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.sql : '');
        }
      );
    });
  }
  return '';
}

// 格式化 SQL 值
function formatSQLValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'string') return `'${val.replace(/[\\']/g, "\\$&")}'`;
  if (typeof val === 'number') return val.toString();
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
  if (Buffer.isBuffer(val)) return `X'${val.toString('hex')}'`;
  if (typeof val === 'bigint') return val.toString();
  // 其他类型转为字符串
  return `'${String(val).replace(/[\\']/g, "\\$&")}'`;
}

// 生成 INSERT 语句
async function getInsertStatements(connection, type, tableName, options = {}) {
  const { completeInsert = true, extendedInsert = true } = options;
  
  if (type === 'mysql') {
    const [rows] = await connection.execute(`SELECT * FROM \`${tableName}\``);
    if (rows.length === 0) return '';
    
    const columns = Object.keys(rows[0]);
    let sql = '';
    
    if (extendedInsert) {
      // 扩展 INSERT，多行 VALUES
      const colStr = columns.map(c => `\`${c}\``).join(', ');
      sql += `INSERT INTO \`${tableName}\` (${colStr}) VALUES\n`;
      
      const valuesList = rows.map(row => {
        const vals = columns.map(col => formatSQLValue(row[col]));
        return `  (${vals.join(', ')})`;
      });
      
      sql += valuesList.join(',\n') + ';\n';
    } else {
      // 单行 INSERT
      rows.forEach(row => {
        const colStr = completeInsert ? columns.map(c => `\`${c}\``).join(', ') : '';
        const vals = columns.map(col => formatSQLValue(row[col]));
        
        if (completeInsert) {
          sql += `INSERT INTO \`${tableName}\` (${colStr}) VALUES (${vals.join(', ')});\n`;
        } else {
          sql += `INSERT INTO \`${tableName}\` VALUES (${vals.join(', ')});\n`;
        }
      });
    }
    
    return sql;
  }
  
  return '';
}

// ============ API 路由 ============

// 获取所有保存的连接
app.get('/api/connections', (req, res) => {
  const connections = getConnections();
  // 不返回密码
  const safeConnections = connections.map(c => ({
    ...c,
    password: c.password ? '******' : ''
  }));
  res.json({ success: true, data: safeConnections });
});

// 测试连接
app.post('/api/connections/test', async (req, res) => {
  const config = req.body;
  let connection = null;
  
  try {
    connection = await createConnection(config);
    await closeConnection(connection, config.type);
    res.json({ success: true, message: '连接成功' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 保存连接
app.post('/api/connections', (req, res) => {
  const config = req.body;
  const connections = getConnections();
  
  // 确保有有效的 ID
  const id = config.id && config.id !== 'null' && config.id !== 'undefined' ? config.id : uuidv4();
  
  const newConnection = {
    id,
    type: config.type,
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    savedAt: new Date().toISOString()
  };
  
  // 检查是否已存在
  const existingIndex = connections.findIndex(c => c.id === newConnection.id);
  if (existingIndex >= 0) {
    connections[existingIndex] = newConnection;
  } else {
    connections.push(newConnection);
  }
  
  saveConnections(connections);
  
  res.json({ 
    success: true, 
    data: { ...newConnection, password: '******' },
    message: '连接已保存'
  });
});

// 删除连接
app.delete('/api/connections/:id', (req, res) => {
  const { id } = req.params;
  let connections = getConnections();
  connections = connections.filter(c => c.id !== id);
  saveConnections(connections);
  
  // 同时删除相关配置
  const configs = getConfigs();
  delete configs[id];
  saveConfigs(configs);
  
  res.json({ success: true, message: '连接已删除' });
});

// 获取连接详情（包含密码，用于连接数据库）
app.get('/api/connections/:id/detail', (req, res) => {
  const { id } = req.params;
  const connections = getConnections();
  const connection = connections.find(c => c.id === id);
  
  if (!connection) {
    return res.status(404).json({ success: false, message: '连接不存在' });
  }
  
  res.json({ success: true, data: connection });
});

// 获取数据库表列表
app.get('/api/connections/:id/tables', async (req, res) => {
  const { id } = req.params;
  const connections = getConnections();
  const connectionConfig = connections.find(c => c.id === id);
  
  if (!connectionConfig) {
    return res.status(404).json({ success: false, message: '连接不存在' });
  }
  
  let connection = null;
  try {
    connection = await createConnection(connectionConfig);
    const tables = await getTables(connection, connectionConfig.type, connectionConfig.database);
    await closeConnection(connection, connectionConfig.type);
    
    res.json({ success: true, data: tables });
  } catch (error) {
    if (connection) await closeConnection(connection, connectionConfig.type);
    res.status(400).json({ success: false, message: error.message });
  }
});

// 获取表配置
app.get('/api/connections/:id/config', (req, res) => {
  const { id } = req.params;
  const configs = getConfigs();
  res.json({ success: true, data: configs[id] || {} });
});

// 保存表配置
app.post('/api/connections/:id/config', (req, res) => {
  const { id } = req.params;
  const config = req.body;
  
  const configs = getConfigs();
  configs[id] = {
    ...config,
    updatedAt: new Date().toISOString()
  };
  saveConfigs(configs);
  
  res.json({ success: true, message: '配置已保存' });
});

// 生成 SQL
app.post('/api/connections/:id/export', async (req, res) => {
  const { id } = req.params;
  const { tableConfigs, options = {} } = req.body;
  
  const connections = getConnections();
  const connectionConfig = connections.find(c => c.id === id);
  
  if (!connectionConfig) {
    return res.status(404).json({ success: false, message: '连接不存在' });
  }
  
  let connection = null;
  try {
    connection = await createConnection(connectionConfig);
    
    let sql = `-- ========================================\n`;
    sql += `-- 数据库初始化脚本\n`;
    sql += `-- 生成时间: ${new Date().toLocaleString()}\n`;
    sql += `-- 数据库: ${connectionConfig.database}\n`;
    sql += `-- 主机: ${connectionConfig.host}\n`;
    sql += `-- ========================================\n\n`;
    
    if (options.disableForeignKeyChecks) {
      sql += `SET FOREIGN_KEY_CHECKS=0;\n\n`;
    }
    
    const structureTables = [];
    const dataTables = [];
    
    Object.entries(tableConfigs).forEach(([table, mode]) => {
      if (mode === 'structure') structureTables.push(table);
      if (mode === 'data') dataTables.push(table);
    });
    
    // 仅结构表
    if (structureTables.length > 0) {
      sql += `-- ----------------------------------------\n`;
      sql += `-- 仅表结构 (${structureTables.length} 个表)\n`;
      sql += `-- ----------------------------------------\n\n`;
      
      for (const table of structureTables) {
        if (options.addDropTable) {
          sql += `DROP TABLE IF EXISTS \`${table}\`;\n`;
        }
        const createSQL = await getCreateTableSQL(connection, connectionConfig.type, table);
        sql += `${createSQL.replace(/;\s*$/, '')};\n\n`;
      }
    }
    
    // 含数据表
    if (dataTables.length > 0) {
      sql += `-- ----------------------------------------\n`;
      sql += `-- 表结构和数据 (${dataTables.length} 个表)\n`;
      sql += `-- ----------------------------------------\n\n`;
      
      for (const table of dataTables) {
        if (options.addDropTable) {
          sql += `DROP TABLE IF EXISTS \`${table}\`;\n`;
        }
        const createSQL = await getCreateTableSQL(connection, connectionConfig.type, table);
        sql += `${createSQL.replace(/;\s*$/, '')};\n\n`;
        
        const insertSQL = await getInsertStatements(connection, connectionConfig.type, table, {
          completeInsert: options.completeInsert,
          extendedInsert: options.extendedInsert
        });
        if (insertSQL) {
          sql += insertSQL + '\n';
        }
      }
    }
    
    if (options.disableForeignKeyChecks) {
      sql += `SET FOREIGN_KEY_CHECKS=1;\n`;
    }
    
    await closeConnection(connection, connectionConfig.type);
    
    res.json({ success: true, data: sql });
  } catch (error) {
    if (connection) await closeConnection(connection, connectionConfig.type);
    res.status(400).json({ success: false, message: error.message });
  }
});

// ============ 笔记 API ============

// 获取所有笔记
app.get('/api/notes', (req, res) => {
  const notes = getNotes();
  // 按更新时间倒序
  notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json({ success: true, data: notes });
});

// 创建笔记
app.post('/api/notes', (req, res) => {
  const { title, content } = req.body;
  const notes = getNotes();
  
  const newNote = {
    id: uuidv4(),
    title: title || '新笔记',
    content: content || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  notes.push(newNote);
  saveNotes(notes);
  
  res.json({ success: true, data: newNote, message: '笔记已创建' });
});

// 更新笔记
app.put('/api/notes/:id', (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;
  const notes = getNotes();
  
  const noteIndex = notes.findIndex(n => n.id === id);
  if (noteIndex === -1) {
    return res.status(404).json({ success: false, message: '笔记不存在' });
  }
  
  notes[noteIndex] = {
    ...notes[noteIndex],
    title: title !== undefined ? title : notes[noteIndex].title,
    content: content !== undefined ? content : notes[noteIndex].content,
    updatedAt: new Date().toISOString()
  };
  
  saveNotes(notes);
  res.json({ success: true, data: notes[noteIndex], message: '笔记已更新' });
});

// 删除笔记
app.delete('/api/notes/:id', (req, res) => {
  const { id } = req.params;
  let notes = getNotes();
  
  const noteIndex = notes.findIndex(n => n.id === id);
  if (noteIndex === -1) {
    return res.status(404).json({ success: false, message: '笔记不存在' });
  }
  
  notes = notes.filter(n => n.id !== id);
  saveNotes(notes);
  
  res.json({ success: true, message: '笔记已删除' });
});

// ============ 网站收藏 API ============

// 获取收藏数据辅助函数
function getBookmarksData() {
  try {
    return JSON.parse(fs.readFileSync(BOOKMARKS_FILE, 'utf8'));
  } catch {
    return { categories: [], bookmarks: [] };
  }
}

function saveBookmarksData(data) {
  fs.writeFileSync(BOOKMARKS_FILE, JSON.stringify(data, null, 2));
}

// 获取所有收藏
app.get('/api/bookmarks', (req, res) => {
  const data = getBookmarksData();
  res.json({ success: true, data });
});

// 保存收藏数据
app.post('/api/bookmarks', (req, res) => {
  const { categories, bookmarks } = req.body;
  saveBookmarksData({ categories: categories || [], bookmarks: bookmarks || [] });
  res.json({ success: true, message: '保存成功' });
});

// ============ 工具配置 API ============

// 获取所有工具（完整注册表）
app.get('/api/tools', (req, res) => {
  const tools = getTools();
  res.json({ success: true, data: tools.registry });
});

// 获取侧边栏工具配置
app.get('/api/tools/sidebar', (req, res) => {
  const tools = getTools();
  // 返回侧边栏配置的工具详情（有序）
  const sidebarTools = tools.sidebar
    .map(id => tools.registry.find(t => t.id === id))
    .filter(Boolean);
  res.json({ success: true, data: { sidebar: tools.sidebar, tools: sidebarTools } });
});

// 保存侧边栏工具配置
app.post('/api/tools/sidebar', (req, res) => {
  const { sidebar } = req.body;
  
  if (!Array.isArray(sidebar)) {
    return res.status(400).json({ success: false, message: '无效的配置格式' });
  }
  
  const tools = getTools();
  // 验证所有 ID 都存在于注册表中
  const validIds = tools.registry.map(t => t.id);
  const filteredSidebar = sidebar.filter(id => validIds.includes(id));
  
  tools.sidebar = filteredSidebar;
  saveTools(tools);
  
  res.json({ success: true, message: '配置已保存' });
});

// ============ 程序导出 API ============

// ========== AI 工具生成相关 API ==========

const AGENT_URL = process.env.AGENT_URL || 'http://localhost:3001';

// Agent 代理 - 运行任务
app.post('/api/agent/run', async (req, res) => {
  try {
    const response = await fetch(`${AGENT_URL}/agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.json({ success: false, error: `Agent 服务不可用: ${err.message}` });
  }
});

// Agent 代理 - 流式运行任务 (SSE)
app.post('/api/agent/run/stream', async (req, res) => {
  try {
    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const response = await fetch(`${AGENT_URL}/agent/run/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    // 转发 SSE 流
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
    res.end();
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: `Agent 服务不可用: ${err.message}` })}\n\n`);
    res.end();
  }
});

// Agent 代理 - 获取状态
app.get('/api/agent/status/:taskId', async (req, res) => {
  try {
    const response = await fetch(`${AGENT_URL}/agent/status/${req.params.taskId}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.json({ success: false, error: `Agent 服务不可用: ${err.message}` });
  }
});

// Agent 代理 - 停止任务
app.post('/api/agent/stop/:taskId', async (req, res) => {
  try {
    const response = await fetch(`${AGENT_URL}/agent/stop/${req.params.taskId}`, { method: 'POST' });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.json({ success: false, error: `Agent 服务不可用: ${err.message}` });
  }
});

// Agent 代理 - 健康检查
app.get('/api/agent/health', async (req, res) => {
  try {
    const response = await fetch(`${AGENT_URL}/agent/health`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.json({ success: false, error: `Agent 服务不可用`, agentUrl: AGENT_URL });
  }
});

// Agent 代理 - 重新加载配置
app.post('/api/agent/reload-config', async (req, res) => {
  try {
    const response = await fetch(`${AGENT_URL}/agent/reload-config`, { method: 'POST' });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.json({ success: false, error: `Agent 服务不可用: ${err.message}` });
  }
});

// 获取 AI 配置
app.get('/api/ai/config', (req, res) => {
  try {
    const config = JSON.parse(fs.readFileSync(AI_CONFIG_FILE, 'utf8'));
    // 返回配置，标记是否已配置 API Key
    res.json({ 
      success: true, 
      data: { 
        ...config, 
        apiKey: config.apiKey ? '****' : '',
        hasApiKey: !!config.apiKey
      }
    });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// 保存 AI 配置
app.post('/api/ai/config', (req, res) => {
  try {
    const { apiType, endpoint, apiKey, model, temperature } = req.body;
    const currentConfig = JSON.parse(fs.readFileSync(AI_CONFIG_FILE, 'utf8'));
    const newConfig = {
      apiType: apiType || currentConfig.apiType,
      endpoint: endpoint || currentConfig.endpoint,
      // 如果 apiKey 是掩码则保持原值
      apiKey: (apiKey && !apiKey.startsWith('****')) ? apiKey : currentConfig.apiKey,
      model: model || currentConfig.model,
      temperature: temperature !== undefined ? parseFloat(temperature) : (currentConfig.temperature || 0.7)
    };
    fs.writeFileSync(AI_CONFIG_FILE, JSON.stringify(newConfig, null, 2));
    
    // 通知 Agent 服务重新加载配置
    try {
      fetch('http://localhost:3001/agent/reload-config', { method: 'POST' });
    } catch (e) { /* ignore */ }
    
    res.json({ success: true, message: '配置已保存' });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// 获取 SKILL 定义
app.get('/api/ai/skill', (req, res) => {
  try {
    if (fs.existsSync(SKILL_FILE)) {
      const content = fs.readFileSync(SKILL_FILE, 'utf8');
      res.json({ success: true, data: content });
    } else {
      res.json({ success: false, message: 'SKILL 文件不存在' });
    }
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// AI 对话 - 代理到 AI 服务
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, systemPrompt } = req.body;
    const config = JSON.parse(fs.readFileSync(AI_CONFIG_FILE, 'utf8'));
    
    if (!config.apiKey) {
      return res.json({ success: false, message: '请先配置 API Key' });
    }

    // 获取 SKILL 内容
    let skillContent = '';
    if (fs.existsSync(SKILL_FILE)) {
      skillContent = fs.readFileSync(SKILL_FILE, 'utf8');
    }

    // 构建系统提示词
    const fullSystemPrompt = `${skillContent}\n\n${systemPrompt || '请根据用户需求生成工具代码。'}`;

    let response;
    if (config.apiType === 'claude') {
      // Claude API
      response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 4096,
          system: fullSystemPrompt,
          messages: messages
        })
      });
      const data = await response.json();
      if (data.error) {
        return res.json({ success: false, message: data.error.message });
      }
      res.json({ success: true, data: { content: data.content[0].text } });
    } else {
      // OpenAI 兼容 API
      response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: fullSystemPrompt },
            ...messages
          ],
          max_tokens: 4096,
          temperature: config.temperature || 0.7
        })
      });
      const data = await response.json();
      if (data.error) {
        return res.json({ success: false, message: data.error.message });
      }
      res.json({ success: true, data: { content: data.choices[0].message.content } });
    }
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// ========== 任务管理 API ==========

// 获取所有任务
app.get('/api/ai/tasks', (req, res) => {
  try {
    const tasks = JSON.parse(fs.readFileSync(AI_TASKS_FILE, 'utf8'));
    res.json({ success: true, data: tasks });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// 创建任务
app.post('/api/ai/tasks', (req, res) => {
  try {
    const { name, description } = req.body;
    const tasks = JSON.parse(fs.readFileSync(AI_TASKS_FILE, 'utf8'));
    
    const newTask = {
      id: 'task-' + Date.now(),
      name: name || '新任务',
      description: description || '',
      status: 'pending', // pending, generating, completed, adopted, failed
      createdAt: new Date().toISOString(),
      messages: [],
      generatedTool: null,
      generatedCode: null
    };
    
    tasks.unshift(newTask);
    fs.writeFileSync(AI_TASKS_FILE, JSON.stringify(tasks, null, 2));
    
    res.json({ success: true, data: newTask });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// 更新任务
app.put('/api/ai/tasks/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;
    const updates = req.body;
    
    const tasks = JSON.parse(fs.readFileSync(AI_TASKS_FILE, 'utf8'));
    const index = tasks.findIndex(t => t.id === taskId);
    
    if (index === -1) {
      return res.json({ success: false, message: '任务不存在' });
    }
    
    tasks[index] = { ...tasks[index], ...updates, updatedAt: new Date().toISOString() };
    fs.writeFileSync(AI_TASKS_FILE, JSON.stringify(tasks, null, 2));
    
    res.json({ success: true, data: tasks[index] });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// 删除任务
app.delete('/api/ai/tasks/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;
    const tasks = JSON.parse(fs.readFileSync(AI_TASKS_FILE, 'utf8'));
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) {
      return res.json({ success: false, message: '任务不存在' });
    }
    
    let deletedTool = null;
    
    // 如果任务已采纳，删除对应的工具
    if (task.status === 'adopted' && task.generatedTool?.id) {
      const toolId = task.generatedTool.id;
      deletedTool = task.generatedTool.name || toolId;
      
      // 删除工具文件（主文件）
      const toolPath = path.join(__dirname, 'public', 'tools', `${toolId}.html`);
      if (fs.existsSync(toolPath)) {
        fs.unlinkSync(toolPath);
      }
      
      // 删除版本文件
      const toolsDir = path.join(__dirname, 'public', 'tools');
      const files = fs.readdirSync(toolsDir);
      files.forEach(file => {
        if (file.startsWith(`${toolId}_v`) && file.endsWith('.html')) {
          fs.unlinkSync(path.join(toolsDir, file));
        }
      });
      
      // 从工具注册表中移除
      const tools = JSON.parse(fs.readFileSync(TOOLS_FILE, 'utf8'));
      tools.registry = tools.registry.filter(t => t.id !== toolId);
      tools.sidebar = tools.sidebar.filter(id => id !== toolId);
      fs.writeFileSync(TOOLS_FILE, JSON.stringify(tools, null, 2));
    }
    
    // 删除任务
    const filtered = tasks.filter(t => t.id !== taskId);
    fs.writeFileSync(AI_TASKS_FILE, JSON.stringify(filtered, null, 2));
    
    // 删除对应的日志文件
    const logFile = path.join(AI_LOGS_DIR, `${taskId}.json`);
    if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
    
    // 删除对应的预览目录（新路径）
    const previewDir = path.join(AI_DIR, 'previews', taskId);
    if (fs.existsSync(previewDir)) {
      fs.rmSync(previewDir, { recursive: true, force: true });
    }
    
    // 删除旧路径的预览文件（兼容）
    const oldPreviewFile = path.join(__dirname, 'public', 'tools', `_preview_${taskId}.html`);
    if (fs.existsSync(oldPreviewFile)) fs.unlinkSync(oldPreviewFile);
    
    res.json({ success: true, message: '删除成功', deletedTool });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// 获取任务日志
app.get('/api/ai/tasks/:taskId/logs', (req, res) => {
  try {
    const { taskId } = req.params;
    const logFile = path.join(AI_LOGS_DIR, `${taskId}.json`);
    if (fs.existsSync(logFile)) {
      const logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
      res.json({ success: true, data: logs });
    } else {
      res.json({ success: true, data: [] });
    }
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// 保存任务日志
app.put('/api/ai/tasks/:taskId/logs', (req, res) => {
  try {
    const { taskId } = req.params;
    const logs = req.body.logs || [];
    const logFile = path.join(AI_LOGS_DIR, `${taskId}.json`);
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
    res.json({ success: true, path: logFile });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// 采纳任务（部署生成的工具）
app.post('/api/ai/tasks/:taskId/adopt', (req, res) => {
  try {
    const { taskId } = req.params;
    const tasks = JSON.parse(fs.readFileSync(AI_TASKS_FILE, 'utf8'));
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) {
      return res.json({ success: false, message: '任务不存在' });
    }
    
    if (task.status !== 'completed') {
      return res.json({ success: false, message: '任务未完成，无法采纳' });
    }
    
    if (!task.generatedTool || !task.generatedCode) {
      return res.json({ success: false, message: '没有可部署的工具' });
    }
    
    const toolId = task.generatedTool.id;
    
    // 检查工具 ID 是否与内置工具冲突
    const builtinIds = ['db-export', 'keygen', 'notebook', 'json-format', 'timestamp', 'bookmarks', 'tool-manager', 'tool-generator'];
    if (builtinIds.includes(toolId)) {
      return res.json({ success: false, message: '工具 ID 与内置工具冲突，请修改' });
    }
    
    // 读取工具注册表
    const tools = JSON.parse(fs.readFileSync(TOOLS_FILE, 'utf8'));
    
    // 版本管理：查找是否已存在该工具
    const existingTool = tools.registry.find(t => t.id === toolId);
    const version = existingTool ? (existingTool.version || 0) + 1 : 1;
    
    // ===== 新版本存档结构 =====
    // 版本目录: data/ai/versions/{toolId}/
    const versionsDir = path.join(AI_DIR, 'versions', toolId);
    if (!fs.existsSync(versionsDir)) {
      fs.mkdirSync(versionsDir, { recursive: true });
    }
    
    // 写入版本文件: v1.html, v2.html, ...
    const versionFilePath = path.join(versionsDir, `v${version}.html`);
    fs.writeFileSync(versionFilePath, task.generatedCode, 'utf8');
    
    // 更新或创建 meta.json
    const metaPath = path.join(versionsDir, 'meta.json');
    let meta = { toolId, name: task.generatedTool.name, currentVersion: version, versions: [] };
    if (fs.existsSync(metaPath)) {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      meta.currentVersion = version;
    }
    meta.versions.push({
      version,
      file: `v${version}.html`,
      adoptedAt: new Date().toISOString(),
      taskId
    });
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    
    // ===== 写入正式工具文件 =====
    // 正式工具: public/tools/{toolId}.html
    const toolPath = path.join(__dirname, 'public', 'tools', `${toolId}.html`);
    fs.writeFileSync(toolPath, task.generatedCode, 'utf8');
    
    // 注册/更新工具信息
    const existingIndex = tools.registry.findIndex(t => t.id === toolId);
    
    const toolInfo = {
      id: toolId,
      name: task.generatedTool.name,
      icon: task.generatedTool.icon || 'fa-tools',
      color: task.generatedTool.color || 'gray',
      desc: task.generatedTool.desc || '',
      url: `/tools/${toolId}.html`,
      version: version
    };
    
    if (existingIndex >= 0) {
      tools.registry[existingIndex] = toolInfo;
    } else {
      tools.registry.push(toolInfo);
    }
    
    fs.writeFileSync(TOOLS_FILE, JSON.stringify(tools, null, 2));
    
    // 更新任务状态
    task.status = 'adopted';
    task.adoptedAt = new Date().toISOString();
    task.adoptedVersion = version;
    fs.writeFileSync(AI_TASKS_FILE, JSON.stringify(tasks, null, 2));
    
    res.json({ 
      success: true, 
      message: `工具已采纳并部署 (v${version})`, 
      data: { ...toolInfo, adoptedVersion: version }
    });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// ========== 预览文件 API ==========

// 获取预览文件（最新版本）
app.get('/api/ai/previews/:taskId/latest', (req, res) => {
  try {
    const { taskId } = req.params;
    const previewPath = path.join(AI_DIR, 'previews', taskId, 'latest.html');
    
    if (fs.existsSync(previewPath)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(fs.readFileSync(previewPath, 'utf8'));
    } else {
      res.status(404).send('<h1>预览文件不存在</h1>');
    }
  } catch (err) {
    res.status(500).send(`<h1>读取预览文件失败: ${err.message}</h1>`);
  }
});

// 获取预览文件历史列表
app.get('/api/ai/previews/:taskId/history', (req, res) => {
  try {
    const { taskId } = req.params;
    const historyDir = path.join(AI_DIR, 'previews', taskId, 'history');
    
    if (!fs.existsSync(historyDir)) {
      return res.json({ success: true, data: [] });
    }
    
    const files = fs.readdirSync(historyDir)
      .filter(f => f.endsWith('.html'))
      .map(f => {
        const stats = fs.statSync(path.join(historyDir, f));
        return {
          filename: f,
          timestamp: f.replace('.html', ''),
          size: stats.size,
          createdAt: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    
    res.json({ success: true, data: files });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// 获取预览文件历史版本
app.get('/api/ai/previews/:taskId/history/:filename', (req, res) => {
  try {
    const { taskId, filename } = req.params;
    const historyPath = path.join(AI_DIR, 'previews', taskId, 'history', filename);
    
    if (fs.existsSync(historyPath)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(fs.readFileSync(historyPath, 'utf8'));
    } else {
      res.status(404).send('<h1>历史版本不存在</h1>');
    }
  } catch (err) {
    res.status(500).send(`<h1>读取历史版本失败: ${err.message}</h1>`);
  }
});

// ========== 版本管理 API ==========

// 获取工具版本列表
app.get('/api/ai/tools/:toolId/versions', (req, res) => {
  try {
    const { toolId } = req.params;
    const metaPath = path.join(AI_DIR, 'versions', toolId, 'meta.json');
    
    if (!fs.existsSync(metaPath)) {
      return res.json({ success: true, data: { toolId, versions: [] } });
    }
    
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    res.json({ success: true, data: meta });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// 获取工具指定版本代码
app.get('/api/ai/tools/:toolId/versions/:version', (req, res) => {
  try {
    const { toolId, version } = req.params;
    const versionPath = path.join(AI_DIR, 'versions', toolId, `v${version}.html`);
    
    if (!fs.existsSync(versionPath)) {
      return res.status(404).json({ success: false, message: '版本不存在' });
    }
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(fs.readFileSync(versionPath, 'utf8'));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 回滚到指定版本
app.post('/api/ai/tools/:toolId/rollback/:version', (req, res) => {
  try {
    const { toolId, version } = req.params;
    const versionsDir = path.join(AI_DIR, 'versions', toolId);
    const versionPath = path.join(versionsDir, `v${version}.html`);
    const metaPath = path.join(versionsDir, 'meta.json');
    
    if (!fs.existsSync(versionPath)) {
      return res.json({ success: false, message: '版本不存在' });
    }
    
    // 读取版本代码
    const code = fs.readFileSync(versionPath, 'utf8');
    
    // 写入正式工具文件
    const toolPath = path.join(__dirname, 'public', 'tools', `${toolId}.html`);
    fs.writeFileSync(toolPath, code, 'utf8');
    
    // 更新 meta.json 的 currentVersion
    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      meta.currentVersion = parseInt(version);
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
      
      // 更新工具注册表的版本号
      const tools = JSON.parse(fs.readFileSync(TOOLS_FILE, 'utf8'));
      const toolIndex = tools.registry.findIndex(t => t.id === toolId);
      if (toolIndex >= 0) {
        tools.registry[toolIndex].version = parseInt(version);
        fs.writeFileSync(TOOLS_FILE, JSON.stringify(tools, null, 2));
      }
    }
    
    res.json({ 
      success: true, 
      message: `已回滚到 v${version}`,
      data: { toolId, version: parseInt(version) }
    });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// 创建工具文件
app.post('/api/tools/create', (req, res) => {
  try {
    const { toolId, html, apiCode } = req.body;
    
    if (!toolId || !html) {
      return res.json({ success: false, message: '缺少必要参数' });
    }

    // 验证 toolId 格式
    if (!/^[a-z][a-z0-9-]*$/.test(toolId)) {
      return res.json({ success: false, message: '工具 ID 格式错误，只能包含小写字母、数字和连字符' });
    }

    // 检查是否已存在
    const toolPath = path.join(__dirname, 'public', 'tools', `${toolId}.html`);
    if (fs.existsSync(toolPath)) {
      return res.json({ success: false, message: '工具已存在，请使用其他 ID' });
    }

    // 写入 HTML 文件
    fs.writeFileSync(toolPath, html, 'utf8');

    res.json({ 
      success: true, 
      message: '工具文件创建成功',
      data: { path: toolPath }
    });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// 动态注册工具到列表
app.post('/api/tools/register', (req, res) => {
  try {
    const { tool } = req.body;
    
    if (!tool || !tool.id || !tool.name) {
      return res.json({ success: false, message: '缺少工具信息' });
    }

    // 读取当前工具配置
    const tools = JSON.parse(fs.readFileSync(TOOLS_FILE, 'utf8'));
    
    // 检查是否已存在
    const existingIndex = tools.registry.findIndex(t => t.id === tool.id);
    if (existingIndex >= 0) {
      // 更新已存在的工具
      tools.registry[existingIndex] = {
        ...tools.registry[existingIndex],
        ...tool,
        url: `/tools/${tool.id}.html`
      };
    } else {
      // 添加新工具
      tools.registry.push({
        id: tool.id,
        name: tool.name,
        icon: tool.icon || 'fa-tools',
        color: tool.color || 'gray',
        desc: tool.desc || '',
        url: `/tools/${tool.id}.html`
      });
    }

    // 保存
    fs.writeFileSync(TOOLS_FILE, JSON.stringify(tools, null, 2));

    res.json({ success: true, message: '工具注册成功' });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// 删除工具
app.delete('/api/tools/:toolId', (req, res) => {
  try {
    const { toolId } = req.params;
    
    // 不允许删除内置工具
    const builtinTools = ['db-export', 'keygen', 'notebook', 'json-format', 'timestamp', 'bookmarks', 'tool-manager', 'tool-generator'];
    if (builtinTools.includes(toolId)) {
      return res.json({ success: false, message: '不能删除内置工具' });
    }

    // 删除文件
    const toolPath = path.join(__dirname, 'public', 'tools', `${toolId}.html`);
    if (fs.existsSync(toolPath)) {
      fs.unlinkSync(toolPath);
    }

    // 从注册表移除
    const tools = JSON.parse(fs.readFileSync(TOOLS_FILE, 'utf8'));
    tools.registry = tools.registry.filter(t => t.id !== toolId);
    tools.sidebar = tools.sidebar.filter(id => id !== toolId);
    fs.writeFileSync(TOOLS_FILE, JSON.stringify(tools, null, 2));

    res.json({ success: true, message: '工具已删除' });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// 获取项目信息
app.get('/api/project/info', (req, res) => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  res.json({
    success: true,
    data: {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description,
      developer: 'nielz'
    }
  });
});

// 导出程序和数据
app.get('/api/project/export', (req, res) => {
  const includeData = req.query.includeData === 'true';
  
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="dev-toolbox-${Date.now()}.zip"`);
  
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  archive.on('error', (err) => {
    res.status(500).json({ success: false, message: err.message });
  });
  
  archive.pipe(res);
  
  // 添加核心文件
  archive.file(path.join(__dirname, 'package.json'), { name: 'package.json' });
  archive.file(path.join(__dirname, 'server.js'), { name: 'server.js' });
  
  // 添加 README
  if (fs.existsSync(path.join(__dirname, 'README.md'))) {
    archive.file(path.join(__dirname, 'README.md'), { name: 'README.md' });
  }
  
  // 添加 public 目录
  archive.directory(path.join(__dirname, 'public'), 'public');
  
  // 可选添加 data 目录
  if (includeData && fs.existsSync(DATA_DIR)) {
    archive.directory(DATA_DIR, 'data');
  } else {
    // 添加空的数据目录占位（保留目录结构）
    archive.append('[]', { name: 'data/db-export/connections.json' });
    archive.append('{}', { name: 'data/db-export/configs.json' });
    archive.append('[]', { name: 'data/notebook/notes.json' });
    archive.append('{"categories":[],"bookmarks":[]}', { name: 'data/bookmarks/bookmarks.json' });
    archive.append('{}', { name: 'data/ai/config.json' });
    // 工具配置始终导出（保留用户的排序和选择）
    const toolsData = fs.existsSync(TOOLS_FILE) 
      ? fs.readFileSync(TOOLS_FILE, 'utf8')
      : JSON.stringify(DEFAULT_TOOLS, null, 2);
    archive.append(toolsData, { name: 'data/system/tools.json' });
  }
  
  // 添加 .qoder 目录（SKILL 定义）
  const qoderDir = path.join(__dirname, '.qoder');
  if (fs.existsSync(qoderDir)) {
    archive.directory(qoderDir, '.qoder');
  }
  
  archive.finalize();
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`开发工具箱已启动: http://localhost:${PORT}`);
  console.log(`数据存储目录: ${DATA_DIR}`);
});
