"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { getLocalDeadlines } from "@/lib/localDeadlines";
import { getDaysLeft } from "@/lib/dates";
import type { Deadline } from "@/lib/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function urgencyColor(dueDate: string) {
  const d = getDaysLeft(dueDate);
  if (d <= 2) return "bg-red-500";
  if (d <= 7) return "bg-amber-400";
  return "bg-indigo-400";
}

export default function CalendarPage() {
  const router = useRouter();
  const [allDeadlines, setAllDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const token = localStorage.getItem("canvas_token");
      if (!token) { router.push("/connect-canvas"); return; }

      try {
        const CACHE_KEY = "canvas_deadlines_cache";
        const CACHE_VERSION = 2;
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

        const local = getLocalDeadlines();
        setAllDeadlines([...canvas, ...local]);
      } catch {
        // show empty calendar on error
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  // Group deadlines by "YYYY-M-D" key
  const deadlineMap = useMemo(() => {
    const map = new Map<string, Deadline[]>();
    for (const d of allDeadlines) {
      const date = new Date(d.dueDate);
      const key = toDateKey(date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return map;
  }, [allDeadlines]);

  // Build the grid: days from Monday of the first week to Sunday of the last
  const { cells, year, month } = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    // pad to full weeks
    while (cells.length % 7 !== 0) cells.push(null);

    return { cells, year, month };
  }, [currentMonth]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selectedDeadlines = selectedDate ? (deadlineMap.get(selectedDate) ?? []) : [];

  function prevMonth() {
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
    setSelectedDate(null);
  }
  function nextMonth() {
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
    setSelectedDate(null);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />

      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-extrabold text-slate-900">
            {MONTHS[month]} {year}
          </h1>
          <div className="flex gap-2">
            <button
              onClick={prevMonth}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              ←
            </button>
            <button
              onClick={() => { setCurrentMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setSelectedDate(null); }}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Today
            </button>
            <button
              onClick={nextMonth}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              →
            </button>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Calendar grid */}
          <div className="flex-1 min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center py-24 text-slate-400">
                <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-500" />
                <p className="text-sm">Loading your calendar…</p>
              </div>
            ) : (
              <>
                {/* Day headers */}
                <div className="grid grid-cols-7 border-b border-slate-100">
                  {DAYS.map((d) => (
                    <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7">
                  {cells.map((date, i) => {
                    if (!date) {
                      return <div key={`empty-${i}`} className="border-b border-r border-slate-100 bg-slate-50/50 min-h-[88px]" />;
                    }
                    const key = toDateKey(date);
                    const items = deadlineMap.get(key) ?? [];
                    const isToday = date.getTime() === today.getTime();
                    const isSelected = selectedDate === key;
                    const isCurrentMonth = date.getMonth() === month;

                    return (
                      <div
                        key={key}
                        onClick={() => setSelectedDate(isSelected ? null : key)}
                        className={`border-b border-r border-slate-100 min-h-[88px] p-2 cursor-pointer transition-colors ${
                          isSelected ? "bg-indigo-50" : "hover:bg-slate-50"
                        } ${!isCurrentMonth ? "opacity-40" : ""}`}
                      >
                        <div className={`mb-1.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                          isToday ? "bg-indigo-600 text-white" : "text-slate-700"
                        }`}>
                          {date.getDate()}
                        </div>

                        <div className="space-y-0.5">
                          {items.slice(0, 3).map((dl) => (
                            <div
                              key={dl.id}
                              className="flex items-center gap-1 overflow-hidden"
                            >
                              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${urgencyColor(dl.dueDate)}`} />
                              <span className="truncate text-xs text-slate-600">{dl.title}</span>
                            </div>
                          ))}
                          {items.length > 3 && (
                            <p className="text-xs text-slate-400">+{items.length - 3} more</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Side panel */}
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
                          <Link
                            href={dl.url}
                            target="_blank"
                            className="mt-2 block text-xs font-medium text-indigo-600 hover:text-indigo-800"
                          >
                            Open in Canvas →
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : selectedDate ? (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 text-center text-sm text-slate-400">
                No deadlines on this day.
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 text-center text-sm text-slate-400">
                Click a day to see deadlines.
              </div>
            )}

            {/* Legend */}
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
      </div>
    </div>
  );
}
