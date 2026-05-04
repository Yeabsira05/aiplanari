"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import DeadlineCard from "@/components/DeadlineCard";
import { getLocalDeadlines } from "@/lib/localDeadlines";
import { getDaysLeft } from "@/lib/dates";
import type { Deadline } from "@/lib/types";

type Filter = "all" | "assignment" | "exam" | "urgent";

export default function DashboardPage() {
  const router = useRouter();

  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [prioritizing, setPrioritizing] = useState(false);
  const [aiStrategy, setAiStrategy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedCourse, setSelectedCourse] = useState("All");
  const [plan, setPlan] = useState("");
  const [generatingPlan, setGeneratingPlan] = useState(false);

  useEffect(() => {
    async function load() {
      const token = localStorage.getItem("canvas_token");
      if (!token) { router.push("/connect-canvas"); return; }

      try {
        const CACHE_KEY = "canvas_deadlines_cache";
        const CACHE_TTL = 5 * 60 * 1000;
        let canvas: Deadline[] = [];

        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const { deadlines: cd, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL) canvas = cd;
        }

        if (!canvas.length) {
          const res = await fetch("/api/canvas/deadlines", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          canvas = data.deadlines;
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ deadlines: canvas, timestamp: Date.now() }));
        }

        const local = getLocalDeadlines();
        const done: string[] = JSON.parse(localStorage.getItem("done_deadlines") || "[]");
        const today = new Date(); today.setHours(0, 0, 0, 0);

        const all = [...canvas, ...local].filter((d) => {
          const due = new Date(d.dueDate); due.setHours(0, 0, 0, 0);
          return due >= today && !done.includes(d.id);
        });

        setDeadlines(all);
        setLoading(false);

        // AI prioritize in background
        if (all.length) {
          setPrioritizing(true);
          const openaiKey = localStorage.getItem("openai_key") || "";
          try {
            const res = await fetch("/api/ai/prioritize", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ deadlines: all, openaiKey }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.priorities) {
                type P = { id: string; urgencyScore: number; reason: string; studyTip: string };
                const map = new Map(data.priorities.map((p: P) => [p.id, { urgencyScore: p.urgencyScore, aiReason: p.reason, aiStudyTip: p.studyTip }]));
                setDeadlines((prev) => prev.map((d) => { const ai = map.get(d.id) as Partial<Deadline> | undefined; return ai ? { ...d, ...ai } : d; }));
                if (data.overallStrategy) setAiStrategy(data.overallStrategy);
              }
            }
          } catch { /* fail silently */ }
          finally { setPrioritizing(false); }
        }
      } catch {
        setError("Could not load deadlines. Check your Canvas token.");
        setLoading(false);
      }
    }
    load();
  }, [router]);

  function handleDone(id: string) {
    const done: string[] = JSON.parse(localStorage.getItem("done_deadlines") || "[]");
    localStorage.setItem("done_deadlines", JSON.stringify([...done, id]));
    setDeadlines((prev) => prev.filter((d) => d.id !== id));
    setSuccess("Marked as done!");
    setTimeout(() => setSuccess(""), 3000);
  }

  const courseNames = useMemo(() => [...new Set(deadlines.map((d) => d.course))].sort(), [deadlines]);

  const sorted = useMemo(() => {
    const now = Date.now();
    return deadlines
      .filter((d) => {
        if (selectedCourse !== "All" && d.course !== selectedCourse) return false;
        if (filter === "assignment") return d.type === "assignment";
        if (filter === "exam") return d.type === "exam";
        if (filter === "urgent") return Math.ceil((new Date(d.dueDate).getTime() - now) / 86400000) <= 7;
        return true;
      })
      .sort((a, b) => {
        if (a.urgencyScore !== undefined && b.urgencyScore !== undefined) return b.urgencyScore - a.urgencyScore;
        if (a.urgencyScore !== undefined) return -1;
        if (b.urgencyScore !== undefined) return 1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
  }, [deadlines, filter, selectedCourse]);

  async function handleGeneratePlan() {
    if (!sorted.length) return;
    setGeneratingPlan(true); setPlan("");
    try {
      const openaiKey = localStorage.getItem("openai_key") || "";
      const res = await fetch("/api/study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deadlines: sorted, openaiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPlan(data.plan);
    } catch { alert("Could not generate study plan."); }
    finally { setGeneratingPlan(false); }
  }

  // Stats
  const urgentCount = deadlines.filter((d) => getDaysLeft(d.dueDate) <= 2).length;
  const weekCount = deadlines.filter((d) => { const l = getDaysLeft(d.dueDate); return l >= 0 && l <= 7; }).length;

  const filterOptions: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "assignment", label: "Assignments" },
    { value: "exam", label: "Exams" },
    { value: "urgent", label: "Urgent" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />

      <div className="mx-auto max-w-4xl px-6 py-8">

        {/* Stats */}
        {!loading && !error && (
          <div className="mb-8 grid grid-cols-3 gap-4">
            {[
              { label: "Upcoming", value: deadlines.length, color: "text-slate-900" },
              { label: "This week", value: weekCount, color: "text-amber-600" },
              { label: "Urgent", value: urgentCount, color: "text-red-600" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
                <p className="mt-0.5 text-sm text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Focus today */}
        {!loading && !error && sorted.length > 0 && (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Focus today</p>
              <p className="mt-0.5 truncate font-bold text-slate-900">{sorted[0].course}</p>
              <p className="mt-0.5 text-sm text-slate-500 truncate">{sorted[0].title} · {getDaysLeft(sorted[0].dueDate) <= 0 ? "due today" : `${getDaysLeft(sorted[0].dueDate)}d left`}</p>
            </div>
            <Link
              href="/learn"
              className="shrink-0 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              Study now →
            </Link>
          </div>
        )}

        {/* AI strategy */}
        {aiStrategy && (
          <div className="mb-6 flex gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
            <span className="text-lg">✦</span>
            <p className="text-sm text-indigo-800"><span className="font-semibold">AI strategy: </span>{aiStrategy}</p>
          </div>
        )}
        {prioritizing && !aiStrategy && (
          <div className="mb-6 flex items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-600">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-500" />
            AI is prioritizing your assignments…
          </div>
        )}

        {/* Filters */}
        {!loading && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {courseNames.length > 0 && (
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 outline-none hover:bg-slate-50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="All">All courses</option>
                {courseNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            )}
            {filterOptions.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                  filter === f.value
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {f.label}
              </button>
            ))}
            <button
              onClick={handleGeneratePlan}
              disabled={generatingPlan || !sorted.length}
              className="ml-auto rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
            >
              {generatingPlan ? "Generating…" : "✦ AI Study Plan"}
            </button>
          </div>
        )}

        {/* Study plan */}
        {plan && (
          <div className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50 p-6">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-indigo-900">AI Study Plan</p>
              <button onClick={() => setPlan("")} className="text-xs text-indigo-400 hover:text-indigo-600">Dismiss</button>
            </div>
            <pre className="mt-3 whitespace-pre-wrap text-sm leading-7 text-indigo-800">{plan}</pre>
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {success}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center py-24 text-slate-400">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-500" />
            <p className="text-sm">Fetching your Canvas deadlines…</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
        )}

        {!loading && !error && sorted.length === 0 && (
          <div className="flex flex-col items-center py-24 text-slate-400">
            <span className="text-4xl">🎉</span>
            <p className="mt-3 font-semibold text-slate-600">
              {selectedCourse !== "All" ? "No deadlines in this course." : "Nothing due — enjoy the break!"}
            </p>
          </div>
        )}

        {/* Card list */}
        <div className="space-y-3">
          {sorted.map((d) => (
            <DeadlineCard key={d.id} deadline={d} onDone={handleDone} />
          ))}
        </div>
      </div>
    </div>
  );
}
