"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";

// ─── Types ───────────────────────────────────────────────────────────────────

type Course = { id: number; name: string; isCurrent: boolean };
type ModuleItem = { id: number; title: string; type: string; htmlUrl: string | null; apiUrl: string | null };
type Module = { id: number; name: string; position: number; items: ModuleItem[] };
type Question = { question: string; options: string[]; correct: number; explanation: string; topic?: string };

type QuizState = {
  course: Course; module: Module; questions: Question[];
  current: number; selected: number | null; answers: (number | null)[];
  revealed: boolean; done: boolean;
};
type ExamState = {
  course: Course; questions: Question[];
  answers: (number | null)[]; submitted: boolean;
};

// ─── Progress store ──────────────────────────────────────────────────────────

type ModProg = { score: number; attempts: number; lastDate: string };

function loadProg(cid: number, mid: number): ModProg | null {
  try { return JSON.parse(localStorage.getItem(`mp_${cid}_${mid}`) ?? "null"); } catch { return null; }
}

function saveProg(cid: number, mid: number, score: number) {
  const prev = loadProg(cid, mid);
  localStorage.setItem(`mp_${cid}_${mid}`, JSON.stringify({
    score: Math.max(score, prev?.score ?? 0),
    attempts: (prev?.attempts ?? 0) + 1,
    lastDate: new Date().toISOString(),
  }));
}

function courseAvg(cid: number, mods: Module[]): number | null {
  if (!mods.length) return null;
  return Math.round(mods.reduce((s, m) => s + (loadProg(cid, m.id)?.score ?? 0), 0) / mods.length);
}

// ─── Proficiency levels ───────────────────────────────────────────────────────

type ProfInfo = { label: string; text: string; bar: string; border: string };

function profInfo(score: number | null | undefined): ProfInfo {
  if (!score) return { label: "Not started", text: "text-slate-400", bar: "bg-slate-200", border: "border-slate-200" };
  if (score >= 85) return { label: "Mastered", text: "text-emerald-600", bar: "bg-emerald-500", border: "border-emerald-400" };
  if (score >= 70) return { label: "Proficient", text: "text-indigo-600", bar: "bg-indigo-500", border: "border-indigo-400" };
  if (score >= 50) return { label: "Familiar", text: "text-amber-600", bar: "bg-amber-400", border: "border-amber-300" };
  return { label: "Needs practice", text: "text-red-500", bar: "bg-red-400", border: "border-red-300" };
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProgressPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [modMap, setModMap] = useState<Record<number, Module[]>>({});
  const [loadingMods, setLoadingMods] = useState<number | null>(null);
  const [genQuiz, setGenQuiz] = useState<number | null>(null);
  const [genExam, setGenExam] = useState<number | null>(null);
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [exam, setExam] = useState<ExamState | null>(null);
  const [rev, setRev] = useState(0); // bump after saving progress to re-read localStorage

  useEffect(() => {
    const token = localStorage.getItem("canvas_token");
    if (!token) { router.push("/connect-canvas"); return; }
    fetch("/api/canvas/courses", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).then(r => r.json()).then(d => {
      if (d.courses) setCourses(d.courses);
    }).finally(() => setLoadingCourses(false));
  }, [router]);

  async function toggleCourse(course: Course) {
    if (expanded === course.id) { setExpanded(null); return; }
    setExpanded(course.id);
    if (modMap[course.id]) return;
    setLoadingMods(course.id);
    const token = localStorage.getItem("canvas_token") || "";
    try {
      const res = await fetch("/api/canvas/modules", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, courseId: course.id }),
      });
      const d = await res.json();
      if (d.modules) setModMap(prev => ({ ...prev, [course.id]: d.modules }));
    } finally { setLoadingMods(null); }
  }

  async function startQuiz(course: Course, mod: Module) {
    const openaiKey = localStorage.getItem("openai_key") || "";
    if (!openaiKey) { alert("Add your OpenAI key on the Connect Canvas page to use quizzes."); return; }
    setGenQuiz(mod.id);
    const token = localStorage.getItem("canvas_token") || "";

    let content = "";
    const srcItems = mod.items.filter(i => ["Page", "Assignment"].includes(i.type)).slice(0, 2);
    await Promise.allSettled(srcItems.map(async item => {
      try {
        const res = await fetch("/api/canvas/item-content", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, type: item.type, apiUrl: item.apiUrl, htmlUrl: item.htmlUrl, title: item.title }),
        });
        const d = await res.json();
        const raw = (d.body || d.description || "") as string;
        content += `\n${item.title}: ${raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 800)}`;
      } catch { /* skip */ }
    }));

    try {
      const res = await fetch("/api/ai/generate-quiz", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseName: course.name, moduleName: mod.name, content, openaiKey }),
      });
      const d = await res.json();
      if (d.questions?.length) {
        setQuiz({
          course, module: mod, questions: d.questions,
          current: 0, selected: null,
          answers: new Array(d.questions.length).fill(null),
          revealed: false, done: false,
        });
      } else {
        alert(d.error || "Failed to generate quiz.");
      }
    } catch { alert("Failed to generate quiz."); }
    finally { setGenQuiz(null); }
  }

  async function startExam(course: Course) {
    const modules = modMap[course.id] || [];
    if (!modules.length) return;
    const openaiKey = localStorage.getItem("openai_key") || "";
    if (!openaiKey) { alert("Add your OpenAI key on the Connect Canvas page to use the mock exam."); return; }
    setGenExam(course.id);

    const examFiles = modules.flatMap(m =>
      m.items.filter(it => {
        const t = it.title.toLowerCase();
        return it.type === "File" && (t.includes("exam") || t.includes("final") || t.includes("midterm") || t.includes("past") || t.includes("old"));
      }).map(it => it.title)
    );

    try {
      const res = await fetch("/api/ai/generate-exam", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseName: course.name,
          modules: modules.map(m => ({ name: m.name, items: m.items.map(i => i.title) })),
          examFiles, openaiKey,
        }),
      });
      const d = await res.json();
      if (d.questions?.length) {
        setExam({ course, questions: d.questions, answers: new Array(d.questions.length).fill(null), submitted: false });
      } else {
        alert(d.error || "Failed to generate exam.");
      }
    } catch { alert("Failed to generate exam."); }
    finally { setGenExam(null); }
  }

  void rev; // used only to trigger re-renders after localStorage writes

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />

      <div className="mx-auto max-w-4xl px-6 py-10">
        {/* Title + legend */}
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-slate-900">Progress</h1>
          <p className="mt-1 text-sm text-slate-500">
            Take quizzes to track proficiency per module, or generate a mock final exam for any course.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5">
            {[
              { label: "Mastered 85–100%", dot: "bg-emerald-500" },
              { label: "Proficient 70–84%", dot: "bg-indigo-500" },
              { label: "Familiar 50–69%", dot: "bg-amber-400" },
              { label: "Needs practice 1–49%", dot: "bg-red-400" },
              { label: "Not started", dot: "bg-slate-200" },
            ].map(l => (
              <span key={l.label} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className={`h-2 w-2 rounded-full ${l.dot}`} />
                {l.label}
              </span>
            ))}
          </div>
        </div>

        {loadingCourses && (
          <div className="flex items-center justify-center gap-3 py-20 text-slate-400">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-400" />
            <p className="text-sm">Loading courses…</p>
          </div>
        )}

        {/* Current courses */}
        <div className="space-y-3">
          {courses.filter(c => c.isCurrent).map(course => {
            const mods = modMap[course.id];
            const open = expanded === course.id;
            const avg = mods ? courseAvg(course.id, mods) : null;
            const pi = profInfo(avg);

            return (
              <div key={course.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* Course header */}
                <div
                  onClick={() => toggleCourse(course)}
                  className="flex cursor-pointer select-none items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
                >
                  <span
                    className="shrink-0 text-xs text-slate-300 transition-transform duration-200"
                    style={{ display: "inline-block", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
                  >
                    ▶
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 truncate">{course.name}</p>
                    {avg !== null && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 w-full max-w-xs rounded-full bg-slate-100">
                          <div className={`h-1.5 rounded-full transition-all ${pi.bar}`} style={{ width: `${avg}%` }} />
                        </div>
                        <span className={`shrink-0 text-xs font-semibold ${pi.text}`}>{avg}% · {pi.label}</span>
                      </div>
                    )}
                  </div>
                  {open && mods && mods.length > 0 && (
                    <button
                      onClick={e => { e.stopPropagation(); startExam(course); }}
                      disabled={genExam === course.id}
                      className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {genExam === course.id ? "Generating…" : "✦ Mock Final Exam"}
                    </button>
                  )}
                </div>

                {/* Module tree */}
                {open && (
                  <div className="border-t border-slate-100">
                    {loadingMods === course.id && (
                      <div className="flex items-center gap-2 px-5 py-4 text-sm text-slate-400">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-400" />
                        Loading modules…
                      </div>
                    )}
                    {loadingMods !== course.id && (!mods || mods.length === 0) && (
                      <p className="px-5 py-4 text-sm text-slate-400">No modules found.</p>
                    )}
                    {mods?.map((mod, idx) => {
                      const mp = loadProg(course.id, mod.id);
                      const mpi = profInfo(mp?.score);
                      const isLast = idx === mods.length - 1;
                      const busy = genQuiz === mod.id;
                      return (
                        <div
                          key={mod.id}
                          className={`flex items-center gap-4 border-l-4 py-3.5 pl-4 pr-5 transition-colors ${mpi.border} ${!isLast ? "border-b border-b-slate-50" : ""}`}
                        >
                          {/* Tree connector */}
                          <span className="shrink-0 text-xs text-slate-200 select-none">
                            {isLast ? "└" : "├"}
                          </span>

                          {/* Module info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-slate-800 truncate">
                                {mod.position}. {mod.name}
                              </p>
                              <span className={`shrink-0 text-xs font-medium ${mpi.text}`}>{mpi.label}</span>
                            </div>
                            <div className="mt-1.5 flex items-center gap-2">
                              <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                                <div className={`h-1.5 rounded-full transition-all ${mpi.bar}`} style={{ width: `${mp?.score ?? 0}%` }} />
                              </div>
                              <span className="w-9 shrink-0 text-right text-xs font-bold tabular-nums text-slate-400">
                                {mp?.score ?? 0}%
                              </span>
                            </div>
                            {mp && (
                              <p className="mt-0.5 text-xs text-slate-300">
                                {mp.attempts} attempt{mp.attempts !== 1 ? "s" : ""} · {new Date(mp.lastDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>

                          {/* Quiz button */}
                          <button
                            onClick={() => startQuiz(course, mod)}
                            disabled={busy}
                            className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                              mp
                                ? "border border-slate-200 text-slate-600 hover:bg-slate-50"
                                : "bg-indigo-600 text-white hover:bg-indigo-700"
                            }`}
                          >
                            {busy ? "Generating…" : mp ? "Retake Quiz" : "Take Quiz"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Past courses */}
        {courses.some(c => !c.isCurrent) && (
          <div className="mt-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Past courses</p>
            <div className="space-y-2">
              {courses.filter(c => !c.isCurrent).map(course => {
                const mods = modMap[course.id];
                const open = expanded === course.id;
                const avg = mods ? courseAvg(course.id, mods) : null;
                const pi = profInfo(avg);
                return (
                  <div key={course.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 opacity-60 transition-opacity hover:opacity-100">
                    <div
                      onClick={() => toggleCourse(course)}
                      className="flex cursor-pointer select-none items-center gap-4 px-5 py-3.5 hover:bg-slate-100 transition-colors"
                    >
                      <span
                        className="shrink-0 text-xs text-slate-300 transition-transform duration-200"
                        style={{ display: "inline-block", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
                      >▶</span>
                      <div className="flex-1 min-w-0 flex items-center gap-3">
                        <p className="font-semibold text-slate-500 truncate">{course.name}</p>
                        <span className="shrink-0 rounded-md bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500">Past</span>
                      </div>
                      {avg !== null && (
                        <span className={`shrink-0 text-xs font-semibold ${pi.text}`}>{avg}%</span>
                      )}
                    </div>
                    {open && (
                      <div className="border-t border-slate-200">
                        {loadingMods === course.id && (
                          <div className="flex items-center gap-2 px-5 py-3 text-sm text-slate-400">
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-200 border-t-slate-400" />Loading…
                          </div>
                        )}
                        {mods?.map((mod, idx) => {
                          const mp = loadProg(course.id, mod.id);
                          const mpi = profInfo(mp?.score);
                          return (
                            <div key={mod.id} className={`flex items-center gap-4 border-l-4 py-3 pl-4 pr-5 ${mpi.border} ${idx !== mods.length - 1 ? "border-b border-b-slate-100" : ""}`}>
                              <span className="shrink-0 text-xs text-slate-200 select-none">{idx === mods.length - 1 ? "└" : "├"}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-600 truncate">{mod.position}. {mod.name}</p>
                                <div className="mt-1 flex items-center gap-2">
                                  <div className="h-1 flex-1 rounded-full bg-slate-200">
                                    <div className={`h-1 rounded-full ${mpi.bar}`} style={{ width: `${mp?.score ?? 0}%` }} />
                                  </div>
                                  <span className="text-xs text-slate-400 w-8 text-right">{mp?.score ?? 0}%</span>
                                </div>
                              </div>
                              <button
                                onClick={() => startQuiz(course, mod)}
                                disabled={genQuiz === mod.id}
                                className="shrink-0 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-200 disabled:opacity-50"
                              >
                                {genQuiz === mod.id ? "…" : mp ? "Retake" : "Quiz"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {quiz && (
        <QuizModal
          quiz={quiz}
          onChange={setQuiz}
          onSave={(cid, mid, score) => { saveProg(cid, mid, score); setRev(r => r + 1); }}
          onClose={() => setQuiz(null)}
        />
      )}

      {exam && (
        <ExamModal
          exam={exam}
          onChange={setExam}
          onClose={() => setExam(null)}
        />
      )}
    </div>
  );
}

// ─── Quiz modal ───────────────────────────────────────────────────────────────

function QuizModal({
  quiz, onChange, onSave, onClose,
}: {
  quiz: QuizState;
  onChange: (q: QuizState) => void;
  onSave: (cid: number, mid: number, score: number) => void;
  onClose: () => void;
}) {
  const q = quiz.questions[quiz.current];
  const total = quiz.questions.length;

  function pick(idx: number) {
    if (quiz.revealed) return;
    onChange({ ...quiz, selected: idx, revealed: true });
  }

  function next() {
    const newAnswers = [...quiz.answers];
    newAnswers[quiz.current] = quiz.selected;
    if (quiz.current === total - 1) {
      const score = Math.round(
        newAnswers.filter((a, i) => a === quiz.questions[i].correct).length / total * 100
      );
      onSave(quiz.course.id, quiz.module.id, score);
      onChange({ ...quiz, answers: newAnswers, done: true });
    } else {
      onChange({ ...quiz, answers: newAnswers, current: quiz.current + 1, selected: null, revealed: false });
    }
  }

  // ── Results ──
  if (quiz.done) {
    const correct = quiz.answers.filter((a, i) => a === quiz.questions[i].correct).length;
    const score = Math.round(correct / total * 100);
    const pi = profInfo(score);
    const medal = score >= 85 ? "🏆" : score >= 70 ? "✅" : score >= 50 ? "📚" : "💪";
    return (
      <Overlay>
        <div className="mx-4 flex w-full max-w-lg flex-col rounded-3xl bg-white shadow-2xl" style={{ maxHeight: "90vh" }}>
          <div className="shrink-0 border-b border-slate-100 px-8 py-7 text-center">
            <div className="text-5xl">{medal}</div>
            <p className="mt-2 text-4xl font-black text-slate-900">{score}%</p>
            <p className={`mt-1 text-base font-bold ${pi.text}`}>{pi.label}</p>
            <p className="mt-0.5 text-sm text-slate-400">{correct}/{total} correct · {quiz.module.name}</p>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 px-8 py-5">
            {quiz.questions.map((qn, i) => {
              const ans = quiz.answers[i];
              const ok = ans === qn.correct;
              return (
                <div key={i} className={`rounded-2xl border p-4 ${ok ? "border-emerald-100 bg-emerald-50" : "border-red-100 bg-red-50"}`}>
                  <div className="flex items-start gap-2">
                    <span className={`shrink-0 font-bold ${ok ? "text-emerald-500" : "text-red-500"}`}>{ok ? "✓" : "✗"}</span>
                    <div>
                      <p className="text-sm font-medium text-slate-800 leading-snug">{qn.question}</p>
                      {!ok && ans !== null && (
                        <p className="mt-0.5 text-xs text-red-600">Your answer: {qn.options[ans]}</p>
                      )}
                      <p className={`mt-0.5 text-xs ${ok ? "text-emerald-700" : "text-slate-600"}`}>
                        ✓ {qn.options[qn.correct]}
                      </p>
                      <p className="mt-1 text-xs italic text-slate-500">{qn.explanation}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="shrink-0 border-t border-slate-100 px-8 py-4">
            <button onClick={onClose} className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-700 transition-colors">
              Done
            </button>
          </div>
        </div>
      </Overlay>
    );
  }

  // ── Question ──
  return (
    <Overlay>
      <div className="mx-4 w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl">
        {/* Progress */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-600 truncate">{quiz.module.name}</span>
            <span className="shrink-0 ml-2">Q {quiz.current + 1} / {total}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100">
            <div
              className="h-1.5 rounded-full bg-indigo-500 transition-all"
              style={{ width: `${(quiz.current / total) * 100}%` }}
            />
          </div>
        </div>

        {/* Question text */}
        <p className="mb-5 text-lg font-bold leading-snug text-slate-900">{q.question}</p>

        {/* Options */}
        <div className="space-y-2.5">
          {q.options.map((opt, i) => {
            let cls = "border border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer";
            if (quiz.revealed) {
              if (i === q.correct) cls = "border-2 border-emerald-500 bg-emerald-50 text-emerald-900 cursor-default";
              else if (i === quiz.selected) cls = "border-2 border-red-400 bg-red-50 text-red-700 cursor-default";
              else cls = "border border-slate-100 text-slate-400 cursor-default";
            }
            return (
              <button
                key={i}
                onClick={() => pick(i)}
                disabled={quiz.revealed}
                className={`w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors ${cls}`}
              >
                <span className="mr-2 font-bold">{String.fromCharCode(65 + i)}.</span>{opt}
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {quiz.revealed && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span className="font-semibold text-slate-700">Explanation: </span>{q.explanation}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-400 hover:bg-slate-50 transition-colors">
            Exit
          </button>
          {quiz.revealed && (
            <button onClick={next} className="flex-1 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-700 transition-colors">
              {quiz.current === total - 1 ? "Finish Quiz →" : "Next →"}
            </button>
          )}
        </div>
      </div>
    </Overlay>
  );
}

// ─── Exam modal ───────────────────────────────────────────────────────────────

function ExamModal({
  exam, onChange, onClose,
}: {
  exam: ExamState;
  onChange: (e: ExamState) => void;
  onClose: () => void;
}) {
  function setAnswer(qi: number, ai: number) {
    if (exam.submitted) return;
    const answers = [...exam.answers];
    answers[qi] = ai;
    onChange({ ...exam, answers });
  }

  const answered = exam.answers.filter(a => a !== null).length;
  const total = exam.questions.length;

  // ── Results ──
  if (exam.submitted) {
    const correct = exam.answers.filter((a, i) => a === exam.questions[i].correct).length;
    const score = Math.round(correct / total * 100);
    const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
    const gradeColor = score >= 70 ? "text-emerald-600" : score >= 60 ? "text-amber-500" : "text-red-500";
    const pi = profInfo(score);
    return (
      <Overlay>
        <div className="mx-4 flex w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl" style={{ maxHeight: "92vh" }}>
          <div className="shrink-0 border-b border-slate-100 px-8 py-6 text-center">
            <p className={`text-6xl font-black ${gradeColor}`}>{grade}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{score}%</p>
            <p className="mt-0.5 text-sm text-slate-400">{correct}/{total} correct</p>
            <span className={`mt-2 inline-block text-xs font-semibold ${pi.text}`}>{pi.label}</span>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-8 py-6">
            {exam.questions.map((q, i) => {
              const ans = exam.answers[i];
              const ok = ans === q.correct;
              return (
                <div key={i} className={`rounded-2xl border p-5 ${ok ? "border-emerald-100 bg-emerald-50" : "border-red-100 bg-red-50"}`}>
                  <div className="flex items-start gap-2">
                    <span className={`shrink-0 font-bold ${ok ? "text-emerald-500" : "text-red-500"}`}>{ok ? "✓" : "✗"}</span>
                    <div className="min-w-0">
                      {q.topic && <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{q.topic}</p>}
                      <p className="text-sm font-medium leading-snug text-slate-800">{q.question}</p>
                      {!ok && ans !== null && <p className="mt-0.5 text-xs text-red-600">Your answer: {q.options[ans]}</p>}
                      <p className={`mt-0.5 text-xs ${ok ? "text-emerald-700" : "text-slate-600"}`}>✓ {q.options[q.correct]}</p>
                      <p className="mt-1 text-xs italic text-slate-500">{q.explanation}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="shrink-0 border-t border-slate-100 px-8 py-4">
            <button onClick={onClose} className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-700 transition-colors">
              Close
            </button>
          </div>
        </div>
      </Overlay>
    );
  }

  // ── Questions ──
  return (
    <Overlay>
      <div className="mx-4 flex w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl" style={{ maxHeight: "92vh" }}>
        {/* Header */}
        <div className="shrink-0 border-b border-slate-100 px-8 py-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{exam.course.name}</p>
            <h2 className="text-lg font-extrabold text-slate-900">Mock Final Exam</h2>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">{answered}/{total} answered</p>
            <div className="mt-1 h-1.5 w-24 rounded-full bg-slate-100">
              <div className="h-1.5 rounded-full bg-indigo-500 transition-all" style={{ width: `${(answered / total) * 100}%` }} />
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="flex-1 space-y-8 overflow-y-auto px-8 py-6">
          {exam.questions.map((q, qi) => (
            <div key={qi}>
              <div className="mb-3 flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                  {qi + 1}
                </span>
                <div className="min-w-0">
                  {q.topic && <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{q.topic}</p>}
                  <p className="text-sm font-semibold leading-snug text-slate-900">{q.question}</p>
                </div>
              </div>
              <div className="ml-9 space-y-2">
                {q.options.map((opt, oi) => (
                  <button
                    key={oi}
                    onClick={() => setAnswer(qi, oi)}
                    className={`w-full rounded-xl px-4 py-2.5 text-left text-sm transition-colors ${
                      exam.answers[qi] === oi
                        ? "border-2 border-indigo-500 bg-indigo-50 font-medium text-indigo-900"
                        : "border border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"
                    }`}
                  >
                    <span className="mr-2 font-bold">{String.fromCharCode(65 + oi)}.</span>{opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center gap-3 border-t border-slate-100 px-8 py-4">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 transition-colors">
            Exit
          </button>
          <button
            onClick={() => onChange({ ...exam, submitted: true })}
            className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            Submit Exam · {answered}/{total} answered
          </button>
        </div>
      </div>
    </Overlay>
  );
}

// ─── Overlay ──────────────────────────────────────────────────────────────────

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      {children}
    </div>
  );
}
