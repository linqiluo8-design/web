# 知识付费系统

一个完整的知识付费平台，支持商品展示、购物车、订单管理和多种支付方式。

## 🎯 核心功能

### 1. 商品展示（公开访问，无需登录）
- ✅ 商品列表浏览
- ✅ 商品详情查看
- ✅ 搜索和分类筛选
- ✅ 响应式设计

### 2. 用户认证
- ✅ 用户注册/登录
- ✅ JWT令牌认证
- ✅ 基于NextAuth.js的会话管理
- ✅ 密码加密存储

### 3. 购物车功能（需要登录）
- ✅ 添加商品到购物车
- ✅ 购物车数量管理
- ✅ 购物车项目删除
- ✅ 购物车结算

### 4. 订单管理
- ✅ 立即购买（单商品）
- ✅ 购物车批量结算
- ✅ 订单状态跟踪
- ✅ 订单历史查询

### 5. 多种支付方式
- ✅ **支付宝支付**（网页支付）
- ✅ **微信支付**（H5支付）
- ✅ **PayPal支付**（国际支付）
- ✅ 支付回调处理
- ✅ 订单状态自动更新

## 🛠️ 技术栈

### 前端
- **Next.js 14** - React全栈框架（App Router）
- **TypeScript** - 类型安全
- **Tailwind CSS** - 样式框架
- **NextAuth.js** - 认证解决方案

### 后端
- **Next.js API Routes** - RESTful API
- **Prisma** - ORM数据库工具
- **SQLite** - 开发数据库（可切换到PostgreSQL）
- **bcryptjs** - 密码加密

### 支付集成
- **alipay-sdk** - 支付宝SDK
- **wechatpay-node-v3** - 微信支付SDK
- **@paypal/checkout-server-sdk** - PayPal SDK

## 📁 项目结构

```
.
├── app/
│   ├── api/                    # API路由
│   │   ├── auth/              # 认证相关API
│   │   │   ├── [...nextauth]/ # NextAuth处理器
│   │   │   └── register/      # 用户注册
│   │   ├── products/          # 商品API
│   │   ├── cart/              # 购物车API
│   │   ├── orders/            # 订单API
│   │   └── payment/           # 支付API
│   │       ├── create/        # 创建支付
│   │       └── callback/      # 支付回调
│   ├── layout.tsx             # 根布局
│   └── page.tsx               # 首页
├── components/                 # React组件
│   └── Navbar.tsx             # 导航栏
├── lib/
│   ├── auth.ts                # NextAuth配置
│   ├── prisma.ts              # Prisma客户端
│   ├── session.ts             # 会话工具
│   └── payment/               # 支付服务
│       ├── alipay.ts          # 支付宝
│       ├── wechat.ts          # 微信支付
│       └── paypal.ts          # PayPal
├── prisma/
│   ├── schema.prisma          # 数据库模型
│   └── migrations/            # 数据库迁移
└── .env                       # 环境变量

```

## 🗄️ 数据库设计

### 核心模型

1. **User** - 用户表
   - 基本信息、邮箱、密码
   - 关联：订单、购物车

2. **Product** - 商品表
   - 标题、描述、价格、封面图
   - 状态管理（active/inactive/archived）

3. **CartItem** - 购物车项
   - 用户-商品关联
   - 数量管理

4. **Order** - 订单表
   - 订单号、总金额、状态
   - 支付方式

5. **OrderItem** - 订单项
   - 订单详情
   - 购买时价格快照

6. **Payment** - 支付记录
   - 交易ID、支付方式
   - 支付状态、金额

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env` 文件并填入配置：

```env
# 数据库
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# 支付宝
ALIPAY_APP_ID="your-app-id"
ALIPAY_PRIVATE_KEY="your-private-key"
ALIPAY_PUBLIC_KEY="alipay-public-key"

# 微信支付
WECHAT_APP_ID="your-app-id"
WECHAT_MCH_ID="your-mch-id"
WECHAT_API_KEY="your-api-key"

# PayPal
PAYPAL_CLIENT_ID="your-client-id"
PAYPAL_CLIENT_SECRET="your-client-secret"
PAYPAL_MODE="sandbox"
```

### 3. 初始化数据库

```bash
npx prisma generate
npx prisma migrate dev
```

### 4. 运行开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看应用。

## 📝 API文档

### 认证 API

- `POST /api/auth/register` - 用户注册
- `POST /api/auth/signin` - 用户登录

### 商品 API（公开）

- `GET /api/products` - 获取商品列表
- `GET /api/products/[id]` - 获取商品详情
- `POST /api/products` - 创建商品（管理员）

### 购物车 API（需认证）

- `GET /api/cart` - 获取购物车
- `POST /api/cart` - 添加到购物车
- `PUT /api/cart/[id]` - 更新数量
- `DELETE /api/cart/[id]` - 删除购物车项

### 订单 API（需认证）

- `GET /api/orders` - 获取订单列表
- `POST /api/orders` - 创建订单
  - `type: "direct"` - 立即购买
  - `type: "cart"` - 购物车结算

### 支付 API（需认证）

- `POST /api/payment/create` - 创建支付订单
- `POST /api/payment/callback/alipay` - 支付宝回调
- `POST /api/payment/callback/wechat` - 微信回调
- `GET /api/payment/callback/paypal` - PayPal回调

## 🔒 安全特性

- ✅ 密码bcrypt加密
- ✅ JWT令牌认证
- ✅ 支付签名验证
- ✅ 订单归属验证
- ✅ API权限控制

## 📦 部署

### 生产环境配置

1. 将SQLite切换到PostgreSQL
2. 配置生产环境支付密钥
3. 设置NEXTAUTH_SECRET
4. 配置域名和回调URL

### Vercel部署

```bash
npm run build
vercel deploy
```

## 🎨 功能演示流程

### 完整购买流程

1. **浏览商品**（无需登录）
   - 访问首页
   - 浏览商品列表
   - 查看商品详情

2. **添加购物车**（需要登录）
   - 点击"加入购物车"
   - 系统提示登录
   - 登录后商品添加成功

3. **立即购买**（需要登录）
   - 点击"立即购买"
   - 跳转到登录页
   - 登录后创建订单

4. **选择支付方式**
   - 支付宝
   - 微信支付
   - PayPal

5. **完成支付**
   - 跳转到支付页面
   - 完成支付
   - 自动回调更新订单状态

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
