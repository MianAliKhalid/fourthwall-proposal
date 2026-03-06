'use client'

import { useState, useEffect, useCallback } from 'react'

interface User {
  id: string
  username: string
  displayName: string | null
  role: 'ADMIN' | 'USER'
  isActive: boolean
  lastLogin: string | null
  createdAt: string
  updatedAt: string
  _count: {
    documents: number
    shareLinks: number
  }
}

interface AuditLog {
  id: string
  action: string
  resourceType: string
  resourceId: string | null
  details: unknown
  ipAddress: string | null
  createdAt: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<{ user: User; logs: AuditLog[] } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (roleFilter) params.set('role', roleFilter)
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`/api/admin/users?${params}`)
      const data = await res.json()
      setUsers(data.users || [])
    } catch {
      // Handle silently
    } finally {
      setLoading(false)
    }
  }, [search, roleFilter, statusFilter])

  useEffect(() => {
    const timeout = setTimeout(fetchUsers, 300)
    return () => clearTimeout(timeout)
  }, [fetchUsers])

  async function handleToggleActive(user: User) {
    setActionLoading(user.id)
    try {
      const res = await fetch(`/api/centralsystem/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      })
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, isActive: !u.isActive } : u))
        )
      }
    } catch {
      // Handle silently
    }
    setActionLoading(null)
  }

  async function handleRoleChange(user: User, newRole: 'ADMIN' | 'USER') {
    setActionLoading(user.id)
    try {
      const res = await fetch(`/api/centralsystem/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u))
        )
      }
    } catch {
      // Handle silently
    }
    setActionLoading(null)
  }

  async function viewActivity(user: User) {
    setDetailLoading(true)
    setSelectedUser({ user, logs: [] })
    try {
      const res = await fetch(`/api/centralsystem/admin/users/${user.id}`)
      const data = await res.json()
      setSelectedUser({ user: data.user, logs: data.recentLogs || [] })
    } catch {
      // Handle silently
    }
    setDetailLoading(false)
  }

  function isOnline(lastLogin: string | null): boolean {
    if (!lastLogin) return false
    const diff = Date.now() - new Date(lastLogin).getTime()
    return diff < 30 * 60 * 1000 // 30 minutes
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
        <p className="text-sm text-gray-500 mt-1">Manage user accounts, roles, and access.</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="6.5" cy="6.5" r="5" />
              <path d="M10.5 10.5L14.5 14.5" />
            </svg>
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white cursor-pointer"
          >
            <option value="">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="USER">User</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white cursor-pointer"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                <div className="w-10 h-10 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-gray-200 rounded" />
                  <div className="h-3 w-24 bg-gray-200 rounded" />
                </div>
                <div className="h-6 w-16 bg-gray-200 rounded-full" />
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-gray-500">No users found.</p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3 border-b border-gray-100 bg-gray-50/50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <div className="col-span-3">User</div>
              <div className="col-span-1">Role</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-2">Last Login</div>
              <div className="col-span-1">Docs</div>
              <div className="col-span-1">Links</div>
              <div className="col-span-3 text-right">Actions</div>
            </div>

            <div className="divide-y divide-gray-50">
              {users.map((user) => (
                <div key={user.id} className="lg:grid lg:grid-cols-12 lg:gap-4 flex flex-col gap-2 px-6 py-4 hover:bg-gray-50/50 transition-colors">
                  {/* User info */}
                  <div className="col-span-3 flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center">
                        <span className="text-sm font-bold text-brand-700">
                          {(user.displayName || user.username)[0].toUpperCase()}
                        </span>
                      </div>
                      {/* Online indicator */}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                          isOnline(user.lastLogin) ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{user.displayName || user.username}</p>
                      <p className="text-xs text-gray-500 truncate">@{user.username}</p>
                    </div>
                  </div>

                  {/* Role */}
                  <div className="col-span-1 flex items-center">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                      user.role === 'ADMIN'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-blue-50 text-blue-700'
                    }`}>
                      {user.role}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="col-span-1 flex items-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                      user.isActive
                        ? 'bg-green-50 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {user.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </div>

                  {/* Last Login */}
                  <div className="col-span-2 flex items-center">
                    <span className="text-sm text-gray-500">
                      {user.lastLogin
                        ? new Date(user.lastLogin).toLocaleString()
                        : 'Never'}
                    </span>
                  </div>

                  {/* Counts */}
                  <div className="col-span-1 flex items-center">
                    <span className="text-sm font-medium text-gray-700">{user._count.documents}</span>
                  </div>
                  <div className="col-span-1 flex items-center">
                    <span className="text-sm font-medium text-gray-700">{user._count.shareLinks}</span>
                  </div>

                  {/* Actions */}
                  <div className="col-span-3 flex items-center justify-end gap-1">
                    <a
                      href={`/centralsystem/admin/users/${user.id}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 border border-brand-200 rounded-lg transition-colors"
                    >
                      Profile
                    </a>
                    <button
                      onClick={() => viewActivity(user)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors cursor-pointer"
                    >
                      Activity
                    </button>
                    <button
                      onClick={() => handleToggleActive(user)}
                      disabled={actionLoading === user.id}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                        user.isActive
                          ? 'text-amber-700 hover:bg-amber-50 border border-amber-200'
                          : 'text-green-700 hover:bg-green-50 border border-green-200'
                      }`}
                    >
                      {user.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user, e.target.value as 'ADMIN' | 'USER')}
                      disabled={actionLoading === user.id}
                      className="px-2 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white cursor-pointer disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="USER">User</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* User Activity Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col animate-fade-in-up">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center">
                  <span className="text-sm font-bold text-brand-700">
                    {(selectedUser.user.displayName || selectedUser.user.username || '?')[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    {selectedUser.user.displayName || selectedUser.user.username}
                  </h3>
                  <p className="text-xs text-gray-500">@{selectedUser.user.username} - Recent Activity</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>

            {/* Logs */}
            <div className="flex-1 overflow-y-auto p-6">
              {detailLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse flex gap-3">
                      <div className="w-2 h-2 bg-gray-200 rounded-full mt-2" />
                      <div className="flex-1 space-y-1">
                        <div className="h-4 w-48 bg-gray-200 rounded" />
                        <div className="h-3 w-32 bg-gray-200 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : selectedUser.logs.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No recent activity found.</p>
              ) : (
                <div className="space-y-3">
                  {selectedUser.logs.map((log) => (
                    <div key={log.id} className="flex gap-3 items-start">
                      <div className="w-2 h-2 rounded-full bg-brand-400 mt-2 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">{log.action.replace(/_/g, ' ')}</span>
                          {log.resourceType && (
                            <span className="text-gray-500"> on {log.resourceType}</span>
                          )}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-gray-400">
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                          {log.ipAddress && (
                            <span className="text-xs text-gray-400">IP: {log.ipAddress}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
