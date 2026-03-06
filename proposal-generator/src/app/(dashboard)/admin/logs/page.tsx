'use client'

import { useState, useEffect, useCallback } from 'react'

interface LogEntry {
  id: string
  action: string
  resourceType: string
  resourceId: string | null
  details: unknown
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  user: {
    id: string
    username: string
    displayName: string | null
  } | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface Filters {
  actionTypes: string[]
  resourceTypes: string[]
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 })
  const [filters, setFilters] = useState<Filters>({ actionTypes: [], resourceTypes: [] })
  const [loading, setLoading] = useState(true)

  // Filter state
  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState('')
  const [resourceTypeFilter, setResourceTypeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '50')
      if (actionFilter) params.set('action', actionFilter)
      if (resourceTypeFilter) params.set('resourceType', resourceTypeFilter)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      if (search) params.set('search', search)

      const res = await fetch(`/api/admin/logs?${params}`)
      const data = await res.json()
      setLogs(data.logs || [])
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 })
      if (data.filters) setFilters(data.filters)
    } catch {
      // Handle silently
    } finally {
      setLoading(false)
    }
  }, [page, actionFilter, resourceTypeFilter, dateFrom, dateTo, search])

  useEffect(() => {
    const timeout = setTimeout(fetchLogs, 300)
    return () => clearTimeout(timeout)
  }, [fetchLogs])

  function handleExportCSV() {
    const params = new URLSearchParams()
    params.set('format', 'csv')
    if (actionFilter) params.set('action', actionFilter)
    if (resourceTypeFilter) params.set('resourceType', resourceTypeFilter)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    if (search) params.set('search', search)

    window.open(`/api/admin/logs?${params}`, '_blank')
  }

  function formatDetails(details: unknown): string {
    if (!details) return ''
    try {
      if (typeof details === 'string') {
        return JSON.stringify(JSON.parse(details), null, 2)
      }
      return JSON.stringify(details, null, 2)
    } catch {
      return String(details)
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Audit Logs</h2>
          <p className="text-sm text-gray-500 mt-1">
            {pagination.total.toLocaleString()} total log entries
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M8 2v8l3 3M2 12h12M8 10v4" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="6.5" cy="6.5" r="5" />
              <path d="M10.5 10.5L14.5 14.5" />
            </svg>
            <input
              type="text"
              placeholder="Search logs..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-10 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white cursor-pointer"
          >
            <option value="">All Actions</option>
            {filters.actionTypes.map((a) => (
              <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select
            value={resourceTypeFilter}
            onChange={(e) => { setResourceTypeFilter(e.target.value); setPage(1) }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white cursor-pointer"
          >
            <option value="">All Resources</option>
            {filters.resourceTypes.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
            placeholder="From date"
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
            placeholder="To date"
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-3 animate-pulse">
                <div className="h-4 w-32 bg-gray-200 rounded" />
                <div className="h-4 w-24 bg-gray-200 rounded" />
                <div className="h-4 w-36 bg-gray-200 rounded" />
                <div className="flex-1" />
                <div className="h-4 w-24 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-gray-500">No logs found matching your filters.</p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3 border-b border-gray-100 bg-gray-50/50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <div className="col-span-2">Timestamp</div>
              <div className="col-span-2">User</div>
              <div className="col-span-2">Action</div>
              <div className="col-span-2">Resource</div>
              <div className="col-span-2">IP Address</div>
              <div className="col-span-2">Details</div>
            </div>

            <div className="divide-y divide-gray-50">
              {logs.map((log) => (
                <div key={log.id}>
                  <div
                    className="lg:grid lg:grid-cols-12 lg:gap-4 flex flex-col gap-1 px-6 py-3 hover:bg-gray-50/50 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  >
                    <div className="col-span-2 flex items-center">
                      <span className="text-xs text-gray-500 font-mono">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center">
                      <span className="text-sm text-gray-700">
                        {log.user?.displayName || log.user?.username || 'System'}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center">
                      <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-md">
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center">
                      <span className="text-sm text-gray-500">{log.resourceType}</span>
                    </div>
                    <div className="col-span-2 flex items-center">
                      <span className="text-xs text-gray-400 font-mono">{log.ipAddress || '-'}</span>
                    </div>
                    <div className="col-span-2 flex items-center justify-between">
                      <span className="text-xs text-gray-400 truncate max-w-[120px]">
                        {log.details ? 'View details' : '-'}
                      </span>
                      {log.details != null && (
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform ${expandedId === log.id ? 'rotate-180' : ''}`}
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path d="M4 6l4 4 4-4" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {expandedId === log.id && log.details != null && (
                    <div className="px-6 pb-4">
                      <pre className="bg-gray-50 rounded-lg p-4 text-xs text-gray-600 overflow-x-auto font-mono whitespace-pre-wrap">
                        {formatDetails(log.details)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-gray-500">
            Showing {((page - 1) * 50) + 1} to {Math.min(page * 50, pagination.total)} of {pagination.total.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">
              Page {page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
              disabled={page === pagination.totalPages}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
