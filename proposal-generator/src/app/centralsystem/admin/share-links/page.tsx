'use client'

import { useState, useEffect, useCallback } from 'react'

interface ShareLink {
  id: string
  token: string
  isActive: boolean
  expiresAt: string | null
  accessCount: number
  createdAt: string
  effectiveStatus: 'active' | 'disabled' | 'expired'
  document: {
    id: string
    title: string
    clientName: string
    isActive: boolean
  }
  createdBy: {
    id: string
    username: string
    displayName?: string | null
  }
}

type StatusFilter = '' | 'active' | 'disabled' | 'expired'

export default function AdminShareLinksPage() {
  const [links, setLinks] = useState<ShareLink[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [actionLoading, setActionLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchLinks = useCallback(async () => {
    setLoading(true)
    try {
      const params = statusFilter ? `?status=${statusFilter}` : ''
      const res = await fetch(`/api/share-links${params}`)
      const data = await res.json()
      setLinks(data.shareLinks || [])
    } catch {
      // Handle silently
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchLinks()
  }, [fetchLinks])

  async function handleToggle(id: string, currentActive: boolean) {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/share-links/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      })
      if (res.ok) fetchLinks()
    } catch {
      // Silently handle
    }
    setActionLoading(false)
  }

  async function handleBulkDisable() {
    if (selectedIds.size === 0) return
    setActionLoading(true)
    try {
      const promises = Array.from(selectedIds).map((id) =>
        fetch(`/api/share-links/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: false }),
        })
      )
      await Promise.all(promises)
      setSelectedIds(new Set())
      fetchLinks()
    } catch {
      // Silently handle
    }
    setActionLoading(false)
  }

  async function copyLink(token: string, id: string) {
    const url = `${window.location.origin}/share/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // Fallback
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === links.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(links.map((l) => l.id)))
    }
  }

  function statusBadge(status: string) {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Active
          </span>
        )
      case 'disabled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            Disabled
          </span>
        )
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-50 text-red-600 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            Expired
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">All Share Links</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage share links across all users. {links.length} total.
          </p>
        </div>
      </div>

      {/* Filters & Bulk Actions */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex gap-2">
            {(['', 'active', 'disabled', 'expired'] as StatusFilter[]).map((s) => (
              <button
                key={s || 'all'}
                onClick={() => setStatusFilter(s)}
                className={`
                  px-3 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer
                  ${statusFilter === s
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-50 border border-transparent'
                  }
                `}
              >
                {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDisable}
              disabled={actionLoading}
              className="px-4 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              Disable {selectedIds.size} selected
            </button>
          )}
        </div>
      </div>

      {/* Links Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                <div className="w-5 h-5 bg-gray-200 rounded" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-gray-200 rounded" />
                  <div className="h-3 w-32 bg-gray-200 rounded" />
                </div>
                <div className="h-6 w-16 bg-gray-200 rounded-full" />
              </div>
            ))}
          </div>
        ) : links.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-gray-500">
              {statusFilter ? 'No matching share links.' : 'No share links found.'}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3 border-b border-gray-100 bg-gray-50/50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <div className="col-span-1 flex items-center">
                <input
                  type="checkbox"
                  checked={selectedIds.size === links.length && links.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                />
              </div>
              <div className="col-span-3">Document</div>
              <div className="col-span-2">Owner</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1">Views</div>
              <div className="col-span-1">Created</div>
              <div className="col-span-3 text-right">Actions</div>
            </div>

            <div className="divide-y divide-gray-50">
              {links.map((link) => (
                <div key={link.id} className="lg:grid lg:grid-cols-12 lg:gap-4 flex flex-col gap-2 px-6 py-4 hover:bg-gray-50/50 transition-colors">
                  <div className="col-span-1 flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(link.id)}
                      onChange={() => toggleSelect(link.id)}
                      className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                  </div>
                  <div className="col-span-3 flex items-center min-w-0">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{link.document.title}</p>
                      <p className="text-xs text-gray-500 truncate">{link.document.clientName}</p>
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center">
                    <span className="text-sm text-gray-600">
                      {link.createdBy.displayName || link.createdBy.username}
                    </span>
                  </div>
                  <div className="col-span-1 flex items-center">
                    {statusBadge(link.effectiveStatus)}
                  </div>
                  <div className="col-span-1 flex items-center">
                    <span className="text-sm font-medium text-gray-700">{link.accessCount}</span>
                  </div>
                  <div className="col-span-1 flex items-center">
                    <span className="text-xs text-gray-500">{new Date(link.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="col-span-3 flex items-center justify-end gap-1">
                    <button
                      onClick={() => copyLink(link.token, link.id)}
                      className={`
                        inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer
                        ${copiedId === link.id
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'text-gray-600 hover:bg-gray-100 border border-gray-200'
                        }
                      `}
                    >
                      {copiedId === link.id ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      onClick={() => handleToggle(link.id, link.isActive)}
                      disabled={actionLoading}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                        link.isActive
                          ? 'text-amber-700 hover:bg-amber-50 border border-amber-200'
                          : 'text-green-700 hover:bg-green-50 border border-green-200'
                      }`}
                    >
                      {link.isActive ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
