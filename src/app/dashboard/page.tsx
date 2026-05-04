"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import DeadlineCard from "@/components/DeadlineCard";
import { getLocalDeadlines } from "@/lib/localDeadlines";

type Deadline = {
  id: string;
  course: string;
  title: string;
  dueDate: string;
  type: "assignment" | "exam";
};

export default function DashboardPage() {
  const router = useRouter();

  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [filter, setFilter] = useState<
    "all" | "assignment" | "exam" | "urgent"
  >("all");

  const [plan, setPlan] = useState("");
  const [generatingPlan, setGeneratingPlan] = useState(false);

  useEffect(() => {
    async function fetchCanvasDeadlines() {
      const token = localStorage.getItem("canvas_token");

      if (!token) {
        router.push("/connect-canvas");
        return;
      }

      try {
        const res = await fetch("/api/canvas/deadlines", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch deadlines");
        }

        const local = getLocalDeadlines();

        const doneIds = JSON.parse(
          localStorage.getItem("done_deadlines") || "[]"
        );

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const allDeadlines = [...data.deadlines, ...local];

        const filtered = allDeadlines.filter((deadline) => {
          const dueDate = new Date(deadline.dueDate);
          dueDate.setHours(0, 0, 0, 0);

          return dueDate >= today && !doneIds.includes(deadline.id);
        });

        setDeadlines(filtered);
      } catch (err) {
        setError("Could not load Canvas deadlines. Check your token.");
      } finally {
        setLoading(false);
      }
    }

    fetchCanvasDeadlines();
  }, [router]);

  function handleDisconnect() {
    localStorage.removeItem("canvas_token");
    router.push("/connect-canvas");
  }

  function handleDone(id: string) {
    const doneIds = JSON.parse(localStorage.getItem("done_deadlines") || "[]");

    localStorage.setItem("done_deadlines", JSON.stringify([...doneIds, id]));

    setDeadlines((prev) => prev.filter((deadline) => deadline.id !== id));

    setSuccess("Well done! Deadline completed 🎉");

    setTimeout(() => {
      setSuccess("");
    }, 3000);
  }

  const filteredDeadlines = deadlines.filter((deadline) => {
    const daysLeft = Math.ceil(
      (new Date(deadline.dueDate).getTime() - new Date().getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (filter === "assignment") return deadline.type === "assignment";
    if (filter === "exam") return deadline.type === "exam";
    if (filter === "urgent") return daysLeft <= 7;

    return true;
  });

  const sortedDeadlines = [...filteredDeadlines].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );

  async function handleGenerateStudyPlan() {
    if (sortedDeadlines.length === 0) {
      alert("No deadlines to generate a study plan from.");
      return;
    }

    setGeneratingPlan(true);
    setPlan("");

    try {
      const res = await fetch("/api/study-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deadlines: sortedDeadlines }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate study plan");
      }

      setPlan(data.plan);
    } catch (err) {
      alert("Could not generate study plan.");
    } finally {
      setGeneratingPlan(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-extrabold text-gray-900">
                Dashboard
              </h1>

              <p className="mt-2 text-gray-600">
                Your upcoming Canvas deadlines and AI study alerts.
              </p>
            </div>

            <div className="flex gap-2">
              <Link
                href="/add-deadline"
                className="rounded-xl bg-black px-4 py-2 font-semibold text-white hover:bg-gray-800"
              >
                + Add Exam
              </Link>

              <button
                onClick={handleDisconnect}
                className="rounded-xl border px-4 py-2 font-semibold text-gray-700 hover:bg-gray-100"
              >
                Disconnect
              </button>
            </div>
          </div>

          {/* FILTERS */}
          <div className="mt-6 flex flex-wrap gap-2">
            {[
              { label: "All", value: "all" },
              { label: "Assignments", value: "assignment" },
              { label: "Exams / Tests", value: "exam" },
              { label: "Urgent", value: "urgent" },
            ].map((item) => (
              <button
                key={item.value}
                onClick={() => setFilter(item.value as typeof filter)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  filter === item.value
                    ? "bg-black text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* AI BUTTON (only after loading) */}
          {!loading && (
            <button
              onClick={handleGenerateStudyPlan}
              disabled={generatingPlan || sortedDeadlines.length === 0}
              className="mt-6 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {generatingPlan
                ? "Generating study plan..."
                : "Generate AI Study Plan"}
            </button>
          )}

          {/* AI RESULT */}
          {plan && (
            <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <h2 className="text-xl font-bold text-gray-900">
                AI Study Plan
              </h2>

              <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                {plan}
              </pre>
            </div>
          )}

          {success && (
            <div className="mt-6 rounded-xl bg-green-100 px-4 py-3 font-semibold text-green-800">
              {success}
            </div>
          )}

          {loading && (
            <p className="mt-8 text-gray-600">Loading Canvas data...</p>
          )}

          {error && <p className="mt-8 text-red-600">{error}</p>}

          {!loading && !error && sortedDeadlines.length === 0 && (
            <p className="mt-8 rounded-xl bg-gray-100 p-4 text-gray-600">
              No deadlines found.
            </p>
          )}

          <section className="mt-8 grid gap-4">
            {sortedDeadlines.map((deadline) => (
              <DeadlineCard
                key={deadline.id}
                deadline={deadline}
                onDone={handleDone}
              />
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}