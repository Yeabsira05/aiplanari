import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
      <Navbar />

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <p className="mb-4 inline-block rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm">
              AI-powered study planning
            </p>

            <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 md:text-6xl">
              Plan your school life better with AI.
            </h1>

            <p className="mt-6 text-lg leading-8 text-gray-600">
              StudyFlow connects to Canvas, imports your deadlines, and helps
              you prioritize what to study next before stress builds up.
            </p>

            <div className="mt-8 flex gap-3">
              <Link
                href="/connect-canvas"
                className="rounded-xl bg-black px-6 py-3 font-semibold text-white hover:bg-gray-800"
              >
                Get started
              </Link>

              <Link
                href="/pricing"
                className="rounded-xl border bg-white px-6 py-3 font-semibold text-gray-800 hover:bg-gray-50"
              >
                View pricing
              </Link>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-xl">
            <div className="rounded-2xl bg-red-50 p-4">
              <p className="font-bold text-red-700">Urgent</p>
              <p className="mt-1 text-gray-900">Final exam in 2 days</p>
            </div>

            <div className="mt-4 rounded-2xl bg-yellow-50 p-4">
              <p className="font-bold text-yellow-700">Soon</p>
              <p className="mt-1 text-gray-900">Project deadline in 6 days</p>
            </div>

            <div className="mt-4 rounded-2xl bg-green-50 p-4">
              <p className="font-bold text-green-700">Upcoming</p>
              <p className="mt-1 text-gray-900">Presentation in 14 days</p>
            </div>
          </div>
        </div>

        <section className="mt-20 grid gap-4 md:grid-cols-3">
          {[
            ["Import Canvas", "Fetch courses and deadlines automatically."],
            ["Prioritize work", "See what matters most based on due dates."],
            ["Study smarter", "Break big tasks into smaller study steps."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900">{title}</h2>
              <p className="mt-2 text-gray-600">{text}</p>
            </div>
          ))}
        </section>
      </section>
    </main>
  );
}