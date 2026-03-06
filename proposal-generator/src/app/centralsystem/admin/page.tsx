'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Stats {
  totalUsers: number
  activeUsers: number
  totalDocuments: number
  totalShareLinks: number
  activeShareLinks: number
  recentLogs: {
    id: string
    action: string
    resourceType: string
    createdAt: string
    user: { username: string; displayName?: string | null } | null
  }[]
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const [usersRes, logsRes] = await Promise.all([
          fetch('/api/admin/users'),
          fetch('/api/admin/logs?limit=10'),
        ])

        const usersData = await usersRes.json()
        const logsData = await logsRes.json()

        const users = usersData.users || []
        const activeUsers = users.filter((u: { isActive: boolean }) => u.isActive).length
        const totalDocs = users.reduce((sum: number, u: { _count: { documents: number } }) => sum + u._count.documents, 0)
        const totalLinks = users.reduce((sum: number, u: { _count: { shareLinks: number } }) => sum + u._count.shareLinks, 0)

        setStats({
          totalUsers: users.length,
          activeUsers,
          totalDocuments: totalDocs,
          totalShareLinks: totalLinks,
          activeShareLinks: 0,
          recentLogs: logsData.logs || [],
        })
      } catch {
        // Handle silently
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-6 animate-pulse">
              <div className="h-4 w-20 bg-gray-200 rounded mb-3" />
              <div className="h-8 w-16 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const statCards = [
    { label: 'Total Users', value: stats?.totalUsers ?? 0, href: '/admin/users', color: 'bg-blue-50 text-blue-700' },
    { label: 'Active Users', value: stats?.activeUsers ?? 0, href: '/admin/users?status=active', color: 'bg-green-50 text-green-700' },
    { label: 'Documents', value: stats?.totalDocuments ?? 0, href: '/admin/documents', color: 'bg-purple-50 text-purple-700' },
    { label: 'Share Links', value: stats?.totalShareLinks ?? 0, href: '/admin/share-links', color: 'bg-amber-50 text-amber-700' },
  ]

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow group"
          >
            <p className="text-sm font-medium text-gray-500 mb-1">{card.label}</p>
            <p className="text-3xl font-bold text-gray-900">{card.value}</p>
            <span className={`inline-block mt-2 px-2 py-0.5 text-xs font-medium rounded-full ${card.color}`}>
              View all
            </span>
          </Link>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Recent Activity</h2>
          <Link href="/centralsystem/admin/logs" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            View all
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {(stats?.recentLogs || []).length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">No recent activity.</div>
          ) : (
            stats?.recentLogs.map((log) => (
              <div key={log.id} className="px-6 py-3 flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-gray-500">
                    {(log.user?.displayName || log.user?.username || 'S')[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">
                    <span className="font-medium">{log.user?.displayName || log.user?.username || 'System'}</span>
                    {' '}
                    <span className="text-gray-500">{log.action.replace(/_/g, ' ').toLowerCase()}</span>
                    {' '}
                    <span className="text-gray-400">({log.resourceType})</span>
                  </p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
