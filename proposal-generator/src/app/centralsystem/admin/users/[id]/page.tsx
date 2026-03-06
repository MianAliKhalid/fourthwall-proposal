'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'

interface UserDetail {
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
    chatMessages: number
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

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [user, setUser] = useState<UserDetail | null>(null)
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [logsPage, setLogsPage] = useState(1)
  const [logsTotal, setLogsTotal] = useState(0)
  const [logsTotalPages, setLogsTotalPages] = useState(0)
  const [logsLoading, setLogsLoading] = useState(false)
  const [actionFilter, setActionFilter] = useState('')
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [displayNameInput, setDisplayNameInput] = useState('')

  const fetchUser = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${id}`)
      const data = await res.json()
      if (data.user) {
        setUser(data.user)
        setDisplayNameInput(data.user.displayName || '')
      }
      if (data.recentLogs) setLogs(data.recentLogs)
    } catch {
      // Handle silently
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(logsPage))
      params.set('limit', '30')
      params.set('userId', id)
      if (actionFilter) params.set('action', actionFilter)

      const res = await fetch(`/api/admin/logs?${params}`)
      const data = await res.json()
      setLogs(data.logs || [])
      setLogsTotal(data.pagination?.total || 0)
      setLogsTotalPages(data.pagination?.totalPages || 0)
    } catch {
      // Handle silently
    } finally {
      setLogsLoading(false)
    }
  }, [id, logsPage, actionFilter])

  useEffect(() => { fetchUser() }, [fetchUser])
  useEffect(() => { fetchLogs() }, [fetchLogs])

  async function handleToggleActive() {
    if (!user) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      })
      if (res.ok) {
        setUser(prev => prev ? { ...prev, isActive: !prev.isActive } : null)
      }
    } catch { /* */ }
    setActionLoading(false)
  }

  async function handleRoleChange(newRole: 'ADMIN' | 'USER') {
    if (!user) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) {
        setUser(prev => prev ? { ...prev, role: newRole } : null)
      }
    } catch { /* */ }
    setActionLoading(false)
  }

  async function handleSaveDisplayName() {
    if (!user) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayNameInput }),
      })
      if (res.ok) {
        setUser(prev => prev ? { ...prev, displayName: displayNameInput } : null)
        setEditingName(false)
      }
    } catch { /* */ }
    setActionLoading(false)
  }

  function isOnline(lastLogin: string | null): boolean {
    if (!lastLogin) return false
    return Date.now() - new Date(lastLogin).getTime() < 30 * 60 * 1000
  }

  function formatDetails(details: unknown): string {
    if (!details) return ''
    try {
      return JSON.stringify(typeof details === 'string' ? JSON.parse(details) : details, null, 2)
    } catch {
      return String(details)
    }
  }

  function getActionColor(action: string): string {
    if (action.includes('LOGIN_SUCCESS')) return 'bg-green-50 text-green-700'
    if (action.includes('LOGIN_FAILED') || action.includes('RATE_LIMITED')) return 'bg-red-50 text-red-700'
    if (action.includes('ADMIN')) return 'bg-amber-50 text-amber-700'
    if (action.includes('LOGOUT')) return 'bg-gray-100 text-gray-600'
    return 'bg-blue-50 text-blue-700'
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto animate-pulse">
        <div className="h-6 w-48 bg-gray-200 rounded mb-8" />
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <div className="flex gap-6">
            <div className="w-20 h-20 bg-gray-200 rounded-full" />
            <div className="space-y-3 flex-1">
              <div className="h-6 w-48 bg-gray-200 rounded" />
              <div className="h-4 w-32 bg-gray-200 rounded" />
              <div className="h-4 w-64 bg-gray-200 rounded" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto text-center py-16">
        <p className="text-gray-500">User not found.</p>
        <Link href="/centralsystem/admin/users" className="text-brand-600 hover:underline text-sm mt-2 inline-block">
          Back to Users
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-6">
        <Link href="/centralsystem/admin/users" className="text-gray-500 hover:text-brand-600 transition-colors">Users</Link>
        <svg className="w-4 h-4 text-gray-300" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M6 3l5 5-5 5" />
        </svg>
        <span className="text-gray-900 font-medium">{user.displayName || user.username}</span>
      </div>

      {/* User Profile Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <span className="text-2xl font-bold text-white">
                {(user.displayName || user.username)[0].toUpperCase()}
              </span>
            </div>
            <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-3 border-white ${
              isOnline(user.lastLogin) ? 'bg-green-500' : 'bg-gray-300'
            }`} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                {editingName ? (
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      value={displayNameInput}
                      onChange={(e) => setDisplayNameInput(e.target.value)}
                      className="text-xl font-bold text-gray-900 border border-gray-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      autoFocus
                    />
                    <button onClick={handleSaveDisplayName} disabled={actionLoading}
                      className="px-3 py-1 text-xs font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 cursor-pointer disabled:opacity-50">
                      Save
                    </button>
                    <button onClick={() => { setEditingName(false); setDisplayNameInput(user.displayName || '') }}
                      className="px-3 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-xl font-bold text-gray-900">{user.displayName || user.username}</h2>
                    <button onClick={() => setEditingName(true)}
                      className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded cursor-pointer">
                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
                        <path d="M11 2l3 3-8 8H3v-3l8-8z" />
                      </svg>
                    </button>
                  </div>
                )}
                <p className="text-sm text-gray-500">@{user.username}</p>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                  user.role === 'ADMIN' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                }`}>
                  {user.role}
                </span>
                <span className={`px-3 py-1 text-xs font-bold rounded-full flex items-center gap-1.5 ${
                  user.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                  {user.isActive ? 'Active' : 'Disabled'}
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-2xl font-bold text-gray-900">{user._count.documents}</p>
                <p className="text-xs text-gray-500 font-medium">Documents</p>
              </div>
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-2xl font-bold text-gray-900">{user._count.shareLinks}</p>
                <p className="text-xs text-gray-500 font-medium">Share Links</p>
              </div>
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-2xl font-bold text-gray-900">{user._count.chatMessages}</p>
                <p className="text-xs text-gray-500 font-medium">Chat Messages</p>
              </div>
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-sm font-medium text-gray-900">
                  {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                </p>
                <p className="text-xs text-gray-500 font-medium">Last Login</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2 mt-5 pt-5 border-t border-gray-100">
              <button
                onClick={handleToggleActive}
                disabled={actionLoading}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors cursor-pointer disabled:opacity-50 ${
                  user.isActive
                    ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                    : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                }`}
              >
                {user.isActive ? 'Disable Account' : 'Enable Account'}
              </button>
              <select
                value={user.role}
                onChange={(e) => handleRoleChange(e.target.value as 'ADMIN' | 'USER')}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-xl bg-white cursor-pointer disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="USER">Role: User</option>
                <option value="ADMIN">Role: Admin</option>
              </select>
              <Link
                href={`/admin/logs?userId=${id}`}
                className="px-4 py-2 text-sm font-medium text-brand-700 bg-brand-50 border border-brand-200 rounded-xl hover:bg-brand-100 transition-colors"
              >
                View All Logs
              </Link>
              <p className="text-xs text-gray-400 ml-auto">
                Member since {new Date(user.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Log */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Activity Log</h3>
            <p className="text-xs text-gray-500 mt-0.5">{logsTotal} total events</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setLogsPage(1) }}
              className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">All Actions</option>
              <option value="LOGIN_SUCCESS">Login Success</option>
              <option value="LOGIN_FAILED">Login Failed</option>
              <option value="LOGIN_RATE_LIMITED">Rate Limited</option>
              <option value="LOGOUT">Logout</option>
              <option value="DOCUMENT_CREATED">Doc Created</option>
              <option value="DOCUMENT_UPDATED">Doc Updated</option>
              <option value="DOCUMENT_DELETED">Doc Deleted</option>
              <option value="SHARE_LINK_CREATED">Share Created</option>
              <option value="SHARE_LINK_TOGGLED">Share Toggled</option>
              <option value="ADMIN_USER_UPDATED">Admin Changed</option>
            </select>
          </div>
        </div>

        {logsLoading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-3 animate-pulse">
                <div className="w-2 h-2 bg-gray-200 rounded-full" />
                <div className="h-4 w-32 bg-gray-200 rounded" />
                <div className="h-4 w-24 bg-gray-200 rounded" />
                <div className="flex-1" />
                <div className="h-4 w-28 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <span className="text-lg text-gray-300 font-medium">--</span>
            </div>
            <p className="text-sm text-gray-500">No activity found{actionFilter ? ' for this filter' : ''}.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {logs.map((log) => (
              <div key={log.id}>
                <div
                  className="flex items-start gap-3 px-6 py-3 hover:bg-gray-50/50 transition-colors cursor-pointer"
                  onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                >
                  <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                    log.action.includes('SUCCESS') ? 'bg-green-500' :
                    log.action.includes('FAILED') || log.action.includes('RATE') ? 'bg-red-500' :
                    log.action.includes('ADMIN') ? 'bg-amber-500' : 'bg-brand-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-md ${getActionColor(log.action)}`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                      {log.resourceType && (
                        <span className="text-xs text-gray-500">on {log.resourceType}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-400 font-mono">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                      {log.ipAddress && (
                        <span className="text-xs text-gray-400">IP: {log.ipAddress}</span>
                      )}
                    </div>
                  </div>
                  {log.details != null && (
                    <svg className={`w-4 h-4 text-gray-400 transition-transform shrink-0 mt-1 ${
                      expandedLogId === log.id ? 'rotate-180' : ''
                    }`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path d="M4 6l4 4 4-4" />
                    </svg>
                  )}
                </div>
                {expandedLogId === log.id && log.details != null && (
                  <div className="px-6 pb-3 pl-11">
                    <pre className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 overflow-x-auto font-mono whitespace-pre-wrap">
                      {formatDetails(log.details)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {logsTotalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Page {logsPage} of {logsTotalPages} ({logsTotal} events)
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLogsPage(Math.max(1, logsPage - 1))}
                disabled={logsPage === 1}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Previous
              </button>
              <button
                onClick={() => setLogsPage(Math.min(logsTotalPages, logsPage + 1))}
                disabled={logsPage === logsTotalPages}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
