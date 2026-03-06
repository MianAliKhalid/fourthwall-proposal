'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Document {
  id: string
  title: string
  clientName: string
  clientTagline?: string | null
  createdAt: string
  updatedAt: string
  activeShareLinks: number
  folder?: { id: string; name: string } | null
  createdBy: { id: string; username: string; displayName?: string | null }
}

interface DashboardData {
  documents: Document[]
  totalDocuments: number
  totalShareLinks: number
  recentActivity: { action: string; resourceType: string; createdAt: string; details?: string }[]
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-3">
          <div className="h-4 w-24 bg-gray-200 rounded" />
          <div className="h-8 w-16 bg-gray-200 rounded" />
        </div>
        <div className="w-12 h-12 bg-gray-200 rounded-xl" />
      </div>
    </div>
  )
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4 animate-pulse">
      <div className="w-10 h-10 bg-gray-200 rounded-xl" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-48 bg-gray-200 rounded" />
        <div className="h-3 w-32 bg-gray-200 rounded" />
      </div>
      <div className="h-8 w-20 bg-gray-200 rounded-lg" />
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const [docsRes, userRes, linksRes] = await Promise.all([
          fetch('/api/documents?limit=5&sortBy=createdAt&sortOrder=desc'),
          fetch('/api/auth/me'),
          fetch('/api/share-links'),
        ])

        const docsData = await docsRes.json()
        const userData = await userRes.json()
        const linksData = await linksRes.json()

        if (userData.user) {
          setUserName(userData.user.displayName || userData.user.fullName || userData.user.username || '')
        }

        setData({
          documents: docsData.documents || [],
          totalDocuments: docsData.pagination?.total || 0,
          totalShareLinks: linksData.shareLinks?.filter((l: { effectiveStatus: string }) => l.effectiveStatus === 'active').length || 0,
          recentActivity: [],
        })
      } catch {
        // Silently handle errors
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setData((prev) => prev ? {
          ...prev,
          documents: prev.documents.filter((d) => d.id !== id),
          totalDocuments: prev.totalDocuments - 1,
        } : null)
      }
    } catch {
      // Silently handle
    }
    setDeleteId(null)
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          {loading ? 'Welcome back' : `Welcome back${userName ? `, ${userName}` : ''}`}
        </h1>
        <p className="text-gray-500 mt-1">Here is an overview of your proposal workspace.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard
              label="Total Documents"
              value={data?.totalDocuments || 0}
              color="bg-brand-50"
              icon={
                <svg className="w-6 h-6 text-brand-600" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <rect x="4" y="2" width="12" height="16" rx="1.5" />
                  <path d="M7 7h6M7 10h6M7 13h4" />
                </svg>
              }
            />
            <StatCard
              label="Active Share Links"
              value={data?.totalShareLinks || 0}
              color="bg-green-50"
              icon={
                <svg className="w-6 h-6 text-green-600" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <circle cx="6" cy="10" r="2.5" />
                  <circle cx="14" cy="5" r="2.5" />
                  <circle cx="14" cy="15" r="2.5" />
                  <path d="M8.2 8.8l3.6-2.6M8.2 11.2l3.6 2.6" />
                </svg>
              }
            />
            <StatCard
              label="Recent Activity"
              value={data?.documents.length || 0}
              color="bg-amber-50"
              icon={
                <svg className="w-6 h-6 text-amber-600" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <circle cx="10" cy="10" r="8" />
                  <path d="M10 5v5l3 3" />
                </svg>
              }
            />
          </>
        )}
      </div>

      {/* Recent Documents */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Recent Documents</h2>
          <Link href="/documents" className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors">
            View all
          </Link>
        </div>

        {loading ? (
          <div className="divide-y divide-gray-50">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : !data?.documents.length ? (
          <div className="p-12 text-center">
            <h3 className="text-base font-semibold text-gray-900 mb-1">No documents yet</h3>
            <p className="text-sm text-gray-500 mb-4">Create your first proposal to get started.</p>
            <Link
              href="/new-proposal"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors"
            >
              <span className="text-base leading-none">+</span>
              Create Proposal
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {data.documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-brand-600 tracking-tight">PDF</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{doc.title}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500">{doc.clientName}</span>
                    {doc.folder && (
                      <>
                        <span className="text-gray-300">|</span>
                        <span className="text-xs text-gray-400">{doc.folder.name}</span>
                      </>
                    )}
                    <span className="text-gray-300">|</span>
                    <span className="text-xs text-gray-400">{new Date(doc.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {doc.activeShareLinks > 0 && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 rounded-full mr-2">
                      {doc.activeShareLinks} shared
                    </span>
                  )}
                  <button
                    onClick={() => router.push(`/documents?search=${encodeURIComponent(doc.title)}`)}
                    className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors cursor-pointer"
                    title="View"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <circle cx="8" cy="8" r="3" />
                      <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" />
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
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl p-6 max-w-sm w-full mx-4 animate-fade-in-up">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Document</h3>
            <p className="text-sm text-gray-500 mb-6">Are you sure you want to delete this document? This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl border border-gray-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick create FAB on mobile */}
      <Link
        href="/new-proposal"
        className="fixed bottom-6 right-6 sm:hidden w-14 h-14 bg-brand-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-brand-600/30 hover:bg-brand-700 transition-all z-50"
      >
        <span className="text-2xl leading-none">+</span>
      </Link>
    </div>
  )
}
