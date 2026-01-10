#!/bin/bash

echo "======================================"
echo "智能文档转换器 - 快速安装脚本"
echo "======================================"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "错误: 未安装 Node.js"
    echo "请访问 https://nodejs.org/ 下载安装"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "警告: Node.js 版本过低，建议 v16+"
fi

echo "✓ Node.js 版本: $(node -v)"
echo "✓ npm 版本: $(npm -v)"

echo ""
echo "正在安装依赖..."

# 安装后端依赖
echo "1. 安装后端依赖..."
cd server
npm install

# 检查并创建 .env 文件
if [ ! -f .env ]; then
    echo "2. 创建 .env 文件..."
    cp .env.example .env
    echo "⚠️  请编辑 server/.env 文件，填入你的 API 密钥"
else
    echo "2. .env 文件已存在，跳过创建"
fi

cd ..

# 安装前端依赖
echo "3. 安装前端依赖..."
cd client
npm install

cd ..

echo ""
echo "======================================"
echo "✅ 安装完成！"
echo "======================================"
echo ""
echo "下一步:"
echo "1. 编辑 server/.env 文件，填入 API 密钥:"
echo "   - NOVITA_API_KEY (Novita AI)"
echo "   - OPENROUTER_API_KEY (OpenRouter)"
echo ""
echo "2. 启动服务:"
echo "   cd server && npm start"
echo "   cd client && npm start (另一个终端)"
echo ""
echo "3. 访问 http://localhost:3002"
echo ""
echo "详细说明请参考 SETUP.md"
