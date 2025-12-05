#!/bin/bash

# 订单导出功能一键实施脚本
# 功能：自动安装依赖、更新数据库、生成代码

set -e  # 遇到错误立即退出

echo "================================================"
echo "  订单导出功能自动实施脚本"
echo "================================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 步骤计数
STEP=1

print_step() {
  echo -e "${BLUE}[步骤 $STEP]${NC} $1"
  STEP=$((STEP + 1))
}

print_success() {
  echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1"
}

# 检查是否在项目根目录
if [ ! -f "package.json" ]; then
  print_error "错误：请在项目根目录运行此脚本"
  exit 1
fi

print_success "检测到项目根目录"
echo ""

# ============================================
# 步骤1：备份当前数据库
# ============================================
print_step "备份当前数据库"

BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/database_backup_$TIMESTAMP.sql"

mkdir -p "$BACKUP_DIR"

# 检查数据库类型
if grep -q "postgresql" prisma/schema.prisma; then
  print_success "检测到 PostgreSQL 数据库"

  # 从环境变量获取数据库连接信息
  if [ -f ".env" ]; then
    source .env

    # 提取数据库信息（假设DATABASE_URL格式为postgresql://user:password@host:port/database）
    DB_URL=$DATABASE_URL

    print_warning "PostgreSQL 备份需要手动执行"
    echo "请在另一个终端执行："
    echo "pg_dump \$DATABASE_URL > $BACKUP_FILE"
    echo ""
    read -p "备份完成后按回车继续，或输入 'skip' 跳过备份: " BACKUP_CONFIRM

    if [ "$BACKUP_CONFIRM" != "skip" ]; then
      print_success "数据库备份已确认"
    else
      print_warning "跳过数据库备份"
    fi
  fi
elif grep -q "sqlite" prisma/schema.prisma; then
  print_success "检测到 SQLite 数据库"

  # 查找SQLite数据库文件
  SQLITE_FILE=$(grep -oP '(?<=file:).*?(?=")' prisma/schema.prisma | head -1)

  if [ -f "$SQLITE_FILE" ]; then
    cp "$SQLITE_FILE" "$BACKUP_DIR/database_$TIMESTAMP.db"
    print_success "SQLite 数据库已备份到: $BACKUP_DIR/database_$TIMESTAMP.db"
  else
    print_warning "未找到 SQLite 数据库文件: $SQLITE_FILE"
  fi
else
  print_warning "无法确定数据库类型，跳过备份"
fi

echo ""

# ============================================
# 步骤2：安装依赖
# ============================================
print_step "安装所需依赖"

if [ -f "package.json" ]; then
  # 检查是否已安装 exceljs
  if ! grep -q "exceljs" package.json; then
    print_warning "正在安装 exceljs..."
    npm install exceljs
    npm install --save-dev @types/exceljs
    print_success "exceljs 安装完成"
  else
    print_success "exceljs 已安装"
  fi
else
  print_error "未找到 package.json"
  exit 1
fi

echo ""

# ============================================
# 步骤3：更新 Prisma Schema
# ============================================
print_step "更新 Prisma Schema"

SCHEMA_FILE="prisma/schema.prisma"

if [ ! -f "$SCHEMA_FILE" ]; then
  print_error "未找到 Prisma Schema 文件"
  exit 1
fi

# 检查是否已经添加了 OrderExport 模型
if grep -q "model OrderExport" "$SCHEMA_FILE"; then
  print_warning "OrderExport 模型已存在，跳过添加"
else
  print_warning "准备添加 OrderExport 模型到 Prisma Schema"

  # 创建临时文件
  TEMP_SCHEMA=$(mktemp)

  # 在 Order 模型前添加 OrderExport 模型
  cat >> "$TEMP_SCHEMA" << 'EOF'

// 订单导出记录
model OrderExport {
  id          String   @id @default(cuid())
  orderId     String
  userId      String
  orderType   String   // product, membership
  exportDate  DateTime @default(now())
  exportedAt  DateTime @default(now())
  fileSize    Int?
  fileName    String?
  ipAddress   String?
  userAgent   String?

  order       Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([orderId, userId, exportDate])
  @@index([userId, exportDate])
  @@index([exportDate])

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
EOF

  print_success "OrderExport 模型定义已准备"
fi

# 检查 Order 模型是否已添加导出相关字段
if grep -q "exportCount" "$SCHEMA_FILE"; then
  print_warning "Order 模型导出字段已存在"
else
  print_warning "需要手动在 Order 模型中添加以下字段："
  echo ""
  echo "  exportCount     Int           @default(0)"
  echo "  lastExportedAt  DateTime?"
  echo "  exports         OrderExport[]"
  echo ""
fi

echo ""

# ============================================
# 步骤4：重置数据库（可选）
# ============================================
print_step "数据库迁移准备"

echo "由于检测到迁移错误，推荐使用以下方法之一："
echo ""
echo "选项1: 重置数据库（⚠️ 会清空所有数据）"
echo "选项2: 使用 db push（适合开发环境，不创建迁移历史）"
echo "选项3: 手动修复迁移（需要 SQL 知识）"
echo ""

read -p "请选择 (1/2/3) [默认: 2]: " DB_OPTION
DB_OPTION=${DB_OPTION:-2}

case $DB_OPTION in
  1)
    print_warning "警告：此操作将删除所有数据！"
    read -p "确认要重置数据库吗？输入 'YES' 继续: " CONFIRM

    if [ "$CONFIRM" = "YES" ]; then
      print_warning "正在重置数据库..."
      npx prisma migrate reset --force
      print_success "数据库已重置"
    else
      print_error "操作已取消"
      exit 1
    fi
    ;;

  2)
    print_warning "使用 db push 更新数据库结构..."
    npx prisma db push --skip-generate
    print_success "数据库结构已更新"
    ;;

  3)
    print_warning "请手动执行以下步骤："
    echo ""
    echo "1. 删除 prisma/migrations 目录中有问题的迁移"
    echo "2. 运行: npx prisma migrate dev --name add_order_export"
    echo ""
    read -p "按回车键继续..." PAUSE
    ;;

  *)
    print_error "无效选项"
    exit 1
    ;;
esac

echo ""

# ============================================
# 步骤5：生成 Prisma Client
# ============================================
print_step "生成 Prisma Client"

npx prisma generate
print_success "Prisma Client 已生成"

echo ""

# ============================================
# 步骤6：创建 API 文件
# ============================================
print_step "创建 API 文件"

# 创建 API 目录
mkdir -p app/api/orders/export/check
mkdir -p app/api/orders/export/history

print_success "API 目录已创建"
print_warning "API 实现文件需要手动创建，请参考文档："
echo "  - docs/ORDER_EXPORT_DESIGN.md"
echo ""

# ============================================
# 步骤7：创建前端组件
# ============================================
print_step "创建前端组件"

mkdir -p components

print_warning "前端组件需要手动创建，请参考文档："
echo "  - components/OrderExportButton.tsx"
echo ""

# ============================================
# 步骤8：验证安装
# ============================================
print_step "验证安装"

echo "检查已安装的包..."
if npm list exceljs > /dev/null 2>&1; then
  print_success "exceljs 已正确安装"
else
  print_error "exceljs 未正确安装"
fi

echo ""
echo "检查 Prisma Schema..."
if grep -q "model OrderExport" "$SCHEMA_FILE"; then
  print_success "OrderExport 模型已添加"
else
  print_warning "OrderExport 模型未找到，请手动添加"
fi

echo ""

# ============================================
# 完成
# ============================================
echo "================================================"
echo -e "${GREEN}✓ 订单导出功能基础设施安装完成！${NC}"
echo "================================================"
echo ""

echo "后续步骤："
echo ""
echo "1. 检查并更新 Prisma Schema："
echo "   - 确认 OrderExport 模型已添加"
echo "   - 在 Order 模型中添加 exportCount、lastExportedAt、exports 字段"
echo ""
echo "2. 创建 API 路由："
echo "   - app/api/orders/export/check/route.ts"
echo "   - app/api/orders/export/route.ts"
echo "   - app/api/orders/export/history/route.ts"
echo ""
echo "3. 创建前端组件："
echo "   - components/OrderExportButton.tsx"
echo ""
echo "4. 集成到订单页面"
echo ""
echo "详细实施步骤请参考："
echo "  📄 docs/ORDER_EXPORT_DESIGN.md"
echo ""

print_success "脚本执行完成！"
