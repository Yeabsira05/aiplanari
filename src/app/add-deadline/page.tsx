"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getLocalDeadlines, saveLocalDeadlines } from "@/lib/localDeadlines";

export default function AddDeadlinePage() {
  const [course, setCourse] = useState("");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");

  const router = useRouter();

  function handleAdd() {
    if (!course || !title || !dueDate) {
      alert("Fill all fields");
      return;
    }

    const newDeadline = {
      id: Date.now().toString(),
      course,
      title,
      dueDate,
      type: "exam" as const,
    };

    const existing = getLocalDeadlines();
    saveLocalDeadlines([...existing, newDeadline]);

    router.push("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold">Add Exam/Test</h1>

        <input
          placeholder="Course"
          value={course}
          onChange={(e) => setCourse(e.target.value)}
          className="mt-4 w-full border px-3 py-2 rounded"
        />

        <input
          placeholder="Title (e.g. Final Exam)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-4 w-full border px-3 py-2 rounded"
        />

        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="mt-4 w-full border px-3 py-2 rounded"
        />

        <button
          onClick={handleAdd}
          className="mt-4 w-full bg-black text-white py-2 rounded"
        >
          Add
        </button>
      </div>
    </main>
  );
}