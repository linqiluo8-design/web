/**
 * 筛选条件构建器
 * 支持复杂的 AND/OR 逻辑组合
 */

export type FilterOperator =
  | 'equals' // 等于
  | 'not' // 不等于
  | 'gt' // 大于
  | 'gte' // 大于等于
  | 'lt' // 小于
  | 'lte' // 小于等于
  | 'contains' // 包含
  | 'startsWith' // 以...开始
  | 'endsWith' // 以...结束
  | 'in' // 在列表中
  | 'notIn' // 不在列表中

export type FilterCondition = {
  field: string // 字段名，支持嵌套如 "user.email"
  operator: FilterOperator
  value: any
}

export type FilterGroup = {
  logic: 'AND' | 'OR' // 逻辑关系
  conditions: (FilterCondition | FilterGroup)[] // 条件列表，可嵌套
}

/**
 * 构建 Prisma where 查询条件
 */
export function buildWhereClause(filterGroup: FilterGroup): any {
  if (!filterGroup || !filterGroup.conditions || filterGroup.conditions.length === 0) {
    return {}
  }

  const { logic, conditions } = filterGroup

  // 将每个条件转换为 Prisma where 对象
  const whereClauses = conditions.map(condition => {
    // 如果是嵌套的 FilterGroup
    if ('logic' in condition) {
      return buildWhereClause(condition as FilterGroup)
    }

    // 处理单个条件
    const { field, operator, value } = condition as FilterCondition

    // 处理嵌套字段（如 user.email）
    const fieldParts = field.split('.')
    let whereObj: any = {}

    // 构建嵌套对象
    const buildNestedObj = (parts: string[], val: any): any => {
      if (parts.length === 1) {
        return { [parts[0]]: val }
      }
      return { [parts[0]]: buildNestedObj(parts.slice(1), val) }
    }

    // 根据操作符构建条件值
    let conditionValue: any

    switch (operator) {
      case 'equals':
        conditionValue = value
        break
      case 'not':
        conditionValue = { not: value }
        break
      case 'gt':
        conditionValue = { gt: value }
        break
      case 'gte':
        conditionValue = { gte: value }
        break
      case 'lt':
        conditionValue = { lt: value }
        break
      case 'lte':
        conditionValue = { lte: value }
        break
      case 'contains':
        conditionValue = { contains: value, mode: 'insensitive' }
        break
      case 'startsWith':
        conditionValue = { startsWith: value, mode: 'insensitive' }
        break
      case 'endsWith':
        conditionValue = { endsWith: value, mode: 'insensitive' }
        break
      case 'in':
        conditionValue = { in: Array.isArray(value) ? value : [value] }
        break
      case 'notIn':
        conditionValue = { notIn: Array.isArray(value) ? value : [value] }
        break
      default:
        conditionValue = value
    }

    whereObj = buildNestedObj(fieldParts, conditionValue)

    return whereObj
  })

  // 根据逻辑关系组合条件
  if (logic === 'OR') {
    return { OR: whereClauses }
  } else {
    // AND 逻辑
    return { AND: whereClauses }
  }
}

/**
 * 快捷方法：创建简单的 AND 条件组
 */
export function createAndFilter(conditions: FilterCondition[]): FilterGroup {
  return {
    logic: 'AND',
    conditions
  }
}

/**
 * 快捷方法：创建简单的 OR 条件组
 */
export function createOrFilter(conditions: FilterCondition[]): FilterGroup {
  return {
    logic: 'OR',
    conditions
  }
}

/**
 * 快捷方法：创建日期范围筛选
 */
export function createDateRangeFilter(
  field: string,
  startDate?: string,
  endDate?: string
): FilterCondition[] {
  const conditions: FilterCondition[] = []

  if (startDate) {
    conditions.push({
      field,
      operator: 'gte',
      value: new Date(startDate)
    })
  }

  if (endDate) {
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)
    conditions.push({
      field,
      operator: 'lte',
      value: end
    })
  }

  return conditions
}

/**
 * 快捷方法：创建价格范围筛选
 */
export function createPriceRangeFilter(
  field: string,
  minPrice?: number,
  maxPrice?: number
): FilterCondition[] {
  const conditions: FilterCondition[] = []

  if (minPrice !== undefined && minPrice !== null) {
    conditions.push({
      field,
      operator: 'gte',
      value: minPrice
    })
  }

  if (maxPrice !== undefined && maxPrice !== null) {
    conditions.push({
      field,
      operator: 'lte',
      value: maxPrice
    })
  }

  return conditions
}
