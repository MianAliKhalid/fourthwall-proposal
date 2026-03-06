"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import PdfPreview from "@/components/pdf-preview";
import ChatPanel from "@/components/chat-panel";

interface DocumentData {
  id: string;
  title: string;
  clientName: string;
  clientTagline: string | null;
  productsJson: unknown;
  updatedAt: string;
  createdBy: {
    id: string;
    username: string;
    displayName: string | null;
  };
}

export default function DocumentEditPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;

  const [document, setDocument] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load document data
  useEffect(() => {
    async function loadDocument() {
      try {
        const res = await fetch(`/api/documents/${documentId}`);
        if (res.status === 404) {
          setError("Document not found");
          return;
        }
        if (res.status === 401) {
          router.push("/");
          return;
        }
        if (!res.ok) {
          throw new Error("Failed to load document");
        }
        const data = await res.json();
        setDocument(data.document);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load document");
      } finally {
        setLoading(false);
      }
    }
    loadDocument();
  }, [documentId, router]);

  // Called when chat updates the document
  const handleDocumentUpdated = useCallback(() => {
    setRefreshKey((k) => k + 1);
    // Reload document data so we have the latest
    fetch(`/api/documents/${documentId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.document) setDocument(data.document);
      })
      .catch(() => {});
  }, [documentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="w-8 h-8 text-brand-600 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-sm text-gray-500">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-500"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <circle cx="10" cy="10" r="8" />
              <path d="M10 6v5M10 13h.01" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {error || "Document not found"}
          </h2>
          <Link
            href="/centralsystem/documents"
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            Back to Documents
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/centralsystem/documents"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors shrink-0"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path d="M10 3L5 8l5 5" />
            </svg>
            Documents
          </Link>
          <span className="text-gray-300">/</span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">
              {document.title}
            </h1>
            <p className="text-xs text-gray-500 truncate">
              {document.clientName}
              {document.clientTagline ? ` -- ${document.clientTagline}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline text-xs text-gray-400">
            Auto-saves on edit
          </span>
          <div className="w-2 h-2 rounded-full bg-green-400" title="Connected" />
        </div>
      </div>

      {/* Split pane */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
        {/* LEFT: PDF Preview (60%) */}
        <div className="lg:w-[60%] h-[50vh] lg:h-full shrink-0">
          <PdfPreview documentId={documentId} refreshKey={refreshKey} />
        </div>

        {/* RIGHT: Chat (40%) */}
        <div className="lg:w-[40%] h-[50vh] lg:h-full min-h-0">
          <ChatPanel
            documentId={documentId}
            onDocumentUpdated={handleDocumentUpdated}
          />
        </div>
      </div>
    </div>
  );
}
