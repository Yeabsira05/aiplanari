"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";

// ─── Types ────────────────────────────────────────────────────────────────────

type Course = { id: number; name: string; isCurrent: boolean };
type Module = { id: number; name: string; position: number; items: { title: string; type: string }[] };
type Skill = { id: string; name: string; description: string; importance: "high" | "medium" | "low"; estimatedMinutes: number };
type SkillStatus = "not_started" | "learning" | "confident";
type LessonContent = { explanation: string; example: string; keyInsight: string; practiceQuestion: string; answer: string };

// ─── localStorage helpers ─────────────────────────────────────────────────────

function todayKey() { return new Date().toISOString().split("T")[0]; }

function loadSkills(cid: number): Skill[] | null {
  try { return JSON.parse(localStorage.getItem(`skills_v1_${cid}`) ?? "null"); } catch { return null; }
}
function saveSkills(cid: number, skills: Skill[]) {
  localStorage.setItem(`skills_v1_${cid}`, JSON.stringify(skills));
}

function getSkillStatus(cid: number, sid: string): SkillStatus {
  return (localStorage.getItem(`ss_${cid}_${sid}`) as SkillStatus) ?? "not_started";
}
function setSkillStatus(cid: number, sid: string, s: SkillStatus) {
  localStorage.setItem(`ss_${cid}_${sid}`, s);
}

function loadLesson(cid: number, sid: string): LessonContent | null {
  try { return JSON.parse(localStorage.getItem(`lsn_${cid}_${sid}`) ?? "null"); } catch { return null; }
}
function saveLesson(cid: number, sid: string, c: LessonContent) {
  localStorage.setItem(`lsn_${cid}_${sid}`, JSON.stringify(c));
}

function getTodaySecs(cid: number): number {
  return parseInt(localStorage.getItem(`st_${cid}_${todayKey()}`) ?? "0", 10);
}
function getTotalSecs(cid: number): number {
  return parseInt(localStorage.getItem(`st_total_${cid}`) ?? "0", 10);
}
function addSecs(cid: number, secs: number) {
  if (secs < 5) return;
  localStorage.setItem(`st_${cid}_${todayKey()}`, String(getTodaySecs(cid) + secs));
  localStorage.setItem(`st_total_${cid}`, String(getTotalSecs(cid) + secs));
}

function fmtTime(s: number): string {
  if (s === 0) return "0 min";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}min` : `${h}h`;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LearnPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [learningSkill, setLearningSkill] = useState<Skill | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("canvas_token");
    if (!token) { router.push("/connect-canvas"); return; }
    fetch("/api/canvas/courses", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).then(r => r.json()).then(d => { if (d.courses) setCourses(d.courses); })
      .finally(() => setLoading(false));
  }, [router]);

  async function openCourse(course: Course) {
    setActiveCourse(course);
    const cached = loadSkills(course.id);
    if (cached?.length) { setSkills(cached); return; }
    await fetchSkills(course);
  }

  async function fetchSkills(course: Course) {
    setLoadingSkills(true);
    setSkills([]);
    const token = localStorage.getItem("canvas_token") || "";

    let modules: Module[] = [];
    try {
      const r = await fetch("/api/canvas/modules", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, courseId: course.id }),
      });
      const d = await r.json();
      modules = d.modules || [];
    } catch { /* skip */ }

    try {
      const r = await fetch("/api/ai/extract-skills", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseName: course.name,
          modules: modules.map(m => ({ name: m.name, items: m.items.map(i => i.title) })),
        }),
      });
      const d = await r.json();
      if (d.skills?.length) { saveSkills(course.id, d.skills); setSkills(d.skills); }
    } catch { /* skip */ }
    finally { setLoadingSkills(false); }
  }

  void tick;

  // ── Course grid ──
  if (!activeCourse) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader />
        <div className="mx-auto max-w-4xl px-6 py-10">
          <div className="mb-8">
            <h1 className="text-2xl font-extrabold text-slate-900">Learn</h1>
            <p className="mt-1 text-sm text-slate-500">
              Pick a course. The app breaks it into skills and teaches you each one — no thinking required.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-3 py-20 text-slate-400">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-400" />
              <span className="text-sm">Loading your courses…</span>
            </div>
          ) : (
            <>
              {/* Current courses */}
              <div className="grid gap-4 sm:grid-cols-2">
                {courses.filter(c => c.isCurrent).map(course => {
                  const cached = loadSkills(course.id);
                  const confident = cached?.filter(s => getSkillStatus(course.id, s.id) === "confident").length ?? 0;
                  const todaySecs = getTodaySecs(course.id);
                  const totalSecs = getTotalSecs(course.id);
                  const pct = cached?.length ? Math.round((confident / cached.length) * 100) : 0;

                  return (
                    <button
                      key={course.id}
                      onClick={() => openCourse(course)}
                      className="group flex flex-col items-start rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all hover:border-indigo-300 hover:shadow-md"
                    >
                      <p className="font-bold text-slate-900 transition-colors group-hover:text-indigo-700 leading-snug">
                        {course.name}
                      </p>

                      {cached && (
                        <div className="mt-3 w-full">
                          <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                            <span>{confident}/{cached.length} skills confident</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-100">
                            <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2">
                        {todaySecs > 0 && (
                          <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600">
                            ⏱ {fmtTime(todaySecs)} today
                          </span>
                        )}
                        {totalSecs > 0 && todaySecs === 0 && (
                          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                            {fmtTime(totalSecs)} total
                          </span>
                        )}
                        {!cached && (
                          <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs text-slate-400">
                            AI will extract skills
                          </span>
                        )}
                      </div>

                      <span className="mt-5 text-xs font-semibold text-indigo-500 transition-colors group-hover:text-indigo-700">
                        {cached ? "Continue studying →" : "Start learning →"}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Past courses */}
              {courses.some(c => !c.isCurrent) && (
                <div className="mt-8">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Past courses</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {courses.filter(c => !c.isCurrent).map(course => {
                      const cached = loadSkills(course.id);
                      const confident = cached?.filter(s => getSkillStatus(course.id, s.id) === "confident").length ?? 0;
                      const pct = cached?.length ? Math.round((confident / cached.length) * 100) : 0;

                      return (
                        <button
                          key={course.id}
                          onClick={() => openCourse(course)}
                          className="group flex flex-col items-start rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left opacity-60 transition-all hover:opacity-100 hover:shadow-sm"
                        >
                          <div className="flex w-full items-start justify-between gap-2">
                            <p className="font-semibold text-slate-500 leading-snug group-hover:text-slate-800 transition-colors">
                              {course.name}
                            </p>
                            <span className="shrink-0 rounded-md bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500">
                              Past
                            </span>
                          </div>
                          {cached && (
                            <div className="mt-2 w-full">
                              <div className="h-1 w-full rounded-full bg-slate-200">
                                <div className="h-1 rounded-full bg-slate-400 transition-all" style={{ width: `${pct}%` }} />
                              </div>
                              <p className="mt-1 text-xs text-slate-400">{confident}/{cached.length} skills</p>
                            </div>
                          )}
                        </button>
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

  // ── Skills view ──
  const confidentCount = skills.filter(s => getSkillStatus(activeCourse.id, s.id) === "confident").length;
  const toLearn = skills.filter(s => getSkillStatus(activeCourse.id, s.id) !== "confident");
  const recommended = toLearn.find(s => s.importance === "high") ?? toLearn[0] ?? null;

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <div className="mx-auto max-w-4xl px-6 py-10">

        {/* Course header */}
        <div className="mb-8">
          <button
            onClick={() => { setActiveCourse(null); setSkills([]); setTick(t => t + 1); }}
            className="mb-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-700"
          >
            ← All courses
          </button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">{activeCourse.name}</h1>
              <div className="mt-2 flex flex-wrap gap-2">
                {getTodaySecs(activeCourse.id) > 0 && (
                  <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600">
                    ⏱ {fmtTime(getTodaySecs(activeCourse.id))} today
                  </span>
                )}
                {getTotalSecs(activeCourse.id) > 0 && (
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                    {fmtTime(getTotalSecs(activeCourse.id))} total
                  </span>
                )}
                {skills.length > 0 && (
                  <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600">
                    ✓ {confidentCount}/{skills.length} confident
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => { saveSkills(activeCourse.id, []); fetchSkills(activeCourse); }}
              className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50"
            >
              Refresh skills
            </button>
          </div>
        </div>

        {loadingSkills ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-500" />
            <p className="text-sm text-slate-500">Figuring out what you need to learn…</p>
          </div>
        ) : skills.length === 0 ? (
          <p className="py-20 text-center text-sm text-slate-400">No skills loaded. Add your OpenAI key to enable AI skill extraction.</p>
        ) : (
          <>
            {/* Recommended next */}
            {recommended && (
              <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-indigo-100 bg-indigo-50 px-6 py-5">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-indigo-400">Study next</p>
                  <p className="mt-0.5 truncate font-bold text-indigo-900">{recommended.name}</p>
                  <p className="mt-0.5 text-xs text-indigo-600">{recommended.description}</p>
                </div>
                <button
                  onClick={() => setLearningSkill(recommended)}
                  className="shrink-0 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                >
                  Start →
                </button>
              </div>
            )}

            {/* Skills grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              {skills
                .sort((a, b) => {
                  const imp: Record<string, number> = { high: 0, medium: 1, low: 2 };
                  const ord: Record<string, number> = { not_started: 0, learning: 1, confident: 2 };
                  const sa = getSkillStatus(activeCourse.id, a.id);
                  const sb = getSkillStatus(activeCourse.id, b.id);
                  if (sa !== sb) return ord[sa] - ord[sb];
                  return imp[a.importance] - imp[b.importance];
                })
                .map(skill => {
                  const status = getSkillStatus(activeCourse.id, skill.id);
                  const impCls = skill.importance === "high"
                    ? "bg-red-50 text-red-600"
                    : skill.importance === "medium"
                    ? "bg-amber-50 text-amber-600"
                    : "bg-slate-50 text-slate-400";
                  const statusCls = status === "confident"
                    ? "border-emerald-200 bg-emerald-50"
                    : status === "learning"
                    ? "border-indigo-200 bg-white"
                    : "border-slate-200 bg-white";
                  const ctaText = status === "confident"
                    ? "Review again →"
                    : status === "learning"
                    ? "Continue →"
                    : "Learn →";
                  const ctaColor = status === "confident"
                    ? "text-emerald-600"
                    : "text-indigo-500 group-hover:text-indigo-700";

                  return (
                    <button
                      key={skill.id}
                      onClick={() => setLearningSkill(skill)}
                      className={`group flex flex-col items-start rounded-2xl border p-5 text-left shadow-sm transition-all hover:shadow-md ${statusCls}`}
                    >
                      <div className="mb-3 flex w-full items-start justify-between gap-2">
                        <div className="flex flex-wrap gap-1.5">
                          <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${impCls}`}>
                            {skill.importance === "high" ? "Essential" : skill.importance === "medium" ? "Important" : "Optional"}
                          </span>
                          {status !== "not_started" && (
                            <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${status === "confident" ? "bg-emerald-100 text-emerald-700" : "bg-indigo-50 text-indigo-600"}`}>
                              {status === "confident" ? "✓ Confident" : "In progress"}
                            </span>
                          )}
                        </div>
                        <span className="shrink-0 text-xs text-slate-300">~{skill.estimatedMinutes} min</span>
                      </div>
                      <p className="font-bold text-slate-900 transition-colors group-hover:text-indigo-700">
                        {skill.name}
                      </p>
                      <p className="mt-1 text-sm leading-snug text-slate-500">{skill.description}</p>
                      <span className={`mt-4 text-xs font-semibold transition-colors ${ctaColor}`}>{ctaText}</span>
                    </button>
                  );
                })}
            </div>
          </>
        )}
      </div>

      {/* Learning session modal */}
      {learningSkill && (
        <LearningSession
          skill={learningSkill}
          course={activeCourse}
          onClose={() => { setLearningSkill(null); setTick(t => t + 1); }}
          onConfident={() => {
            setSkillStatus(activeCourse.id, learningSkill.id, "confident");
            setLearningSkill(null);
            setTick(t => t + 1);
          }}
        />
      )}
    </div>
  );
}

// ─── Learning session ─────────────────────────────────────────────────────────

function LearningSession({
  skill, course, onClose, onConfident,
}: {
  skill: Skill;
  course: Course;
  onClose: () => void;
  onConfident: () => void;
}) {
  const [lesson, setLesson] = useState<LessonContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"learn" | "practice">("learn");
  const [showAnswer, setShowAnswer] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  // Tick timer every second
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // Save study time on unmount
  useEffect(() => {
    return () => { addSecs(course.id, Math.floor((Date.now() - startRef.current) / 1000)); };
  }, [course.id]);

  // Load lesson content (cache-first)
  useEffect(() => {
    const cached = loadLesson(course.id, skill.id);
    if (cached) { setLesson(cached); return; }
    setLoading(true);
    setSkillStatus(course.id, skill.id, "learning");
    fetch("/api/ai/teach-skill", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseName: course.name, skillName: skill.name }),
    }).then(r => r.json()).then(d => {
      if (d.explanation) { saveLesson(course.id, skill.id, d); setLesson(d); }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [course.id, course.name, skill.id, skill.name]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/85 backdrop-blur-sm">
      <div className="mx-auto flex min-h-full max-w-2xl flex-col px-4 py-8">

        {/* Floating top bar */}
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm font-medium text-white/60 transition-colors hover:text-white"
          >
            ← {course.name}
          </button>
          <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 text-sm font-semibold text-white">
            <span className="text-xs opacity-60">⏱</span>
            {mm}:{ss}
          </div>
        </div>

        {/* Card */}
        <div className="flex-1 overflow-hidden rounded-3xl bg-white shadow-2xl">
          {/* Header */}
          <div className="border-b border-slate-100 px-8 py-6">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{course.name}</p>
            <h2 className="text-2xl font-extrabold text-slate-900">{skill.name}</h2>
            <p className="mt-1 text-sm text-slate-500">{skill.description}</p>
          </div>

          {/* Body */}
          {loading ? (
            <div className="flex flex-col items-center gap-4 py-24 text-center">
              <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-100 border-t-indigo-500" />
              <p className="text-sm text-slate-400">Your tutor is preparing a lesson…</p>
            </div>
          ) : !lesson ? (
            <div className="flex flex-col items-center gap-4 px-8 py-24 text-center">
              <p className="text-sm text-slate-500">
                Could not load lesson. Make sure your OpenAI key is saved on the Connect Canvas page.
              </p>
              <button onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50">
                Close
              </button>
            </div>
          ) : step === "learn" ? (
            <div className="space-y-7 px-8 py-7">
              {/* Explanation */}
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Explanation</p>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-6 py-5">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-slate-800">{lesson.explanation}</p>
                </div>
              </div>

              {/* Worked example */}
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Worked Example</p>
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-6 py-5">
                  <p className="whitespace-pre-line font-mono text-sm leading-relaxed text-indigo-900">{lesson.example}</p>
                </div>
              </div>

              {/* Key insight */}
              <div className="flex items-start gap-4 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4">
                <span className="shrink-0 text-2xl">💡</span>
                <p className="text-sm font-medium leading-relaxed text-amber-900">{lesson.keyInsight}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pb-2">
                <button
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50"
                >
                  Study later
                </button>
                <button
                  onClick={() => { setStep("practice"); setShowAnswer(false); }}
                  className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                >
                  Test myself →
                </button>
              </div>
            </div>
          ) : (
            // Practice step
            <div className="space-y-6 px-8 py-7">
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Practice Question</p>
                <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
                  <p className="text-base font-semibold leading-snug text-slate-900">{lesson.practiceQuestion}</p>
                </div>
              </div>

              {!showAnswer ? (
                <button
                  onClick={() => setShowAnswer(true)}
                  className="w-full rounded-xl border border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50"
                >
                  Reveal answer
                </button>
              ) : (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-6 py-5">
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-emerald-500">Answer</p>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-emerald-900">{lesson.answer}</p>
                </div>
              )}

              <div className="flex gap-3 pb-2">
                <button
                  onClick={() => { setStep("learn"); setShowAnswer(false); }}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50"
                >
                  ← Review again
                </button>
                <button
                  onClick={onConfident}
                  className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  ✓ Got it — I&apos;m confident
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
