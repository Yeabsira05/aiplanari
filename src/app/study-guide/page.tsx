"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import AppHeader from "@/components/AppHeader";

const PdfViewer = dynamic(() => import("@/components/PdfViewer"), { ssr: false });

type Course = { id: number; name: string; isCurrent: boolean };
type ModuleItem = { id: number; title: string; type: string; htmlUrl: string | null; apiUrl: string | null };
type Module = { id: number; name: string; position: number; items: ModuleItem[] };

type ItemContent =
  | { kind: "page";       title: string; body: string }
  | { kind: "assignment"; title: string; description: string; dueAt: string | null; pointsPossible: number | null }
  | { kind: "file";       title: string; url: string; contentType: string; size: number | null }
  | { kind: "quiz";       title: string; description: string; questionCount: number | null; timeLimit: number | null; pointsPossible: number | null; htmlUrl: string | null }
  | { kind: "link";       title: string; url: string };

type AiNotes = { summary: string; keyPoints: string[]; studyQuestions: string[]; studyTip: string; difficulty: string };

const ICON: Record<string, string> = { Page:"📄", Assignment:"✏️", File:"📎", Quiz:"🧪", Discussion:"💬", ExternalUrl:"🔗", ExternalTool:"🔧" };

function canAnalyze(type: string) { return ["Page","Assignment","Quiz"].includes(type); }

// ── Shared field strip helper ──────────────────────────────────────────────

function Meta({ items }: { items: { label: string; value: string | number }[] }) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {items.map((i) => (
        <div key={i.label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
          <span className="font-semibold text-slate-400">{i.label} </span>
          <span className="text-slate-700">{i.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function StudyGuidePage() {
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activeModule, setActiveModule] = useState<Module | null>(null);
  const [activeItem, setActiveItem] = useState<ModuleItem | null>(null);
  const [itemContent, setItemContent] = useState<ItemContent | null>(null);
  const [aiNotes, setAiNotes] = useState<AiNotes | null>(null);
  const [tab, setTab] = useState<"content"|"ai">("content");

  const [canvasToken, setCanvasToken] = useState("");
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingModules, setLoadingModules] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("canvas_token");
    if (!token) { router.push("/connect-canvas"); return; }
    setCanvasToken(token);
    fetch("/api/canvas/courses", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({token}) })
      .then(r=>r.json()).then(d=>{ if(d.courses) setCourses(d.courses); })
      .finally(()=>setLoadingCourses(false));
  }, [router]);

  const selectCourse = useCallback(async (course: Course) => {
    setSelectedCourse(course); setModules([]); setExpandedId(null);
    setActiveModule(null); setActiveItem(null); setItemContent(null); setAiNotes(null);
    setLoadingModules(true);
    const token = localStorage.getItem("canvas_token") || "";
    try {
      const res = await fetch("/api/canvas/modules", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({token, courseId:course.id}) });
      const d = await res.json();
      if (d.modules) setModules(d.modules);
    } finally { setLoadingModules(false); }
  }, []);

  function selectModule(mod: Module) {
    setExpandedId(prev => prev===mod.id ? null : mod.id);
    setActiveModule(mod); setActiveItem(null); setItemContent(null); setAiNotes(null); setTab("content");
    contentRef.current?.scrollTo({top:0});
  }

  async function selectItem(item: ModuleItem, mod: Module) {
    setActiveItem(item); setActiveModule(mod); setItemContent(null); setAiNotes(null); setTab("content");
    setLoadingContent(true);
    contentRef.current?.scrollTo({top:0});
    const token = localStorage.getItem("canvas_token") || "";
    try {
      const res = await fetch("/api/canvas/item-content", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({token, type:item.type, apiUrl:item.apiUrl, htmlUrl:item.htmlUrl, title:item.title}),
      });
      setItemContent(await res.json());
    } finally { setLoadingContent(false); }
  }

  async function generateAiNotes() {
    if (!itemContent || !selectedCourse) return;
    setLoadingAi(true); setTab("ai");
    const openaiKey = localStorage.getItem("openai_key") || "";
    let content = "";
    if (itemContent.kind==="page") content = itemContent.body;
    else if (itemContent.kind==="assignment") content = itemContent.description;
    else if (itemContent.kind==="quiz") content = itemContent.description;
    try {
      const res = await fetch("/api/ai/explain-content", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({title:itemContent.title, content, contentType:itemContent.kind, courseName:selectedCourse.name, openaiKey}),
      });
      const d = await res.json();
      if (d.summary) setAiNotes(d);
    } finally { setLoadingAi(false); }
  }

  // ── Content renderers ───────────────────────────────────────────────────

  function renderContent() {
    if (loadingContent) return <Spinner label="Loading content…" />;
    if (!itemContent) return null;

    if (itemContent.kind==="page") return itemContent.body
      ? <div className="canvas-prose" dangerouslySetInnerHTML={{__html:itemContent.body}} />
      : <Empty label="This page has no content." url={activeItem?.htmlUrl} />;

    if (itemContent.kind==="assignment") return (
      <div>
        <Meta items={[
          ...(itemContent.dueAt ? [{label:"Due", value:new Date(itemContent.dueAt).toLocaleDateString()}] : []),
          ...(itemContent.pointsPossible!==null ? [{label:"Points", value:itemContent.pointsPossible!}] : []),
        ]} />
        {itemContent.description
          ? <div className="canvas-prose" dangerouslySetInnerHTML={{__html:itemContent.description}} />
          : <Empty label="No description." url={activeItem?.htmlUrl} />}
      </div>
    );

    if (itemContent.kind==="quiz") return (
      <div>
        <Meta items={[
          ...(itemContent.questionCount!==null ? [{label:"Questions", value:itemContent.questionCount!}] : []),
          ...(itemContent.timeLimit!==null ? [{label:"Time limit", value:`${itemContent.timeLimit} min`}] : []),
          ...(itemContent.pointsPossible!==null ? [{label:"Points", value:itemContent.pointsPossible!}] : []),
        ]} />
        {itemContent.description
          ? <div className="canvas-prose" dangerouslySetInnerHTML={{__html:itemContent.description}} />
          : <Empty label="No description." url={itemContent.htmlUrl} />}
        {itemContent.htmlUrl && (
          <a href={itemContent.htmlUrl} target="_blank" rel="noreferrer"
            className="mt-4 inline-flex rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
            Open Quiz in Canvas →
          </a>
        )}
      </div>
    );

    if (itemContent.kind==="file") {
      const isImg = itemContent.contentType.startsWith("image/");
      const isPdf = itemContent.contentType==="application/pdf";
      // Route all files through the proxy so Canvas auth is handled server-side
      // and Content-Disposition is forced to "inline" for in-browser viewing.
      const proxyUrl = itemContent.url
        ? `/api/canvas/file-proxy?url=${encodeURIComponent(itemContent.url)}&token=${encodeURIComponent(canvasToken)}`
        : null;

      return (
        <div>
          <Meta items={[
            {label:"Type", value:itemContent.contentType||"File"},
            ...(itemContent.size ? [{label:"Size", value:`${(itemContent.size/1024).toFixed(0)} KB`}] : []),
          ]} />

          {isPdf && proxyUrl && (
            <PdfViewer
              url={proxyUrl}
              title={itemContent.title}
              courseName={selectedCourse?.name ?? ""}
            />
          )}

          {isImg && proxyUrl && (
            <img src={proxyUrl} alt={itemContent.title} className="max-w-full rounded-2xl border border-slate-200" />
          )}

          {!isPdf && !isImg && (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16">
              <span className="text-4xl">📎</span>
              <p className="text-sm text-slate-400">Preview not available for this file type.</p>
              {proxyUrl && (
                <a href={proxyUrl} target="_blank" rel="noreferrer"
                  className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">
                  Open file
                </a>
              )}
            </div>
          )}
        </div>
      );
    }

    if (itemContent.kind==="link") return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16">
        <span className="text-4xl">🔗</span>
        <a href={itemContent.url} target="_blank" rel="noreferrer"
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">
          Open resource →
        </a>
      </div>
    );
    return null;
  }

  function renderAi() {
    if (loadingAi) return <Spinner label="Generating AI study notes…" color="indigo" />;
    if (!aiNotes) return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-3xl">✦</div>
        <p className="font-semibold text-slate-700">AI study notes</p>
        <p className="max-w-xs text-sm text-slate-400">AI will summarize the content, extract key points, and write practice questions for you.</p>
        <button onClick={generateAiNotes} className="mt-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
          Generate notes
        </button>
      </div>
    );
    const diffColor: Record<string,string> = {Easy:"bg-emerald-50 text-emerald-700 border-emerald-100", Medium:"bg-amber-50 text-amber-700 border-amber-100", Hard:"bg-red-50 text-red-700 border-red-100"};
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <span className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${diffColor[aiNotes.difficulty]??""}`}>{aiNotes.difficulty}</span>
          <button onClick={generateAiNotes} className="text-xs text-slate-400 hover:text-slate-600">Regenerate</button>
        </div>
        <div className="rounded-2xl bg-indigo-50 p-5">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-indigo-400">Summary</p>
          <p className="text-sm leading-relaxed text-indigo-900">{aiNotes.summary}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Key points</p>
          <ul className="space-y-2">
            {aiNotes.keyPoints.map((pt,i)=>(
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">{i+1}</span>
                {pt}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Practice questions</p>
          <ol className="space-y-3">
            {aiNotes.studyQuestions.map((q,i)=>(
              <li key={i} className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <span className="font-semibold text-slate-400">Q{i+1}. </span>{q}
              </li>
            ))}
          </ol>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <span className="text-xl">💡</span>
          <p className="text-sm italic text-amber-800">{aiNotes.studyTip}</p>
        </div>
      </div>
    );
  }

  // ── Layout ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col" style={{height:"100dvh"}}>
      <AppHeader />

      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ── */}
        <aside className="flex w-64 shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white">
          {/* Course select */}
          <div className="shrink-0 border-b border-slate-100 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Course</p>
            {loadingCourses ? (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />Loading…
              </div>
            ) : (
              <select
                value={selectedCourse?.id ?? ""}
                onChange={(e) => { const c=courses.find(c=>c.id===Number(e.target.value)); if(c) selectCourse(c); }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-indigo-500"
              >
                <option value="">Pick a course…</option>
                {courses.filter(c => c.isCurrent).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                {courses.some(c => !c.isCurrent) && (
                  <optgroup label="─── Past courses">
                    {courses.filter(c => !c.isCurrent).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                )}
              </select>
            )}
          </div>

          {/* Module list */}
          <div className="flex-1 overflow-y-auto">
            {loadingModules && (
              <div className="flex items-center gap-2 p-4 text-xs text-slate-400">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />Loading modules…
              </div>
            )}
            {!loadingModules && modules.length===0 && selectedCourse && (
              <p className="p-4 text-xs text-slate-400">No modules found.</p>
            )}
            {modules.map(mod=>{
              const open = expandedId===mod.id;
              const isMod = activeModule?.id===mod.id && !activeItem;
              return (
                <div key={mod.id}>
                  <button
                    onClick={()=>selectModule(mod)}
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${
                      isMod ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="line-clamp-2 leading-snug">{mod.position}. {mod.name}</span>
                    <span className={`ml-2 shrink-0 text-xs text-slate-300 transition-transform ${open?"rotate-90":""}`}>▶</span>
                  </button>
                  {open && (
                    <div className="border-l-2 border-slate-100 ml-4">
                      {mod.items.length===0 && <p className="px-3 py-2 text-xs text-slate-400">No items</p>}
                      {mod.items.map(item=>{
                        const active = activeItem?.id===item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={()=>selectItem(item, mod)}
                            className={`flex w-full items-start gap-1.5 px-3 py-2 text-left text-xs transition-colors ${
                              active ? "bg-indigo-50 text-indigo-600 font-medium" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                            }`}
                          >
                            <span className="shrink-0 mt-0.5">{ICON[item.type]??"•"}</span>
                            <span className="line-clamp-2 leading-snug">{item.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* ── Content panel ── */}
        <main ref={contentRef} className="flex-1 overflow-y-auto bg-slate-50">

          {/* Nothing selected */}
          {!activeModule && !activeItem && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <span className="text-5xl">📚</span>
              <p className="text-lg font-bold text-slate-700">
                {selectedCourse ? "Select a module to get started" : "Pick a course from the sidebar"}
              </p>
              <p className="text-sm text-slate-400">Browse modules and view content, or get AI study notes.</p>
            </div>
          )}

          {/* Module overview */}
          {activeModule && !activeItem && (
            <div className="mx-auto max-w-3xl p-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{selectedCourse?.name}</p>
              <h1 className="mt-1 text-2xl font-extrabold text-slate-900">{activeModule.name}</h1>
              <p className="mt-0.5 text-sm text-slate-400">{activeModule.items.length} item{activeModule.items.length!==1?"s":""}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {activeModule.items.map(item=>(
                  <button
                    key={item.id}
                    onClick={()=>selectItem(item, activeModule)}
                    className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-indigo-300 hover:shadow-md"
                  >
                    <span className="mt-0.5 text-2xl">{ICON[item.type]??"📌"}</span>
                    <div className="min-w-0">
                      <p className="font-semibold leading-snug text-slate-900">{item.title}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{item.type}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Item viewer */}
          {activeItem && (
            <div className="flex h-full flex-col">
              {/* Item header */}
              <div className="shrink-0 border-b border-slate-200 bg-white px-8 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <button
                        onClick={()=>{ setActiveItem(null); setItemContent(null); setAiNotes(null); }}
                        className="hover:text-slate-700 transition-colors"
                      >
                        {activeModule?.name}
                      </button>
                      <span>›</span>
                      <span className="text-slate-600">{activeItem.title}</span>
                    </div>
                    <h1 className="mt-1 text-xl font-extrabold text-slate-900">{activeItem.title}</h1>
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                      {ICON[activeItem.type]} {activeItem.type}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {activeItem.htmlUrl && (
                      <a href={activeItem.htmlUrl} target="_blank" rel="noreferrer"
                        className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                        Open in Canvas →
                      </a>
                    )}
                    {canAnalyze(activeItem.type) && !loadingContent && (
                      <button onClick={generateAiNotes} disabled={loadingAi}
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                        {loadingAi ? "Analyzing…" : "✦ AI notes"}
                      </button>
                    )}
                  </div>
                </div>
                {canAnalyze(activeItem.type) && (
                  <div className="mt-4 flex gap-0 border-b border-slate-100">
                    {(["content","ai"] as const).map(t=>(
                      <button key={t} onClick={()=>{ setTab(t); if(t==="ai"&&!aiNotes) generateAiNotes(); }}
                        className={`border-b-2 px-4 pb-3 pt-1 text-sm font-semibold transition-colors ${
                          tab===t ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-700"
                        }`}>
                        {t==="content" ? "Content" : "✦ AI study notes"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-8">
                <div className="mx-auto max-w-3xl">
                  {tab==="content" ? renderContent() : renderAi()}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function Spinner({ label, color="slate" }: { label: string; color?: string }) {
  const ring = color==="indigo" ? "border-indigo-200 border-t-indigo-500" : "border-slate-200 border-t-slate-500";
  return (
    <div className="flex flex-col items-center justify-center py-24 text-slate-400">
      <div className={`mb-3 h-7 w-7 animate-spin rounded-full border-4 ${ring}`} />
      <p className="text-sm">{label}</p>
    </div>
  );
}

function Empty({ label, url }: { label: string; url?: string | null }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <span className="text-3xl">📭</span>
      <p className="text-sm text-slate-400">{label}</p>
      {url && <a href={url} target="_blank" rel="noreferrer" className="text-sm text-indigo-500 hover:underline">View in Canvas →</a>}
    </div>
  );
}
