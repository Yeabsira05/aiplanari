import Link from "next/link";
import Navbar from "@/components/Navbar";

const features = [
  {
    icon: "🎓",
    title: "Canvas integration",
    desc: "Connects to Canvas and imports every assignment and deadline automatically.",
  },
  {
    icon: "🤖",
    title: "AI prioritization",
    desc: "Scores every deadline 1–10 for urgency so you always know what to do first.",
  },
  {
    icon: "📖",
    title: "Smart study guide",
    desc: "Browse course modules, view content, and get AI breakdowns for any material.",
  },
];

const demoCards = [
  { urgency: "Urgent", label: "bg-red-50 border-red-100 text-red-700", bar: "bg-red-400", title: "Linear Algebra — Final Exam", sub: "2 days left" },
  { urgency: "Soon",   label: "bg-amber-50 border-amber-100 text-amber-700", bar: "bg-amber-400", title: "Web Dev — Project submission", sub: "5 days left" },
  { urgency: "Upcoming", label: "bg-emerald-50 border-emerald-100 text-emerald-700", bar: "bg-emerald-400", title: "Physics — Lab report", sub: "12 days left" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 py-24 text-center">
        <span className="inline-block rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm font-semibold text-indigo-600">
          AI-powered for students
        </span>

        <h1 className="mt-6 text-5xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
          Study smarter,<br />not harder.
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-500">
          Planari connects to Canvas, pulls in all your deadlines, and uses AI to tell
          you exactly what to focus on — and how to study it.
        </p>

        <div className="mt-10 flex justify-center gap-3">
          <Link
            href="/connect-canvas"
            className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            Connect Canvas — it&apos;s free
          </Link>
          <Link
            href="/pricing"
            className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            See pricing
          </Link>
        </div>
      </section>

      {/* Demo */}
      <section className="border-y border-slate-100 bg-slate-50 py-16">
        <div className="mx-auto max-w-md px-6">
          <p className="mb-6 text-center text-xs font-semibold uppercase tracking-widest text-slate-400">
            Your dashboard
          </p>
          <div className="space-y-3">
            {demoCards.map((c) => (
              <div key={c.title} className="flex overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className={`w-1 shrink-0 ${c.bar}`} />
                <div className="flex-1 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{c.title}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${c.label}`}>{c.urgency}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">{c.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <p className="mb-10 text-center text-xs font-semibold uppercase tracking-widest text-slate-400">
          Everything you need
        </p>
        <div className="grid gap-6 sm:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <span className="text-3xl">{f.icon}</span>
              <h3 className="mt-4 text-base font-bold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-100 bg-slate-50 py-20 text-center">
        <h2 className="text-3xl font-extrabold text-slate-900">Ready to stop guessing?</h2>
        <p className="mt-3 text-slate-500">Connect Canvas in 30 seconds. No account needed.</p>
        <Link
          href="/connect-canvas"
          className="mt-8 inline-block rounded-xl bg-indigo-600 px-8 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          Get started for free
        </Link>
      </section>
    </div>
  );
}
