'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Document {
  id: string
  title: string
  clientName: string
  clientTagline?: string | null
  pdfUrl?: string | null
  createdAt: string
  updatedAt: string
  activeShareLinks: number
  folder?: { id: string; name: string } | null
  createdBy: { id: string; username: string; displayName?: string | null }
}

interface Folder {
  id: string
  name: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

type SortField = 'createdAt' | 'title' | 'clientName' | 'updatedAt'
type SortOrder = 'asc' | 'desc'

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [folderId, setFolderId] = useState<string>('')
  const [sortBy, setSortBy] = useState<SortField>('createdAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [moveDoc, setMoveDoc] = useState<{ id: string; currentFolderId: string | null } | null>(null)
  const [moveFolderId, setMoveFolderId] = useState<string>('')
  const [shareDocId, setShareDocId] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [folderSearch, setFolderSearch] = useState('')
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(null), 2500)
  }

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: '20',
        sortBy,
        sortOrder,
      })
      if (search) params.set('search', search)
      if (folderId) params.set('folderId', folderId)

      const res = await fetch(`/api/documents?${params}`)
      const data = await res.json()
      setDocuments(data.documents || [])
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 })
    } catch {
      // Handle silently
    } finally {
      setLoading(false)
    }
  }, [pagination.page, search, folderId, sortBy, sortOrder])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  useEffect(() => {
    fetch('/api/folders')
      .then((res) => res.json())
      .then((data) => setFolders(data.flatFolders || []))
      .catch(() => {})
  }, [])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
    setPagination((p) => ({ ...p, page: 1 }))
  }

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setPagination((p) => ({ ...p, page: 1 }))
  }

  async function handleDelete(id: string) {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchDocuments()
      }
    } catch {
      // Silently handle
    }
    setDeleteId(null)
    setActionLoading(false)
  }

  async function handleMove() {
    if (!moveDoc) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/documents/${moveDoc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: moveFolderId || null }),
      })
      if (res.ok) {
        const targetFolder = folders.find((f) => f.id === moveFolderId)
        showToast(moveFolderId ? `Moved to ${targetFolder?.name || 'folder'}` : 'Removed from folder')
        fetchDocuments()
      }
    } catch {
      // Silently handle
    }
    setMoveDoc(null)
    setMoveFolderId('')
    setFolderSearch('')
    setShowCreateFolder(false)
    setNewFolderName('')
    setActionLoading(false)
  }

  async function handleCreateFolderAndMove() {
    if (!moveDoc || !newFolderName.trim()) return
    setActionLoading(true)
    try {
      const folderRes = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim() }),
      })
      const folderData = await folderRes.json()
      if (folderRes.ok && folderData.folder) {
        const res = await fetch(`/api/documents/${moveDoc.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderId: folderData.folder.id }),
        })
        if (res.ok) {
          showToast(`Moved to ${newFolderName.trim()}`)
          fetchDocuments()
          // Refresh folders list
          fetch('/api/folders')
            .then((r) => r.json())
            .then((d) => setFolders(d.flatFolders || []))
            .catch(() => {})
        }
      }
    } catch {
      // Silently handle
    }
    setMoveDoc(null)
    setMoveFolderId('')
    setFolderSearch('')
    setShowCreateFolder(false)
    setNewFolderName('')
    setActionLoading(false)
  }

  async function handleShare(docId: string) {
    setActionLoading(true)
    try {
      const res = await fetch('/api/share-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId }),
      })
      const data = await res.json()
      if (res.ok) {
        const url = `${window.location.origin}/share/${data.shareLink.token}`
        setShareUrl(url)
        try {
          await navigator.clipboard.writeText(url)
          showToast('Link copied to clipboard')
        } catch { /* ignore */ }
      }
    } catch {
      // Silently handle
    }
    setActionLoading(false)
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortBy !== field) return <span className="text-gray-300 ml-1">&#8597;</span>
    return <span className="text-brand-600 ml-1">{sortOrder === 'asc' ? '&#8593;' : '&#8595;'}</span>
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Documents</h1>
          <p className="text-gray-500 text-sm mt-1">{pagination.total} document{pagination.total !== 1 ? 's' : ''} total</p>
        </div>
        <Link
          href="/new-proposal"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 hover:shadow-lg hover:shadow-brand-600/25 transition-all duration-200 shrink-0"
        >
          <span className="text-base leading-none">+</span>
          New Proposal
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by title or client name..."
              className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none focus:bg-white focus:border-brand-400 focus:ring-4 focus:ring-brand-100 transition-all"
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-gray-100 text-gray-700 font-medium text-sm rounded-xl hover:bg-gray-200 transition-colors cursor-pointer"
            >
              Search
            </button>
          </form>
          <select
            value={folderId}
            onChange={(e) => { setFolderId(e.target.value); setPagination((p) => ({ ...p, page: 1 })) }}
            className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100 transition-all cursor-pointer"
          >
            <option value="">All Folders</option>
            <option value="null">No Folder</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
        {search && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-gray-500">Searching:</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-50 text-brand-700 text-xs font-medium rounded-full">
              {search}
              <button
                onClick={() => { setSearch(''); setSearchInput(''); setPagination((p) => ({ ...p, page: 1 })) }}
                className="hover:text-brand-900 cursor-pointer"
              >
                <span className="text-[10px] leading-none font-bold">x</span>
              </button>
            </span>
          </div>
        )}
      </div>

      {/* Documents table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                <div className="w-10 h-10 bg-gray-200 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-gray-200 rounded" />
                  <div className="h-3 w-32 bg-gray-200 rounded" />
                </div>
                <div className="h-6 w-16 bg-gray-200 rounded-full" />
              </div>
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <circle cx="10" cy="10" r="7" />
                <path d="M15.5 15.5L21 21" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              {search || folderId ? 'No matching documents' : 'No documents yet'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {search || folderId ? 'Try adjusting your search or filter.' : 'Create your first proposal to get started.'}
            </p>
            {!search && !folderId && (
              <Link href="/new-proposal" className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors">
                <span className="text-base leading-none">+</span>
                Create Proposal
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b border-gray-100 bg-gray-50/50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <button onClick={() => handleSort('title')} className="col-span-4 text-left flex items-center cursor-pointer hover:text-gray-700">
                Title <SortIcon field="title" />
              </button>
              <button onClick={() => handleSort('clientName')} className="col-span-2 text-left flex items-center cursor-pointer hover:text-gray-700">
                Client <SortIcon field="clientName" />
              </button>
              <div className="col-span-2 text-left">Folder</div>
              <button onClick={() => handleSort('createdAt')} className="col-span-2 text-left flex items-center cursor-pointer hover:text-gray-700">
                Created <SortIcon field="createdAt" />
              </button>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {/* Table body */}
            <div className="divide-y divide-gray-50">
              {documents.map((doc) => (
                <div key={doc.id} className="md:grid md:grid-cols-12 md:gap-4 flex flex-col gap-2 px-6 py-4 hover:bg-gray-50/50 transition-colors group">
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-brand-600 tracking-tight">PDF</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{doc.title}</p>
                      {doc.activeShareLinks > 0 && (
                        <span className="inline-flex items-center text-xs text-green-600 font-medium mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1" />
                          {doc.activeShareLinks} shared
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center">
                    <span className="text-sm text-gray-600 truncate">{doc.clientName}</span>
                  </div>
                  <div className="col-span-2 flex items-center">
                    {doc.folder ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-md truncate">
                        <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M1 4.5A1.5 1.5 0 012.5 3H6l1.5 2h5A1.5 1.5 0 0114 6.5v6a1.5 1.5 0 01-1.5 1.5h-10A1.5 1.5 0 011 12.5v-8z" />
                        </svg>
                        {doc.folder.name}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">--</span>
                    )}
                  </div>
                  <div className="col-span-2 flex items-center">
                    <span className="text-sm text-gray-500">{new Date(doc.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-1">
                    {doc.pdfUrl && (
                      <a
                        href={doc.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View PDF"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
                          <rect x="2" y="4" width="9" height="10" rx="1" />
                          <path d="M6 2h7a1 1 0 011 1v7M9 7l5-5" />
                        </svg>
                      </a>
                    )}
                    <button
                      onClick={() => {
                        setShareDocId(doc.id)
                        setShareUrl(null)
                        handleShare(doc.id)
                      }}
                      className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors cursor-pointer"
                      title="Create Share Link"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
                        <circle cx="4" cy="8" r="2" />
                        <circle cx="12" cy="4" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <path d="M5.8 7l4.4-2M5.8 9l4.4 2" />
                      </svg>
                    </button>
                    <button
                      onClick={() => { setMoveDoc({ id: doc.id, currentFolderId: doc.folder?.id || null }); setMoveFolderId(doc.folder?.id || '') }}
                      className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                      title="Move to Folder"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
                        <path d="M1 5v8.5A1.5 1.5 0 002.5 15h11a1.5 1.5 0 001.5-1.5V7a1.5 1.5 0 00-1.5-1.5H9L7.5 3.5H2.5A1.5 1.5 0 001 5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeleteId(doc.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
                        <rect x="3" y="5" width="10" height="9" rx="1" />
                        <path d="M2 5h12M6 5V3.5a1 1 0 011-1h2a1 1 0 011 1V5" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                    disabled={pagination.page >= pagination.totalPages}
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Document</h3>
            <p className="text-sm text-gray-500 mb-6">This will deactivate the document and any associated share links. Are you sure?</p>
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

      {/* Move to Folder Modal */}
      {moveDoc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl p-6 max-w-sm w-full mx-4 animate-fade-in-up">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Move to Folder</h3>

            {/* Folder search */}
            <div className="relative mb-3">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="6.5" cy="6.5" r="5" />
                <path d="M10.5 10.5L14.5 14.5" />
              </svg>
              <input
                type="text"
                value={folderSearch}
                onChange={(e) => setFolderSearch(e.target.value)}
                placeholder="Search folders..."
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none focus:bg-white focus:border-brand-400 focus:ring-4 focus:ring-brand-100 transition-all"
              />
            </div>

            {/* Folder list */}
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl mb-3">
              <button
                onClick={() => setMoveFolderId('')}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer ${moveFolderId === '' ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                No Folder
              </button>
              {folders
                .filter((f) => !folderSearch || f.name.toLowerCase().includes(folderSearch.toLowerCase()))
                .map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setMoveFolderId(f.id)}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer flex items-center gap-2 ${moveFolderId === f.id ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    <svg className="w-4 h-4 shrink-0 text-gray-400" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M1 4.5A1.5 1.5 0 012.5 3H6l1.5 2h5A1.5 1.5 0 0114 6.5v6a1.5 1.5 0 01-1.5 1.5h-10A1.5 1.5 0 011 12.5v-8z" />
                    </svg>
                    {f.name}
                  </button>
                ))}
              {folderSearch && folders.filter((f) => f.name.toLowerCase().includes(folderSearch.toLowerCase())).length === 0 && (
                <p className="px-4 py-3 text-sm text-gray-400 text-center">No folders found</p>
              )}
            </div>

            {/* Create new folder */}
            {!showCreateFolder ? (
              <button
                onClick={() => setShowCreateFolder(true)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-brand-600 hover:bg-brand-50 rounded-xl transition-colors cursor-pointer mb-4"
              >
                <span className="w-4 h-4 flex items-center justify-center text-base leading-none">+</span>
                Create new folder
              </button>
            ) : (
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name"
                  autoFocus
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none focus:bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && newFolderName.trim() && handleCreateFolderAndMove()}
                />
                <button
                  onClick={handleCreateFolderAndMove}
                  disabled={actionLoading || !newFolderName.trim()}
                  className="px-3 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  Create & Move
                </button>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button onClick={() => { setMoveDoc(null); setFolderSearch(''); setShowCreateFolder(false); setNewFolderName('') }} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl border border-gray-200 transition-colors cursor-pointer">
                Cancel
              </button>
              <button onClick={handleMove} disabled={actionLoading} className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50">
                {actionLoading ? 'Moving...' : 'Move'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl shadow-lg animate-fade-in-up">
          {toast}
        </div>
      )}

      {/* Share Link Modal */}
      {shareDocId && shareUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl p-6 max-w-md w-full mx-4 animate-fade-in-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <circle cx="8" cy="8" r="6.5" />
                  <path d="M5 8l2 2 4-4" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Share Link Created</h3>
                <p className="text-xs text-gray-500">Link copied to clipboard</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 mb-6">
              <p className="text-sm text-gray-700 font-mono break-all">{shareUrl}</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShareDocId(null); setShareUrl(null) }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl border border-gray-200 transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareUrl)
                    showToast('Link copied to clipboard')
                  } catch { /* ignore */ }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors cursor-pointer"
              >
                Copy Again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
