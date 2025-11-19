# 知识付费系统 - 设计逻辑文档

> 📌 本文档记录系统的核心设计逻辑、关键决策和实现方案，方便后续开发追溯

---

## 🎯 核心商业模式（2025-11）

### 虚拟产品售卖平台

**设计理念**：
本系统的核心定位是**虚拟产品售卖平台**，主要售卖视频教程、电子书、在线课程等数字内容产品。

**核心流程**：
1. **商品发布**：管理员在后台添加商品时，填写商品基本信息（标题、价格、描述）+ 网盘资源链接
2. **用户下单**：用户浏览商品并完成支付
3. **资源交付**：支付成功后，系统在订单详情中显示网盘链接和提取密码
4. **用户获取**：用户通过订单详情获取网盘链接，自行下载资源

**技术实现**：

1. **商品网盘字段** (`networkDiskLink`):
   ```typescript
   model Product {
     networkDiskLink  String?  // 网盘链接（课程资源）
     // 示例内容：
     // "百度网盘: https://pan.baidu.com/xxx
     //  提取码: abcd"
   }
   ```

2. **后台商品管理**：
   - 单个商品创建/编辑：提供"网盘链接"文本框
   - 批量商品创建：每个商品都可填写网盘链接
   - 字段说明：
     - 💡 虚拟商品（视频、电子书等）：填写网盘链接和提取密码
     - 📦 实体商品或线下服务：留空即可

3. **订单详情展示**（`/order-lookup`）：
   - **显示条件**：
     - ✅ 订单状态为 `paid`（已支付）
     - ✅ 商品存在 `networkDiskLink` 字段
   - **安全策略**：
     - 未支付订单不显示网盘链接（防止恶意获取）
     - API 层面过滤：未支付订单返回 `networkDiskLink: null`
   - **UI 展示**：
     - 绿色背景区域，标题"🎁 虚拟商品资源"
     - 显示每个虚拟商品的标题 + "虚拟商品"标签
     - 以代码块形式展示网盘链接（支持复制）
     - 提示用户保存资源链接

**适用场景**：
- ✅ 在线课程售卖
- ✅ 电子书/PDF 文档售卖
- ✅ 视频教程售卖
- ✅ 软件/工具包售卖
- ✅ 音频/音乐素材售卖
- ✅ 设计素材/模板售卖

**混合模式支持**：
- 虚拟商品：填写 `networkDiskLink`，支付后显示资源链接
- 实体商品：不填写 `networkDiskLink`，订单详情仅显示商品信息
- 可在同一平台同时售卖虚拟和实体商品

**实现位置**：
- 数据模型: `prisma/schema.prisma` - `Product.networkDiskLink`
- 商品管理: `app/backendmanager/page.tsx` - 创建/编辑/批量添加表单
- 订单详情: `app/order-lookup/page.tsx` - 虚拟商品资源展示区
- 订单API: `app/api/orders/lookup/route.ts` - 安全过滤逻辑

**注意事项**：
- 网盘链接建议包含平台名称、链接、提取码等完整信息
- 考虑网盘链接的时效性，定期检查和更新
- 建议使用多个网盘平台做备份，提高资源可用性
- 未来可扩展为多个网盘链接字段或JSON格式存储

---

## 📋 目录

- [核心商业模式](#核心商业模式2025-11)
- [用户认证与权限](#用户认证与权限)
- [会员系统](#会员系统)
- [商品管理](#商品管理)
- [订单与支付](#订单与支付)
- [安全设计](#安全设计)
- [API 路由规范](#api-路由规范)

---

## 🔐 用户认证与权限

### 用户审核机制

**设计决策**（2025-11）：
- 所有新注册用户默认状态为 `PENDING`（待审核）
- 只有管理员批准（`APPROVED`）后才能登录系统
- 三种账号状态：
  - `PENDING` - 待审核（注册后默认状态）
  - `APPROVED` - 已批准（可登录）
  - `REJECTED` - 已拒绝（无法登录）

**实现位置**：
- Schema: `prisma/schema.prisma` - `User.accountStatus`
- 注册逻辑: `app/api/auth/register/route.ts`
- 登录验证: `lib/auth.ts` - `authorize` 函数
- 审核管理: `app/backendmanager/users/page.tsx`

### 细粒度权限控制

**权限模块**：
1. `CATEGORIES` - 分类管理
2. `MEMBERSHIPS` - 会员管理
3. `ORDERS` - 订单数据管理
4. `PRODUCTS` - 商品管理

**权限级别**：
- `NONE` - 无权限
- `READ` - 只读权限
- `WRITE` - 读写权限

**特殊规则**：
- 管理员（`role=ADMIN`）自动拥有所有权限
- 普通用户需要单独授权

**实现位置**：
- Schema: `prisma/schema.prisma` - `Permission` 模型
- 权限工具: `lib/permissions.ts`
- 权限管理 API: `app/api/backendmanager/users/[id]/permissions/route.ts`

---

## 💳 会员系统

### 会员方案设计

**核心字段**：
```typescript
{
  name: string        // 会员名称（如"年度会员"）
  price: number       // 价格
  duration: number    // 有效期天数（-1=终身）
  discount: number    // 折扣率（0.8=8折）
  dailyLimit: number  // 每日折扣使用次数
  status: string      // active | inactive
  sortOrder: number   // 显示排序
}
```

**设计决策**：
- 会员方案独立管理，使用专用脚本 `scripts/init-membership-plans.ts`
- 测试数据脚本 `scripts/create-test-data.js` 不创建会员方案，避免覆盖自定义配置
- 会员码采用哈希存储，确保唯一性

**使用流程**：
1. 用户购买会员方案
2. 系统生成唯一会员码
3. 用户在购物车/立即购买时输入会员码
4. 系统验证并应用折扣
5. 记录每日使用次数

**实现位置**：
- Schema: `prisma/schema.prisma` - `MembershipPlan`, `Membership`, `MembershipUsage`
- 购买页面: `app/membership/page.tsx`
- 成功页面: `app/membership/success/page.tsx`
- 验证 API: `app/api/memberships/verify/route.ts`

### 会员购买跳转优化

**设计方案**（2025-11）：
- 购物车页面跳转会员购买时，URL 带参数 `?from=cart`
- 购买成功后根据来源显示不同按钮：
  - 从购物车来：显示"返回购物车" + "继续购物"
  - 其他来源：显示"立即购物" + "查看会员方案"

**实现位置**：
- 购物车链接: `app/cart/page.tsx:308` - `href="/membership?from=cart"`
- 成功页面: `app/membership/success/page.tsx` - `fromCart` 状态判断

---

## 🛍️ 商品管理

### 商品图片配置

**图片来源**：
- 开发环境使用 `picsum.photos` 提供测试图片
- 需在 `next.config.ts` 中配置允许的图片域名

**配置示例**：
```typescript
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: 'picsum.photos',
      pathname: '/**',
    },
  ],
}
```

**实现位置**：
- 配置: `next.config.ts`
- 测试数据: `scripts/create-test-data.js` - 商品 coverImage

---

## 💰 订单与支付

### 会员码优惠处理

**适用场景（所有结算入口）**：
1. 购物车批量结算
2. 单商品立即购买（2025-11 新增）
3. 待支付订单去支付（2025-11 新增）

**折扣计算逻辑**：
```javascript
原价 * 会员折扣率 = 折后价
```

**注意事项**：
- 需检查会员码有效期
- 需检查每日使用限制
- 折扣信息记录到订单中（`originalAmount`, `discount`）

**1. 购物车结算会员码支持**：
- 在购物车页面输入会员码并验证
- 显示折扣预览
- 创建订单时应用会员码

**2. 立即购买会员码支持**（2025-11）：
- 点击"立即购买"按钮时弹出会员码输入对话框
- 支持实时验证会员码
- 显示折扣后的价格预览
- 可选择性使用会员码（跳过输入直接购买）
- 与购物车的会员码验证逻辑保持一致

**3. 待支付订单会员码支持**（2025-11）：
- **入口**：我的订单页面 → 待支付订单 → 去支付按钮
- **条件**：只有未应用会员码的待支付订单才显示会员码输入区
- **流程**：
  1. 在支付页面输入会员码并点击"验证"
  2. 系统验证会员码有效性并计算折扣预览
  3. 显示原价、折后价、节省金额
  4. 点击"应用会员码"更新订单金额
  5. 订单金额更新后自动刷新，显示折扣详情
- **限制**：
  - 只有待支付（pending）状态的订单可以应用会员码
  - 已应用会员码的订单不能重复应用
  - 会员码应用成功后立即更新订单，消费会员次数

**实现位置**：
- 购物车验证: `app/cart/page.tsx` - `verifyMembership`
- 立即购买验证: `app/products/page.tsx` - `verifyMembership`
- 支付页面验证: `app/payment/[orderId]/page.tsx` - `verifyMembership` + `applyMembership`
- 订单创建: `app/api/orders/route.ts` - POST
- 支付前应用会员码: `app/api/orders/[orderId]/apply-membership/route.ts` - POST

---

### 结算支付统一规范（2025-11）

**核心原则**：凡是涉及结算支付的地方，都必须同时支持以下两个功能：

#### 1. 会员码优惠功能
- 所有结算入口必须提供会员码输入框
- 支持实时验证会员码有效性
- 显示折扣预览（原价、折后价、节省金额）
- 显示会员使用限制（今日剩余次数等）

#### 2. 购买会员引导功能
- 在会员码输入区域下方必须显示"还没有会员？立即购买"链接
- 点击链接跳转到会员购买页面 `/membership`
- 通过 URL 参数 `from` 标识来源（如 `?from=cart`, `?from=buy-now`, `?from=payment`）
- 购买完成后可以返回原页面继续结算

#### 适用的所有结算入口：
1. **购物车结算** (`/cart`)
   - 会员码输入框 + 验证按钮 ✓
   - "还没有会员？立即购买" 链接 ✓
   - 跳转参数：`?from=cart`

2. **立即购买弹窗** (`/products` 的会员码弹窗)
   - 会员码输入框 + 验证按钮 ✓
   - "还没有会员？立即购买" 链接 ✓（2025-11 新增）
   - 跳转参数：`?from=buy-now`
   - 点击链接时关闭弹窗

3. **待支付订单支付页面** (`/payment/[orderId]`)
   - 会员码输入框 + 验证按钮 ✓
   - "还没有会员？立即购买" 链接 ✓（2025-11 新增）
   - 跳转参数：`?from=payment`
   - 仅当订单未应用会员码时显示

#### 实现要求：
- **UI 一致性**：所有入口的会员码输入区域样式和交互保持一致
- **链接样式**：`text-xs text-blue-600 hover:underline`
- **位置要求**：链接显示在会员码输入框下方，错误提示之后
- **条件显示**：购买会员链接仅在未验证会员码时显示

#### 开发规范：
```typescript
// 会员码输入区域标准结构
<div className="会员码输入区">
  <input type="text" placeholder="输入会员码" />
  <button>验证</button>
  {membershipError && <p className="错误提示">{membershipError}</p>}

  {/* 必须包含此链接 */}
  {!membership && (
    <Link href="/membership?from=来源标识" className="text-xs text-blue-600 hover:underline">
      还没有会员？立即购买
    </Link>
  )}

  {membership && <div className="会员信息显示">...</div>}
</div>
```

### 支付方式

支持三种支付方式：
1. **支付宝** - `alipay`
2. **微信支付** - `wechat`
3. **PayPal** - `paypal`

**实现位置**：
- 支付服务: `lib/payment/`
  - `lib/payment/alipay.ts`
  - `lib/payment/wechat.ts`
  - `lib/payment/paypal.ts`
- 支付创建: `app/api/payment/create/route.ts`
- 支付回调: `app/api/payment/callback/`

### 订单数据管理安全机制

**设计决策**（2025-11）：
- 清理订单数据前**必须先导出**相同配置的订单数据
- 导出功能**不强绑定**清理功能，可独立使用

**安全流程**：
1. **导出阶段**：
   - 配置导出参数（日期范围、订单状态）
   - 执行导出操作
   - 导出成功后，系统记录导出配置

2. **清理阶段**：
   - 配置清理参数（日期范围、订单状态）
   - 系统自动验证清理配置是否与最近的导出配置一致
   - 如果配置不匹配，阻止清理操作并提示先导出
   - 如果配置匹配，允许执行清理
   - 清理成功后，清除导出记录（需要重新导出才能再次清理）

**配置匹配规则**：
- 开始日期必须一致
- 结束日期必须一致
- 订单状态必须一致

**UI 提示**：
- 未导出时：显示黄色警告提示"请先导出要清理的订单数据"
- 已导出时：显示绿色成功提示"已导出数据：[日期范围] ([状态])"
- 尝试清理未导出的配置时：弹出警告对话框阻止操作

**实现位置**：
- 后台订单管理: `app/backendmanager/orders/page.tsx`
- 清理 API: `app/api/backendmanager/orders/cleanup/route.ts`
- 导出 API: `app/api/backendmanager/orders/export/route.ts`

---

## 📊 订单统计分析（2025-11）

### 多维度订单统计图表

**功能说明**：
为后台管理系统提供全面的订单统计分析功能，支持商品订单和会员订单的多维度可视化统计，帮助运营人员进行数据分析和业务决策。

**设计理念**：
- 支持按不同时间维度统计，满足不同场景的数据分析需求
- 仅对管理员和授权的管理员团队成员开放，不对匿名用户开放
- 使用图表可视化展示，直观易懂
- 提供灵活的筛选和自定义功能

**核心功能**：

#### 1. 统计维度（时间粒度）

支持4种统计维度，满足不同的业务分析需求：

- **按小时统计**：
  - 用途：查看日内流量高峰，识别高峰时段
  - 价值：有利于制定服务器扩缩容方案，优化资源配置
  - 适用场景：分析当日或近期的访问模式

- **按日统计**：
  - 用途：进行详细的日常数据分析
  - 价值：追踪每日订单趋势，识别异常波动
  - 适用场景：日常运营监控，短期趋势分析

- **按月统计**：
  - 用途：进行财务统计和月度报表
  - 价值：便于财务核算和月度业绩评估
  - 适用场景：月度总结，财务报告

- **按年统计**：
  - 用途：进行长期数据分析和年度总结
  - 价值：识别年度趋势，制定长期战略
  - 适用场景：年度报告，长期业务规划

#### 2. 订单类型

支持两种订单类型的独立统计：

- **商品订单** (`product`):
  - 统计商品销售订单数据
  - 包含订单数量、订单金额等指标
  - 区分总订单和已支付订单

- **会员订单** (`membership`):
  - 统计会员购买订单数据
  - 包含会员购买数量、收入金额等指标
  - 区分总订单和已支付订单

#### 3. 统计指标

每个时间点/时间段提供以下4个核心指标：

- **订单数量** (`count`): 该时间段内创建的订单总数
- **订单总金额** (`amount`): 该时间段内订单金额总和
- **已支付订单数** (`paidCount`): 该时间段内已支付的订单数量
- **已支付金额** (`paidAmount`): 该时间段内已支付订单的金额总和

#### 4. 图表展示

支持两种图表类型：

- **折线图** (`line`):
  - 适合展示趋势变化
  - 清晰展示数据走向
  - 支持双Y轴（左轴：数量，右轴：金额）

- **柱状图** (`bar`):
  - 适合对比不同时间段的数据
  - 直观展示数据差异
  - 支持双Y轴（左轴：数量，右轴：金额）

#### 5. 交互控制

- **订单类型切换**：一键切换商品订单/会员订单
- **统计维度切换**：灵活选择时间粒度
- **图表类型切换**：在折线图和柱状图之间切换
- **自定义日期范围**：自由选择统计的起止日期
- **自动初始化**：根据选择的维度自动设置合理的默认日期范围

#### 6. 数据摘要

在图表下方提供4个数据摘要卡片：

- 总订单数：所选时间范围内的订单总量
- 已支付订单数：所选时间范围内的已支付订单量
- 总金额：所选时间范围内的订单金额总和
- 已支付金额：所选时间范围内的已支付金额总和

**权限控制**：

严格的权限验证机制，确保数据安全：

- **管理员**：自动拥有完整访问权限
- **普通用户**：需要以下任一权限：
  - `ORDERS` 模块的 `READ` 权限（查看商品订单统计）
  - `MEMBERSHIPS` 模块的 `READ` 权限（查看会员订单统计）
- **未授权用户**：
  - 无法访问统计页面
  - 显示友好的权限不足提示
  - 提供联系管理员的引导信息

**技术实现**：

#### API 端点

**路径**: `/api/backendmanager/order-statistics`

**方法**: `GET`

**查询参数**:
```typescript
{
  type: "product" | "membership",  // 订单类型
  dimension: "hour" | "day" | "month" | "year",  // 统计维度
  startDate: string,  // 开始日期 (ISO格式)
  endDate: string     // 结束日期 (ISO格式)
}
```

**返回数据**:
```typescript
{
  data: Array<{
    period: string,      // 时间周期标识（如 "2025-11-19" 或 "2025-11-19 14:00"）
    count: number,       // 订单数量
    amount: number,      // 订单总金额
    paidCount: number,   // 已支付订单数
    paidAmount: number   // 已支付金额
  }>
}
```

**时间周期格式**:
- 按小时: `YYYY-MM-DD HH:00`（如 "2025-11-19 14:00"）
- 按日: `YYYY-MM-DD`（如 "2025-11-19"）
- 按月: `YYYY-MM`（如 "2025-11"）
- 按年: `YYYY`（如 "2025"）

#### 数据聚合逻辑

后端进行高效的数据聚合处理：

1. 根据订单类型查询数据库：
   - 商品订单：查询 `Order` 表
   - 会员订单：查询 `Membership` 表

2. 按时间范围过滤：
   - 使用 `createdAt` 字段筛选指定日期范围内的订单

3. 按维度分组聚合：
   - 根据选择的维度对订单进行分组
   - 计算每个时间段的统计指标

4. 区分支付状态：
   - 商品订单：`status === 'paid'`
   - 会员订单：`paymentStatus === 'completed'`

#### 前端组件

**组件**: `OrderStatisticsChart`

**技术栈**:
- **图表库**: Recharts 3.4.1
- **UI框架**: React + TypeScript
- **样式**: Tailwind CSS

**组件特性**:
- 完全响应式设计
- 支持实时数据刷新
- 自定义 Tooltip 显示详细信息
- 金额格式化显示（¥符号 + 两位小数）
- 加载状态和错误处理
- 空数据友好提示

**实现位置**：

- **后端API**: `app/api/backendmanager/order-statistics/route.ts`
- **前端组件**: `components/OrderStatisticsChart.tsx`
- **统计页面**: `app/backendmanager/order-statistics/page.tsx`
- **后台入口**: `app/backendmanager/page.tsx`（添加订单统计分析卡片）

**UI设计**：

页面布局包含以下区域：

1. **页面标题**：
   - 主标题："订单统计分析"
   - 副标题：功能说明

2. **功能说明卡片**：
   - 蓝色背景的提示区域
   - 列出各维度的用途和价值

3. **控制面板**：
   - 订单类型选择器
   - 统计维度选择器
   - 图表类型选择器
   - 日期范围选择器（开始日期 + 结束日期）

4. **维度说明**：
   - 动态显示当前选择维度的说明
   - 帮助用户理解维度的适用场景

5. **图表区域**：
   - 响应式图表容器（高度400px）
   - 支持折线图/柱状图切换
   - 双Y轴设计（左轴数量，右轴金额）
   - 自定义颜色方案

6. **数据摘要卡片**：
   - 4个统计卡片横向排列
   - 不同颜色区分（蓝/绿/黄/红）
   - 大字号显示关键数字

**使用场景**：

1. **运营分析**：
   - 查看每日订单趋势，识别业务高峰期
   - 分析促销活动效果
   - 监控订单转化率

2. **容量规划**：
   - 按小时统计识别访问高峰
   - 制定服务器扩缩容策略
   - 优化资源配置

3. **财务报表**：
   - 按月统计生成财务报表
   - 计算月度/年度营收
   - 支持财务核算

4. **战略决策**：
   - 按年统计分析长期趋势
   - 评估业务增长情况
   - 制定未来发展规划

**最佳实践**：

1. **时间范围选择建议**：
   - 按小时：建议选择1-7天范围
   - 按日：建议选择1-90天范围
   - 按月：建议选择1-24个月范围
   - 按年：建议选择3-10年范围

2. **性能优化**：
   - 大数据量查询时使用数据库索引
   - 前端使用加载状态提升用户体验
   - 合理设置日期范围避免过载

3. **数据安全**：
   - 后端严格验证权限
   - 只返回用户有权限查看的数据
   - 防止未授权访问

**未来扩展方向**：

- [ ] 支持更多统计维度（如按周、按季度）
- [ ] 添加同比、环比分析
- [ ] 支持导出统计报表（Excel/PDF）
- [ ] 添加预警功能（订单异常波动提醒）
- [ ] 支持多个指标的组合对比
- [ ] 添加地域分布统计
- [ ] 支持用户分群统计

---

## 🔒 安全设计

### 管理后台路径

**设计决策**（2025-11）：
- ❌ 不使用常见的 `/admin` 路径（易被攻击）
- ✅ 使用 `/backendmanager` 路径（提高安全性）

**路径映射**：
```
旧路径                              → 新路径
/admin/users                       → /backendmanager/users
/api/admin/users                   → /api/backendmanager/users
/api/admin/products                → /api/backendmanager/products
/api/admin/orders                  → /api/backendmanager/orders
```

**实现位置**：
- 页面: `app/backendmanager/`
- API: `app/api/backendmanager/`
- 导航: `components/Navbar.tsx`

### 权限验证

**API 权限保护**：
```typescript
import { requireAdmin, requireRead, requireWrite } from '@/lib/permissions'

// 要求管理员权限
export async function DELETE(req: Request) {
  await requireAdmin()
  // ...
}

// 要求读权限
export async function GET(req: Request) {
  await requireRead('PRODUCTS')
  // ...
}

// 要求写权限
export async function POST(req: Request) {
  await requireWrite('CATEGORIES')
  // ...
}
```

---

## 🌐 API 路由规范

### 命名规则

1. **资源命名**：使用复数形式
   - ✅ `/api/products`
   - ❌ `/api/product`

2. **动作命名**：使用动词
   - ✅ `/api/memberships/verify`
   - ✅ `/api/orders/export`

3. **管理接口**：统一前缀 `/api/backendmanager/`
   - ✅ `/api/backendmanager/users`
   - ✅ `/api/backendmanager/products`

### HTTP 方法规范

- `GET` - 查询数据
- `POST` - 创建资源
- `PUT` - 更新整个资源
- `PATCH` - 部分更新
- `DELETE` - 删除资源

---

## 📦 数据库迁移

### 重要脚本

1. **测试数据创建**：
   ```bash
   node scripts/create-test-data.js
   ```
   创建：管理员、测试用户、分类、商品（不含会员方案）

2. **会员方案初始化**：
   ```bash
   npx tsx scripts/init-membership-plans.ts
   ```
   创建：会员方案配置

3. **现有用户批准**：
   ```bash
   npx tsx scripts/update-existing-users.ts
   ```
   批准所有现有用户（添加审核功能后运行一次）

### 数据库更新流程

```bash
# 1. 生成 Prisma Client
npx prisma generate

# 2. 创建迁移
npx prisma migrate dev --name your_migration_name

# 3. 重置数据库（仅开发环境）
npx prisma migrate reset

# 4. 重新创建测试数据
node scripts/create-test-data.js
npx tsx scripts/init-membership-plans.ts
```

---

## 📄 分页与搜索优化

### 订单展示优化（2025-11）

**设计决策**：
- 所有订单展示页面支持分页和搜索功能
- 提供灵活的每页数量配置和页码跳转功能

**功能细节**：

1. **匿名用户订单（`/my-orders`）**：
   - 默认展示最近10条订单记录
   - 支持手动配置每页显示数量（10/15/20/30/50条）
   - 支持翻页/分页预览所有订单
   - 支持手动跳转到指定页码
   - 支持通过订单号搜索特定订单
   - 订单数据从 localStorage 读取，客户端分页

2. **会员用户订单（`/orders`）**：
   - 默认展示最近10条订单记录
   - 支持手动配置每页显示数量（10/15/20/30/50条）
   - 支持翻页/分页预览所有订单
   - 支持手动跳转到指定页码
   - 支持通过订单号搜索特定订单
   - 支持按状态筛选（全部、待支付、已支付、已完成、已取消、已退款）

3. **后台管理员订单（`/backendmanager/orders`）**：
   - 默认展示最近10条订单记录
   - 支持手动配置每页显示数量（10/15/20/30/50条）
   - 支持翻页/分页预览所有订单
   - 支持手动跳转到指定页码
   - 支持通过订单号搜索特定订单
   - 支持按状态筛选
   - 支持按日期范围筛选
   - 显示用户信息（注册用户显示姓名和邮箱，匿名用户标记为"匿名用户"）

**实现位置**：
- 匿名用户订单: `app/my-orders/page.tsx`
- 会员用户订单: `app/orders/page.tsx`
- 后台订单管理: `app/backendmanager/orders/page.tsx`

### 商品列表优化（2025-11）

**设计决策**：
- 商品列表默认每页展示15件商品
- 支持灵活的每页数量配置和页码跳转

**功能细节**：
- 默认展示15件商品（调整自之前的12件）
- 支持手动配置每页显示数量（10/15/20/30/50件）
- 支持翻页/分页预览所有商品
- 支持手动跳转到指定页码
- 支持通过商品标题或描述搜索
- 支持多分类筛选（多选）
- 支持"其他"分类筛选

**实现位置**：
- 商品列表: `app/products/page.tsx`
- API 路由: `app/api/products/route.ts`

**分页组件设计**：
```typescript
// 每页数量选择器
[10, 15, 20, 30, 50].map((num) => (
  <button onClick={() => handleLimitChange(num)}>
    {num}
  </button>
))

// 跳转到指定页
<input type="number" min="1" max={totalPages} />
<button onClick={handleJumpToPage}>跳转</button>
```

---

## 🎨 UI/UX 优化

### 弹窗倒计时

**设计方案**（2025-11）：

1. **复制会员码弹窗**：
   - 5秒自动关闭
   - 实时显示倒计时：`{countdown}秒后自动退出`
   - 支持手动点击"确定"关闭

2. **添加购物车成功**（待实现）：
   - 3秒自动关闭
   - 实时显示倒计时：`{countdown}秒后自动关闭`
   - 支持手动点击"确定"关闭

**实现方式**：
```typescript
const [countdown, setCountdown] = useState(5)

useEffect(() => {
  if (!showDialog) return

  if (countdown > 0) {
    const timer = setTimeout(() => {
      setCountdown(countdown - 1)
    }, 1000)
    return () => clearTimeout(timer)
  } else {
    setShowDialog(false)
  }
}, [showDialog, countdown])
```

---

## 📝 待办事项

### 已完成 ✅
- [x] 用户审核系统
- [x] 细粒度权限管理
- [x] 管理后台路径安全优化
- [x] 会员购买跳转优化
- [x] 复制会员码倒计时
- [x] 商品列表分页和搜索优化（默认15件/页）
- [x] 用户订单分页和搜索优化（默认10条/页）
- [x] 后台订单管理分页和搜索优化（默认10条/页）
- [x] 匿名用户订单分页和搜索优化（默认10条/页）
- [x] 订单数据清理安全机制（必须先导出才能清理）
- [x] 立即购买会员码优惠逻辑

### 进行中 🔄
- [ ] 添加购物车成功弹窗优化
- [ ] 订单支付创建失败修复
- [ ] 购物车会员码结算闪现问题

### 待优化 📋
- [ ] 客服聊天功能更换
- [ ] 轮播图完整管理后台页面
- [ ] 支付页面动态支付方式实现
- [ ] 订单导出优化
- [ ] 邮件通知功能

---

## 🎨 网站功能管理（2025-11）

### 轮播图系统

**功能说明**：
- 首页顶部展示轮播图，用于宣传活动、新品推广等
- 管理员可在后台控制是否启用轮播图功能
- 支持添加、编辑、删除轮播图
- 自动轮播，每5秒切换一次

**数据模型** (`Banner`):
- `title` - 轮播图标题
- `image` - 图片URL
- `link` - 点击跳转链接（可选）
- `description` - 描述
- `sortOrder` - 排序顺序，数字越小越靠前
- `status` - active/inactive

**API端点**:
- `GET /api/banners` - 获取启用的轮播图（公开）
- `GET /api/backendmanager/banners` - 管理员获取所有轮播图
- `POST /api/backendmanager/banners` - 创建轮播图
- `PATCH /api/backendmanager/banners/[id]` - 更新轮播图
- `DELETE /api/backendmanager/banners/[id]` - 删除轮播图

**实现位置**:
- 轮播图组件: `components/BannerCarousel.tsx`
- 首页集成: `app/page.tsx`
- 后台设置: `app/backendmanager/settings/page.tsx`

**特性**:
- 响应式设计，支持移动端
- 自动轮播 + 手动切换
- 支持链接跳转
- 显示标题和描述
- 可通过后台开关控制显示/隐藏

---

### 系统配置管理

**功能说明**：
- 统一的系统配置管理，支持动态启用/禁用功能
- 管理员可在后台设置页面管理所有配置

**支持的配置项**:

1. **轮播图配置**:
   - `banner_enabled` (boolean) - 是否启用首页轮播图

2. **支付方式配置** (2025-11):
   - `payment_alipay_enabled` (boolean) - 是否启用支付宝支付
   - `payment_wechat_enabled` (boolean) - 是否启用微信支付
   - `payment_paypal_enabled` (boolean) - 是否启用PayPal支付

**API端点**:
- `GET /api/system-config?keys=...` - 获取公开配置（前端使用）
- `GET /api/backendmanager/system-config` - 管理员获取所有配置
- `POST /api/backendmanager/system-config` - 创建/更新单个配置
- `PUT /api/backendmanager/system-config` - 批量更新配置

**实现位置**:
- 管理后台设置: `app/backendmanager/settings/page.tsx`
- API路由(公开): `app/api/system-config/route.ts`
- API路由(管理员): `app/api/backendmanager/system-config/route.ts`

**使用方式**:
```typescript
// 前端获取配置
const res = await fetch('/api/system-config?keys=banner_enabled,payment_alipay_enabled')
const config = await res.json()
// config = { banner_enabled: true, payment_alipay_enabled: true, ... }
```

**数据库迁移**:
```bash
# 需要运行数据库迁移以创建新表
npx prisma db push
# 或
npx prisma migrate dev
```

---

## 🔗 相关文档

- [README.md](./README.md) - 项目简介和快速开始
- [DEPLOYMENT.md](./DEPLOYMENT.md) - 部署文档
- [MEMBERSHIP_FEATURES.md](./MEMBERSHIP_FEATURES.md) - 会员功能详解
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - 数据迁移指南

---

**最后更新**: 2025-11-19
**维护者**: Claude AI Assistant
