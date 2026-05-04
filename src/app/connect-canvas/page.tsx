"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ConnectCanvasPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    if (!name.trim() || !token.trim()) {
      alert("Please enter your name and Canvas token.");
      return;
    }
    setLoading(true);
    localStorage.setItem("student_name", name.trim());
    localStorage.setItem("canvas_token", token.trim());
    if (openaiKey.trim()) localStorage.setItem("openai_key", openaiKey.trim());
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Minimal top bar */}
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <Link href="/" className="text-base font-extrabold tracking-tight text-slate-900">
          Planari
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-extrabold text-slate-900">Connect Canvas</h1>
          <p className="mt-2 text-sm text-slate-500">
            Your token is stored locally in your browser and never sent to our servers.
          </p>

          <div className="mt-8 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Your name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bjarki"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Canvas access token</label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste your Canvas token"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <p className="mt-1.5 text-xs text-slate-400">
                Found in Canvas → Account → Settings → New Access Token
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-700">OpenAI key <span className="font-normal text-slate-400">(optional)</span></p>
              <p className="mt-0.5 text-xs text-slate-400">Enables AI prioritization, summaries, and study notes.</p>
              <input
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
                className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          <button
            onClick={handleConnect}
            disabled={loading}
            className="mt-6 w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {loading ? "Connecting…" : "Connect Canvas"}
          </button>
        </div>
      </div>
    </div>
  );
}
