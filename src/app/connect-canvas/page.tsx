"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function ConnectCanvasPage() {
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const router = useRouter();

  function handleConnect() {
    if (!name.trim() || !token.trim()) {
      alert("Please enter your name and Canvas token");
      return;
    }

    localStorage.setItem("student_name", name);
    localStorage.setItem("canvas_token", token);

    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <Navbar />

      <section className="flex min-h-[80vh] items-center justify-center px-6">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
          <h1 className="text-3xl font-extrabold text-gray-900">
            Login with Canvas Token
          </h1>

          <p className="mt-3 text-gray-600">
            Connect your Canvas account once and start planning your deadlines.
          </p>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="mt-6 w-full rounded-xl border px-4 py-3 text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-black"
          />

          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Canvas access token"
            className="mt-4 w-full rounded-xl border px-4 py-3 text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-black"
          />

          <button
            onClick={handleConnect}
            className="mt-5 w-full rounded-xl bg-black px-4 py-3 font-semibold text-white hover:bg-gray-800"
          >
            Connect Canvas
          </button>

          <p className="mt-4 text-sm text-gray-500">
            Your token is stored locally in your browser for this prototype.
          </p>
        </div>
      </section>
    </main>
  );
}