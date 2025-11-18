"use client"

import { useState } from "react"

export type FilterOperator =
  | 'equals'
  | 'not'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'in'
  | 'notIn'

export type FilterCondition = {
  id: string
  field: string
  operator: FilterOperator
  value: any
}

export type FilterGroup = {
  logic: 'AND' | 'OR'
  conditions: FilterCondition[]
}

// 可用的筛选字段配置
const FILTER_FIELDS = {
  // 订单相关字段
  orderNumber: { label: '订单号', type: 'string' },
  status: {
    label: '订单/会员状态',
    type: 'select',
    options: [
      { value: 'pending', label: '待支付' },
      { value: 'paid', label: '已支付' },
      { value: 'completed', label: '已完成' },
      { value: 'cancelled', label: '已取消' },
      { value: 'refunded', label: '已退款' },
      { value: 'active', label: '有效' },
      { value: 'expired', label: '已过期' },
    ]
  },
  paymentMethod: {
    label: '支付方式',
    type: 'select',
    options: [
      { value: 'wechat', label: '微信支付' },
      { value: 'alipay', label: '支付宝' },
      { value: 'paypal', label: 'PayPal' },
    ]
  },
  paymentStatus: {
    label: '支付状态',
    type: 'select',
    options: [
      { value: 'pending', label: '待支付' },
      { value: 'completed', label: '已支付' },
      { value: 'failed', label: '支付失败' },
    ]
  },
  totalAmount: { label: '订单金额', type: 'number' },
  purchasePrice: { label: '购买价格', type: 'number' },
  createdAt: { label: '创建时间', type: 'date' },
  'user.email': { label: '用户邮箱', type: 'string' },
  membershipCode: { label: '会员码', type: 'string' },
}

// 操作符配置
const OPERATORS = {
  string: [
    { value: 'equals', label: '等于' },
    { value: 'not', label: '不等于' },
    { value: 'contains', label: '包含' },
    { value: 'startsWith', label: '以...开始' },
    { value: 'endsWith', label: '以...结束' },
  ],
  number: [
    { value: 'equals', label: '等于' },
    { value: 'not', label: '不等于' },
    { value: 'gt', label: '大于' },
    { value: 'gte', label: '大于等于' },
    { value: 'lt', label: '小于' },
    { value: 'lte', label: '小于等于' },
  ],
  date: [
    { value: 'equals', label: '等于' },
    { value: 'gt', label: '晚于' },
    { value: 'gte', label: '不早于' },
    { value: 'lt', label: '早于' },
    { value: 'lte', label: '不晚于' },
  ],
  select: [
    { value: 'equals', label: '等于' },
    { value: 'not', label: '不等于' },
    { value: 'in', label: '在列表中' },
  ],
}

interface AdvancedFilterProps {
  onFilterChange: (filterGroup: FilterGroup) => void
  initialFilter?: FilterGroup
}

export default function AdvancedFilter({ onFilterChange, initialFilter }: AdvancedFilterProps) {
  const [logic, setLogic] = useState<'AND' | 'OR'>(initialFilter?.logic || 'AND')
  const [conditions, setConditions] = useState<FilterCondition[]>(
    initialFilter?.conditions || []
  )

  // 添加新条件
  const addCondition = () => {
    const newCondition: FilterCondition = {
      id: `condition-${Date.now()}`,
      field: 'status',
      operator: 'equals',
      value: ''
    }
    const newConditions = [...conditions, newCondition]
    setConditions(newConditions)
    notifyChange(logic, newConditions)
  }

  // 删除条件
  const removeCondition = (id: string) => {
    const newConditions = conditions.filter(c => c.id !== id)
    setConditions(newConditions)
    notifyChange(logic, newConditions)
  }

  // 更新条件
  const updateCondition = (id: string, updates: Partial<FilterCondition>) => {
    const newConditions = conditions.map(c =>
      c.id === id ? { ...c, ...updates } : c
    )
    setConditions(newConditions)
    notifyChange(logic, newConditions)
  }

  // 切换逻辑
  const toggleLogic = () => {
    const newLogic = logic === 'AND' ? 'OR' : 'AND'
    setLogic(newLogic)
    notifyChange(newLogic, conditions)
  }

  // 通知父组件
  const notifyChange = (currentLogic: 'AND' | 'OR', currentConditions: FilterCondition[]) => {
    onFilterChange({
      logic: currentLogic,
      conditions: currentConditions
    })
  }

  // 清空所有条件
  const clearAll = () => {
    setConditions([])
    notifyChange(logic, [])
  }

  // 获取字段类型
  const getFieldType = (field: string): string => {
    return FILTER_FIELDS[field as keyof typeof FILTER_FIELDS]?.type || 'string'
  }

  // 获取可用操作符
  const getAvailableOperators = (field: string) => {
    const fieldType = getFieldType(field)
    return OPERATORS[fieldType as keyof typeof OPERATORS] || OPERATORS.string
  }

  return (
    <div className="space-y-4">
      {/* 逻辑切换和添加按钮 */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={addCondition}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
        >
          + 添加筛选条件
        </button>

        {conditions.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">条件关系：</span>
            <button
              onClick={toggleLogic}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                logic === 'AND'
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-orange-100 text-orange-700 border border-orange-300'
              }`}
            >
              {logic === 'AND' ? 'AND (且)' : 'OR (或)'}
            </button>
            <span className="text-xs text-gray-500">
              {logic === 'AND' ? '所有条件都满足' : '满足任一条件即可'}
            </span>
          </div>
        )}

        {conditions.length > 0 && (
          <button
            onClick={clearAll}
            className="px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md"
          >
            清空全部
          </button>
        )}
      </div>

      {/* 筛选条件列表 */}
      {conditions.length > 0 && (
        <div className="space-y-3">
          {conditions.map((condition, index) => {
            const fieldConfig = FILTER_FIELDS[condition.field as keyof typeof FILTER_FIELDS]
            const availableOperators = getAvailableOperators(condition.field)

            return (
              <div key={condition.id} className="flex items-start gap-2 bg-gray-50 p-3 rounded-md">
                {/* 条件序号 */}
                <div className="flex items-center pt-2">
                  <span className="text-xs font-medium text-gray-500 min-w-[60px]">
                    {index > 0 && (
                      <span className={logic === 'AND' ? 'text-green-600' : 'text-orange-600'}>
                        {logic}
                      </span>
                    )}
                    {index === 0 && '条件'}
                    {' '}
                    {index + 1}
                  </span>
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                  {/* 字段选择 */}
                  <select
                    value={condition.field}
                    onChange={(e) => {
                      const newField = e.target.value
                      const newFieldType = getFieldType(newField)
                      const newOperators = OPERATORS[newFieldType as keyof typeof OPERATORS]
                      updateCondition(condition.id, {
                        field: newField,
                        operator: newOperators[0].value as FilterOperator,
                        value: ''
                      })
                    }}
                    className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(FILTER_FIELDS).map(([key, config]) => (
                      <option key={key} value={key}>
                        {config.label}
                      </option>
                    ))}
                  </select>

                  {/* 操作符选择 */}
                  <select
                    value={condition.operator}
                    onChange={(e) => updateCondition(condition.id, {
                      operator: e.target.value as FilterOperator
                    })}
                    className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {availableOperators.map(op => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>

                  {/* 值输入 */}
                  {fieldConfig?.type === 'select' ? (
                    <select
                      value={condition.value}
                      onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                      className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">请选择</option>
                      {fieldConfig.options?.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={fieldConfig?.type === 'number' ? 'number' : fieldConfig?.type === 'date' ? 'date' : 'text'}
                      value={condition.value}
                      onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                      placeholder="请输入值"
                      className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      step={fieldConfig?.type === 'number' ? '0.01' : undefined}
                    />
                  )}
                </div>

                {/* 删除按钮 */}
                <button
                  onClick={() => removeCondition(condition.id)}
                  className="px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md text-sm"
                  title="删除此条件"
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* 提示信息 */}
      {conditions.length === 0 && (
        <div className="text-center py-6 text-gray-400 text-sm bg-gray-50 rounded-md border-2 border-dashed border-gray-200">
          点击"添加筛选条件"开始创建筛选规则
        </div>
      )}
    </div>
  )
}
