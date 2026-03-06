'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

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
type SortField = 'createdAt' | 'accessCount'
type SortOrder = 'asc' | 'desc'

const PER_PAGE = 20

export default function ShareLinksPage() {
  const [links, setLinks] = useState<ShareLink[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [actionLoading, setActionLoading] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Search, sort, pagination
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [sortBy, setSortBy] = useState<SortField>('createdAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [page, setPage] = useState(1)

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

  // Client-side filter, sort, paginate
  const processed = useMemo(() => {
    let result = [...links]

    // Search filter
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (l) =>
          l.document.title.toLowerCase().includes(q) ||
          l.document.clientName.toLowerCase().includes(q)
      )
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0
      if (sortBy === 'createdAt') {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      } else if (sortBy === 'accessCount') {
        cmp = a.accessCount - b.accessCount
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })

    return result
  }, [links, search, sortBy, sortOrder])

  const totalPages = Math.max(1, Math.ceil(processed.length / PER_PAGE))
  const paginated = processed.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setPage(1)
  }

  async function handleToggle(id: string, currentActive: boolean) {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/share-links/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      })
      if (res.ok) {
        fetchLinks()
      }
    } catch {
      // Silently handle
    }
    setActionLoading(false)
  }

  async function handleDelete(id: string) {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/share-links/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setLinks((prev) => prev.filter((l) => l.id !== id))
        selectedIds.delete(id)
        setSelectedIds(new Set(selectedIds))
      }
    } catch {
      // Silently handle
    }
    setDeleteId(null)
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

  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return
    setActionLoading(true)
    try {
      const promises = Array.from(selectedIds).map((id) =>
        fetch(`/api/share-links/${id}`, { method: 'DELETE' })
      )
      await Promise.all(promises)
      setSelectedIds(new Set())
      setBulkDeleteConfirm(false)
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
    if (selectedIds.size === paginated.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(paginated.map((l) => l.id)))
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

  function SortIndicator({ field }: { field: SortField }) {
    if (sortBy !== field) return <span className="text-gray-300 ml-1">&#8597;</span>
    return <span className="text-brand-600 ml-1">{sortOrder === 'asc' ? '\u2191' : '\u2193'}</span>
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Share Links</h1>
          <p className="text-gray-500 text-sm mt-1">Manage all your document share links.</p>
        </div>
      </div>

      {/* Filters, search, and bulk actions */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex gap-2">
            {(['', 'active', 'disabled', 'expired'] as StatusFilter[]).map((s) => (
              <button
                key={s || 'all'}
                onClick={() => { setStatusFilter(s); setPage(1) }}
                className={`
                  px-3 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer
                  ${statusFilter === s
                    ? 'bg-brand-50 text-brand-700 border border-brand-200'
                    : 'text-gray-600 hover:bg-gray-50 border border-transparent'
                  }
                `}
              >
                {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="6.5" cy="6.5" r="5" />
                <path d="M10.5 10.5L14.5 14.5" />
              </svg>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by document name..."
                className="pl-8 pr-3 py-1.5 w-56 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none focus:bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-gray-100 text-gray-700 font-medium text-xs rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
            >
              Search
            </button>
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); setSearchInput(''); setPage(1) }}
                className="px-2 py-1.5 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
              >
                Clear
              </button>
            )}
          </form>
          {selectedIds.size > 0 && (
            <div className="flex gap-2">
              <button
                onClick={handleBulkDisable}
                disabled={actionLoading}
                className="px-4 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                Disable {selectedIds.size}
              </button>
              <button
                onClick={() => setBulkDeleteConfirm(true)}
                disabled={actionLoading}
                className="px-4 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                Delete {selectedIds.size}
              </button>
            </div>
          )}
        </div>
        {search && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-gray-500">Searching:</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-50 text-brand-700 text-xs font-medium rounded-full">
              {search}
              <button
                onClick={() => { setSearch(''); setSearchInput(''); setPage(1) }}
                className="hover:text-brand-900 cursor-pointer ml-1"
              >
                x
              </button>
            </span>
          </div>
        )}
      </div>

      {/* Links list */}
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
        ) : paginated.length === 0 ? (
          <div className="p-12 text-center">
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              {search || statusFilter ? 'No matching share links' : 'No share links yet'}
            </h3>
            <p className="text-sm text-gray-500">
              {search || statusFilter ? 'Try changing your search or filter.' : 'Create share links from the Documents page.'}
            </p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b border-gray-100 bg-gray-50/50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <div className="col-span-1 flex items-center">
                <input
                  type="checkbox"
                  checked={selectedIds.size === paginated.length && paginated.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                />
              </div>
              <div className="col-span-3">Document</div>
              <div className="col-span-2">Status</div>
              <button
                onClick={() => handleSort('createdAt')}
                className="col-span-2 text-left flex items-center cursor-pointer hover:text-gray-700"
              >
                Created <SortIndicator field="createdAt" />
              </button>
              <button
                onClick={() => handleSort('accessCount')}
                className="col-span-1 text-left flex items-center cursor-pointer hover:text-gray-700"
              >
                Views <SortIndicator field="accessCount" />
              </button>
              <div className="col-span-3 text-right">Actions</div>
            </div>

            <div className="divide-y divide-gray-50">
              {paginated.map((link) => (
                <div key={link.id} className="md:grid md:grid-cols-12 md:gap-4 flex flex-col gap-2 px-6 py-4 hover:bg-gray-50/50 transition-colors">
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
                    {statusBadge(link.effectiveStatus)}
                  </div>
                  <div className="col-span-2 flex items-center">
                    <span className="text-sm text-gray-500">{new Date(link.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="col-span-1 flex items-center">
                    <span className="text-sm font-medium text-gray-700">{link.accessCount}</span>
                  </div>
                  <div className="col-span-3 flex items-center justify-end gap-1">
                    <button
                      onClick={() => copyLink(link.token, link.id)}
                      className={`
                        inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer
                        ${copiedId === link.id
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'text-gray-600 hover:bg-gray-100 border border-gray-200'
                        }
                      `}
                    >
                      {copiedId === link.id ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      onClick={() => handleToggle(link.id, link.isActive)}
                      disabled={actionLoading}
                      className={`
                        px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50
                        ${link.isActive
                          ? 'text-amber-700 hover:bg-amber-50 border border-amber-200'
                          : 'text-green-700 hover:bg-green-50 border border-green-200'
                        }
                      `}
                    >
                      {link.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => setDeleteId(link.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M4 4l8 8M12 4l-8 8" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Showing {(page - 1) * PER_PAGE + 1} to {Math.min(page * PER_PAGE, processed.length)} of {processed.length}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-500 flex items-center px-2">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl p-6 max-w-sm w-full mx-4 animate-fade-in-up">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Share Link</h3>
            <p className="text-sm text-gray-500 mb-6">This will permanently remove this share link. Anyone with the link will no longer have access.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl border border-gray-200 transition-colors cursor-pointer">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteId)} disabled={actionLoading} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50">
                {actionLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {bulkDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl p-6 max-w-sm w-full mx-4 animate-fade-in-up">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete {selectedIds.size} Share Links</h3>
            <p className="text-sm text-gray-500 mb-6">This will permanently remove {selectedIds.size} share link{selectedIds.size !== 1 ? 's' : ''}. Anyone with these links will no longer have access.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setBulkDeleteConfirm(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl border border-gray-200 transition-colors cursor-pointer">
                Cancel
              </button>
              <button onClick={handleBulkDelete} disabled={actionLoading} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50">
                {actionLoading ? 'Deleting...' : 'Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
