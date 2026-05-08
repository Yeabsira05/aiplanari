"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { getLocalDeadlines } from "@/lib/localDeadlines";
import { getDaysLeft } from "@/lib/dates";
import type { Deadline } from "@/lib/types";

// ─── Shared data fetching ────────────────────────────────────────────────────

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
function urgencyColor(dueDate: string) {
  const d = getDaysLeft(dueDate);
  if (d <= 2) return "bg-red-500";
  if (d <= 7) return "bg-amber-400";
  return "bg-indigo-400";
}

// ─── Semester view helpers ───────────────────────────────────────────────────

const COURSE_COLORS = [
  { light: "bg-violet-100", text: "text-violet-700", border: "border-violet-200" },
  { light: "bg-blue-100",   text: "text-blue-700",   border: "border-blue-200"   },
  { light: "bg-emerald-100",text: "text-emerald-700",border: "border-emerald-200"},
  { light: "bg-amber-100",  text: "text-amber-700",  border: "border-amber-200"  },
  { light: "bg-rose-100",   text: "text-rose-700",   border: "border-rose-200"   },
  { light: "bg-indigo-100", text: "text-indigo-700", border: "border-indigo-200" },
  { light: "bg-teal-100",   text: "text-teal-700",   border: "border-teal-200"   },
  { light: "bg-orange-100", text: "text-orange-700", border: "border-orange-200" },
  { light: "bg-pink-100",   text: "text-pink-700",   border: "border-pink-200"   },
  { light: "bg-cyan-100",   text: "text-cyan-700",   border: "border-cyan-200"   },
];

function courseColorIndex(course: string) {
  let h = 0;
  for (let i = 0; i < course.length; i++) h = (h * 31 + course.charCodeAt(i)) & 0xffff;
  return h % COURSE_COLORS.length;
}

function getMondayKey(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

function isExam(dl: Deadline) {
  const t = dl.title.toLowerCase();
  return dl.type === "exam" ||
    t.includes("exam") || t.includes("próf") || t.includes("prof") ||
    t.includes("quiz") || t.includes("test") || t.includes("midterm") ||
    t.includes("mið") || t.includes("loka");
}

function isFinalExam(dl: Deadline) {
  const t = dl.title.toLowerCase();
  return isExam(dl) && (t.includes("final") || t.includes("lokapróf") || t.includes("loka próf"));
}

function dlSymbol(dl: Deadline) {
  if (isFinalExam(dl)) return "♥";
  if (isExam(dl)) return "★";
  return "●";
}

function fmt(d: Date) { return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`; }

// ─── Main page ───────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const router = useRouter();
  const [allDeadlines, setAllDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"month" | "semester">("month");

  // Monthly calendar state
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const token = localStorage.getItem("canvas_token");
      if (!token) { router.push("/connect-canvas"); return; }
      try {
        const CACHE_KEY = "canvas_deadlines_cache";
        const CACHE_VERSION = 3;
        const CACHE_TTL = 5 * 60 * 1000;
        let canvas: Deadline[] = [];
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const { deadlines: cd, timestamp, v } = JSON.parse(cached);
          if (v === CACHE_VERSION && Date.now() - timestamp < CACHE_TTL) canvas = cd;
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
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ deadlines: canvas, timestamp: Date.now(), v: CACHE_VERSION }));
        }
        setAllDeadlines([...canvas, ...getLocalDeadlines()]);
      } catch { /* show empty */ } finally { setLoading(false); }
    }
    load();
  }, [router]);

  // ── Monthly grid data ──────────────────────────────────────────────────────

  const deadlineMap = useMemo(() => {
    const map = new Map<string, Deadline[]>();
    for (const d of allDeadlines) {
      const key = toDateKey(new Date(d.dueDate));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return map;
  }, [allDeadlines]);

  const { cells, year, month } = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return { cells, year, month };
  }, [currentMonth]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const selectedDeadlines = selectedDate ? (deadlineMap.get(selectedDate) ?? []) : [];

  // ── Semester view data ─────────────────────────────────────────────────────

  const SEMESTER_WEEKS = 12;
  // Semester starts first Monday of January this year
  const SEMESTER_START = useMemo(() => {
    const jan1 = new Date(new Date().getFullYear(), 0, 1);
    const day = jan1.getDay();
    const offset = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
    const d = new Date(jan1); d.setDate(jan1.getDate() + offset); d.setHours(0,0,0,0);
    return d;
  }, []);

  const { weeks, courses, maxCount } = useMemo(() => {
    const weekMap = new Map<string, Deadline[]>();
    const courseSet = new Set<string>();
    for (const dl of allDeadlines.filter(d => new Date(d.dueDate) >= SEMESTER_START)) {
      const key = getMondayKey(new Date(dl.dueDate));
      if (!weekMap.has(key)) weekMap.set(key, []);
      weekMap.get(key)!.push(dl);
      courseSet.add(dl.course);
    }
    const sortedKeys = Array.from(weekMap.keys()).sort();
    const maxCount = Math.max(...Array.from(weekMap.values()).map(v => v.length), 1);
    const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
    return {
      weeks: sortedKeys.map((key) => {
        const monday = new Date(key);
        const sunday = new Date(key); sunday.setDate(sunday.getDate() + 6);
        const weekNum = Math.floor((monday.getTime() - SEMESTER_START.getTime()) / MS_PER_WEEK) + 1;
        return {
          key, weekNum, monday, sunday,
          deadlines: weekMap.get(key)!.sort((a, b) =>
            new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
        };
      }),
      courses: Array.from(courseSet),
      maxCount,
    };
  }, [allDeadlines, SEMESTER_START]);

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />

      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Tabs */}
        <div className="mb-6 flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 w-fit shadow-sm">
          {(["month", "semester"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                tab === t ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {t === "month" ? "Monthly" : "Semester"}
            </button>
          ))}
        </div>

        {/* ── MONTHLY VIEW ── */}
        {tab === "month" && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-extrabold text-slate-900">{MONTHS[month]} {year}</h1>
              <div className="flex gap-2">
                <button
                  onClick={() => { setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1)); setSelectedDate(null); }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >←</button>
                <button
                  onClick={() => { setCurrentMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setSelectedDate(null); }}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >Today</button>
                <button
                  onClick={() => { setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1)); setSelectedDate(null); }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >→</button>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex-1 min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {loading ? (
                  <div className="flex flex-col items-center py-24 text-slate-400">
                    <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-500" />
                    <p className="text-sm">Loading your calendar…</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-7 border-b border-slate-100">
                      {DAYS.map((d) => (
                        <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7">
                      {cells.map((date, i) => {
                        if (!date) return <div key={`empty-${i}`} className="border-b border-r border-slate-100 bg-slate-50/50 min-h-[88px]" />;
                        const key = toDateKey(date);
                        const items = deadlineMap.get(key) ?? [];
                        const isToday = date.getTime() === today.getTime();
                        const isSelected = selectedDate === key;
                        return (
                          <div
                            key={key}
                            onClick={() => setSelectedDate(isSelected ? null : key)}
                            className={`border-b border-r border-slate-100 min-h-[88px] p-2 cursor-pointer transition-colors ${
                              isSelected ? "bg-indigo-50" : "hover:bg-slate-50"
                            } ${date.getMonth() !== month ? "opacity-40" : ""}`}
                          >
                            <div className={`mb-1.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                              isToday ? "bg-indigo-600 text-white" : "text-slate-700"
                            }`}>{date.getDate()}</div>
                            <div className="space-y-0.5">
                              {items.slice(0, 3).map((dl) => (
                                <div key={dl.id} className="flex items-center gap-1 overflow-hidden">
                                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${urgencyColor(dl.dueDate)}`} />
                                  <span className="truncate text-xs text-slate-600">{dl.title}</span>
                                </div>
                              ))}
                              {items.length > 3 && <p className="text-xs text-slate-400">+{items.length - 3} more</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="w-72 shrink-0">
                {selectedDate && selectedDeadlines.length > 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                      {new Date(selectedDate.replace(/(\d+)-(\d+)-(\d+)/, (_, y, m, d) =>
                        `${y}-${String(Number(m) + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
                      )).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                    </p>
                    <div className="space-y-2">
                      {selectedDeadlines.map((dl) => {
                        const daysLeft = getDaysLeft(dl.dueDate);
                        return (
                          <div key={dl.id} className="rounded-xl border border-slate-100 p-3">
                            <div className="flex items-start gap-2">
                              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${urgencyColor(dl.dueDate)}`} />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{dl.course}</p>
                                <p className="mt-0.5 text-sm font-semibold text-slate-800 leading-snug">{dl.title}</p>
                                <p className="mt-1 text-xs text-slate-400">
                                  {daysLeft <= 0 ? "Due today" : daysLeft === 1 ? "Due tomorrow" : `${daysLeft}d left`}
                                </p>
                              </div>
                            </div>
                            {dl.url && (
                              <Link href={dl.url} target="_blank" className="mt-2 block text-xs font-medium text-indigo-600 hover:text-indigo-800">
                                Open in Canvas →
                              </Link>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : selectedDate ? (
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 text-center text-sm text-slate-400">No deadlines on this day.</div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 text-center text-sm text-slate-400">Click a day to see deadlines.</div>
                )}

                <div className="mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Legend</p>
                  <div className="space-y-1.5">
                    {[
                      { color: "bg-red-500", label: "Due within 2 days" },
                      { color: "bg-amber-400", label: "Due this week" },
                      { color: "bg-indigo-400", label: "Upcoming" },
                    ].map(({ color, label }) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${color}`} />
                        <span className="text-xs text-slate-500">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── SEMESTER VIEW ── */}
        {tab === "semester" && (
          <>
            <div className="mb-4 flex items-center gap-6 text-sm text-slate-500">
              <span className="flex items-center gap-1.5 font-medium"><span className="text-base">★</span> Exam</span>
              <span className="flex items-center gap-1.5 font-medium"><span className="text-base">●</span> Assignment</span>
              <span className="flex items-center gap-1.5 font-medium"><span className="text-base text-rose-500">♥</span> Final exam</span>
            </div>

            {loading ? (
              <div className="flex flex-col items-center py-24 text-slate-400">
                <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-500" />
                <p className="text-sm">Loading your calendar…</p>
              </div>
            ) : weeks.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">No deadlines found.</div>
            ) : (
              <div className="space-y-2">
                {/* Semester weeks */}
                {weeks.filter(w => w.weekNum <= SEMESTER_WEEKS).length > 0 && (
                  <div className="space-y-2">
                    {weeks.filter(w => w.weekNum <= SEMESTER_WEEKS).map(({ key, weekNum, monday, sunday, deadlines }) => {
                      const pct = Math.round((deadlines.length / maxCount) * 100);
                      const barColor = deadlines.length >= 6 ? "bg-red-400" : deadlines.length >= 3 ? "bg-amber-400" : "bg-emerald-400";
                      return (
                        <div key={key} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                          <div className="w-24 shrink-0">
                            <p className="text-sm font-bold text-slate-900">Week {weekNum}</p>
                            <p className="text-xs text-slate-400">{fmt(monday)} – {fmt(sunday)}</p>
                          </div>
                          <div className="flex flex-1 flex-wrap gap-1.5 min-w-0">
                            {deadlines.map((dl) => {
                              const c = COURSE_COLORS[courseColorIndex(dl.course)];
                              const final = isFinalExam(dl);
                              return (
                                <div
                                  key={dl.id}
                                  title={`${dl.course}: ${dl.title}`}
                                  className={`flex h-8 w-8 shrink-0 cursor-default select-none items-center justify-center rounded-full border text-sm font-bold ${c.light} ${c.border} ${final ? "text-rose-500" : c.text}`}
                                >
                                  {dlSymbol(dl)}
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex w-48 shrink-0 items-center gap-2">
                            <div className="flex-1 h-3 overflow-hidden rounded-full bg-slate-100">
                              <div className={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="w-5 text-right text-xs font-bold text-slate-400">{deadlines.length}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Finals period divider + remaining weeks */}
                {weeks.filter(w => w.weekNum > SEMESTER_WEEKS).map(({ key, weekNum, monday, sunday, deadlines }) => {
                  const pct = Math.round((deadlines.length / maxCount) * 100);
                  const barColor = deadlines.length >= 6 ? "bg-red-400" : deadlines.length >= 3 ? "bg-amber-400" : "bg-emerald-400";
                  return (
                    <div key={key}>
                      {weekNum === SEMESTER_WEEKS + 1 && (
                        <div className="my-4 flex items-center gap-3">
                          <div className="h-px flex-1 bg-slate-200" />
                          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Finals Period</span>
                          <div className="h-px flex-1 bg-slate-200" />
                        </div>
                      )}
                      <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                        <div className="w-24 shrink-0">
                          <p className="text-sm font-bold text-slate-900">Week {weekNum}</p>
                          <p className="text-xs text-slate-400">{fmt(monday)} – {fmt(sunday)}</p>
                        </div>
                        <div className="flex flex-1 flex-wrap gap-1.5 min-w-0">
                          {deadlines.map((dl) => {
                            const c = COURSE_COLORS[courseColorIndex(dl.course)];
                            const final = isFinalExam(dl);
                            return (
                              <div
                                key={dl.id}
                                title={`${dl.course}: ${dl.title}`}
                                className={`flex h-8 w-8 shrink-0 cursor-default select-none items-center justify-center rounded-full border text-sm font-bold ${c.light} ${c.border} ${final ? "text-rose-500" : c.text}`}
                              >
                                {dlSymbol(dl)}
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex w-48 shrink-0 items-center gap-2">
                          <div className="flex-1 h-3 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-5 text-right text-xs font-bold text-slate-400">{deadlines.length}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Course key */}
            {courses.length > 0 && (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Courses</p>
                <div className="flex flex-wrap gap-2">
                  {courses.map((course) => {
                    const c = COURSE_COLORS[courseColorIndex(course)];
                    return (
                      <span key={course} className={`rounded-full border px-3 py-1 text-xs font-semibold ${c.light} ${c.text} ${c.border}`}>
                        {course}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
