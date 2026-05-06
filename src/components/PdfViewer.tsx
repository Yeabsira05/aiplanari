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
type Highlight = { phrase: string; importance: "high" | "medium" };

// High = amber, medium = emerald
const HL_STYLE: Record<string, string> = {
  high:   "rgba(251,191,36,0.55)",
  medium: "rgba(167,243,208,0.55)",
};

function applyHighlightsToContainer(container: HTMLElement, highlights: Highlight[]) {
  if (!highlights.length) return;
  const spans = container.querySelectorAll<HTMLElement>(
    ".react-pdf__Page__textContent span[role='presentation'], .react-pdf__Page__textContent span"
  );
  spans.forEach(span => {
    const text = span.textContent ?? "";
    if (!text.trim()) return;
    const match = highlights.find(h =>
      text.toLowerCase().includes(h.phrase.toLowerCase())
    );
    if (match) {
      span.style.backgroundColor = HL_STYLE[match.importance];
      span.style.borderRadius = "2px";
      span.style.mixBlendMode = "multiply";
    }
  });
}

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
  const [renderedPages, setRenderedPages] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [toolbar, setToolbar] = useState<Toolbar | null>(null);
  const [notes, setNotes] = useState<AiNote[]>([]);
  const [loadingNote, setLoadingNote] = useState(false);
  const [containerWidth, setContainerWidth] = useState(700);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loadingHL, setLoadingHL] = useState(false);
  const [hlDone, setHlDone] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  // Responsive width
  useEffect(() => {
    const el = pdfRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => setContainerWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Close toolbar on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest("[data-pdf-toolbar]")) setToolbar(null);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function onDocumentLoad({ numPages: n }: { numPages: number }) {
    setNumPages(n);
  }

  async function runHighlight() {
    if (loadingHL || hlDone || !numPages) return;
    setLoadingHL(true);
    try {
      const pdf = await pdfjs.getDocument(url).promise;
      let fullText = "";
      const limit = Math.min(numPages, 6);
      for (let p = 1; p <= limit; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        fullText += content.items
          .map((item) => ("str" in item ? (item as { str: string }).str : ""))
          .join(" ") + "\n";
      }
      const res = await fetch("/api/ai/highlight-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: fullText.slice(0, 5000), courseName, title }),
      });
      const data = await res.json();
      if (data.highlights?.length) { setHighlights(data.highlights); setHlDone(true); }
    } catch { /* fail silently */ }
    finally { setLoadingHL(false); }
  }

  // Re-apply highlights whenever a new page finishes rendering
  useEffect(() => {
    if (!highlights.length || !pdfRef.current) return;
    const timer = setTimeout(() => {
      if (pdfRef.current) applyHighlightsToContainer(pdfRef.current, highlights);
    }, 100);
    return () => clearTimeout(timer);
  }, [highlights, renderedPages]);

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
      const res = await fetch("/api/ai/explain-selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, title, courseName }),
      });
      const data = await res.json();
      if (data.explanation) {
        setNotes(prev => [
          { quote: text, explanation: data.explanation, terms: data.terms ?? [], question: data.question ?? "" },
          ...prev,
        ]);
      } else if (data.error) {
        alert("Could not explain selection.");
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
        {/* Highlight bar */}
        {numPages > 0 && (
          <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur-sm">
            {loadingHL ? (
              <>
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
                <span className="text-xs text-slate-500">AI is highlighting key terms…</span>
              </>
            ) : hlDone ? (
              <>
                <span className="text-xs text-slate-500">{highlights.length} terms highlighted</span>
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: HL_STYLE.high }} />
                  Critical
                  <span className="ml-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: HL_STYLE.medium }} />
                  Important
                </span>
              </>
            ) : (
              <button
                onClick={runHighlight}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
              >
                <span>✦</span> Highlight with AI
              </button>
            )}
          </div>
        )}

        <Document
          file={url}
          onLoadSuccess={onDocumentLoad}
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
              onRenderSuccess={() => setRenderedPages(p => p + 1)}
            />
          ))}
        </Document>
      </div>

      {/* AI notes panel */}
      {showPanel && (
        <div className="w-72 shrink-0 overflow-y-auto space-y-3 pr-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">AI notes</p>
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
