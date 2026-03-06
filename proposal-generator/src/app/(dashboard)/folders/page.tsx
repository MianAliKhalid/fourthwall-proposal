'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'

interface FolderNode {
  id: string
  name: string
  parentId: string | null
  createdAt: string
  _count: { documents: number }
  children: FolderNode[]
}

interface Document {
  id: string
  title: string
  clientName: string
  createdAt: string
}

const DOCS_PER_PAGE = 20

export default function FoldersPage() {
  const [folders, setFolders] = useState<FolderNode[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [folderDocs, setFolderDocs] = useState<Document[]>([])
  const [docsLoading, setDocsLoading] = useState(false)

  // Pagination & search for folder docs
  const [docsPage, setDocsPage] = useState(1)
  const [docsSearch, setDocsSearch] = useState('')
  const [docsSearchInput, setDocsSearchInput] = useState('')

  // Dropdown menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Modals
  const [createModal, setCreateModal] = useState<{ parentId: string | null } | null>(null)
  const [renameModal, setRenameModal] = useState<{ id: string; name: string } | null>(null)
  const [deleteModal, setDeleteModal] = useState<{ id: string; name: string; docCount: number } | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [renameName, setRenameName] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchFolders = useCallback(async () => {
    try {
      const res = await fetch('/api/folders')
      const data = await res.json()
      setFolders(data.folders || [])
    } catch {
      // Handle silently
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFolders()
  }, [fetchFolders])

  const fetchFolderDocs = useCallback(async (folderId: string) => {
    setDocsLoading(true)
    try {
      const res = await fetch(`/api/documents?folderId=${folderId}&limit=50`)
      const data = await res.json()
      setFolderDocs(data.documents || [])
    } catch {
      // Handle silently
    } finally {
      setDocsLoading(false)
    }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openMenuId])

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectFolder(id: string) {
    setSelectedFolder(id)
    setDocsPage(1)
    setDocsSearch('')
    setDocsSearchInput('')
    fetchFolderDocs(id)
  }

  // Filter and paginate docs
  const filteredDocs = docsSearch
    ? folderDocs.filter(
        (d) =>
          d.title.toLowerCase().includes(docsSearch.toLowerCase()) ||
          d.clientName.toLowerCase().includes(docsSearch.toLowerCase())
      )
    : folderDocs

  const totalDocsPages = Math.max(1, Math.ceil(filteredDocs.length / DOCS_PER_PAGE))
  const paginatedDocs = filteredDocs.slice((docsPage - 1) * DOCS_PER_PAGE, docsPage * DOCS_PER_PAGE)

  function handleDocsSearch(e: React.FormEvent) {
    e.preventDefault()
    setDocsSearch(docsSearchInput)
    setDocsPage(1)
  }

  async function handleCreate() {
    if (!newFolderName.trim()) return
    setActionLoading(true)
    setError('')
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim(), parentId: createModal?.parentId || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create folder')
        setActionLoading(false)
        return
      }
      setCreateModal(null)
      setNewFolderName('')
      fetchFolders()
    } catch {
      setError('Network error')
    }
    setActionLoading(false)
  }

  async function handleRename() {
    if (!renameModal || !renameName.trim()) return
    setActionLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/folders/${renameModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to rename folder')
        setActionLoading(false)
        return
      }
      setRenameModal(null)
      setRenameName('')
      fetchFolders()
    } catch {
      setError('Network error')
    }
    setActionLoading(false)
  }

  async function handleDelete() {
    if (!deleteModal) return
    setActionLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/folders/${deleteModal.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to delete folder')
        setActionLoading(false)
        return
      }
      setDeleteModal(null)
      if (selectedFolder === deleteModal.id) {
        setSelectedFolder(null)
        setFolderDocs([])
      }
      fetchFolders()
    } catch {
      setError('Network error')
    }
    setActionLoading(false)
  }

  function getFolderName(id: string): string {
    function find(nodes: FolderNode[]): string | null {
      for (const n of nodes) {
        if (n.id === id) return n.name
        const child = find(n.children)
        if (child) return child
      }
      return null
    }
    return find(folders) || 'Folder'
  }

  function FolderTreeItem({ folder, depth = 0 }: { folder: FolderNode; depth?: number }) {
    const isExpanded = expanded.has(folder.id)
    const isSelected = selectedFolder === folder.id
    const hasChildren = folder.children.length > 0
    const isMenuOpen = openMenuId === folder.id

    return (
      <div>
        <div
          className={`
            flex items-center gap-2 py-2 pr-2 cursor-pointer transition-all duration-150 group relative
            ${isSelected
              ? 'bg-brand-50 text-brand-700 border-l-[3px] border-brand-600'
              : 'hover:bg-gray-50 text-gray-700 border-l-[3px] border-transparent'
            }
          `}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
          onClick={() => selectFolder(folder.id)}
        >
          {/* Expand toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleExpand(folder.id) }}
            className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${hasChildren ? 'hover:bg-gray-200' : ''} cursor-pointer`}
          >
            {hasChildren && (
              <span className={`text-[10px] text-gray-400 transition-transform duration-200 inline-block ${isExpanded ? 'rotate-90' : ''}`}>
                &#9654;
              </span>
            )}
          </button>

          {/* Folder icon - simple shape */}
          <svg className={`w-4 h-4 shrink-0 ${isSelected ? 'text-brand-500' : 'text-gray-400'}`} viewBox="0 0 20 20" fill="currentColor">
            <rect x="2" y="5" width="16" height="12" rx="1.5" opacity="0.3" />
            <rect x="2" y="7" width="16" height="10" rx="1.5" />
            <rect x="2" y="4" width="7" height="4" rx="1" />
          </svg>

          {/* Name and count */}
          <span className="text-sm font-medium truncate flex-1">{folder.name}</span>
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${isSelected ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-500'}`}>
            {folder._count.documents}
          </span>

          {/* Actions dropdown */}
          <div className="relative" ref={isMenuOpen ? menuRef : undefined}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setOpenMenuId(isMenuOpen ? null : folder.id)
              }}
              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
              title="Actions"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="3" r="1.5" />
                <circle cx="8" cy="8" r="1.5" />
                <circle cx="8" cy="13" r="1.5" />
              </svg>
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg border border-gray-200 shadow-lg z-20 py-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpenMenuId(null)
                    setCreateModal({ parentId: folder.id })
                    setNewFolderName('')
                    setError('')
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                >
                  <span className="w-4 h-4 rounded-full border border-gray-400 flex items-center justify-center text-[10px] font-bold text-gray-500">+</span>
                  Add sub-folder
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpenMenuId(null)
                    setRenameModal({ id: folder.id, name: folder.name })
                    setRenameName(folder.name)
                    setError('')
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-gray-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M11 2l3 3-8 8H3v-3l8-8z" />
                  </svg>
                  Rename
                </button>
                <div className="my-1 border-t border-gray-100" />
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpenMenuId(null)
                    setDeleteModal({ id: folder.id, name: folder.name, docCount: folder._count.documents })
                    setError('')
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer flex items-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Children */}
        {isExpanded && hasChildren && (
          <div>
            {folder.children.map((child) => (
              <FolderTreeItem key={child.id} folder={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Folders</h1>
          <p className="text-gray-500 text-sm mt-1">Organize your documents into folders.</p>
        </div>
        <button
          onClick={() => { setCreateModal({ parentId: null }); setNewFolderName(''); setError('') }}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 hover:shadow-lg hover:shadow-brand-600/25 transition-all duration-200 shrink-0 cursor-pointer"
        >
          <span className="w-4 h-4 flex items-center justify-center text-base leading-none">+</span>
          New Folder
        </button>
      </div>

      {/* Unified panel - single card with tree sidebar + content */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex flex-col lg:flex-row min-h-[500px]">
          {/* Left sidebar - folder tree */}
          <div className="lg:w-[280px] lg:shrink-0 border-b lg:border-b-0 lg:border-r border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Folders</h2>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {loading ? (
                <div className="space-y-1 p-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 animate-pulse">
                      <div className="w-4 h-4 bg-gray-200 rounded" />
                      <div className="h-4 flex-1 bg-gray-200 rounded" />
                      <div className="w-6 h-4 bg-gray-200 rounded" />
                    </div>
                  ))}
                </div>
              ) : folders.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm text-gray-500">No folders yet</p>
                  <p className="text-xs text-gray-400 mt-1">Create a folder to start organizing.</p>
                </div>
              ) : (
                <div className="py-1">
                  {folders.map((folder) => (
                    <FolderTreeItem key={folder.id} folder={folder} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right content - folder documents */}
          <div className="flex-1 flex flex-col min-w-0">
            {!selectedFolder ? (
              <div className="flex-1 flex items-center justify-center p-12">
                <div className="text-center">
                  <h3 className="text-base font-semibold text-gray-900 mb-1">No folder selected</h3>
                  <p className="text-sm text-gray-500">Click a folder from the tree to view its documents.</p>
                </div>
              </div>
            ) : (
              <>
                {/* Content header with search */}
                <div className="px-5 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
                  <h2 className="text-sm font-semibold text-gray-900 shrink-0">
                    {getFolderName(selectedFolder)}
                    <span className="text-gray-400 font-normal ml-2">({filteredDocs.length} document{filteredDocs.length !== 1 ? 's' : ''})</span>
                  </h2>
                  <div className="flex-1" />
                  <form onSubmit={handleDocsSearch} className="flex gap-2">
                    <div className="relative">
                      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="6.5" cy="6.5" r="5" />
                        <path d="M10.5 10.5L14.5 14.5" />
                      </svg>
                      <input
                        type="text"
                        value={docsSearchInput}
                        onChange={(e) => setDocsSearchInput(e.target.value)}
                        placeholder="Search docs..."
                        className="pl-8 pr-3 py-1.5 w-48 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none focus:bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 font-medium text-xs rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
                    >
                      Search
                    </button>
                    {docsSearch && (
                      <button
                        type="button"
                        onClick={() => { setDocsSearch(''); setDocsSearchInput(''); setDocsPage(1) }}
                        className="px-2 py-1.5 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </form>
                </div>

                {/* Documents list */}
                {docsLoading ? (
                  <div className="divide-y divide-gray-50">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                        <div className="w-9 h-9 bg-gray-200 rounded-lg" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-48 bg-gray-200 rounded" />
                          <div className="h-3 w-32 bg-gray-200 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : paginatedDocs.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center p-12">
                    <div className="text-center">
                      <h3 className="text-base font-semibold text-gray-900 mb-1">
                        {docsSearch ? 'No matching documents' : 'Empty folder'}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {docsSearch ? 'Try a different search term.' : 'Move documents here from the Documents page.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1">
                    <div className="divide-y divide-gray-50">
                      {paginatedDocs.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                          <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-brand-600 tracking-tight">PDF</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{doc.title}</p>
                            <p className="text-xs text-gray-500">{doc.clientName} -- {new Date(doc.createdAt).toLocaleDateString()}</p>
                          </div>
                          <Link
                            href={`/documents?search=${encodeURIComponent(doc.title)}`}
                            className="text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
                          >
                            View
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pagination */}
                {totalDocsPages > 1 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      {(docsPage - 1) * DOCS_PER_PAGE + 1} - {Math.min(docsPage * DOCS_PER_PAGE, filteredDocs.length)} of {filteredDocs.length}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDocsPage((p) => Math.max(1, p - 1))}
                        disabled={docsPage === 1}
                        className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      >
                        Previous
                      </button>
                      <span className="text-xs text-gray-500 flex items-center px-2">
                        {docsPage} / {totalDocsPages}
                      </span>
                      <button
                        onClick={() => setDocsPage((p) => Math.min(totalDocsPages, p + 1))}
                        disabled={docsPage >= totalDocsPages}
                        className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Create Folder Modal */}
      {createModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl p-6 max-w-sm w-full mx-4 animate-fade-in-up">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {createModal.parentId ? 'New Sub-folder' : 'New Folder'}
            </h3>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
            )}
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              autoFocus
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none focus:bg-white focus:border-brand-400 focus:ring-4 focus:ring-brand-100 transition-all mb-6"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setCreateModal(null)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl border border-gray-200 transition-colors cursor-pointer">
                Cancel
              </button>
              <button onClick={handleCreate} disabled={actionLoading || !newFolderName.trim()} className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50">
                {actionLoading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl p-6 max-w-sm w-full mx-4 animate-fade-in-up">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rename Folder</h3>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
            )}
            <input
              type="text"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              autoFocus
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none focus:bg-white focus:border-brand-400 focus:ring-4 focus:ring-brand-100 transition-all mb-6"
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setRenameModal(null)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl border border-gray-200 transition-colors cursor-pointer">
                Cancel
              </button>
              <button onClick={handleRename} disabled={actionLoading || !renameName.trim()} className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50">
                {actionLoading ? 'Renaming...' : 'Rename'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl p-6 max-w-sm w-full mx-4 animate-fade-in-up">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Folder</h3>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
            )}
            <p className="text-sm text-gray-500 mb-1">
              Are you sure you want to delete <span className="font-semibold text-gray-700">{deleteModal.name}</span>?
            </p>
            {deleteModal.docCount > 0 && (
              <p className="text-sm text-amber-600 mb-4">
                {deleteModal.docCount} document{deleteModal.docCount !== 1 ? 's' : ''} will be moved to no folder.
              </p>
            )}
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setDeleteModal(null)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl border border-gray-200 transition-colors cursor-pointer">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={actionLoading} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50">
                {actionLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
