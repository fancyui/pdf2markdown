# 快速开始指南

## 环境要求

- Node.js (v14 或更高版本)
- npm 或 yarn

## 安装步骤

### 1. 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装后端依赖
cd server && npm install

# 安装前端依赖
cd ../client && npm install
```

### 2. 配置环境变量

在 `server` 目录下创建 `.env` 文件：

```bash
cd server
cp .env.example .env
```

编辑 `.env` 文件，填入你的 Novita AI API 密钥：

```
DEEPSEEK_API_KEY=your_actual_api_key_here
API_BASE_URL=https://api.novita.ai/openai
API_MODEL=deepseek/deepseek-ocr
PORT=3001
```

### 3. 启动服务

#### 方式一：同时启动前后端（推荐）

```bash
# 在项目根目录
npm run dev
```

#### 方式二：分别启动

```bash
# 终端1：启动后端
cd server
npm run dev

# 终端2：启动前端
cd client
npm start
```

### 4. 访问应用

打开浏览器访问：http://localhost:3002

## PDF处理说明

系统会将PDF的每一页转换为图片，然后发送给OCR API进行识别：

1. 使用 `pdf-poppler` 将PDF每页转换为高分辨率PNG图片
2. 每页图片独立发送给 DeepSeek OCR API
3. 所有页面的识别结果合并为一个Markdown文件
4. 识别结果按页码顺序排列

## 使用说明

1. 选择文件类型（PDF 或 图片）
2. 拖拽文件到上传区域或点击选择文件
3. （可选）输入自定义提示词
4. 等待处理完成
5. 预览和下载 Markdown 文件

## 常见问题

### Q: 提示 "DEEPSEEK_API_KEY is not set"
A: 请确保在 server/.env 文件中正确配置了 API 密钥

### Q: PDF 处理失败
A: 检查是否有足够的磁盘空间，确保安装了所有依赖

### Q: 上传文件大小限制
A: 默认最大支持50MB的文件，可在server/src/index.js中修改

### Q: 转换速度慢
A: 多页PDF需要逐页转换和识别，请耐心等待。处理时间取决于PDF页数和API响应速度
