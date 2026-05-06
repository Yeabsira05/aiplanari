"use client";

import { useEffect, useRef, useState } from "react";
import { getDaysLeft, getUrgency } from "@/lib/dates";
import type { Deadline } from "@/lib/types";

type Props = { deadline: Deadline; onDone: (id: string) => void };
type Summary = { tldr: string; bullets: string[] };
type SubmissionTab = "online_upload" | "online_text_entry" | "online_url";

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

const TAB_LABEL: Record<SubmissionTab, string> = {
  online_upload: "File",
  online_text_entry: "Text",
  online_url: "URL",
};

// Canvas assignments have composite IDs like "courseId-assignmentId"
function parseCanvasId(id: string): { courseId: string; assignmentId: string } | null {
  const parts = id.split("-");
  if (parts.length !== 2) return null;
  return { courseId: parts[0], assignmentId: parts[1] };
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export default function DeadlineCard({ deadline, onDone }: Props) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Submit modal
  const [submitOpen, setSubmitOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [submissionTypes, setSubmissionTypes] = useState<SubmissionTab[]>([]);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SubmissionTab>("online_upload");
  const [submitFile, setSubmitFile] = useState<File | null>(null);
  const [submitText, setSubmitText] = useState("");
  const [submitUrl, setSubmitUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const days = getDaysLeft(deadline.dueDate);
  const urgency = getUrgency(days);
  const barColor = URGENCY_BAR[urgency] ?? "bg-slate-300";
  const badgeStyle = URGENCY_BADGE[urgency] ?? "bg-slate-50 text-slate-600 border-slate-200";
  const daysLabel =
    days < 0  ? `${Math.abs(days)}d overdue` :
    days === 0 ? "Due today" :
    days === 1 ? "1 day left" :
    `${days} days left`;

  const canvasIds = parseCanvasId(deadline.id);
  const onlineTypes: SubmissionTab[] = ["online_upload", "online_text_entry", "online_url", "media_recording" as SubmissionTab];
  const isSubmittable =
    !!canvasIds &&
    deadline.type === "assignment" &&
    (
      // undefined means old cached data — show the button and let the modal decide
      deadline.submissionTypes === undefined ||
      deadline.submissionTypes.some((t) => onlineTypes.includes(t as SubmissionTab))
    );

  useEffect(() => {
    if (!submitOpen || !isSubmittable || !canvasIds) return;
    setLoadingDetails(true);
    setSubmitError("");
    const token = localStorage.getItem("canvas_token") ?? "";
    fetch("/api/canvas/assignment-details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, courseId: canvasIds.courseId, assignmentId: canvasIds.assignmentId }),
    })
      .then((r) => r.json())
      .then((data) => {
        const types = (data.submissionTypes ?? []).filter((t: string) =>
          ["online_upload", "online_text_entry", "online_url"].includes(t)
        ) as SubmissionTab[];
        setSubmissionTypes(types);
        setActiveTab(types[0] ?? "online_upload");
        setAlreadySubmitted(data.alreadySubmitted ?? false);
        setSubmittedAt(data.submittedAt ?? null);
      })
      .catch(() => setSubmitError("Could not load assignment details."))
      .finally(() => setLoadingDetails(false));
  }, [submitOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit() {
    if (!canvasIds) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const token = localStorage.getItem("canvas_token") ?? "";
      const fd = new FormData();
      fd.append("token", token);
      fd.append("courseId", canvasIds.courseId);
      fd.append("assignmentId", canvasIds.assignmentId);
      fd.append("submissionType", activeTab);
      if (activeTab === "online_upload" && submitFile) fd.append("file", submitFile);
      if (activeTab === "online_text_entry") fd.append("text", submitText);
      if (activeTab === "online_url") fd.append("url", submitUrl);

      const res = await fetch("/api/canvas/submit", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error ?? "Submission failed."); return; }

      setSubmitSuccess(`Submitted${data.submittedAt ? ` at ${formatDateTime(data.submittedAt)}` : ""}!`);
      setAlreadySubmitted(true);
      setSubmittedAt(data.submittedAt ?? null);
    } finally {
      setSubmitting(false);
    }
  }

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

  const canSubmitNow =
    (activeTab === "online_upload" && !!submitFile) ||
    (activeTab === "online_text_entry" && !!submitText.trim()) ||
    (activeTab === "online_url" && !!submitUrl.trim());

  return (
    <>
      <div className="flex overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
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

            {isSubmittable && (
              <button
                onClick={() => { setSubmitOpen(true); setSubmitSuccess(""); setSubmitError(""); }}
                className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors"
              >
                {alreadySubmitted ? "Resubmit" : "Submit →"}
              </button>
            )}

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

          {alreadySubmitted && submittedAt && !submitOpen && (
            <p className="mt-2 text-xs text-emerald-600 font-medium">
              ✓ Submitted {formatDateTime(submittedAt)}
            </p>
          )}

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

      {/* Submit modal */}
      {submitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSubmitOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl">
            {/* Modal header */}
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{deadline.course}</p>
                <h2 className="mt-0.5 font-bold text-slate-900 leading-snug">{deadline.title}</h2>
              </div>
              <button onClick={() => setSubmitOpen(false)} className="ml-4 shrink-0 text-slate-300 hover:text-slate-600 transition-colors text-lg">✕</button>
            </div>

            <div className="px-6 py-5">
              {loadingDetails ? (
                <div className="flex items-center justify-center gap-3 py-10 text-slate-400">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
                  <span className="text-sm">Loading assignment…</span>
                </div>
              ) : submissionTypes.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  This assignment doesn&apos;t allow online submission.
                </p>
              ) : (
                <>
                  {alreadySubmitted && submittedAt && !submitSuccess && (
                    <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      ✓ Already submitted on {formatDateTime(submittedAt)}
                    </div>
                  )}

                  {/* Type tabs */}
                  {submissionTypes.length > 1 && (
                    <div className="mb-5 flex gap-2">
                      {submissionTypes.map((t) => (
                        <button
                          key={t}
                          onClick={() => setActiveTab(t)}
                          className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                            activeTab === t
                              ? "bg-slate-900 text-white"
                              : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {TAB_LABEL[t]}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* File upload */}
                  {activeTab === "online_upload" && (
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) setSubmitFile(f); }}
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-colors ${
                        dragOver ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) setSubmitFile(f); }}
                      />
                      {submitFile ? (
                        <div className="text-center">
                          <p className="font-semibold text-slate-900">{submitFile.name}</p>
                          <p className="mt-0.5 text-sm text-slate-400">{(submitFile.size / 1024).toFixed(0)} KB</p>
                          <button onClick={(e) => { e.stopPropagation(); setSubmitFile(null); }} className="mt-2 text-xs text-red-400 hover:text-red-600">Remove</button>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-slate-500">Drop your file here or click to browse</p>
                          <p className="mt-1 text-xs text-slate-400">Any file type accepted</p>
                        </>
                      )}
                    </div>
                  )}

                  {/* Text entry */}
                  {activeTab === "online_text_entry" && (
                    <textarea
                      value={submitText}
                      onChange={(e) => setSubmitText(e.target.value)}
                      rows={8}
                      placeholder="Write your submission here…"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-none"
                    />
                  )}

                  {/* URL */}
                  {activeTab === "online_url" && (
                    <input
                      type="url"
                      value={submitUrl}
                      onChange={(e) => setSubmitUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                  )}

                  {submitError && (
                    <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{submitError}</p>
                  )}
                  {submitSuccess && (
                    <p className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">✓ {submitSuccess}</p>
                  )}

                  <div className="mt-5 flex gap-3">
                    <button
                      onClick={() => setSubmitOpen(false)}
                      className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting || !canSubmitNow}
                      className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {submitting ? "Submitting…" : alreadySubmitted ? "Resubmit" : "Submit →"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
