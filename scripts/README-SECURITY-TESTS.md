# 安全测试脚本使用指南

本目录包含两个主要的安全测试脚本，用于测试系统的安全性。

## 📋 脚本列表

### 1. security-vulnerability-scan.js - 安全漏洞扫描器

**功能**: 全面扫描系统的安全漏洞

**检测项目** (14类漏洞):
1. SQL注入攻击
2. XSS跨站脚本攻击
3. CSRF跨站请求伪造
4. 权限绕过与越权访问
5. 价格篡改攻击
6. URL/路径注入
7. 认证绕过
8. 敏感信息泄露
9. 输入验证漏洞
10. 会话安全
11. 支付流程安全
12. 订单逻辑漏洞
13. 文件上传安全
14. API速率限制

**使用方法**:
```bash
# 模拟支付模式（推荐）
npm run security:scan

# 真实支付模式（谨慎使用）
npm run security:scan:real

# 或直接运行
node scripts/security-vulnerability-scan.js mock
node scripts/security-vulnerability-scan.js real
```

**输出**:
- 彩色终端输出
- 详细的漏洞报告
- 按严重程度分类（Critical/High/Medium/Low）
- 安全通过率评分
- 生产环境部署建议

---

### 2. test-security-alerts.js - 安全警报功能测试器

**功能**: 测试安全警报系统是否正常工作

**测试项目**:
1. 价格篡改警报 (PRICE_MANIPULATION)
2. 负价格警报 (NEGATIVE_PRICE)
3. 超大数量警报 (EXCESSIVE_QUANTITY)
4. 订单项过多警报 (EXCESSIVE_ORDER_ITEMS)
5. 可疑URL警报 (SUSPICIOUS_URL)
6. 超长字符串警报
7. SQL注入尝试检测
8. XSS尝试检测

**使用方法**:
```bash
# 运行安全警报测试
npm run security:test-alerts

# 或直接运行
node scripts/test-security-alerts.js
```

**输出**:
- 彩色终端输出
- 触发的警报列表
- 警报类型统计
- 最近的安全警报详情
- Prisma命令示例（手动插入警报）

---

## 🚀 快速开始

### 准备工作

1. **启动开发服务器**:
```bash
npm run dev
```

2. **确保数据库已初始化**:
```bash
# 如果数据库不存在，运行：
npx prisma db push

# 生成Prisma客户端
npx prisma generate
```

3. **创建测试数据**（可选）:
```bash
DATABASE_URL="file:./prisma/dev.db" npx tsx scripts/create-test-products.ts
```

### 运行测试

```bash
# 1. 运行安全漏洞扫描
npm run security:scan

# 2. 运行安全警报测试
npm run security:test-alerts

# 3. 运行全站功能测试
npm run test:all
```

---

## 📊 安全警报类型说明

系统支持以下类型的安全警报：

| 警报类型 | 严重程度 | 说明 |
|---------|---------|------|
| `PRICE_MANIPULATION` | Critical | 检测到价格篡改尝试 |
| `NEGATIVE_PRICE` | High | 检测到负价格 |
| `PRICE_INCREASE` | High | 使用会员折扣后价格反而上涨 |
| `FREE_PRODUCT_WITH_MEMBERSHIP` | Medium | 免费商品使用会员折扣 |
| `EXCESSIVE_QUANTITY` | Medium | 异常大的订单数量 |
| `EXCESSIVE_ORDER_ITEMS` | Medium | 订单项数量过多 |
| `INVALID_DISCOUNT_RATE` | High | 无效的折扣率 |
| `ABNORMAL_DAILY_LIMIT` | Medium | 异常的每日限额 |
| `ABNORMAL_MEMBERSHIP_DURATION` | Medium | 异常的会员期限 |
| `EXPIRED_MEMBERSHIP_USE` | Medium | 使用已过期的会员 |
| `INACTIVE_MEMBERSHIP_USE` | Medium | 使用未激活的会员 |
| `DAILY_LIMIT_EXHAUSTED` | Low | 每日限额已用尽 |
| `SUSPICIOUS_URL` | High | 可疑的URL（javascript:, data:, file:等） |
| `EXCESSIVE_BANNER_COUNT` | Medium | 轮播图数量超过限制 |

---

## 🔧 故障排除

### 问题1: "Environment variable not found: DATABASE_URL"

**解决方案**:
```bash
# 方法1: 创建 .env 文件
echo "DATABASE_URL=\"file:./prisma/dev.db\"" > .env

# 方法2: 临时设置环境变量
DATABASE_URL="file:./prisma/dev.db" npm run security:test-alerts
```

### 问题2: "@prisma/client did not initialize yet"

**解决方案**:
```bash
# 重新生成Prisma客户端
npx prisma generate

# 重启开发服务器
npm run dev
```

### 问题3: "无法获取安全警报（可能需要管理员权限）"

**原因**: 查看警报列表需要管理员权限

**解决方案**:
1. 直接查询数据库:
```bash
DATABASE_URL="file:./prisma/dev.db" npx prisma studio
```

2. 或使用管理员账号登录后台

### 问题4: "没有商品可测试，跳过"

**解决方案**:
```bash
# 创建测试商品
DATABASE_URL="file:./prisma/dev.db" npx tsx scripts/create-test-products.ts

# 重新运行测试
npm run security:test-alerts
```

---

## 📝 手动插入测试警报

如果需要手动插入安全警报到数据库进行测试，可以使用以下Prisma命令：

```typescript
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// 插入价格篡改警报
await prisma.securityAlert.create({
  data: {
    type: "PRICE_MANIPULATION",
    severity: "critical",
    description: "检测到价格篡改尝试：商品原价100元，被异常折扣至0.01元",
    ipAddress: "127.0.0.1",
    userAgent: "manual-test",
    metadata: JSON.stringify({
      originalAmount: 100,
      tamperedAmount: 0.01,
      productId: "test-product"
    }),
    status: "unresolved"
  }
})

// 插入可疑URL警报
await prisma.securityAlert.create({
  data: {
    type: "SUSPICIOUS_URL",
    severity: "high",
    description: "检测到可疑URL：javascript:alert(1)",
    ipAddress: "127.0.0.1",
    userAgent: "manual-test",
    metadata: JSON.stringify({
      url: "javascript:alert(1)",
      source: "banner_creation"
    }),
    status: "unresolved"
  }
})
```

或使用脚本：
```bash
DATABASE_URL="file:./prisma/dev.db" npx tsx -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
await prisma.securityAlert.create({
  data: {
    type: 'PRICE_MANIPULATION',
    severity: 'critical',
    description: '测试警报',
    ipAddress: '127.0.0.1',
    userAgent: 'test',
    status: 'unresolved'
  }
});
await prisma.\$disconnect();
console.log('警报已创建');
"
```

---

## 🎯 最佳实践

1. **定期扫描**: 建议每周运行一次完整的安全扫描
2. **CI/CD集成**: 将安全扫描集成到CI/CD流程中
3. **修复优先级**: 优先修复Critical和High级别的漏洞
4. **警报监控**: 定期检查安全警报，及时处理异常行为
5. **测试环境**: 在测试环境运行，避免影响生产数据

---

## 📚 相关文档

- [Prisma文档](https://www.prisma.io/docs)
- [Next.js安全最佳实践](https://nextjs.org/docs/advanced-features/security-headers)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

---

## 🤝 贡献

如果发现新的安全问题或想添加新的测试用例，请：

1. Fork本仓库
2. 创建功能分支
3. 添加测试用例
4. 提交Pull Request

---

## ⚠️ 免责声明

这些脚本仅用于测试目的。请勿在生产环境运行可能产生真实交易的测试。使用`mock`模式进行测试，避免产生实际的支付交易。
