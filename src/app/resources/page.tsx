"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import type { Deadline } from "@/lib/types";

type ResourceType = "exam" | "assignment" | "notes" | "other";

type Resource = {
  id: string;
  uploader_name: string;
  course_name: string;
  title: string;
  type: ResourceType;
  file_url: string;
  file_name: string;
  file_size: number;
  description: string;
  created_at: string;
};

type Course = { id: number; name: string; isCurrent: boolean };

const TYPE_STYLE: Record<ResourceType, string> = {
  exam:       "bg-red-50 text-red-600 border-red-100",
  assignment: "bg-indigo-50 text-indigo-600 border-indigo-100",
  notes:      "bg-emerald-50 text-emerald-600 border-emerald-100",
  other:      "bg-slate-100 text-slate-600 border-slate-200",
};
const TYPE_BAR: Record<ResourceType, string> = {
  exam:       "bg-red-400",
  assignment: "bg-indigo-400",
  notes:      "bg-emerald-400",
  other:      "bg-slate-300",
};
const TYPE_LABELS: ResourceType[] = ["exam", "assignment", "notes", "other"];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Recommendation score: higher = more relevant to upcoming work
function scoreResource(resource: Resource, deadlines: Deadline[]): number {
  const now = Date.now();
  let score = 0;
  const matching = deadlines.filter((d) => {
    const rCourse = resource.course_name.toLowerCase();
    const dCourse = d.course.toLowerCase();
    return rCourse.includes(dCourse) || dCourse.includes(rCourse);
  });
  if (matching.length) {
    score += 3;
    const soonest = Math.min(
      ...matching.map((d) => Math.ceil((new Date(d.dueDate).getTime() - now) / 86400000))
    );
    if (soonest <= 2) score += 4;
    else if (soonest <= 7) score += 2;
    const hasExam = matching.some((d) => d.type === "exam");
    if (hasExam && resource.type === "exam") score += 3;
  }
  const ageHours = (now - new Date(resource.created_at).getTime()) / 3600000;
  if (ageHours < 24) score += 2;
  else if (ageHours < 168) score += 1;
  return score;
}

export default function ResourcesPage() {
  const router = useRouter();

  const [courses, setCourses] = useState<Course[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Upload form state
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [type, setType] = useState<ResourceType>("notes");
  const [description, setDescription] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Browse filter state
  const [filterCourse, setFilterCourse] = useState("All");
  const [filterType, setFilterType] = useState<ResourceType | "all">("all");

  useEffect(() => {
    async function load() {
      const token = localStorage.getItem("canvas_token");
      if (!token) { router.push("/connect-canvas"); return; }

      // Load deadlines for recommendation scoring
      const cached = sessionStorage.getItem("canvas_deadlines_cache");
      if (cached) {
        const { deadlines: cd } = JSON.parse(cached);
        setDeadlines(cd ?? []);
      }

      try {
        // Fetch courses for upload dropdown
        const coursesRes = await fetch("/api/canvas/courses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const coursesData = await coursesRes.json();
        const courseList: Course[] = coursesData.courses ?? [];
        setCourses(courseList);
        if (courseList.length) setSelectedCourse(courseList[0].name);

        // Fetch resources for those courses
        const courseNames = courseList.map((c) => c.name);
        if (courseNames.length) {
          const resRes = await fetch("/api/resources/list", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ courses: courseNames }),
          });
          const resData = await resRes.json();
          setResources(resData.resources ?? []);
        }
      } catch {
        setError("Failed to load resources.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) {
      setFile(dropped);
      if (!title) setTitle(dropped.name.replace(/\.[^.]+$/, ""));
    }
  }, [title]);

  async function handleUpload() {
    if (!file || !title.trim() || !selectedCourse) return;
    setUploading(true);
    setUploadError("");
    try {
      const uploaderName = localStorage.getItem("student_name") || "Anonymous";
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title.trim());
      fd.append("courseName", selectedCourse);
      fd.append("type", type);
      fd.append("uploaderName", uploaderName);
      fd.append("description", description.trim());

      const res = await fetch("/api/resources/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.error ?? "Upload failed."); return; }

      setResources((prev) => [data.resource, ...prev]);
      setUploadSuccess("Resource uploaded successfully!");
      setFile(null);
      setTitle("");
      setDescription("");
      setShowUpload(false);
      setTimeout(() => setUploadSuccess(""), 4000);
    } finally {
      setUploading(false);
    }
  }

  const displayed = resources
    .filter((r) => {
      if (filterCourse !== "All" && r.course_name !== filterCourse) return false;
      if (filterType !== "all" && r.type !== filterType) return false;
      return true;
    })
    .map((r) => ({ ...r, score: scoreResource(r, deadlines) }))
    .sort((a, b) => b.score - a.score || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const coursesInResources = [...new Set(resources.map((r) => r.course_name))].sort();

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <div className="mx-auto max-w-4xl px-6 py-8">

        {/* Page header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Resources</h1>
            <p className="mt-1 text-sm text-slate-500">
              Study materials shared by students in your classes.
            </p>
          </div>
          <button
            onClick={() => { setShowUpload((v) => !v); setUploadError(""); }}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            {showUpload ? "Cancel" : "+ Upload"}
          </button>
        </div>

        {/* Upload form */}
        {showUpload && (
          <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 font-bold text-slate-900">Upload a resource</h2>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`mb-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-colors ${
                dragOver ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { setFile(f); if (!title) setTitle(f.name.replace(/\.[^.]+$/, "")); }
                }}
              />
              {file ? (
                <div className="text-center">
                  <p className="font-semibold text-slate-900">{file.name}</p>
                  <p className="mt-0.5 text-sm text-slate-400">{formatBytes(file.size)}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="mt-2 text-xs text-red-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-500">Drop a file here or click to browse</p>
                  <p className="mt-1 text-xs text-slate-400">PDF, Word, PowerPoint, images · max 20 MB</p>
                </>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Midterm 2023 with solutions"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Course</label>
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  {courses.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {/* Type selector */}
            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">Type</label>
              <div className="flex gap-2">
                {TYPE_LABELS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`rounded-xl border px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                      type === t ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Description <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="e.g. Covers chapters 3–6, includes worked solutions"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-none"
              />
            </div>

            {uploadError && (
              <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{uploadError}</p>
            )}

            <button
              onClick={handleUpload}
              disabled={uploading || !file || !title.trim() || !selectedCourse}
              className="mt-5 w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {uploading ? "Uploading…" : "Upload resource"}
            </button>
          </div>
        )}

        {uploadSuccess && (
          <div className="mb-6 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {uploadSuccess}
          </div>
        )}

        {/* Filters */}
        {!loading && resources.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-2">
            <select
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 outline-none hover:bg-slate-50"
            >
              <option value="All">All courses</option>
              {coursesInResources.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {(["all", ...TYPE_LABELS] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`rounded-xl px-4 py-2 text-sm font-medium capitalize transition-colors ${
                  filterType === t
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {t === "all" ? "All types" : t}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center py-24 text-slate-400">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-500" />
            <p className="text-sm">Loading resources…</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
        )}

        {/* Empty state */}
        {!loading && !error && displayed.length === 0 && (
          <div className="flex flex-col items-center py-24 text-slate-400">
            <p className="text-4xl">📚</p>
            <p className="mt-3 font-semibold text-slate-600">No resources yet.</p>
            <p className="mt-1 text-sm">Be the first to upload one for your class.</p>
          </div>
        )}

        {/* Resource cards */}
        <div className="space-y-3">
          {displayed.map((r) => (
            <div key={r.id} className="flex overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
              <div className={`w-1 shrink-0 ${TYPE_BAR[r.type] ?? TYPE_BAR.other}`} />
              <div className="flex-1 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{r.course_name}</p>
                      {r.score >= 5 && (
                        <span className="rounded-full bg-amber-50 border border-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-600">
                          ✦ Recommended
                        </span>
                      )}
                    </div>
                    <h3 className="mt-0.5 font-bold leading-snug text-slate-900">{r.title}</h3>
                    {r.description && (
                      <p className="mt-0.5 text-sm text-slate-500">{r.description}</p>
                    )}
                    <p className="mt-1.5 text-xs text-slate-400">
                      {r.uploader_name} · {relativeDate(r.created_at)} · {formatBytes(r.file_size)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${TYPE_STYLE[r.type] ?? TYPE_STYLE.other}`}>
                    {r.type}
                  </span>
                </div>
                <div className="mt-4">
                  <a
                    href={r.file_url}
                    target="_blank"
                    rel="noreferrer"
                    download={r.file_name}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    Download {r.file_name?.split(".").pop()?.toUpperCase()}
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
