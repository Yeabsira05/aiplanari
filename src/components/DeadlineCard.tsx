"use client";

import { useState } from "react";
import { getDaysLeft, getUrgency } from "@/lib/dates";
import type { Deadline } from "@/lib/types";

type Props = { deadline: Deadline; onDone: (id: string) => void };
type Summary = { tldr: string; bullets: string[] };

const URGENCY_BAR: Record<string, string> = {
  Overdue: "bg-red-500",
  Urgent:  "bg-red-400",
  Soon:    "bg-amber-400",
  Upcoming:"bg-emerald-400",
};
const URGENCY_BADGE: Record<string, string> = {
  Overdue: "bg-red-50 text-red-600 border-red-100",
  Urgent:  "bg-red-50 text-red-600 border-red-100",
  Soon:    "bg-amber-50 text-amber-600 border-amber-100",
  Upcoming:"bg-emerald-50 text-emerald-600 border-emerald-100",
};

export default function DeadlineCard({ deadline, onDone }: Props) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const days = getDaysLeft(deadline.dueDate);
  const urgency = getUrgency(days);

  const barColor = URGENCY_BAR[urgency] ?? "bg-slate-300";
  const badgeStyle = URGENCY_BADGE[urgency] ?? "bg-slate-50 text-slate-600 border-slate-200";

  const daysLabel =
    days < 0  ? `${Math.abs(days)}d overdue` :
    days === 0 ? "Due today" :
    days === 1 ? "1 day left" :
    `${days} days left`;

  async function handleSummarize() {
    if (summary) { setExpanded((e) => !e); return; }
    if (!deadline.description) return;
    setSummarizing(true);
    try {

      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: deadline.title, course: deadline.course, description: deadline.description }),
      });
      const data = await res.json();
      if (res.ok && data.tldr) { setSummary(data); setExpanded(true); }
    } finally {
      setSummarizing(false);
    }
  }

  return (
    <div className="flex overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Urgency accent bar */}
      <div className={`w-1 shrink-0 ${barColor}`} />

      <div className="flex-1 p-5">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {deadline.course}
            </p>
            <h3 className="mt-0.5 text-base font-bold leading-snug text-slate-900">
              {deadline.title}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {new Date(deadline.dueDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              {" · "}
              <span className={days <= 2 ? "font-semibold text-red-600" : days <= 7 ? "font-semibold text-amber-600" : "text-slate-500"}>
                {daysLabel}
              </span>
            </p>
            {deadline.urgencyScore !== undefined && (
              <p className="mt-1 text-xs text-indigo-600">
                AI {deadline.urgencyScore}/10{deadline.aiReason ? ` — ${deadline.aiReason}` : ""}
              </p>
            )}
          </div>

          <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeStyle}`}>
            {urgency}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1 rounded-full bg-slate-100">
          <div
            className={`h-1 rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.max(4, Math.min(100, 100 - days * 6))}%` }}
          />
        </div>

        {/* Study tip */}
        {deadline.aiStudyTip && (
          <p className="mt-2 text-xs italic text-slate-400">{deadline.aiStudyTip}</p>
        )}

        {/* Actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => onDone(deadline.id)}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition-colors"
          >
            Mark done
          </button>

          {deadline.url && (
            <a
              href={deadline.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Open in Canvas →
            </a>
          )}

          {deadline.description && (
            <button
              onClick={handleSummarize}
              disabled={summarizing}
              className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
            >
              {summarizing ? "Summarizing…" : summary ? (expanded ? "Hide summary" : "Show summary") : "✦ Summarize"}
            </button>
          )}
        </div>

        {/* AI summary */}
        {expanded && summary && (
          <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
            <p className="text-sm font-semibold italic text-indigo-900">{summary.tldr}</p>
            <ul className="mt-2 space-y-1">
              {summary.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-indigo-800">
                  <span className="mt-0.5 text-indigo-400">•</span>{b}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
