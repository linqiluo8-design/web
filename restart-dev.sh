#!/bin/bash

echo "正在清理 Next.js 缓存..."
rm -rf .next

echo "缓存已清理"
echo ""
echo "正在启动开发服务器..."
npm run dev
