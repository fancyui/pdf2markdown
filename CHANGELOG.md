# 更新日志

## v2.0 - 2026-01-10

### 🆕 新功能

- **多格式输出**：支持 Markdown、HTML、纯文本三种输出格式
- **多 AI 提供商**：支持 Novita AI 和 OpenRouter，可选多种模型
- **并行 OCR 处理**：多页 PDF 并行处理，大幅提升速度
- **智能重试**：失败自动重试，指数退避策略
- **AI 后处理**：自动去除页眉页脚、合并跨页表格
- **末尾追加内容**：可选在文档末尾追加自定义内容，带开关控制
- **Token 认证**：简单的访问控制，防止未授权使用
- **提示词分离**：所有提示词存储在独立 .md 文件中，便于管理

### 🔧 技术改进

- **PDF 处理**：从 pdf-poppler 迁移到 pdftoimg-js，无需系统依赖
- **日志系统**：新增可配置的日志级别 (debug/info/warn/error/silent)
- **配置分离**：提示词从代码中分离到 `/prompts/` 目录

### ⚙️ 配置变更

新增环境变量：

```env
OPENROUTER_API_KEY=...     # OpenRouter API 密钥
LOG_LEVEL=info             # 日志级别
OCR_CONCURRENCY=3          # 并发处理页数
OCR_MAX_RETRIES=3          # 最大重试次数
OCR_RETRY_DELAY=2000       # 重试延时 (ms)
ACCESS_TOKEN=              # 访问控制令牌
```

变更：

- `DEEPSEEK_API_KEY` → `NOVITA_API_KEY`

### 📁 文件结构

新增目录：

```
/prompts/
├── markdown.md      # Markdown 格式 OCR 提示词
├── html.md          # HTML 格式 OCR 提示词
├── text.md          # 纯文本格式 OCR 提示词
├── post-process.md  # AI 后处理提示词
└── append-content.md # 末尾追加内容模板
```

---

## v1.1 - PDF 处理方式更新

### 主要变更

- PDF 强制转换为图片进行 OCR，不再尝试直接提取文本
- 使用 pdf-poppler 将每页转换为 2048x2048 高分辨率图片
- 支持扫描版 PDF

---

## v1.0 - 初始版本

- 基本的 PDF/图片 OCR 转换功能
- React + Material-UI 前端
- Node.js + Express 后端
- DeepSeek OCR API 支持
