#!/bin/bash
# 生产环境安全检查脚本
# 用法: bash scripts/verify-production-env.sh

set -e

echo "🔍 开始生产环境安全检查..."
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 计数器
PASSED=0
FAILED=0
WARNINGS=0

# 检查函数
check_pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((PASSED++))
}

check_fail() {
  echo -e "${RED}✗${NC} $1"
  ((FAILED++))
}

check_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
  ((WARNINGS++))
}

echo "========================================="
echo "1. 环境变量检查"
echo "========================================="
echo ""

# 检查 NODE_ENV
if [ "$NODE_ENV" = "production" ]; then
  check_pass "NODE_ENV 设置为 production"
else
  check_fail "NODE_ENV 不是 production (当前: ${NODE_ENV:-未设置})"
fi

# 检查 NEXTAUTH_SECRET
if [ -z "$NEXTAUTH_SECRET" ]; then
  check_fail "NEXTAUTH_SECRET 未设置！"
else
  SECRET_LENGTH=${#NEXTAUTH_SECRET}
  if [ $SECRET_LENGTH -ge 32 ]; then
    check_pass "NEXTAUTH_SECRET 已设置 ($SECRET_LENGTH 字节)"
  else
    check_warn "NEXTAUTH_SECRET 长度不足 ($SECRET_LENGTH 字节，建议 >= 32)"
  fi

  # 检查是否使用默认值
  if [[ "$NEXTAUTH_SECRET" == *"your-secret-key"* ]] || [[ "$NEXTAUTH_SECRET" == *"replace-this"* ]]; then
    check_fail "NEXTAUTH_SECRET 使用默认值，极度不安全！"
  fi
fi

# 检查 NEXTAUTH_URL
if [ -z "$NEXTAUTH_URL" ]; then
  check_fail "NEXTAUTH_URL 未设置！"
else
  if [[ $NEXTAUTH_URL == https://* ]]; then
    check_pass "NEXTAUTH_URL 使用 HTTPS: $NEXTAUTH_URL"
  elif [[ $NEXTAUTH_URL == http://localhost* ]]; then
    check_warn "NEXTAUTH_URL 使用 localhost (开发环境？): $NEXTAUTH_URL"
  else
    check_fail "NEXTAUTH_URL 未使用 HTTPS: $NEXTAUTH_URL"
  fi
fi

# 检查 DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  check_fail "DATABASE_URL 未设置！"
else
  if [[ $DATABASE_URL == postgresql://* ]] || [[ $DATABASE_URL == postgres://* ]]; then
    check_pass "DATABASE_URL 使用 PostgreSQL"
  elif [[ $DATABASE_URL == mysql://* ]]; then
    check_pass "DATABASE_URL 使用 MySQL"
  elif [[ $DATABASE_URL == file:* ]]; then
    check_warn "DATABASE_URL 使用 SQLite (不推荐用于生产)"
  else
    check_warn "DATABASE_URL 数据库类型未知: ${DATABASE_URL:0:20}..."
  fi

  # 检查 SSL 模式
  if [[ $DATABASE_URL == *"sslmode=require"* ]] || [[ $DATABASE_URL == *"sslmode=verify"* ]]; then
    check_pass "数据库连接要求 SSL"
  elif [[ $DATABASE_URL == *"localhost"* ]]; then
    check_warn "数据库连接到 localhost (开发环境？)"
  else
    check_warn "数据库连接未要求 SSL (建议添加 sslmode=require)"
  fi
fi

echo ""
echo "========================================="
echo "2. 支付配置检查（可选）"
echo "========================================="
echo ""

# 支付宝
if [ -n "$ALIPAY_APP_ID" ] && [ -n "$ALIPAY_PRIVATE_KEY" ]; then
  check_pass "支付宝配置已设置"
else
  check_warn "支付宝配置未完整设置（如不使用可忽略）"
fi

# 微信支付
if [ -n "$WECHAT_APP_ID" ] && [ -n "$WECHAT_MCH_ID" ]; then
  check_pass "微信支付配置已设置"
else
  check_warn "微信支付配置未完整设置（如不使用可忽略）"
fi

# PayPal
if [ -n "$PAYPAL_CLIENT_ID" ] && [ -n "$PAYPAL_CLIENT_SECRET" ]; then
  check_pass "PayPal 配置已设置"
  if [ "$PAYPAL_MODE" = "live" ]; then
    check_pass "PayPal 使用生产模式"
  else
    check_warn "PayPal 未使用生产模式 (当前: ${PAYPAL_MODE:-未设置})"
  fi
else
  check_warn "PayPal 配置未完整设置（如不使用可忽略）"
fi

echo ""
echo "========================================="
echo "3. 监控配置检查（可选）"
echo "========================================="
echo ""

# Sentry
if [ -n "$NEXT_PUBLIC_SENTRY_DSN" ]; then
  check_pass "Sentry 错误监控已配置"
else
  check_warn "Sentry 未配置（推荐配置以监控生产错误）"
fi

echo ""
echo "========================================="
echo "4. 安全配置检查"
echo "========================================="
echo ""

# 检查端口
if [ -n "$PORT" ]; then
  if [ "$PORT" -lt 1024 ] && [ "$(id -u)" -ne 0 ]; then
    check_warn "端口 $PORT < 1024 需要 root 权限"
  else
    check_pass "端口配置: $PORT"
  fi
fi

# 检查文件权限
if [ -f ".env" ]; then
  ENV_PERMS=$(stat -c "%a" .env 2>/dev/null || stat -f "%OLp" .env 2>/dev/null)
  if [ "$ENV_PERMS" = "600" ] || [ "$ENV_PERMS" = "400" ]; then
    check_pass ".env 文件权限安全: $ENV_PERMS"
  else
    check_warn ".env 文件权限不安全: $ENV_PERMS (建议: 600)"
  fi
fi

# 检查 .gitignore
if [ -f ".gitignore" ]; then
  if grep -q "^\.env$" .gitignore; then
    check_pass ".env 已在 .gitignore 中"
  else
    check_fail ".env 未在 .gitignore 中！"
  fi
fi

echo ""
echo "========================================="
echo "5. 依赖和构建检查"
echo "========================================="
echo ""

# 检查 node_modules
if [ -d "node_modules" ]; then
  check_pass "依赖已安装"
else
  check_fail "依赖未安装，请运行: npm install"
fi

# 检查 Prisma Client
if [ -d "node_modules/.prisma" ]; then
  check_pass "Prisma Client 已生成"
else
  check_warn "Prisma Client 未生成，请运行: npx prisma generate"
fi

# 检查构建
if [ -d ".next" ]; then
  check_pass "Next.js 构建文件存在"
else
  check_warn "Next.js 未构建，请运行: npm run build"
fi

echo ""
echo "========================================="
echo "检查结果汇总"
echo "========================================="
echo ""

echo -e "${GREEN}✓ 通过: $PASSED${NC}"
echo -e "${YELLOW}⚠ 警告: $WARNINGS${NC}"
echo -e "${RED}✗ 失败: $FAILED${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
  echo -e "${RED}❌ 检查失败！请修复上述问题后再部署到生产环境。${NC}"
  echo ""
  echo "常见修复方法："
  echo "1. 生成 NEXTAUTH_SECRET:"
  echo "   openssl rand -base64 32"
  echo ""
  echo "2. 设置环境变量:"
  echo "   export NEXTAUTH_SECRET=\"生成的密钥\""
  echo "   export NODE_ENV=\"production\""
  echo ""
  echo "3. 配置数据库:"
  echo "   export DATABASE_URL=\"postgresql://user:pass@host:5432/db\""
  echo ""
  exit 1
elif [ $WARNINGS -gt 0 ]; then
  echo -e "${YELLOW}⚠️  检查完成，但有警告。建议修复后再部署。${NC}"
  echo ""
  exit 0
else
  echo -e "${GREEN}✅ 所有检查通过！可以安全部署到生产环境。${NC}"
  echo ""
  exit 0
fi
