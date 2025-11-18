# 📊 数据库切换指南 - SQLite 迁移到 PostgreSQL/MySQL 等

## 一、概述

当前项目使用 **SQLite** 作为开发数据库，适合本地开发和小规模部署。本指南将帮助你切换到生产级数据库（PostgreSQL、MySQL、SQL Server 等）。

### 当前配置

- **ORM**：Prisma 6.19.0
- **当前数据库**：SQLite
- **数据库文件位置**：`prisma/dev.db`（被 .gitignore 忽略）

---

## 二、Prisma 支持的数据库类型

Prisma 支持以下数据库类型（按推荐程度排序）：

### 1. PostgreSQL ⭐⭐⭐⭐⭐ (强烈推荐)

**推荐指数**：⭐⭐⭐⭐⭐

**优势**：
- 功能强大，支持高级数据类型（JSON、数组、全文搜索等）
- 性能优秀，适合大规模应用
- 开源免费，社区活跃
- 云服务广泛支持（AWS RDS、Google Cloud SQL、Azure Database 等）
- 支持完整的事务和并发控制
- 与 Prisma 配合最佳

**适用场景**：
- 生产环境部署
- 需要高级查询功能
- 大数据量处理
- 多用户并发访问

**云服务提供商**：
- Supabase（免费额度）
- Neon（免费额度，无服务器）
- Railway（免费额度）
- AWS RDS、Google Cloud SQL、Azure

---

### 2. MySQL / MariaDB ⭐⭐⭐⭐

**推荐指数**：⭐⭐⭐⭐

**优势**：
- 广泛使用，生态成熟
- 性能优秀
- 支持多种云服务
- MariaDB 是 MySQL 的开源替代品，兼容性好

**适用场景**：
- 传统 Web 应用
- 中小型企业应用
- 已有 MySQL 基础设施

**云服务提供商**：
- PlanetScale（免费额度）
- AWS RDS、Google Cloud SQL
- DigitalOcean Managed Database

---

### 3. Microsoft SQL Server ⭐⭐⭐

**推荐指数**：⭐⭐⭐

**优势**：
- 企业级数据库
- Windows 生态系统集成好
- 强大的 T-SQL 语言

**适用场景**：
- .NET 应用
- Windows Server 环境
- 企业级应用

**云服务**：
- Azure SQL Database

---

### 4. MongoDB ⭐⭐⭐

**推荐指数**：⭐⭐⭐

**优势**：
- NoSQL 文档数据库
- 灵活的 Schema
- 水平扩展性好

**适用场景**：
- 非结构化数据
- 快速迭代项目
- 需要灵活 Schema

**注意**：当前项目使用关系型数据模型，切换到 MongoDB 需要重构数据模型。

**云服务**：
- MongoDB Atlas（免费额度）

---

### 5. CockroachDB ⭐⭐⭐

**推荐指数**：⭐⭐⭐

**优势**：
- 分布式 SQL 数据库
- PostgreSQL 兼容
- 云原生设计

**适用场景**：
- 全球分布式应用
- 需要高可用性
- 多区域部署

**云服务**：
- CockroachDB Cloud（免费额度）

---

### 6. SQLite ⭐⭐

**推荐指数**：⭐⭐ (仅用于开发)

**优势**：
- 零配置，易于开发
- 轻量级
- 嵌入式数据库

**局限性**：
- ❌ 不支持多用户并发写入
- ❌ 不适合生产环境
- ❌ 功能有限

**适用场景**：
- 本地开发
- 小型工具
- 桌面应用

---

## 三、切换到 PostgreSQL（推荐）

### 📋 前置准备

#### 选项1：使用云服务（推荐）

**免费 PostgreSQL 云服务推荐**：

1. **Supabase**（推荐）
   - 网址：https://supabase.com
   - 免费额度：500MB 数据库，无限 API 请求
   - 额外功能：实时数据库、存储、认证
   - 注册后即可获得数据库连接字符串

2. **Neon**（推荐）
   - 网址：https://neon.tech
   - 免费额度：3GB 存储，无服务器架构
   - 特色：自动扩缩容，按使用计费

3. **Railway**
   - 网址：https://railway.app
   - 免费额度：$5/月
   - 简单易用

#### 选项2：本地安装 PostgreSQL

```bash
# macOS（使用 Homebrew）
brew install postgresql@16
brew services start postgresql@16

# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# Windows
# 下载安装包：https://www.postgresql.org/download/windows/

# 创建数据库
createdb myapp_dev

# 或使用 psql
psql postgres
CREATE DATABASE myapp_dev;
```

---

### ✅ 切换步骤（共6步）

#### 步骤1：安装 PostgreSQL 依赖

PostgreSQL 需要额外的 Node.js 驱动：

```bash
npm install pg
# 或
yarn add pg
```

#### 步骤2：修改 Prisma Schema

打开 `prisma/schema.prisma`，修改 `datasource` 配置：

**修改前（SQLite）**：
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

**修改后（PostgreSQL）**：
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

#### 步骤3：配置数据库连接字符串

创建或修改 `.env` 文件（如果不存在则创建）：

```bash
# PostgreSQL 连接字符串格式
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"

# 示例：
# 本地开发
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/myapp_dev?schema=public"

# Supabase
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres?schema=public"

# Neon
DATABASE_URL="postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require"

# Railway
DATABASE_URL="postgresql://postgres:password@containers-us-west-xxx.railway.app:5432/railway?sslmode=require"
```

**连接字符串说明**：
- `USER`: 数据库用户名（通常是 `postgres`）
- `PASSWORD`: 数据库密码
- `HOST`: 数据库主机地址
- `PORT`: 端口（PostgreSQL 默认 5432）
- `DATABASE`: 数据库名称
- `schema`: Schema 名称（默认 `public`）
- `sslmode`: SSL 模式（云服务通常需要 `require`）

#### 步骤4：删除旧的 SQLite migrations

由于数据库类型变更，需要重置 migrations：

```bash
# 备份当前数据（如果需要）
npm run db:backup

# 删除 migrations 目录
rm -rf prisma/migrations

# 或者在 Windows 上
# rmdir /s /q prisma\migrations
```

#### 步骤5：创建新的 Migration

```bash
# 创建初始 migration
npx prisma migrate dev --name init

# 这个命令会：
# 1. 连接到 PostgreSQL 数据库
# 2. 根据 schema.prisma 生成 SQL
# 3. 在数据库中创建表
# 4. 生成 Prisma Client
```

**如果遇到错误**，可能需要先推送 schema：

```bash
# 直接推送 schema 到数据库（不创建 migration）
npx prisma db push

# 然后生成 Prisma Client
npx prisma generate
```

#### 步骤6：数据迁移（可选）

如果需要将 SQLite 中的数据迁移到 PostgreSQL：

**方法1：使用备份脚本**

```bash
# 1. 从 SQLite 导出数据
npm run db:backup

# 2. 切换到 PostgreSQL（按上述步骤）

# 3. 导入数据到 PostgreSQL
npm run db:restore
```

**方法2：手动迁移**

如果数据量不大，可以考虑：
1. 在 SQLite 中导出数据为 JSON
2. 编写脚本将数据插入 PostgreSQL
3. 使用 Prisma Studio 手动迁移

---

### 🔍 验证切换是否成功

```bash
# 1. 检查数据库连接
npx prisma db pull

# 2. 打开 Prisma Studio
npx prisma studio

# 3. 运行开发服务器
npm run dev

# 4. 测试创建数据（如创建用户、商品等）
```

---

## 四、切换到 MySQL

### 步骤概述

与 PostgreSQL 类似，但有一些差异：

#### 1. 安装 MySQL 驱动

```bash
npm install mysql2
```

#### 2. 修改 Prisma Schema

```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

#### 3. 配置连接字符串

```bash
# MySQL 连接字符串格式
DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DATABASE"

# 示例：
# 本地开发
DATABASE_URL="mysql://root:password@localhost:3306/myapp_dev"

# PlanetScale
DATABASE_URL="mysql://username:password@aws.connect.psdb.cloud/database?sslaccept=strict"
```

#### 4. Schema 调整

MySQL 与 SQLite/PostgreSQL 有一些差异，可能需要调整：

**Text 类型调整**：

```prisma
// SQLite/PostgreSQL
model User {
  description String?  // 无限制长度
}

// MySQL 需要指定类型
model User {
  description String? @db.Text  // 或 @db.VarChar(500)
}
```

**UUID 处理**：

```prisma
// PostgreSQL 原生支持 UUID
id String @id @default(uuid())

// MySQL 需要用 cuid 或手动处理
id String @id @default(cuid())
```

#### 5. 其他步骤

与 PostgreSQL 相同（删除 migrations、重新生成等）。

---

## 五、切换到 MongoDB

### ⚠️ 重要提示

MongoDB 是 NoSQL 文档数据库，当前项目使用的是关系型数据模型，直接切换需要**重构数据模型**。

### 需要的调整

1. **关系模型改为嵌套文档**
   ```prisma
   // SQLite/PostgreSQL（关系型）
   model Order {
     id         String      @id @default(cuid())
     orderItems OrderItem[]
   }

   model OrderItem {
     id        String @id @default(cuid())
     orderId   String
     order     Order  @relation(fields: [orderId], references: [id])
   }

   // MongoDB（文档型）
   model Order {
     id         String      @id @default(auto()) @map("_id") @db.ObjectId
     orderItems OrderItem[] // 嵌套数组
   }

   type OrderItem {
     productId String
     quantity  Int
     price     Float
   }
   ```

2. **连接字符串**
   ```bash
   DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority"
   ```

3. **Schema 调整**
   - 移除外键约束
   - 使用 `@map("_id")` 和 `@db.ObjectId`
   - 考虑数据嵌套而不是关联

**不推荐切换到 MongoDB**，除非有特殊需求。

---

## 六、需要修改的文件清单

| 文件路径 | 是否必须修改 | 修改内容 |
|---------|-------------|---------|
| `prisma/schema.prisma` | ✅ **必须** | 修改 `provider` 为目标数据库类型 |
| `.env` | ✅ **必须** | 配置新的 `DATABASE_URL` |
| `package.json` | ⚠️ PostgreSQL/MySQL需要 | 添加 `pg` 或 `mysql2` 依赖 |
| `prisma/migrations/` | ✅ **必须删除** | 删除旧的 SQLite migrations |
| 代码文件 | ❌ 无需修改 | Prisma Client API 保持一致 |

---

## 七、数据库对比表

| 特性 | SQLite | PostgreSQL | MySQL | MongoDB | SQL Server |
|------|--------|------------|-------|---------|-----------|
| **类型** | 关系型 | 关系型 | 关系型 | 文档型 | 关系型 |
| **并发写入** | ❌ 差 | ✅ 优秀 | ✅ 良好 | ✅ 优秀 | ✅ 优秀 |
| **性能** | 🟡 小规模快 | ✅ 高性能 | ✅ 高性能 | ✅ 高性能 | ✅ 高性能 |
| **JSON 支持** | ✅ 有限 | ✅ 完整 | ✅ 完整 | ✅ 原生 | ✅ 完整 |
| **全文搜索** | ❌ 有限 | ✅ 完整 | ✅ 完整 | ✅ 完整 | ✅ 完整 |
| **事务** | ✅ 支持 | ✅ 完整 | ✅ 完整 | ✅ 支持 | ✅ 完整 |
| **水平扩展** | ❌ 不支持 | 🟡 有限 | 🟡 有限 | ✅ 优秀 | 🟡 有限 |
| **免费云服务** | N/A | ✅ 多个 | ✅ 多个 | ✅ Atlas | ❌ 无 |
| **学习曲线** | ✅ 简单 | 🟡 中等 | ✅ 简单 | 🟡 中等 | 🟡 中等 |
| **生产环境推荐** | ❌ 不推荐 | ✅ 强烈推荐 | ✅ 推荐 | 🟡 看情况 | ✅ 推荐 |

---

## 八、常见问题

### Q1: 数据会丢失吗？

**不会**，但需要注意：
- 切换前备份数据（`npm run db:backup`）
- 切换数据库类型不会自动迁移数据
- 需要手动导入数据或使用迁移脚本

### Q2: 代码需要改动吗？

**几乎不需要**，Prisma 的优势是：
- Prisma Client API 在不同数据库间保持一致
- 只需要修改 `schema.prisma` 和 `.env`
- 应用代码无需改动

**例外情况**：
- 使用了特定数据库的原生查询（`$queryRaw`）
- 使用了特定数据库的数据类型

### Q3: 如何回退到 SQLite？

```bash
# 1. 修改 schema.prisma
provider = "sqlite"

# 2. 修改 .env
DATABASE_URL="file:./dev.db"

# 3. 删除 migrations 并重新生成
rm -rf prisma/migrations
npx prisma migrate dev --name init

# 4. 恢复数据（如果有备份）
npm run db:restore
```

### Q4: 本地开发用 SQLite，生产用 PostgreSQL 可以吗？

**不推荐**，原因：
- 可能出现本地测试通过但生产环境失败
- 两种数据库的行为有差异（如日期处理、大小写敏感等）
- 难以排查环境差异导致的问题

**建议**：
- 本地和生产使用相同类型的数据库
- 使用 Docker 在本地运行 PostgreSQL
- 或使用云服务的免费开发数据库

### Q5: 多环境如何管理数据库？

**推荐方案**：

```bash
# .env.development（开发环境）
DATABASE_URL="postgresql://postgres:dev@localhost:5432/myapp_dev"

# .env.test（测试环境）
DATABASE_URL="postgresql://postgres:test@localhost:5432/myapp_test"

# .env.production（生产环境）
DATABASE_URL="postgresql://user:pass@prod-server:5432/myapp_prod"
```

使用环境变量切换：
```bash
# 开发
npm run dev

# 生产构建
NODE_ENV=production npm run build
```

---

## 九、推荐配置

### 对于本项目（虚拟商品售卖平台）

**推荐数据库**：PostgreSQL

**推荐云服务**：
1. **Supabase**（最推荐）
   - 免费额度充足
   - 自带实时功能和存储
   - 简单易用，文档完善

2. **Neon**（备选）
   - 无服务器架构
   - 自动扩缩容
   - 按使用计费

**本地开发**：
- 使用 Docker 运行 PostgreSQL
- 或使用 Supabase 免费数据库

---

## 十、快速切换命令

### PostgreSQL（完整流程）

```bash
# 1. 安装依赖
npm install pg

# 2. 修改 schema.prisma
# 将 provider 改为 "postgresql"

# 3. 配置 .env
echo 'DATABASE_URL="postgresql://postgres:password@localhost:5432/myapp_dev"' > .env

# 4. 删除旧 migrations
rm -rf prisma/migrations

# 5. 创建新 migration
npx prisma migrate dev --name init

# 6. 运行开发服务器
npm run dev
```

### MySQL（完整流程）

```bash
# 1. 安装依赖
npm install mysql2

# 2. 修改 schema.prisma
# 将 provider 改为 "mysql"

# 3. 配置 .env
echo 'DATABASE_URL="mysql://root:password@localhost:3306/myapp_dev"' > .env

# 4. 删除旧 migrations
rm -rf prisma/migrations

# 5. 创建新 migration
npx prisma migrate dev --name init

# 6. 运行开发服务器
npm run dev
```

---

## 十一、使用 Docker 本地运行 PostgreSQL

如果不想使用云服务，可以用 Docker：

### 创建 `docker-compose.yml`

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: myapp_postgres
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: yourpassword
      POSTGRES_DB: myapp_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### 启动数据库

```bash
# 启动
docker-compose up -d

# 停止
docker-compose down

# 查看日志
docker-compose logs -f
```

### 连接字符串

```bash
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/myapp_dev"
```

---

## 十二、总结

### 最简单的切换流程（PostgreSQL）

```bash
# ⬇️ 3步完成切换
# 1. 注册 Supabase 并获取数据库连接字符串
# 2. 修改 prisma/schema.prisma 的 provider
# 3. 配置 .env 并运行 migration

npm install pg
# 修改 schema.prisma provider = "postgresql"
echo 'DATABASE_URL="你的连接字符串"' > .env
rm -rf prisma/migrations
npx prisma migrate dev --name init
npm run dev
```

**就这么简单！** Prisma 让数据库迁移变得非常容易。

---

## 十三、参考资源

- [Prisma 官方文档](https://www.prisma.io/docs)
- [PostgreSQL 官方文档](https://www.postgresql.org/docs/)
- [MySQL 官方文档](https://dev.mysql.com/doc/)
- [Supabase 文档](https://supabase.com/docs)
- [Neon 文档](https://neon.tech/docs/introduction)

---

**文档版本**：v1.0
**创建日期**：2025-11-18
**最后更新**：2025-11-18
**作者**：Claude AI Assistant
**状态**：已完成
