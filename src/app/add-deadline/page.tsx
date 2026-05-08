"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getLocalDeadlines, saveLocalDeadlines } from "@/lib/localDeadlines";

export default function AddDeadlinePage() {
  const router = useRouter();
  const [course, setCourse] = useState("");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");

  function handleAdd() {
    if (!course.trim() || !title.trim() || !dueDate) {
      alert("Please fill in all fields.");
      return;
    }
    const existing = getLocalDeadlines();
    saveLocalDeadlines([
      ...existing,
      { id: Date.now().toString(), course: course.trim(), title: title.trim(), dueDate, type: "exam" },
    ]);
    router.push("/dashboard");
  }

  const inputClass =
    "w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-6 py-3 flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Planari" style={{ height: 32, width: "auto" }} />
        <Link href="/dashboard" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
          ← Dashboard
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Course</label>
            <input value={course} onChange={(e) => setCourse(e.target.value)} placeholder="e.g. Linear Algebra" className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Final Exam" className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Due date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
          </div>
          <button
            onClick={handleAdd}
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            Add to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
