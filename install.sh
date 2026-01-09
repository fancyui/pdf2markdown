#!/bin/bash

echo "======================================"
echo "PDF to Markdown - 快速安装脚本"
echo "======================================"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "错误: 未安装 Node.js"
    echo "请访问 https://nodejs.org/ 下载安装"
    exit 1
fi

echo "✓ Node.js 版本: $(node -v)"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "错误: 未安装 npm"
    exit 1
fi

echo "✓ npm 版本: $(npm -v)"

echo ""
echo "正在安装依赖..."

# 安装根目录依赖
echo "1. 安装根目录依赖..."
npm install

# 安装后端依赖
echo "2. 安装后端依赖..."
cd server
npm install

# 检查并创建 .env 文件
if [ ! -f .env ]; then
    echo "3. 创建 .env 文件..."
    cp .env.example .env
    echo "⚠️  请编辑 server/.env 文件，填入你的 DEEPSEEK_API_KEY"
fi

cd ..

# 安装前端依赖
echo "4. 安装前端依赖..."
cd client
npm install

cd ..

echo ""
echo "======================================"
echo "安装完成！"
echo "======================================"
echo ""
echo "下一步:"
echo "1. 编辑 server/.env 文件，填入你的 DeepSeek API 密钥"
echo "2. 运行 'npm run dev' 启动应用"
echo "3. 访问 http://localhost:3000"
echo ""
echo "详细说明请参考 SETUP.md"
