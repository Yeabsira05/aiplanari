"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type AiNote = {
  quote: string;
  explanation: string;
  terms: { term: string; definition: string }[];
  question: string;
};

type Toolbar = { x: number; y: number; text: string };

export default function PdfViewer({
  url,
  title,
  courseName,
}: {
  url: string;
  title: string;
  courseName: string;
}) {
  const [numPages, setNumPages] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [toolbar, setToolbar] = useState<Toolbar | null>(null);
  const [notes, setNotes] = useState<AiNote[]>([]);
  const [loadingNote, setLoadingNote] = useState(false);
  const [containerWidth, setContainerWidth] = useState(700);
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = pdfRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      setContainerWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Close toolbar on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-pdf-toolbar]")) setToolbar(null);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function handleMouseUp() {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    if (!text || text.length < 4) { setToolbar(null); return; }
    const range = sel?.getRangeAt(0);
    const rect = range?.getBoundingClientRect();
    if (rect && rect.width > 0) {
      setToolbar({ x: rect.left + rect.width / 2, y: rect.top, text });
    }
  }

  async function explainSelection() {
    if (!toolbar) return;
    const text = toolbar.text;
    setToolbar(null);
    setLoadingNote(true);
    try {
      const openaiKey = localStorage.getItem("openai_key") ?? "";
      const res = await fetch("/api/ai/explain-selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, title, courseName, openaiKey }),
      });
      const data = await res.json();
      if (data.explanation) {
        setNotes(prev => [
          { quote: text, explanation: data.explanation, terms: data.terms ?? [], question: data.question ?? "" },
          ...prev,
        ]);
      } else if (data.error) {
        alert(data.error === "OpenAI key required"
          ? "Add your OpenAI key on the Connect Canvas page to use AI explanations."
          : "Could not explain selection.");
      }
    } finally {
      setLoadingNote(false);
    }
  }

  const showPanel = notes.length > 0 || loadingNote;
  const pageWidth = Math.max(containerWidth - 32, 300);

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-100 bg-red-50 py-16">
        <p className="text-sm text-red-600">Failed to load PDF.</p>
        <p className="text-xs text-red-400">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4" style={{ height: "75vh" }}>
      {/* PDF scroll area */}
      <div
        ref={pdfRef}
        className="flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50"
        onMouseUp={handleMouseUp}
      >
        <Document
          file={url}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          onLoadError={err => setLoadError(err.message)}
          loading={
            <div className="flex flex-col items-center gap-2 py-20 text-slate-400">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
              <p className="text-sm">Loading PDF…</p>
            </div>
          }
          className="flex flex-col items-center gap-4 p-4"
        >
          {Array.from({ length: numPages }, (_, i) => (
            <Page
              key={i + 1}
              pageNumber={i + 1}
              width={pageWidth}
              renderTextLayer
              renderAnnotationLayer={false}
              className="rounded-xl shadow-sm"
            />
          ))}
        </Document>
      </div>

      {/* AI notes panel */}
      {showPanel && (
        <div className="w-72 shrink-0 overflow-y-auto space-y-3 pr-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">AI highlights</p>
          {loadingNote && (
            <div className="flex items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-600">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-500" />
              Explaining…
            </div>
          )}
          {notes.map((note, i) => (
            <div key={i} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-3">
              <blockquote className="rounded-lg border-l-2 border-indigo-300 bg-indigo-50 px-3 py-2 text-xs italic leading-relaxed text-indigo-700">
                &ldquo;{note.quote.length > 120 ? note.quote.slice(0, 120) + "…" : note.quote}&rdquo;
              </blockquote>
              <p className="text-sm leading-relaxed text-slate-700">{note.explanation}</p>
              {note.terms.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Key terms</p>
                  {note.terms.map(t => (
                    <div key={t.term} className="text-xs">
                      <span className="font-semibold text-slate-700">{t.term}: </span>
                      <span className="text-slate-500">{t.definition}</span>
                    </div>
                  ))}
                </div>
              )}
              {note.question && (
                <div className="rounded-xl bg-amber-50 px-3 py-2.5">
                  <p className="mb-0.5 text-xs font-bold uppercase text-amber-600">Practice</p>
                  <p className="text-xs leading-relaxed text-amber-800">{note.question}</p>
                </div>
              )}
              <button
                onClick={() => setNotes(prev => prev.filter((_, j) => j !== i))}
                className="text-xs text-slate-300 hover:text-red-400 transition-colors"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Floating explain toolbar */}
      {toolbar && (
        <div
          data-pdf-toolbar="true"
          style={{
            position: "fixed",
            left: toolbar.x,
            top: toolbar.y,
            transform: "translate(-50%, -110%)",
            zIndex: 9999,
          }}
          className="flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 shadow-2xl"
        >
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={explainSelection}
            className="flex items-center gap-1.5 text-xs font-semibold text-white hover:text-indigo-300 transition-colors"
          >
            <span>✦</span> Explain with AI
          </button>
          <div className="mx-2 h-3 w-px bg-slate-700" />
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => setToolbar(null)}
            className="text-xs text-slate-500 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
