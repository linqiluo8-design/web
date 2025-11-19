import { buildWhereClause, type FilterGroup } from '../lib/filter-builder'

console.log('测试日期字段 equals 操作符修复\n')

// 测试用例1: createdAt equals 日期字符串
console.log('测试用例1: createdAt equals "2025-11-19"')
const filter1: FilterGroup = {
  logic: 'AND',
  conditions: [
    {
      field: 'createdAt',
      operator: 'equals',
      value: '2025-11-19'
    }
  ]
}
const result1 = buildWhereClause(filter1)
console.log('结果:', JSON.stringify(result1, null, 2))
console.log('期望: 应该包含 gte 和 lte 两个条件\n')

// 测试用例2: paymentStatus equals 字符串
console.log('测试用例2: paymentStatus equals "completed"')
const filter2: FilterGroup = {
  logic: 'AND',
  conditions: [
    {
      field: 'paymentStatus',
      operator: 'equals',
      value: 'completed'
    }
  ]
}
const result2 = buildWhereClause(filter2)
console.log('结果:', JSON.stringify(result2, null, 2))
console.log('期望: 应该是精确匹配字符串\n')

// 测试用例3: 组合条件 - createdAt equals 今天 AND paymentStatus equals completed
console.log('测试用例3: createdAt equals "2025-11-19" AND paymentStatus equals "completed"')
const filter3: FilterGroup = {
  logic: 'AND',
  conditions: [
    {
      field: 'createdAt',
      operator: 'equals',
      value: '2025-11-19'
    },
    {
      field: 'paymentStatus',
      operator: 'equals',
      value: 'completed'
    }
  ]
}
const result3 = buildWhereClause(filter3)
console.log('结果:', JSON.stringify(result3, null, 2))
console.log('期望: createdAt 使用范围查询，paymentStatus 精确匹配\n')

// 测试用例4: createdAt gte（保持原有行为）
console.log('测试用例4: createdAt gte "2025-11-19"')
const filter4: FilterGroup = {
  logic: 'AND',
  conditions: [
    {
      field: 'createdAt',
      operator: 'gte',
      value: '2025-11-19'
    }
  ]
}
const result4 = buildWhereClause(filter4)
console.log('结果:', JSON.stringify(result4, null, 2))
console.log('期望: 应该是 gte 操作符\n')

// 测试用例5: price equals 数字
console.log('测试用例5: price equals 99.99')
const filter5: FilterGroup = {
  logic: 'AND',
  conditions: [
    {
      field: 'price',
      operator: 'equals',
      value: 99.99
    }
  ]
}
const result5 = buildWhereClause(filter5)
console.log('结果:', JSON.stringify(result5, null, 2))
console.log('期望: 应该是精确匹配数字\n')

console.log('✅ 所有测试用例已运行')
