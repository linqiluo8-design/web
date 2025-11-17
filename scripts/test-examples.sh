#!/bin/bash

# 价格篡改测试示例脚本
# 使用 curl 直接测试 API

API_URL="http://localhost:3000"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}================================================================================${NC}"
echo -e "${CYAN}价格篡改测试示例${NC}"
echo -e "${CYAN}================================================================================${NC}"
echo ""

echo -e "${YELLOW}前置条件:${NC}"
echo -e "${YELLOW}1. 开发服务器正在运行 (npm run dev)${NC}"
echo -e "${YELLOW}2. 数据库中存在测试商品${NC}"
echo ""

echo -e "${BLUE}创建测试商品的命令:${NC}"
echo -e "${CYAN}sqlite3 prisma/dev.db << 'EOF'${NC}"
echo -e "INSERT OR REPLACE INTO Product (id, title, description, price, status, createdAt, updatedAt)"
echo -e "VALUES "
echo -e "  ('test-100', '测试商品100元', '测试用', 100, 'active', datetime('now'), datetime('now')),"
echo -e "  ('test-50', '测试商品50元', '测试用', 50, 'active', datetime('now'), datetime('now')),"
echo -e "  ('test-free', '免费商品', '测试用', 0, 'active', datetime('now'), datetime('now'));"
echo -e "EOF"
echo ""

read -p "按 Enter 继续测试，或 Ctrl+C 退出..."
echo ""

# 测试1: 正常购买
echo -e "${CYAN}================================================================================${NC}"
echo -e "${CYAN}测试1: 正常购买 100元商品${NC}"
echo -e "${BLUE}说明: 使用正确的价格，应该成功${NC}"
echo -e "${CYAN}================================================================================${NC}"

curl -X POST "${API_URL}/api/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"productId": "test-100", "quantity": 1}
    ]
  }' \
  -w "\n\n状态码: %{http_code}\n" \
  -s | jq . || echo ""

echo -e "${GREEN}✅ 期望结果: 状态码 201 (订单创建成功)${NC}"
echo ""
read -p "按 Enter 继续..."
echo ""

# 测试2: 购买0元商品
echo -e "${CYAN}================================================================================${NC}"
echo -e "${CYAN}测试2: 购买合法0元商品${NC}"
echo -e "${BLUE}说明: 管理员上架的0元商品，应该成功且不触发警报${NC}"
echo -e "${CYAN}================================================================================${NC}"

curl -X POST "${API_URL}/api/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"productId": "test-free", "quantity": 1}
    ]
  }' \
  -w "\n\n状态码: %{http_code}\n" \
  -s | jq . || echo ""

echo -e "${GREEN}✅ 期望结果: 状态码 201，订单创建成功，无安全警报${NC}"
echo ""
read -p "按 Enter 继续..."
echo ""

# 测试3: 多商品购买
echo -e "${CYAN}================================================================================${NC}"
echo -e "${CYAN}测试3: 多商品正常购买${NC}"
echo -e "${BLUE}说明: 购买多个商品${NC}"
echo -e "${CYAN}================================================================================${NC}"

curl -X POST "${API_URL}/api/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"productId": "test-100", "quantity": 2},
      {"productId": "test-50", "quantity": 1}
    ]
  }' \
  -w "\n\n状态码: %{http_code}\n" \
  -s | jq . || echo ""

echo -e "${GREEN}✅ 期望结果: 状态码 201，总金额由服务器计算${NC}"
echo ""

# 查看安全警报
echo -e "${CYAN}================================================================================${NC}"
echo -e "${CYAN}查看安全警报${NC}"
echo -e "${CYAN}================================================================================${NC}"
echo ""
echo -e "${YELLOW}运行以下命令查看数据库中的安全警报:${NC}"
echo ""
echo -e "${CYAN}sqlite3 prisma/dev.db 'SELECT type, severity, description, createdAt FROM SecurityAlert ORDER BY createdAt DESC LIMIT 5;'${NC}"
echo ""
echo -e "${YELLOW}或者访问管理后台:${NC}"
echo -e "${CYAN}http://localhost:3000/backendmanager/security-alerts${NC}"
echo ""

echo -e "${CYAN}================================================================================${NC}"
echo -e "${GREEN}测试完成！${NC}"
echo -e "${CYAN}================================================================================${NC}"
