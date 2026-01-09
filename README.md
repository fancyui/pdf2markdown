# PDF/Image to Markdown Converter

使用 DeepSeek OCR 模型（通过 Novita AI）将 PDF 或图片文件转换为 Markdown 格式。

## 技术栈

- 前端: React + Material-UI (MUI)
- 后端: Node.js + Express
- PDF处理: pdf-poppler
- OCR: DeepSeek OCR API (通过 Novita AI)

## 功能特性

- 支持上传 PDF 文件和图片文件
- PDF每页转换为图片进行OCR识别
- 多页 PDF 合并为单个 Markdown 文件
- 自定义 OCR 提示词
- 本地运行，无需云存储
- 实时预览和下载 Markdown 文件

## 工作原理

### PDF 处理流程
1. 上传 PDF 文件
2. 使用 pdf-poppler 将每一页转换为高分辨率图片
3. 逐页发送图片到 DeepSeek OCR API
4. 合并所有页面的识别结果为 Markdown
5. 返回完整的 Markdown 文件

### 图片处理流程
1. 上传图片文件（PNG、JPG等）
2. 直接发送到 DeepSeek OCR API
3. 返回识别的 Markdown 内容

## 安装

### 后端设置

```bash
cd server
npm install
```

创建 `.env` 文件:
```
DEEPSEEK_API_KEY=your_api_key_here
API_BASE_URL=https://api.novita.ai/openai
API_MODEL=deepseek/deepseek-ocr
PORT=3001
```

### 前端设置

```bash
cd client
npm install
```

## 运行

### 同时启动前后端（推荐）
```bash
npm run dev
```

### 分别启动
```bash
cd server && npm run dev
cd client && npm start
```

访问 http://localhost:3002

## 环境变量

- `DEEPSEEK_API_KEY`: API 密钥 (必需，从 Novita AI 获取)
- `API_BASE_URL`: API 基础 URL (默认: https://api.novita.ai/openai)
- `API_MODEL`: OCR 模型名称 (默认: deepseek/deepseek-ocr)
- `PORT`: 后端服务器端口 (默认: 3001)

## 获取 API 密钥

1. 访问 [Novita AI](https://novita.ai)
2. 注册并登录
3. 在控制台获取 API 密钥
4. 将密钥填入 server/.env 文件

详细安装说明请参考 [SETUP.md](SETUP.md)
