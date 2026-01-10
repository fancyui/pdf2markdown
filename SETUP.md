# 快速开始指南

## 环境要求

- Node.js v16+
- npm 或 yarn

## 安装步骤

### 1. 安装依赖

```bash
# 安装后端依赖
cd server && npm install

# 安装前端依赖
cd ../client && npm install
```

### 2. 配置环境变量

```bash
cd server
cp .env.example .env
```

编辑 `server/.env`：

```env
# API 密钥 (至少配置一个)
NOVITA_API_KEY=your_novita_api_key
OPENROUTER_API_KEY=your_openrouter_api_key

# 服务配置
PORT=3001
LOG_LEVEL=info

# OCR 并发配置
OCR_CONCURRENCY=3
OCR_MAX_RETRIES=3
OCR_RETRY_DELAY=2000

# 访问控制 (可选，留空则不启用)
ACCESS_TOKEN=
```

### 3. 启动服务

```bash
# 终端1：启动后端
cd server && npm start

# 终端2：启动前端
cd client && npm start
```

### 4. 访问应用

- 本地开发：<http://localhost:3002>
- 带 Token：<http://localhost:3002?token=your-token>

## 处理流程

### PDF 处理

1. PDF 分页转换为高清图片 (pdftoimg-js)
2. 多页并行发送到 AI OCR API
3. 失败自动重试 (指数退避)
4. 合并所有页面结果
5. AI 后处理 (去页眉页脚、合并跨页表格)
6. 可选追加末尾内容

### 图片处理

1. 直接发送到 AI OCR API
2. 返回指定格式 (Markdown/HTML/纯文本)

## 自定义提示词

编辑 `/prompts/` 目录下的文件：

- `markdown.md` - Markdown 格式提示词
- `html.md` - HTML 格式提示词
- `text.md` - 纯文本格式提示词
- `post-process.md` - AI 后处理提示词
- `append-content.md` - 末尾追加内容模板

修改后重启服务器生效。

## 常见问题

### Q: 提示 "API_KEY is not set"

A: 请确保在 `server/.env` 中配置了对应提供商的 API 密钥

### Q: 401 未授权访问

A: 设置了 ACCESS_TOKEN 后，需要在 URL 中加 `?token=xxx`

### Q: 转换速度慢

A: 调整 `OCR_CONCURRENCY` 增加并发数 (注意 API 限速)

### Q: 大文件处理失败

A: 检查磁盘空间，可调整 `server/src/index.js` 中的文件大小限制
