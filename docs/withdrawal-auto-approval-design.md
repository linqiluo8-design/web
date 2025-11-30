# 提现自动审核系统设计文档

## 📋 文档信息

- **版本**: v1.0
- **创建日期**: 2025-11-30
- **最后更新**: 2025-11-30
- **状态**: 设计阶段

## 🎯 项目目标

实现分销商提现的智能审核系统，通过自动审核和风控规则的组合，在保证资金安全的前提下提高提现处理效率。

## 📊 当前系统分析

### 现有提现流程

1. **pending（待审核）** - 分销商提交提现申请
2. **processing（处理中）** - 管理员手动批准后
3. **completed（已完成）** - 管理员打款并填写交易凭证
4. **rejected（已拒绝）** - 管理员拒绝申请

### 存在问题

- 所有提现申请都需要人工审核，效率低
- 小额提现和大额提现使用相同审核流程
- 缺乏自动化风控机制
- 无法识别异常提现行为

## 🎨 设计方案

### 方案概述：分级自动审核 + 风控规则引擎

采用**智能分级审核**策略，结合**多维度风控规则**，实现安全高效的提现审核。

## 🔐 风险分析

### 🔴 高风险场景（必须人工审核）

1. **大额提现**
   - 单笔金额 ≥ 5000元（可配置）
   - 风险：资金安全、欺诈风险

2. **首次提现**
   - 分销商首次申请提现
   - 风险：账户真实性未验证

3. **新注册分销商**
   - 注册天数 < 30天（可配置）
   - 风险：虚假账户、快速套现

4. **未实名认证**
   - 分销商未通过实名认证
   - 风险：合规风险、身份欺诈

5. **银行信息变更**
   - 银行账户信息变更 < 7天（可配置）
   - 风险：账户被盗、洗钱风险

6. **异常订单记录**
   - 最近30天内有退款/纠纷订单
   - 风险：佣金来源异常

### 🟢 低风险场景（可自动审核）

满足以下**所有条件**的提现申请可自动审核：

- ✅ 金额 < 5000元
- ✅ 非首次提现
- ✅ 分销商注册 ≥ 30天
- ✅ 通过实名认证（如启用）
- ✅ 银行信息稳定（最后变更 > 7天）
- ✅ 无异常订单记录
- ✅ 未触发风控规则

## 🛡️ 风控规则设计

### 规则一：提现频率限制

```
单日提现次数限制：3次
单日提现总额限制：10,000元
单月提现总额限制：50,000元
```

**触发后处理**：拒绝申请，提示用户已达当日/当月限额

### 规则二：提现金额校验

```
单次最低提现：100元
单次最高提现：50,000元
可提现余额检查：必须 ≥ 申请金额
```

**触发后处理**：拒绝申请，提示金额不符合要求

### 规则三：账户状态检查

```
分销商状态：必须为 active
待处理提现：不允许有 pending/processing 状态的提现
账户冻结：检查是否被冻结
```

**触发后处理**：拒绝申请，提示账户状态异常

### 规则四：实名认证检查

```
配置项：withdrawal_auto_require_verified
- 如果启用，必须通过实名认证才能自动审核
- 未认证用户转人工审核
```

**触发后处理**：转人工审核

### 规则五：异常行为检测

```
检测项：
- IP地址异常变化（可选）
- 短时间内频繁修改银行信息
- 佣金收入与提现金额比例异常
- 分销订单退款率异常
```

**触发后处理**：转人工审核，记录安全警报

## 📐 数据库设计

### 1. Distributor 表新增字段

```prisma
model Distributor {
  // ... 现有字段

  // 实名认证相关
  isVerified        Boolean   @default(false)  // 是否通过实名认证
  verifiedAt        DateTime? // 认证通过时间
  realName          String?   // 真实姓名
  idCardNumber      String?   // 身份证号（加密存储）

  // 风控相关
  lastBankInfoUpdate DateTime? // 最后一次银行信息更新时间
  firstWithdrawalAt  DateTime? // 首次提现时间
  riskLevel         String    @default("low") // 风险等级：low, medium, high
  isFrozen          Boolean   @default(false) // 账户是否被冻结
  frozenReason      String?   // 冻结原因
}
```

### 2. CommissionWithdrawal 表新增字段

```prisma
model CommissionWithdrawal {
  // ... 现有字段

  // 自动审核相关
  isAutoApproved    Boolean   @default(false) // 是否自动审核通过
  autoApprovedAt    DateTime? // 自动审核时间
  riskCheckResult   String?   // 风控检查结果（JSON）
  riskScore         Float?    @default(0) // 风险评分（0-100）
}
```

### 3. SystemConfig 新增配置项

| 配置键 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `withdrawal_auto_approve` | boolean | false | 是否启用自动审核 |
| `withdrawal_auto_max_amount` | number | 5000 | 自动审核最大金额 |
| `withdrawal_auto_min_days` | number | 30 | 自动审核所需最少注册天数 |
| `withdrawal_auto_require_verified` | boolean | false | 是否要求实名认证 |
| `withdrawal_bank_info_stable_days` | number | 7 | 银行信息稳定期（天） |
| `withdrawal_daily_count_limit` | number | 3 | 每日提现次数限制 |
| `withdrawal_daily_amount_limit` | number | 10000 | 每日提现金额限制 |
| `withdrawal_monthly_amount_limit` | number | 50000 | 每月提现总额限制 |
| `withdrawal_min_amount` | number | 100 | 最低提现金额 |
| `withdrawal_max_amount` | number | 50000 | 最高提现金额 |
| `withdrawal_fee_rate` | number | 0.02 | 提现手续费率 |

## 🔄 业务流程设计

### 自动审核流程图

```
用户提交提现申请
       ↓
基础验证（金额、余额、账户状态）
       ↓
    ❌ 失败 → 拒绝申请
       ✅
       ↓
检查是否启用自动审核
       ↓
    ❌ 关闭 → 进入待审核（pending）
       ✅
       ↓
风控规则检查
       ↓
├─ 高风险 → 转人工审核（pending）
├─ 中风险 → 转人工审核（pending）+ 记录警报
└─ 低风险 ↓
       ↓
自动审核通过
       ↓
更新状态为 processing
       ↓
标记 isAutoApproved = true
       ↓
（后续：接入自动打款接口）
```

### 风控检查逻辑

```typescript
function checkWithdrawalRisk(withdrawal, distributor, config) {
  const risks = []
  let riskScore = 0

  // 1. 金额检查（权重：30）
  if (withdrawal.amount >= config.withdrawal_auto_max_amount) {
    risks.push("大额提现")
    riskScore += 30
  }

  // 2. 首次提现（权重：20）
  if (!distributor.firstWithdrawalAt) {
    risks.push("首次提现")
    riskScore += 20
  }

  // 3. 注册天数（权重：15）
  const daysSinceRegistration = daysBetween(now, distributor.createdAt)
  if (daysSinceRegistration < config.withdrawal_auto_min_days) {
    risks.push("新注册分销商")
    riskScore += 15
  }

  // 4. 实名认证（权重：15）
  if (config.withdrawal_auto_require_verified && !distributor.isVerified) {
    risks.push("未实名认证")
    riskScore += 15
  }

  // 5. 银行信息变更（权重：10）
  if (distributor.lastBankInfoUpdate) {
    const daysSinceUpdate = daysBetween(now, distributor.lastBankInfoUpdate)
    if (daysSinceUpdate < config.withdrawal_bank_info_stable_days) {
      risks.push("银行信息近期变更")
      riskScore += 10
    }
  }

  // 6. 每日限额（权重：5）
  const todayWithdrawals = getTodayWithdrawals(distributor.id)
  if (todayWithdrawals.count >= config.withdrawal_daily_count_limit) {
    risks.push("超过每日提现次数")
    riskScore += 5
  }
  if (todayWithdrawals.amount + withdrawal.amount > config.withdrawal_daily_amount_limit) {
    risks.push("超过每日提现金额")
    riskScore += 5
  }

  // 7. 账户风险等级（权重：10）
  if (distributor.riskLevel === "high") {
    risks.push("高风险账户")
    riskScore += 10
  } else if (distributor.riskLevel === "medium") {
    risks.push("中风险账户")
    riskScore += 5
  }

  // 8. 账户冻结（权重：100，直接拒绝）
  if (distributor.isFrozen) {
    risks.push("账户已冻结")
    riskScore = 100
  }

  return {
    canAutoApprove: riskScore < 10, // 评分 < 10 可自动审核
    riskScore,
    risks
  }
}
```

### 风险等级定义

- **低风险（0-9分）**：自动审核通过
- **中风险（10-29分）**：转人工审核
- **高风险（30-100分）**：转人工审核 + 记录安全警报

## 🖥️ API 接口设计

### 1. 提现申请接口（修改）

**端点**: `POST /api/distribution/withdrawals`

**新增返回字段**:
```typescript
{
  success: true,
  message: string,  // "提现申请已提交，等待审核" 或 "提现申请已自动审核通过"
  withdrawal: {
    // ... 现有字段
    isAutoApproved: boolean,
    riskScore: number,
    status: string  // "pending" 或 "processing"
  }
}
```

### 2. 风控配置接口（新增）

**端点**: `GET /api/backendmanager/withdrawal-config`

返回所有提现相关配置

**端点**: `PUT /api/backendmanager/withdrawal-config`

批量更新提现配置

### 3. 实名认证接口（新增）

**端点**: `POST /api/distribution/verify`

提交实名认证信息

## 📱 UI/UX 设计

### 1. 后台管理 - 提现配置页面

**路径**: `/backendmanager/distribution/withdrawal-config`

**功能模块**:

#### 基础配置
- [ ] 启用/关闭自动审核开关
- [ ] 自动审核最大金额设置
- [ ] 最低/最高提现金额设置
- [ ] 手续费率设置

#### 风控规则配置
- [ ] 注册天数要求
- [ ] 实名认证要求
- [ ] 银行信息稳定期
- [ ] 每日提现次数/金额限制
- [ ] 每月提现金额限制

#### 配置预览
- 显示当前生效的规则
- 预估自动审核通过率

### 2. 后台管理 - 提现列表增强

**新增标识**:
- 自动审核通过的提现显示 "🤖 自动审核" 标签
- 显示风险评分
- 显示触发的风控规则

### 3. 分销商端 - 提现页面增强

**新增提示**:
- 如果未实名认证，提示"完成实名认证可享受自动审核"
- 显示当前提现限额和已用额度
- 预计审核时间提示

## 🚀 实施计划

### Phase 1: 数据库和配置（第1周）
- [x] 更新 Prisma Schema
- [ ] 创建数据库迁移脚本
- [ ] 添加系统配置初始化

### Phase 2: 风控引擎（第2周）
- [ ] 实现风控规则检查函数
- [ ] 实现风险评分算法
- [ ] 单元测试

### Phase 3: API 集成（第3周）
- [ ] 修改提现申请 API
- [ ] 实现自动审核逻辑
- [ ] 创建风控配置 API

### Phase 4: UI 开发（第4周）
- [ ] 后台提现配置页面
- [ ] 提现列表增强
- [ ] 分销商端提示优化

### Phase 5: 测试和上线（第5周）
- [ ] 集成测试
- [ ] 安全测试
- [ ] 灰度发布
- [ ] 全量上线

## 🧪 测试策略

### 单元测试

- 风控规则函数测试
- 风险评分算法测试
- 各种边界条件测试

### 集成测试

- 自动审核流程测试
- 人工审核流程测试
- 配置切换测试

### 安全测试

- 并发提现测试
- 金额篡改测试
- 权限绕过测试

### 性能测试

- 大量提现申请处理
- 配置查询性能
- 数据库查询优化

## 📈 监控指标

### 业务指标

- 自动审核通过率
- 人工审核工作量减少比例
- 提现处理时长
- 风险拦截率

### 技术指标

- API 响应时间
- 数据库查询性能
- 系统错误率
- 并发处理能力

### 安全指标

- 异常提现拦截数量
- 安全警报触发次数
- 风控规则命中率

## 🔒 安全考虑

### 数据安全

- 身份证号等敏感信息加密存储
- 银行账号脱敏显示
- 审计日志完整记录

### 接口安全

- 权限严格校验
- 防止重放攻击
- 请求频率限制

### 业务安全

- 交易状态机严格控制
- 余额扣减原子操作
- 异常回滚机制

## 📝 附录

### A. 状态流转图

```
pending → processing → completed
   ↓
rejected
```

**新增**：
- `isAutoApproved = true` 的记录直接创建为 `processing` 状态

### B. 配置示例

```json
{
  "withdrawal_auto_approve": true,
  "withdrawal_auto_max_amount": 5000,
  "withdrawal_auto_min_days": 30,
  "withdrawal_auto_require_verified": true,
  "withdrawal_bank_info_stable_days": 7,
  "withdrawal_daily_count_limit": 3,
  "withdrawal_daily_amount_limit": 10000,
  "withdrawal_monthly_amount_limit": 50000,
  "withdrawal_min_amount": 100,
  "withdrawal_max_amount": 50000,
  "withdrawal_fee_rate": 0.02
}
```

### C. 风险评分权重表

| 风险因素 | 权重 | 说明 |
|---------|------|------|
| 账户冻结 | 100 | 直接拒绝 |
| 大额提现 | 30 | ≥ 5000元 |
| 首次提现 | 20 | 历史无提现记录 |
| 未实名认证 | 15 | 需配置启用 |
| 新注册账户 | 15 | < 30天 |
| 高风险账户 | 10 | 人工标记 |
| 银行信息变更 | 10 | < 7天 |
| 中风险账户 | 5 | 人工标记 |
| 超每日次数 | 5 | ≥ 3次 |
| 超每日金额 | 5 | ≥ 10000元 |

### D. 错误代码

| 代码 | 说明 | HTTP状态 |
|------|------|---------|
| WITHDRAWAL_AMOUNT_TOO_LOW | 金额低于最低限制 | 400 |
| WITHDRAWAL_AMOUNT_TOO_HIGH | 金额超过最高限制 | 400 |
| WITHDRAWAL_INSUFFICIENT_BALANCE | 余额不足 | 400 |
| WITHDRAWAL_DAILY_LIMIT_EXCEEDED | 超过每日限额 | 400 |
| WITHDRAWAL_MONTHLY_LIMIT_EXCEEDED | 超过每月限额 | 400 |
| WITHDRAWAL_ACCOUNT_FROZEN | 账户已冻结 | 403 |
| WITHDRAWAL_PENDING_EXISTS | 存在待处理提现 | 400 |
| WITHDRAWAL_NOT_VERIFIED | 需要实名认证 | 400 |

## 🔄 版本历史

- **v1.0** (2025-11-30): 初始设计文档
  - 完成整体架构设计
  - 定义风控规则和评分体系
  - 规划实施计划

## 👥 相关人员

- **设计**: Claude Code
- **审核**: [待定]
- **开发**: [待定]
- **测试**: [待定]

---

**注意**: 本文档为设计阶段文档，具体实现可能根据实际情况进行调整。
