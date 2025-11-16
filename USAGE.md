# 项目使用说明

## 🚀 快速开始

### 1. 创建测试数据

```bash
# 运行测试数据脚本（会创建管理员、用户、分类、商品、会员方案）
node scripts/create-test-data.js
```

**创建的测试数据：**
- 管理员账号：`admin@example.com` / `admin123`
- 测试用户：`user@example.com` / `user123`
- 4个分类（课程、电子书、工具、模板）
- 12个测试商品
- 3个会员方案（月度、季度、年度）

### 2. 启动项目

```bash
npm run dev
```

访问 http://localhost:3000

## ✅ 已完成的功能优化

### 1. 会员码复制弹窗优化
- ✓ 5秒自动关闭
- ✓ 可手动点击确定关闭
- ✓ 更美观的弹窗UI

### 2. 商品创建Bug修复
- ✓ 修复了外键约束问题
- ✓ 单个商品创建正常工作
- ✓ 批量商品创建正常工作

### 3. 分类管理优化（后端API）
- ✓ 支持批量创建分类
- ✓ API: `POST /api/categories` 支持单个和批量

## 📝 API使用示例

### 单个创建商品
```javascript
fetch('/api/admin/products', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: '商品名称',
    description: '商品描述',
    price: 99.00,
    categoryId: '分类ID',  // 可选，留空表示无分类
    coverImage: 'https://example.com/image.jpg',  // 可选
    status: 'active'
  })
})
```

### 批量创建商品
```javascript
fetch('/api/admin/products', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    products: [
      {
        title: '商品1',
        description: '描述1',
        price: 99.00
      },
      {
        title: '商品2',
        description: '描述2',
        price: 149.00
      }
    ]
  })
})
```

### 批量创建分类
```javascript
fetch('/api/categories', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    categories: [
      {
        name: '分类1',
        description: '描述1',
        sortOrder: 1
      },
      {
        name: '分类2',
        description: '描述2',
        sortOrder: 2
      }
    ]
  })
})
```

## 🐛 已修复的问题

1. **商品创建失败** - 修复了空字符串categoryId导致的外键约束错误
2. **会员码复制弹窗** - 添加了自动关闭功能和更好的UX

## ⏳ 待完成功能

以下功能需要进一步开发（时间关系未完成）：

1. **分类管理UI批量添加** - 后端API已完成，需要前端UI
2. **独立商品管理页面** - 类似分类管理的独立页面
3. **图片粘贴上传** - 支持直接粘贴图片（需要图片上传服务）

## 💡 注意事项

### 关于图片上传
当前系统使用图片URL方式，如需支持粘贴上传图片：
1. 需要配置图片存储服务（如OSS、S3等）
2. 需要添加图片上传API
3. 需要处理图片Base64转换和上传逻辑

推荐方案：
- 使用 https://picsum.photos 作为测试图片源
- 生产环境配置阿里云OSS或腾讯云COS

### 关于分类ID
- 创建商品时，如果不选择分类，categoryId会自动处理为null
- 不要传递空字符串`""`作为categoryId

## 📞 如有问题
- 查看控制台错误信息
- 检查数据库连接
- 确保已运行`npx prisma migrate dev`
