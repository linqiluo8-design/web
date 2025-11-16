#!/bin/bash

echo "=== 修复浏览量统计功能 ==="
echo ""

echo "步骤 1: 重新生成 Prisma Client..."
npx prisma generate
echo "✓ Prisma Client 已重新生成"
echo ""

echo "步骤 2: 同步数据库..."
npx prisma db push --skip-generate
echo "✓ 数据库已同步"
echo ""

echo "步骤 3: 验证 PageView 模型..."
node check-pageview.js
echo ""

echo "步骤 4: 清理 Next.js 缓存..."
rm -rf .next
echo "✓ 缓存已清理"
echo ""

echo "=== 修复完成 ==="
echo ""
echo "现在请运行: npm run dev"
echo "然后访问: http://localhost:3000/backendmanager/analytics"
