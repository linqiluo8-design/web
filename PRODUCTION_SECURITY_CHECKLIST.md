# 🚀 生产环境部署安全检查清单

> **重要提示**：部署到生产环境前，请严格按照此清单逐项检查并完成！

---

## ✅ 已完成的安全修复（2025-11-21）

- ✅ **移除敏感日志** - `lib/auth.ts` 中的敏感信息日志已清理
- ✅ **生成新密钥** - 本地开发环境已使用安全的 NEXTAUTH_SECRET
- ✅ **更新文档** - `.env.example` 已添加详细的安全警告

---

## 🔴 第一优先级（部署前必须完成）

### 1. 生成生产环境 NEXTAUTH_SECRET

**在生产服务器上执行：**
```bash
# 生成密钥
openssl rand -base64 32

# 输出示例：
# VzwIscNhsASlZ+FC+17xrXAwsOQeeuU4/HikPRCpP+s=
```

**设置环境变量（推荐方式）：**
```bash
# 不要将密钥写入 .env 文件，直接设置环境变量
export NEXTAUTH_SECRET="你生成的密钥"

# 或者在云服务商管理面板中设置环境变量（推荐）
# Vercel: Settings > Environment Variables
# Railway: Variables
# Heroku: Config Vars
```

**验证密钥已正确设置：**
```bash
echo $NEXTAUTH_SECRET | wc -c  # 输出应该 >= 32
```

### 2. 设置 NODE_ENV 为 production

```bash
export NODE_ENV=production
```

这将确保：
- 不输出开发环境日志
- 启用生产优化
- 禁用调试功能

### 3. 配置数据库（从 SQLite 切换到 PostgreSQL）

**修改 `prisma/schema.prisma`：**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**设置生产数据库 URL：**
```bash
# PostgreSQL 连接字符串格式
export DATABASE_URL="postgresql://username:password@host:5432/dbname?schema=public"
```

**运行数据库迁移：**
```bash
npx prisma migrate deploy
npx prisma generate
```

### 4. 启用 HTTPS

**使用 Let's Encrypt 获取免费 SSL 证书：**
```bash
# 使用 certbot
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

**或使用云服务商提供的 SSL（推荐）：**
- Vercel: 自动启用 HTTPS
- Cloudflare: 一键启用 SSL/TLS
- AWS CloudFront: 配置 ACM 证书

---

## 🟡 第二优先级（强烈建议）

### 5. 配置支付商户信息

**支付宝：**
```bash
export ALIPAY_APP_ID="你的AppID"
export ALIPAY_PRIVATE_KEY="你的私钥"
export ALIPAY_PUBLIC_KEY="支付宝公钥"
```

**微信支付：**
```bash
export WECHAT_APP_ID="你的AppID"
export WECHAT_MCH_ID="商户号"
export WECHAT_API_KEY="API密钥"
export WECHAT_SERIAL_NO="证书序列号"
```

**PayPal：**
```bash
export PAYPAL_CLIENT_ID="你的ClientID"
export PAYPAL_CLIENT_SECRET="你的ClientSecret"
export PAYPAL_MODE="live"  # 生产环境使用 live
```

### 6. 添加 Rate Limiting（防止暴力破解）

**安装依赖：**
```bash
npm install @upstash/ratelimit @upstash/redis
```

**配置示例：**
```typescript
// lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  analytics: true,
})
```

### 7. 配置 CORS（防止跨域攻击）

**在 `next.config.js` 添加：**
```javascript
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: 'https://yourdomain.com' },
        { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
        { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
      ],
    },
  ]
}
```

### 8. 设置数据库备份

**PostgreSQL 自动备份脚本：**
```bash
#!/bin/bash
# backup-db.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DB_NAME="your_database"

pg_dump $DB_NAME > $BACKUP_DIR/backup_$DATE.sql
gzip $BACKUP_DIR/backup_$DATE.sql

# 保留最近 7 天的备份
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: backup_$DATE.sql.gz"
```

**添加到 crontab（每天凌晨 2 点备份）：**
```bash
0 2 * * * /path/to/backup-db.sh
```

---

## 🟢 第三优先级（推荐优化）

### 9. 配置日志监控服务

**Sentry（错误监控）：**
```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs

# 设置环境变量
export SENTRY_DSN="你的DSN"
export SENTRY_AUTH_TOKEN="你的AuthToken"
```

### 10. 添加 CSP（内容安全策略）

**在 `next.config.js` 添加：**
```javascript
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "font-src 'self' data:",
            "connect-src 'self' https://api.yourdomain.com",
          ].join('; '),
        },
      ],
    },
  ]
}
```

### 11. 配置 CDN 加速

**Cloudflare 设置步骤：**
1. 注册 Cloudflare 账号
2. 添加你的域名
3. 修改 DNS 服务器为 Cloudflare 提供的 NS
4. 启用 "Proxied" 模式（橙色云朵）
5. 配置缓存规则和 Page Rules

### 12. 优化 Session 配置

**在 `lib/auth.ts` 修改：**
```typescript
session: {
  strategy: "jwt",
  maxAge: 7 * 24 * 60 * 60, // 7天（从30天改为7天更安全）
  updateAge: 24 * 60 * 60,   // 24小时
}
```

---

## 📋 部署前最终检查

复制以下命令在生产服务器上运行，检查所有关键配置：

```bash
#!/bin/bash
echo "🔍 生产环境安全检查..."
echo ""

# 检查 NODE_ENV
if [ "$NODE_ENV" = "production" ]; then
  echo "✅ NODE_ENV: production"
else
  echo "❌ NODE_ENV: $NODE_ENV (应该是 production)"
fi

# 检查 NEXTAUTH_SECRET
if [ -n "$NEXTAUTH_SECRET" ]; then
  SECRET_LENGTH=$(echo -n "$NEXTAUTH_SECRET" | wc -c)
  if [ $SECRET_LENGTH -ge 32 ]; then
    echo "✅ NEXTAUTH_SECRET: 已设置 ($SECRET_LENGTH 字节)"
  else
    echo "⚠️  NEXTAUTH_SECRET: 长度不足 ($SECRET_LENGTH 字节，建议 >= 32)"
  fi
else
  echo "❌ NEXTAUTH_SECRET: 未设置！"
fi

# 检查数据库
if [[ $DATABASE_URL == postgresql* ]]; then
  echo "✅ DATABASE: PostgreSQL"
elif [[ $DATABASE_URL == mysql* ]]; then
  echo "✅ DATABASE: MySQL"
elif [[ $DATABASE_URL == file* ]]; then
  echo "⚠️  DATABASE: SQLite (不推荐用于生产)"
else
  echo "❌ DATABASE: 未知类型"
fi

# 检查 HTTPS
if [ "$NEXTAUTH_URL" = https* ]; then
  echo "✅ HTTPS: 已启用"
else
  echo "⚠️  HTTPS: 未启用 ($NEXTAUTH_URL)"
fi

echo ""
echo "检查完成！"
```

---

## 🔒 安全最佳实践

### 永远不要做：
- ❌ 将 `.env` 文件提交到 Git
- ❌ 在日志中输出密码、Token、密钥
- ❌ 使用默认或弱密码
- ❌ 在生产环境使用 SQLite
- ❌ 禁用 HTTPS
- ❌ 忽略安全警告和更新

### 定期检查：
- 📅 每月更新依赖包（`npm audit fix`）
- 📅 每季度审查访问日志和安全警报
- 📅 每半年更换关键密钥（NEXTAUTH_SECRET、数据库密码等）
- 📅 每年进行完整的安全审计

---

## 📞 遇到问题？

如果在部署过程中遇到安全相关的问题：

1. 检查日志：`pm2 logs` 或 `docker logs <container-id>`
2. 验证环境变量：`printenv | grep -E "NEXTAUTH|DATABASE"`
3. 测试数据库连接：`npx prisma studio`
4. 查看 Next.js 文档：https://nextjs.org/docs/deployment

---

**最后更新**: 2025-11-21
**修复人员**: Claude AI Assistant
