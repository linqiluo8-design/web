#!/bin/bash

# 修复 Prisma 迁移错误的快速脚本
# 专门用于解决 P3006 shadow database 错误

set -e

echo "================================================"
echo "  Prisma 迁移错误修复工具"
echo "================================================"
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_success() {
  echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1"
}

echo "检测到的错误类型："
echo "  P3006 - Migration failed to apply cleanly to shadow database"
echo ""

echo "此脚本提供以下修复选项："
echo ""
echo "1. 使用 db push（推荐，不会丢失数据）"
echo "2. 重置迁移历史（保留数据）"
echo "3. 完全重置数据库（⚠️ 会丢失所有数据）"
echo ""

read -p "请选择修复方法 (1/2/3) [默认: 1]: " CHOICE
CHOICE=${CHOICE:-1}

case $CHOICE in
  1)
    echo ""
    print_warning "使用 Prisma db push 更新数据库..."
    echo "此方法会直接同步 schema 到数据库，不创建迁移文件"
    echo ""

    npx prisma db push --skip-generate

    if [ $? -eq 0 ]; then
      print_success "数据库结构已更新！"
      echo ""
      print_warning "现在生成 Prisma Client..."
      npx prisma generate
      print_success "完成！"
    else
      print_error "db push 失败"
      exit 1
    fi
    ;;

  2)
    echo ""
    print_warning "重置迁移历史..."
    echo "此方法会删除迁移历史但保留数据"
    echo ""

    # 备份迁移目录
    if [ -d "prisma/migrations" ]; then
      TIMESTAMP=$(date +%Y%m%d_%H%M%S)
      mv prisma/migrations "prisma/migrations_backup_$TIMESTAMP"
      print_success "已备份迁移历史到: prisma/migrations_backup_$TIMESTAMP"
    fi

    # 使用 db push 同步结构
    print_warning "同步数据库结构..."
    npx prisma db push --skip-generate

    # 创建基线迁移
    print_warning "创建新的迁移基线..."
    npx prisma migrate dev --name baseline --create-only

    # 标记迁移为已应用
    print_warning "标记迁移为已应用..."
    npx prisma migrate resolve --applied baseline

    print_success "迁移历史已重置！"

    # 生成 Client
    npx prisma generate
    print_success "完成！"
    ;;

  3)
    echo ""
    print_error "警告：此操作将删除所有数据！"
    read -p "确认要完全重置数据库吗？输入 'YES' 继续: " CONFIRM

    if [ "$CONFIRM" = "YES" ]; then
      print_warning "正在重置数据库..."
      npx prisma migrate reset --force

      if [ $? -eq 0 ]; then
        print_success "数据库已完全重置！"
      else
        print_error "重置失败"
        exit 1
      fi
    else
      print_error "操作已取消"
      exit 1
    fi
    ;;

  *)
    print_error "无效选项"
    exit 1
    ;;
esac

echo ""
echo "================================================"
print_success "修复完成！"
echo "================================================"
echo ""

echo "建议的下一步操作："
echo "1. 验证数据库连接: npx prisma studio"
echo "2. 检查数据库结构: npx prisma db pull"
echo "3. 运行应用测试"
echo ""
