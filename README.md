# 智能文档转换器

使用 AI OCR 将 PDF 和图片转换为 Markdown、HTML 或纯文本格式。

## ✨ 功能特性

- **多格式输出**：支持 Markdown、HTML、纯文本三种输出格式
- **多 AI 提供商**：支持 Novita AI 和 OpenRouter 多种模型
- **并行处理**：多页 PDF 并行 OCR，大幅提升处理速度
- **智能重试**：失败自动重试，指数退避策略
- **AI 后处理**：自动去除页眉页脚、合并跨页表格
- **图片提取**：自动从 PDF 中提取嵌入的图片，支持掩码合并和去重
- **目录解析**：支持根据目录大纲和标题层级规则进行智能解析
- **自定义追加**：可在文档末尾追加品牌信息
- **简单认证**：支持 Token 访问控制
- **提示词分离**：提示词存储在独立 .md 文件中，便于管理

## 🛠 技术栈

- **前端**: React + Material-UI
- **后端**: Node.js + Express + Sharp
- **PDF处理**: pdftoimg-js (页面转图) + xpdf-tools (图片提取)
- **OCR**: 支持 Novita AI / OpenRouter 多种模型

## 📦 安装

### 后端

```bash
cd server
npm install
cp .env.example .env
# 编辑 .env 填入你的 API 密钥和 pdfimages 路径
```

> [!IMPORTANT]
> 图片提取功能需要安装 **xpdf-tools**。请从 [xpdfreader.com](https://www.xpdfreader.com/download.html) 下载对应系统的二进制文件，并在 `.env` 中配置 `PDFIMAGES_BIN` 的路径。

### 前端

```bash
cd client
npm install
```

## ⚙️ 配置

编辑 `server/.env`：

```env
# API 密钥 (必需)
NOVITA_API_KEY=your_novita_api_key
OPENROUTER_API_KEY=your_openrouter_api_key

# 服务配置
PORT=3001

# 日志级别: debug | info | warn | error | silent
LOG_LEVEL=info

# OCR 并发配置
OCR_CONCURRENCY=3      # 同时处理页数
OCR_MAX_RETRIES=3      # 最大重试次数
OCR_RETRY_DELAY=2000   # 重试延时 (ms)

# 访问控制 (留空则不启用)
ACCESS_TOKEN=your-secret-token

# 图片提取工具路径 (xpdf-tools)
PDFIMAGES_BIN=C:\path\to\xpdf-tools\bin64\pdfimages.exe
```

Nginx 配置示例：

```nginx
server {
    # ... 其他配置 ...

    location / {
        proxy_pass http://127.0.0.1:5003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # 增加超时时间 (单位：秒)
        proxy_connect_timeout 3600;
        proxy_send_timeout 3600;
        proxy_read_timeout 3600;
        send_timeout 3600;
        
        # 关闭缓冲，支持流式响应 (显示进度)
        proxy_buffering off;
        proxy_cache off;
    }
}

## 🚀 运行

```bash
# 启动后端
cd server && npm start

# 启动前端 (另一个终端)
cd client && npm start
```

访问 <http://localhost:3002>

如启用了 ACCESS_TOKEN，需带 token 访问：

```
http://localhost:3002?token=your-secret-token
```

## 📁 项目结构

```
pdf2markdown/
├── client/                 # React 前端
│   └── src/
│       ├── App.js          # 主应用组件
│       └── config.js       # 模型配置 & 追加内容
├── server/                 # Express 后端
│   └── src/
│       ├── index.js        # 服务入口
│       ├── config.js       # 加载提示词
│       ├── ocrService.js   # OCR API 调用
│       ├── fileHandler.js  # 文件处理 & 并发控制
│       ├── imageExtractor.js # PDF 图片提取逻辑
│       └── logger.js       # 日志工具
└── prompts/                # 提示词文件 (可自定义)
    ├── markdown.md         # Markdown 格式提示词
    ├── html.md             # HTML 格式提示词
    ├── text.md             # 纯文本格式提示词
    ├── post-process.md     # AI 后处理提示词
    └── append-content.md   # 末尾追加内容模板
```

## 🔧 自定义提示词

直接编辑 `/prompts/` 目录下的 `.md` 文件，重启服务器后生效。

## 📄 License

MIT
