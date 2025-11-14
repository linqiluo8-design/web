// @ts-ignore
import { PrismaClient } from '../app/generated/prisma/index.js'

const prisma = new PrismaClient()

async function main() {
  // 清空现有数据（可选）
  await prisma.product.deleteMany()

  // 创建测试商品
  const products = [
    {
      title: "Web开发完整教程",
      description: "从零开始学习现代Web开发，包括HTML、CSS、JavaScript、React等",
      content: "这是一个全面的Web开发课程...",
      price: 199.00,
      category: "课程",
      tags: JSON.stringify(["Web开发", "前端", "React"]),
      status: "active",
      coverImage: "https://via.placeholder.com/400x300?text=Web+Development"
    },
    {
      title: "Python数据分析实战",
      description: "掌握Python数据分析核心技能，包括Pandas、NumPy、Matplotlib等",
      content: "深入学习Python数据分析...",
      price: 299.00,
      category: "课程",
      tags: JSON.stringify(["Python", "数据分析", "机器学习"]),
      status: "active",
      coverImage: "https://via.placeholder.com/400x300?text=Python+Data+Analysis"
    },
    {
      title: "JavaScript高级编程",
      description: "深入理解JavaScript核心概念，掌握高级编程技巧",
      content: "JavaScript进阶知识...",
      price: 159.00,
      category: "电子书",
      tags: JSON.stringify(["JavaScript", "编程", "前端"]),
      status: "active",
      coverImage: "https://via.placeholder.com/400x300?text=JavaScript+Advanced"
    },
    {
      title: "UI/UX设计指南",
      description: "学习专业的UI/UX设计方法和最佳实践",
      content: "设计师必备技能...",
      price: 249.00,
      category: "课程",
      tags: JSON.stringify(["设计", "UI", "UX"]),
      status: "active",
      coverImage: "https://via.placeholder.com/400x300?text=UI+UX+Design"
    },
    {
      title: "Docker容器化实战",
      description: "掌握Docker容器技术，实现应用的快速部署",
      content: "Docker从入门到精通...",
      price: 179.00,
      category: "课程",
      tags: JSON.stringify(["Docker", "DevOps", "容器化"]),
      status: "active",
      coverImage: "https://via.placeholder.com/400x300?text=Docker"
    },
    {
      title: "Git版本控制完全指南",
      description: "全面学习Git版本控制系统的使用",
      content: "Git实用技巧...",
      price: 99.00,
      category: "电子书",
      tags: JSON.stringify(["Git", "版本控制", "协作"]),
      status: "active",
      coverImage: "https://via.placeholder.com/400x300?text=Git+Guide"
    }
  ]

  for (const product of products) {
    await prisma.product.create({
      data: product
    })
  }

  console.log('✅ 测试数据创建成功！')
  console.log(`已创建 ${products.length} 个测试商品`)
}

main()
  .catch((e) => {
    console.error('❌ 数据填充失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
