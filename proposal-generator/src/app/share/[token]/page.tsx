'use client'

import { useState, useEffect, useCallback, use } from 'react'

interface ShareMeta {
  title: string
  clientName: string
}

export default function PublicSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string>('')
  const [meta, setMeta] = useState<ShareMeta | null>(null)

  const loadShare = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/share/${token}/meta`)

      if (res.ok) {
        const data = await res.json()
        setMeta(data)
        setStatus('ready')
      } else {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }))
        if (res.status === 410) {
          setError(data.error || 'This link is no longer available.')
        } else if (res.status === 429) {
          setError('Too many requests. Please try again in a moment.')
        } else if (res.status === 404) {
          setError('This share link was not found.')
        } else {
          setError(data.error || 'An error occurred.')
        }
        setStatus('error')
      }
    } catch {
      setError('Failed to load. Please check your connection and try again.')
      setStatus('error')
    }
  }, [token])

  useEffect(() => {
    loadShare()
  }, [loadShare])

  const pdfUrl = `/api/public/share/${token}`

  function handleDownload() {
    const link = document.createElement('a')
    link.href = pdfUrl
    link.download = `${meta?.title || 'proposal'}.pdf`
    link.click()
  }

  function handlePrint() {
    const iframe = document.getElementById('pdf-viewer') as HTMLIFrameElement
    if (iframe?.contentWindow) {
      try {
        iframe.contentWindow.print()
      } catch {
        window.open(pdfUrl, '_blank')
      }
    } else {
      window.open(pdfUrl, '_blank')
    }
  }

  // Error / expired / disabled state
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Link Unavailable</h1>
            <p className="text-gray-500 mb-8 leading-relaxed">{error}</p>
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <p className="text-sm text-gray-500 mb-2">Need access? Contact us at:</p>
              <a
                href="mailto:hello@pluckyreach.com"
                className="text-sm font-medium text-purple-600 hover:text-purple-700"
              >
                hello@pluckyreach.com
              </a>
              <p className="text-sm text-gray-400 mt-1">+1 (323) 870-1005</p>
            </div>
          </div>
        </div>
        <footer className="py-6 text-center">
          <span className="text-xs text-gray-400">Powered by <span className="font-semibold text-gray-500">Plucky Reach</span></span>
        </footer>
      </div>
    )
  }

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-gray-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading document...</p>
        </div>
      </div>
    )
  }

  // Ready - PDF viewer
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 shadow-sm shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {meta?.title || 'Shared Document'}
                </p>
                <p className="text-xs text-gray-500">
                  Shared by Plucky Reach
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                title="Print"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 7.034V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659" />
                </svg>
                <span className="hidden sm:inline">Print</span>
              </button>
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors cursor-pointer shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                <span className="hidden sm:inline">Download</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* PDF Viewer */}
      <main className="flex-1 flex flex-col">
        <iframe
          id="pdf-viewer"
          src={pdfUrl}
          className="flex-1 w-full min-h-[calc(100vh-3.5rem-3rem)] border-0"
          title="PDF Viewer"
        />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-3 shrink-0">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-center">
          <span className="text-xs text-gray-400">Powered by <span className="font-medium text-gray-500">Plucky Reach</span></span>
        </div>
      </footer>
    </div>
  )
}
