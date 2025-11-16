'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

type PermissionModule = 'CATEGORIES' | 'MEMBERSHIPS' | 'ORDERS' | 'PRODUCTS'
type PermissionLevel = 'NONE' | 'READ' | 'WRITE'

interface UserPermission {
  module: PermissionModule
  level: PermissionLevel
}

interface User {
  id: string
  name: string
  email: string
  role: string
  accountStatus: string
  createdAt: string
  permissions: UserPermission[]
  _count: {
    orders: number
  }
}

const MODULE_NAMES: Record<PermissionModule, string> = {
  CATEGORIES: '分类管理',
  MEMBERSHIPS: '会员管理',
  ORDERS: '订单数据',
  PRODUCTS: '商品管理',
}

const STATUS_NAMES: Record<string, string> = {
  PENDING: '待审核',
  APPROVED: '已批准',
  REJECTED: '已拒绝',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
}

export default function UserManagementPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<Record<PermissionModule, PermissionLevel>>({
    CATEGORIES: 'NONE',
    MEMBERSHIPS: 'NONE',
    ORDERS: 'NONE',
    PRODUCTS: 'NONE',
  })

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (sessionStatus === 'authenticated' && session?.user?.role !== 'ADMIN') {
      router.push('/')
      return
    }

    if (sessionStatus === 'authenticated') {
      loadUsers()
    }
  }, [sessionStatus, session, router])

  const loadUsers = async () => {
    try {
      const url = filter === 'all' ? '/api/admin/users' : `/api/admin/users?status=${filter}`
      const response = await fetch(url)
      const data = await response.json()

      if (response.ok) {
        setUsers(data.users)
      } else {
        alert(data.error || '加载用户失败')
      }
    } catch (error) {
      console.error('加载用户失败:', error)
      alert('加载用户失败')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (userId: string) => {
    if (!confirm('确认批准该用户？')) return

    try {
      const response = await fetch(`/api/admin/users/${userId}/approve`, {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        alert('用户已批准')
        loadUsers()
      } else {
        alert(data.error || '批准失败')
      }
    } catch (error) {
      console.error('批准用户失败:', error)
      alert('批准用户失败')
    }
  }

  const handleReject = async (userId: string) => {
    if (!confirm('确认拒绝该用户？')) return

    try {
      const response = await fetch(`/api/admin/users/${userId}/reject`, {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        alert('用户已拒绝')
        loadUsers()
      } else {
        alert(data.error || '拒绝失败')
      }
    } catch (error) {
      console.error('拒绝用户失败:', error)
      alert('拒绝用户失败')
    }
  }

  const handleEditPermissions = (user: User) => {
    setEditingUser(user.id)

    // 初始化权限状态
    const userPerms: Record<PermissionModule, PermissionLevel> = {
      CATEGORIES: 'NONE',
      MEMBERSHIPS: 'NONE',
      ORDERS: 'NONE',
      PRODUCTS: 'NONE',
    }

    user.permissions.forEach((p) => {
      userPerms[p.module] = p.level
    })

    setPermissions(userPerms)
  }

  const handleSavePermissions = async (userId: string) => {
    try {
      const permissionsArray = Object.entries(permissions).map(([module, level]) => ({
        module: module as PermissionModule,
        level,
      }))

      const response = await fetch(`/api/admin/users/${userId}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: permissionsArray }),
      })

      const data = await response.json()

      if (response.ok) {
        alert('权限更新成功')
        setEditingUser(null)
        loadUsers()
      } else {
        alert(data.error || '权限更新失败')
      }
    } catch (error) {
      console.error('保存权限失败:', error)
      alert('保存权限失败')
    }
  }

  useEffect(() => {
    loadUsers()
  }, [filter])

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">加载中...</div>
      </div>
    )
  }

  const filteredUsers = users.filter((user) => {
    if (filter === 'all') return true
    return user.accountStatus === filter
  })

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">用户管理</h1>
          <p className="text-gray-600">管理用户账号审核和权限设置</p>
        </div>

        {/* 筛选器 */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              全部 ({users.length})
            </button>
            <button
              onClick={() => setFilter('PENDING')}
              className={`px-4 py-2 rounded-lg ${
                filter === 'PENDING'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              待审核 ({users.filter((u) => u.accountStatus === 'PENDING').length})
            </button>
            <button
              onClick={() => setFilter('APPROVED')}
              className={`px-4 py-2 rounded-lg ${
                filter === 'APPROVED'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              已批准 ({users.filter((u) => u.accountStatus === 'APPROVED').length})
            </button>
            <button
              onClick={() => setFilter('REJECTED')}
              className={`px-4 py-2 rounded-lg ${
                filter === 'REJECTED'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              已拒绝 ({users.filter((u) => u.accountStatus === 'REJECTED').length})
            </button>
          </div>
        </div>

        {/* 用户列表 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  用户信息
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  角色
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  权限
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  注册时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{user.name}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.role === 'ADMIN'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {user.role === 'ADMIN' ? '管理员' : '用户'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        STATUS_COLORS[user.accountStatus]
                      }`}
                    >
                      {STATUS_NAMES[user.accountStatus]}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {editingUser === user.id ? (
                      <div className="space-y-2">
                        {Object.entries(MODULE_NAMES).map(([module, name]) => (
                          <div key={module} className="flex items-center gap-2">
                            <span className="text-sm text-gray-700 w-24">{name}:</span>
                            <select
                              value={permissions[module as PermissionModule]}
                              onChange={(e) =>
                                setPermissions({
                                  ...permissions,
                                  [module]: e.target.value as PermissionLevel,
                                })
                              }
                              className="text-sm border rounded px-2 py-1"
                            >
                              <option value="NONE">无权限</option>
                              <option value="READ">只读</option>
                              <option value="WRITE">读写</option>
                            </select>
                          </div>
                        ))}
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleSavePermissions(user.id)}
                            className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                          >
                            保存
                          </button>
                          <button
                            onClick={() => setEditingUser(null)}
                            className="text-sm bg-gray-300 text-gray-700 px-3 py-1 rounded hover:bg-gray-400"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600">
                        {user.role === 'ADMIN' ? (
                          <span className="text-purple-600">全部权限</span>
                        ) : user.permissions.length > 0 ? (
                          <div className="space-y-1">
                            {user.permissions.map((p) => (
                              <div key={p.module}>
                                {MODULE_NAMES[p.module]}: {p.level === 'READ' ? '只读' : '读写'}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">无权限</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex flex-col gap-2">
                      {user.accountStatus === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleApprove(user.id)}
                            className="text-green-600 hover:text-green-900"
                          >
                            批准
                          </button>
                          <button
                            onClick={() => handleReject(user.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            拒绝
                          </button>
                        </>
                      )}
                      {user.accountStatus === 'APPROVED' && user.role !== 'ADMIN' && (
                        <>
                          {editingUser !== user.id && (
                            <button
                              onClick={() => handleEditPermissions(user)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              管理权限
                            </button>
                          )}
                          <button
                            onClick={() => handleReject(user.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            撤销
                          </button>
                        </>
                      )}
                      {user.accountStatus === 'REJECTED' && (
                        <button
                          onClick={() => handleApprove(user.id)}
                          className="text-green-600 hover:text-green-900"
                        >
                          批准
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12 text-gray-500">暂无用户</div>
          )}
        </div>
      </div>
    </div>
  )
}
