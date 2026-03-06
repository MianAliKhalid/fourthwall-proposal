"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateProposalPdf } from "@/lib/generate-pdf";

interface Product {
  name: string;
  subtitle: string;
  printing: string;
  colors: string;
  sizes: string;
  size_note: string;
  description: string;
  pricing: [number, string][];
  timeline: string;
  images: string[];
}

type Step = "input" | "extracting" | "preview" | "generating" | "done";

const STEPS = [
  { key: "input", label: "Paste Link" },
  { key: "preview", label: "Review" },
  { key: "done", label: "Download" },
] as const;

function StepIndicator({ current }: { current: Step }) {
  const stepMap: Record<string, number> = { input: 0, extracting: 0, preview: 1, generating: 1, done: 2 };
  const activeIdx = stepMap[current] ?? 0;

  return (
    <div className="flex items-center justify-center gap-2 mb-10">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div className={`
            flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300
            ${i === activeIdx
              ? "bg-brand-600 text-white shadow-lg shadow-brand-600/25"
              : i < activeIdx
                ? "bg-brand-100 text-brand-700"
                : "bg-gray-100 text-gray-400"
            }
          `}>
            <span className={`
              w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
              ${i === activeIdx ? "bg-white/20" : i < activeIdx ? "bg-brand-200" : "bg-gray-200"}
            `}>
              {i < activeIdx ? (
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2}><path d="M2 6l3 3 5-5" /></svg>
              ) : (
                i + 1
              )}
            </span>
            {s.label}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-8 h-0.5 rounded-full transition-colors duration-300 ${i < activeIdx ? "bg-brand-300" : "bg-gray-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function Spinner({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function NewProposalPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientTagline, setClientTagline] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [step, setStep] = useState<Step>("input");
  const [error, setError] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  async function handleExtract() {
    if (!url || !clientName) {
      setError("Please fill in both the URL and client name.");
      return;
    }
    setError("");
    setStep("extracting");
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setStep("input"); return; }
      setProducts(data.products);
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to extract");
      setStep("input");
    }
  }

  async function handleGenerate() {
    setStep("generating");
    try {
      const res = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products, clientName, clientTagline }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setStep("preview"); return; }
      const pdf = generateProposalPdf({
        products: data.products,
        clientName: data.clientName,
        clientTagline: data.clientTagline,
        imageData: data.imageData,
      });
      pdf.save(`PluckyReach_Proposal_${clientName.replace(/\s+/g, "_")}.pdf`);

      // Save document to database and redirect to editor
      try {
        const docRes = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `Proposal - ${clientName}`,
            clientName,
            clientTagline,
            productsJson: data.products,
          }),
        });
        const docData = await docRes.json();
        if (docData.document?.id) {
          // Redirect to the editor for chat-based editing
          router.push(`/documents/${docData.document.id}/edit`);
          return;
        }
      } catch {
        // Don't fail the whole flow if saving fails
      }

      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate PDF");
      setStep("preview");
    }
  }

  function updateProduct(idx: number, field: keyof Product, value: string) {
    setProducts((prev) => {
      const updated = [...prev];
      if (field === "pricing") {
        try { updated[idx] = { ...updated[idx], pricing: JSON.parse(value) }; } catch { /* ignore */ }
      } else {
        updated[idx] = { ...updated[idx], [field]: value };
      }
      return updated;
    });
  }

  const inputClasses = "w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[15px] text-gray-900 placeholder-gray-400 transition-all duration-200 outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100 disabled:opacity-50 disabled:cursor-not-allowed";
  const inputSmClasses = "w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 transition-all duration-200 outline-none focus:bg-white focus:border-brand-400 focus:ring-4 focus:ring-brand-100";
  const labelClasses = "block text-sm font-semibold text-gray-700 mb-1.5";
  const labelSmClasses = "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5";

  return (
    <div className="max-w-5xl mx-auto">
      <StepIndicator current={step} />

      {/* Error Banner */}
      {error && (
        <div className="mb-8 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl animate-fade-in-up">
          <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="8" cy="8" r="6.5" /><path d="M8 5v4M8 11h.01" /></svg>
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-600 transition-colors cursor-pointer" aria-label="Dismiss error">
            <svg className="w-5 h-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M4 4l8 8M12 4l-8 8" /></svg>
          </button>
        </div>
      )}

      {/* STEP 1: INPUT */}
      {(step === "input" || step === "extracting") && (
        <div className="animate-fade-in-up">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Create a Proposal</h1>
            <p className="text-gray-500 mt-2 text-[15px]">Paste a CommonSKU link and we'll extract everything automatically.</p>
          </div>

          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xl shadow-gray-900/[0.04] p-8 space-y-5">
              <div>
                <label htmlFor="url" className={labelClasses}>Presentation URL</label>
                <input id="url" type="url" value={url} onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://fourthwall.commonsku.com/present.php?id=..."
                  className={inputClasses} disabled={step === "extracting"} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="client" className={labelClasses}>Client Name</label>
                  <input id="client" type="text" value={clientName} onChange={(e) => setClientName(e.target.value)}
                    placeholder="Silverback Hawaii" className={inputClasses} disabled={step === "extracting"} />
                </div>
                <div>
                  <label htmlFor="tagline" className={labelClasses}>
                    Tagline <span className="font-normal text-gray-400">(optional)</span>
                  </label>
                  <input id="tagline" type="text" value={clientTagline} onChange={(e) => setClientTagline(e.target.value)}
                    placeholder="Premium Paddle Ware & Sun Protection" className={inputClasses} disabled={step === "extracting"} />
                </div>
              </div>

              <button
                onClick={handleExtract}
                disabled={step === "extracting"}
                className={`
                  w-full py-3.5 rounded-xl text-white font-semibold text-[15px] transition-all duration-200 cursor-pointer
                  ${step === "extracting"
                    ? "bg-brand-400 animate-pulse-glow cursor-wait"
                    : "bg-brand-600 hover:bg-brand-700 hover:shadow-lg hover:shadow-brand-600/25 active:scale-[0.98]"
                  }
                `}
              >
                {step === "extracting" ? (
                  <span className="flex items-center justify-center gap-2.5">
                    <Spinner />
                    Extracting products with AI...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M8 1v4M8 11v4M1 8h4M11 8h4M3 3l2.5 2.5M10.5 10.5L13 13M13 3l-2.5 2.5M5.5 10.5L3 13" /></svg>
                    Extract Products
                  </span>
                )}
              </button>
            </div>

            <p className="text-center text-xs text-gray-400 mt-4">
              AI reads the presentation page and extracts all products, images, and pricing.
            </p>
          </div>
        </div>
      )}

      {/* STEP 2: PREVIEW */}
      {(step === "preview" || step === "generating") && (
        <div className="animate-fade-in-up">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                {products.length} Product{products.length !== 1 && "s"} Found
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                Proposal for <span className="font-semibold text-brand-700">{clientName}</span> -- click any product to edit before generating.
              </p>
            </div>
            <button
              onClick={handleGenerate}
              disabled={step === "generating"}
              className={`
                px-8 py-3 rounded-xl text-white font-semibold text-sm transition-all duration-200 cursor-pointer shrink-0
                ${step === "generating"
                  ? "bg-brand-400 animate-pulse-glow cursor-wait"
                  : "bg-brand-600 hover:bg-brand-700 hover:shadow-lg hover:shadow-brand-600/25 active:scale-[0.98]"
                }
              `}
            >
              {step === "generating" ? (
                <span className="flex items-center gap-2.5">
                  <Spinner />
                  Generating PDF...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M8 2v8M5 7l3 3 3-3M2 12v2a1 1 0 001 1h10a1 1 0 001-1v-2" /></svg>
                  Generate PDF
                </span>
              )}
            </button>
          </div>

          <div className="space-y-3">
            {products.map((product, idx) => (
              <div
                key={idx}
                className={`
                  bg-white rounded-2xl border transition-all duration-200 overflow-hidden
                  ${editingIdx === idx
                    ? "border-brand-300 shadow-lg shadow-brand-600/[0.06] ring-1 ring-brand-200"
                    : "border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300"
                  }
                `}
              >
                {/* Collapsed header */}
                <div
                  className="flex items-center justify-between px-6 py-5 cursor-pointer group"
                  onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setEditingIdx(editingIdx === idx ? null : idx)}
                  aria-expanded={editingIdx === idx}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                      <span className="text-brand-700 font-bold text-sm">{idx + 1}</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
                      <p className="text-sm text-gray-500 truncate">{product.subtitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 ml-4">
                    <div className="hidden sm:flex items-center gap-3 text-xs font-medium">
                      <span className="px-2.5 py-1 rounded-full bg-brand-50 text-brand-700">
                        {product.images.length} images
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                        {product.colors.split(",").length} colors
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                        {product.pricing.length} tiers
                      </span>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-all duration-200 ${editingIdx === idx ? "rotate-180 text-brand-500" : ""}`}
                      viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}
                    >
                      <path d="M4 6l4 4 4-4" />
                    </svg>
                  </div>
                </div>

                {/* Expanded editor */}
                {editingIdx === idx && (
                  <div className="px-6 pb-6 border-t border-gray-100 pt-5 space-y-4 animate-fade-in-up">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelSmClasses}>Product Name</label>
                        <input value={product.name} onChange={(e) => updateProduct(idx, "name", e.target.value)} className={inputSmClasses} />
                      </div>
                      <div>
                        <label className={labelSmClasses}>Subtitle / SKU</label>
                        <input value={product.subtitle} onChange={(e) => updateProduct(idx, "subtitle", e.target.value)} className={inputSmClasses} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className={labelSmClasses}>Printing Method</label>
                        <input value={product.printing} onChange={(e) => updateProduct(idx, "printing", e.target.value)} className={inputSmClasses} />
                      </div>
                      <div>
                        <label className={labelSmClasses}>Sizes</label>
                        <input value={product.sizes} onChange={(e) => updateProduct(idx, "sizes", e.target.value)} className={inputSmClasses} />
                      </div>
                      <div>
                        <label className={labelSmClasses}>Size Upcharge</label>
                        <input value={product.size_note} onChange={(e) => updateProduct(idx, "size_note", e.target.value)} className={inputSmClasses} />
                      </div>
                    </div>
                    <div>
                      <label className={labelSmClasses}>Available Colors</label>
                      <input value={product.colors} onChange={(e) => updateProduct(idx, "colors", e.target.value)} className={inputSmClasses} />
                    </div>
                    <div>
                      <label className={labelSmClasses}>Description</label>
                      <textarea value={product.description} onChange={(e) => updateProduct(idx, "description", e.target.value)} rows={3}
                        className={`${inputSmClasses} resize-none`} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelSmClasses}>Timeline</label>
                        <input value={product.timeline} onChange={(e) => updateProduct(idx, "timeline", e.target.value)} className={inputSmClasses} />
                      </div>
                      <div>
                        <label className={labelSmClasses}>Pricing JSON</label>
                        <input value={JSON.stringify(product.pricing)} onChange={(e) => updateProduct(idx, "pricing", e.target.value)}
                          className={`${inputSmClasses} font-mono text-xs`} />
                      </div>
                    </div>
                    <div>
                      <label className={labelSmClasses}>Product Images ({product.images.length})</label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {product.images.slice(0, 12).map((id) => (
                          <img key={id} src={`https://files.commonsku.com/large/${id}`} alt={`${product.name} variant`}
                            className="w-18 h-18 object-cover rounded-lg border border-gray-200 hover:border-brand-300 hover:shadow-md transition-all duration-200" />
                        ))}
                        {product.images.length > 12 && (
                          <div className="w-18 h-18 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                            <span className="text-xs font-semibold text-gray-400">+{product.images.length - 12}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 3: DONE */}
      {step === "done" && (
        <div className="animate-fade-in-up">
          <div className="max-w-lg mx-auto text-center">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xl shadow-gray-900/[0.04] p-12">
              <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-green-500" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <circle cx="10" cy="10" r="8" />
                  <path d="M6.5 10l2.5 2.5L13.5 8" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Proposal Ready</h2>
              <p className="text-gray-500 mb-8">
                Your PDF for <span className="font-semibold text-gray-700">{clientName}</span> has been downloaded and saved.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => handleGenerate()}
                  className="px-6 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 cursor-pointer text-sm"
                >
                  Download Again
                </button>
                <button
                  onClick={() => { setStep("input"); setProducts([]); setUrl(""); setClientName(""); setClientTagline(""); setError(""); }}
                  className="px-6 py-3 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 hover:shadow-lg hover:shadow-brand-600/25 transition-all duration-200 cursor-pointer text-sm"
                >
                  Create New Proposal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
