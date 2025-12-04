# 佣金结算触发方式大全

本文档记录了所有可用的佣金结算触发方式，适用于不同场景。

---

## 📋 方式总览

| 方式 | 环境 | 频率 | 适用场景 | 推荐度 |
|------|------|------|----------|--------|
| [浏览器访问](#1-浏览器访问推荐) | 本地/生产 | 手动 | 测试、调试 | ⭐⭐⭐⭐⭐ |
| [curl 命令](#2-curl-命令) | 本地/生产 | 手动 | 快速触发 | ⭐⭐⭐⭐⭐ |
| [PowerShell](#3-powershell-windows) | 本地/生产 | 手动 | Windows环境 | ⭐⭐⭐⭐ |
| [自动结算服务](#4-本地自动结算服务) | 本地开发 | 每4小时 | 长期开发 | ⭐⭐⭐ |
| [Vercel Cron](#5-vercel-cron-生产环境) | 生产环境 | 每天凌晨 | 自动化 | ⭐⭐⭐⭐⭐ |
| [npm 脚本](#6-npm-脚本) | 本地开发 | 手动/自动 | 脚本化 | ⭐⭐⭐ |

---

## 🚀 详细使用方法

### 1. 浏览器访问（推荐）

**最简单直观的方式，适合测试和查看结果**

#### 步骤：

1. 确保开发服务器正在运行
   ```bash
   npm run dev
   ```

2. 打开浏览器，访问：
   ```
   http://localhost:3000/api/cron/settle-commissions
   ```

3. 查看结果：
   ```json
   {
     "success": true,
     "message": "成功结算 5 个订单的佣金",
     "settled": 5,
     "failed": 0
   }
   ```

#### 生产环境：
```
https://your-domain.com/api/cron/settle-commissions
```

#### 优点：
- ✅ 最直观，实时查看JSON结果
- ✅ 无需安装工具
- ✅ 适合测试和调试
- ✅ 可以直接复制结果

#### 缺点：
- ❌ 需要手动操作
- ❌ 浏览器可能格式化显示

---

### 2. curl 命令

**快速命令行触发，适合脚本和自动化**

#### Windows PowerShell：
```powershell
curl http://localhost:3000/api/cron/settle-commissions
```

#### Linux/Mac 终端：
```bash
curl http://localhost:3000/api/cron/settle-commissions
```

#### 格式化输出（使用 jq）：
```bash
curl -s http://localhost:3000/api/cron/settle-commissions | jq .
```

输出：
```json
{
  "success": true,
  "message": "成功结算 5 个订单的佣金",
  "settled": 5,
  "failed": 0
}
```

#### 生产环境：
```bash
curl https://your-domain.com/api/cron/settle-commissions
```

#### 带认证（如果需要）：
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/cron/settle-commissions
```

#### 优点：
- ✅ 快速执行
- ✅ 适合脚本化
- ✅ 可管道处理输出
- ✅ 跨平台支持

#### 缺点：
- ❌ 需要命令行工具
- ❌ 输出可能不够友好（需要 jq 格式化）

---

### 3. PowerShell (Windows)

**Windows 原生方法，无需额外工具**

#### 方式 A：简单调用
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/cron/settle-commissions" | Select-Object -Expand Content
```

#### 方式 B：解析 JSON
```powershell
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/cron/settle-commissions"
Write-Host "成功: $($response.success)"
Write-Host "消息: $($response.message)"
Write-Host "已结算: $($response.settled) 个订单"
Write-Host "失败: $($response.failed) 个订单"
```

输出：
```
成功: True
消息: 成功结算 5 个订单的佣金
已结算: 5 个订单
失败: 0 个订单
```

#### 创建快捷脚本（可选）：

创建 `settle.ps1` 文件：
```powershell
# settle.ps1 - 佣金结算快捷脚本

$url = "http://localhost:3000/api/cron/settle-commissions"

Write-Host "🔄 正在触发佣金结算..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri $url

    if ($response.success) {
        Write-Host "✅ 结算成功!" -ForegroundColor Green
        Write-Host "   消息: $($response.message)" -ForegroundColor White
        Write-Host "   已结算: $($response.settled) 个订单" -ForegroundColor White

        if ($response.failed -gt 0) {
            Write-Host "   失败: $($response.failed) 个订单" -ForegroundColor Yellow
            if ($response.errors) {
                Write-Host "   错误详情:" -ForegroundColor Red
                $response.errors | ForEach-Object {
                    Write-Host "     - $_" -ForegroundColor Red
                }
            }
        }
    } else {
        Write-Host "❌ 结算失败: $($response.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ 调用失败: $_" -ForegroundColor Red
}
```

使用：
```powershell
.\settle.ps1
```

#### 优点：
- ✅ Windows 原生支持
- ✅ 可以自定义输出格式
- ✅ 易于脚本化
- ✅ 支持错误处理

#### 缺点：
- ❌ 仅限 Windows
- ❌ 需要执行策略允许运行脚本

---

### 4. 本地自动结算服务

**开发环境长期运行，自动定时结算**

#### 启动服务：

**终端1 - 开发服务器：**
```bash
npm run dev
```

**终端2 - 自动结算服务：**
```bash
npm run cron:settle
```

#### 输出示例：
```
╔═══════════════════════════════════════════════════╗
║   🤖 佣金自动结算服务（开发环境）                  ║
╚═══════════════════════════════════════════════════╝

⚙️  配置:
   - API地址: http://localhost:3000/api/cron/settle-commissions
   - 结算间隔: 每 4 小时
   - 立即执行: 是

💡 提示:
   - 测试用户 (test001@example.com, test002@example.com) 享有0天冷静期
   - 普通用户订单需等待冷静期（默认15天）后结算
   - 按 Ctrl+C 停止服务

[2025/12/04 17:52:00] 🔄 开始执行佣金结算...
✅ 结算成功: 成功结算 5 个订单的佣金
   - 已结算: 5 个订单
⏰ 下次结算时间: 2025/12/04 21:52:00

✅ 自动结算服务已启动！
```

#### 修改结算间隔：

编辑 `scripts/auto-settle-dev.ts`：
```typescript
// 修改这一行（默认 4 小时）
const INTERVAL_MS = 4 * 60 * 60 * 1000

// 改为 1 小时
const INTERVAL_MS = 1 * 60 * 60 * 1000

// 改为 30 分钟
const INTERVAL_MS = 30 * 60 * 1000
```

#### 停止服务：
按 `Ctrl+C`

#### 优点：
- ✅ 自动化执行
- ✅ 无需手动触发
- ✅ 详细日志输出
- ✅ 失败自动重试

#### 缺点：
- ❌ 占用一个终端窗口
- ❌ 需要持续运行
- ❌ 本地开发才需要

---

### 5. Vercel Cron (生产环境)

**生产环境自动定时任务，无需维护**

#### 配置文件：`vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/settle-commissions",
      "schedule": "0 0 * * *"
    }
  ]
}
```

#### 执行时间：
- **当前配置**：每天凌晨 0:00（北京时间）
- **Cron 表达式**：`0 0 * * *`

#### 常用 Cron 表达式：

| 表达式 | 说明 | 执行时间（北京时间） |
|--------|------|---------------------|
| `0 * * * *` | 每小时 | 00:00, 01:00, 02:00... |
| `0 */2 * * *` | 每2小时 | 00:00, 02:00, 04:00... |
| `0 */4 * * *` | 每4小时 | 00:00, 04:00, 08:00... |
| `0 0 * * *` | 每天凌晨（默认）| 00:00 |
| `0 0,12 * * *` | 每天0点和12点 | 00:00, 12:00 |
| `0 0 * * 0` | 每周日凌晨 | 周日 00:00 |
| `0 0 1 * *` | 每月1号凌晨 | 每月1号 00:00 |

#### 修改执行频率：

1. 编辑 `vercel.json`
2. 修改 `schedule` 值
3. 提交并推送到 GitHub
4. Vercel 自动更新配置

#### 查看执行日志：

**方式1：Vercel Dashboard**
1. 登录 [vercel.com](https://vercel.com)
2. 选择项目
3. 进入 "Logs" 标签
4. 搜索 "settle-commissions"

**方式2：Vercel CLI**
```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 查看最近1小时日志
vercel logs --since 1h

# 查看最近24小时日志
vercel logs --since 24h

# 实时查看日志
vercel logs --follow
```

#### 优点：
- ✅ 完全自动化
- ✅ 免费使用
- ✅ 无需维护服务器
- ✅ 可靠稳定
- ✅ 支持日志查看

#### 缺点：
- ❌ 仅在 Vercel 平台可用
- ❌ 执行频率有限制（最高每小时一次）

---

### 6. npm 脚本

**通过 npm 命令触发**

#### 方式 A：手动触发（使用 curl）

创建 npm 脚本：

编辑 `package.json`：
```json
{
  "scripts": {
    "settle": "curl -s http://localhost:3000/api/cron/settle-commissions | node -e \"const data=JSON.parse(require('fs').readFileSync(0,'utf-8')); console.log(data.success ? '✅ '+data.message : '❌ '+data.error)\""
  }
}
```

使用：
```bash
npm run settle
```

输出：
```
✅ 成功结算 5 个订单的佣金
```

#### 方式 B：TypeScript 脚本

创建 `scripts/manual-settle.ts`：
```typescript
/**
 * 手动触发佣金结算
 */

const API_URL = process.env.SETTLEMENT_API_URL || 'http://localhost:3000/api/cron/settle-commissions'

async function triggerSettlement() {
  console.log('🔄 触发佣金结算...\n')

  try {
    const response = await fetch(API_URL)
    const data = await response.json()

    if (data.success) {
      console.log('✅ 结算成功!')
      console.log(`   ${data.message}`)
      console.log(`   已结算: ${data.settled} 个订单`)
      if (data.failed > 0) {
        console.log(`   失败: ${data.failed} 个订单`)
      }
    } else {
      console.error('❌ 结算失败:', data.error)
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ 调用失败:', error)
    process.exit(1)
  }
}

triggerSettlement()
```

添加到 `package.json`：
```json
{
  "scripts": {
    "settle:now": "tsx scripts/manual-settle.ts"
  }
}
```

使用：
```bash
npm run settle:now
```

#### 优点：
- ✅ 统一的命令接口
- ✅ 易于记忆
- ✅ 可自定义输出格式
- ✅ 支持环境变量

#### 缺点：
- ❌ 需要配置脚本
- ❌ 仍需手动执行

---

## 📊 场景推荐

### 场景1：日常测试（test001/test002）

**推荐方式：** 浏览器访问 或 curl

```bash
# 简单快速
curl http://localhost:3000/api/cron/settle-commissions
```

**理由：**
- 立即查看结果
- 灵活控制时机
- 适合测试流程

---

### 场景2：长期开发

**推荐方式：** 本地自动结算服务

```bash
# 终端1
npm run dev

# 终端2
npm run cron:settle
```

**理由：**
- 自动化执行
- 无需手动触发
- 持续监控日志

---

### 场景3：生产环境

**推荐方式：** Vercel Cron + 手动触发备用

**自动：**
- Vercel Cron 每天凌晨执行
- 保证不遗漏

**手动（紧急情况）：**
```bash
curl https://your-domain.com/api/cron/settle-commissions
```

**理由：**
- 定时自动化
- 紧急情况可手动触发
- 稳定可靠

---

### 场景4：脚本化部署

**推荐方式：** npm 脚本 + CI/CD

```bash
# 部署后自动触发结算
npm run settle:now
```

**配置示例（GitHub Actions）：**
```yaml
- name: Deploy
  run: npm run build && vercel deploy

- name: Trigger Settlement
  run: npm run settle:now
  env:
    SETTLEMENT_API_URL: https://your-domain.com/api/cron/settle-commissions
```

**理由：**
- 自动化部署流程
- 确保数据同步
- 减少人工操作

---

## 🛡️ 安全建议

### 1. 生产环境保护

**问题：** API 无认证，任何人都可调用

**建议：** 添加简单的令牌验证

修改 `app/api/cron/settle-commissions/route.ts`：
```typescript
export async function GET(req: Request) {
  // 验证 Cron 密钥（可选）
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // ... 原有逻辑
}
```

配置 `.env`：
```bash
CRON_SECRET="your-random-secret-key-here"
```

调用时：
```bash
curl -H "Authorization: Bearer your-random-secret-key-here" \
  https://your-domain.com/api/cron/settle-commissions
```

### 2. 频率限制

**建议：** 添加防止频繁调用的保护

```typescript
// 简单的内存缓存（生产环境建议用 Redis）
let lastExecutionTime = 0
const MIN_INTERVAL = 60 * 1000 // 1分钟

export async function GET() {
  const now = Date.now()
  if (now - lastExecutionTime < MIN_INTERVAL) {
    return NextResponse.json(
      { error: '请求过于频繁，请稍后再试' },
      { status: 429 }
    )
  }
  lastExecutionTime = now

  // ... 原有逻辑
}
```

---

## 📚 相关文档

- [自动结算完整指南](./AUTO_SETTLEMENT_GUIDE.md)
- [佣金结算冷静期设计](./commission-settlement-cooldown.md)
- [分销系统文档](../DISTRIBUTION_SYSTEM_README.md)
- [Vercel Cron Jobs 官方文档](https://vercel.com/docs/cron-jobs)

---

## ❓ FAQ

### Q1: 手动触发和自动结算哪个更好？

**A:** 取决于场景：
- **测试环境**：手动触发更灵活
- **生产环境**：自动结算更可靠
- **推荐方案**：两者结合，自动为主，手动备用

### Q2: 为什么我的结算没有生效？

**A:** 检查以下几点：
1. 开发服务器是否运行（`npm run dev`）
2. 数据库连接是否正常
3. 订单是否满足结算条件（已确认 + 过冷静期）
4. 查看 API 返回的错误信息

### Q3: 测试用户立即结算不生效？

**A:** 确认：
1. 用户邮箱是否精确匹配（`test001@example.com`）
2. 订单状态是否为 `confirmed`
3. 手动触发一次结算查看日志

### Q4: 生产环境 Vercel Cron 没有执行？

**A:** 检查：
1. `vercel.json` 是否正确提交
2. 在 Vercel Dashboard 查看 Cron Jobs 配置
3. 查看 Logs 是否有执行记录
4. Cron 表达式是否正确

---

**文档创建时间**: 2025-12-04
**最后更新时间**: 2025-12-04
**维护者**: Claude Code Assistant
