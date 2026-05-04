"use client";

import Navbar from "@/components/Navbar";

export default function PricingPage() {
  function fakePayment() {
    alert("Payment is not active in this prototype.");
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <Navbar />

      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-extrabold text-gray-900">
            Simple pricing
          </h1>

          <p className="mt-4 text-gray-600">
            Start free. Upgrade when you want AI-powered study planning.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-bold">Free</h2>
            <p className="mt-2 text-4xl font-extrabold">0 kr</p>

            <ul className="mt-6 space-y-3 text-gray-700">
              <li>✅ Canvas deadline import</li>
              <li>✅ Manual exam input</li>
              <li>✅ Deadline dashboard</li>
              <li>✅ Basic study alerts</li>
            </ul>

            <button
              onClick={fakePayment}
              className="mt-8 w-full rounded-xl border px-4 py-3 font-semibold hover:bg-gray-50"
            >
              Choose Free
            </button>
          </div>

          <div className="rounded-3xl bg-black p-8 text-white shadow-xl">
            <h2 className="text-2xl font-bold">Pro</h2>
            <p className="mt-2 text-4xl font-extrabold">990 kr / month</p>

            <ul className="mt-6 space-y-3 text-gray-200">
              <li>✅ Everything in Free</li>
              <li>✅ AI study plans</li>
              <li>✅ Smart prioritization</li>
              <li>✅ Task breakdowns</li>
              <li>✅ Future reminders</li>
            </ul>

            <button
              onClick={fakePayment}
              className="mt-8 w-full rounded-xl bg-white px-4 py-3 font-semibold text-black hover:bg-gray-100"
            >
              Choose Pro
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}