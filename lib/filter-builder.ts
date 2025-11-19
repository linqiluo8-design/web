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

    // 智能转换日期字段值
    // 检测是否为日期字段（常见的日期字段名）
    const dateFields = ['createdAt', 'updatedAt', 'startDate', 'endDate', 'expiresAt', 'date']
    const isDateField = dateFields.some(df => field.toLowerCase().includes(df.toLowerCase()))

    // 如果是日期字段且值是字符串，转换为 Date 对象
    let processedValue = value
    let isDateString = false
    if (isDateField && typeof value === 'string' && value) {
      // 检查是否是日期格式的字符串（YYYY-MM-DD 或 ISO格式）
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
        processedValue = new Date(value)
        isDateString = true

        // 对于 lt 和 lte 操作符，设置为当天结束时间（23:59:59.999）
        // 这样 "小于 2025-11-20" 就会匹配到 2025-11-19 的所有数据
        if (operator === 'lt' || operator === 'lte') {
          if (operator === 'lt') {
            // lt: 小于当天开始时间，等同于 lte 前一天结束时间
            // 保持默认的 00:00:00 即可
          } else {
            // lte: 小于等于当天，设置为当天结束时间
            processedValue.setHours(23, 59, 59, 999)
          }
        }
      }
    }

    // 根据操作符构建条件值
    let conditionValue: any

    switch (operator) {
      case 'equals':
        // 对于日期字段的 equals 操作符，转换为日期范围查询
        // 例如：createdAt 等于 2025-11-19 => createdAt >= 2025-11-19 00:00:00 AND createdAt <= 2025-11-19 23:59:59
        if (isDateField && isDateString && processedValue instanceof Date) {
          const startOfDay = new Date(processedValue)
          startOfDay.setHours(0, 0, 0, 0)
          const endOfDay = new Date(processedValue)
          endOfDay.setHours(23, 59, 59, 999)
          conditionValue = {
            gte: startOfDay,
            lte: endOfDay
          }
        } else {
          conditionValue = processedValue
        }
        break
      case 'not':
        conditionValue = { not: processedValue }
        break
      case 'gt':
        conditionValue = { gt: processedValue }
        break
      case 'gte':
        conditionValue = { gte: processedValue }
        break
      case 'lt':
        conditionValue = { lt: processedValue }
        break
      case 'lte':
        conditionValue = { lte: processedValue }
        break
      case 'contains':
        conditionValue = { contains: processedValue, mode: 'insensitive' }
        break
      case 'startsWith':
        conditionValue = { startsWith: processedValue, mode: 'insensitive' }
        break
      case 'endsWith':
        conditionValue = { endsWith: processedValue, mode: 'insensitive' }
        break
      case 'in':
        conditionValue = { in: Array.isArray(processedValue) ? processedValue : [processedValue] }
        break
      case 'notIn':
        conditionValue = { notIn: Array.isArray(processedValue) ? processedValue : [processedValue] }
        break
      default:
        conditionValue = processedValue
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
