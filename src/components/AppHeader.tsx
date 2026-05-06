"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [name, setName] = useState("");

  useEffect(() => {
    setName(localStorage.getItem("student_name") || "");
  }, []);

  function handleSignOut() {
    sessionStorage.clear();
    localStorage.removeItem("canvas_token");
    router.push("/connect-canvas");
  }

  const nav = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/learn", label: "Learn" },
    { href: "/progress", label: "Progress" },
    { href: "/study-guide", label: "Study Guide" },
    { href: "/resources", label: "Resources" },
  ];

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-6">
        <Link href="/dashboard" className="text-base font-extrabold tracking-tight text-slate-900">
          Planari
        </Link>

        <nav className="flex items-center gap-0.5">
          {nav.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                pathname.startsWith(href)
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {name && (
            <span className="hidden text-sm text-slate-400 sm:block">{name}</span>
          )}
          <Link
            href="/add-deadline"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            + Add exam
          </Link>
          <button
            onClick={handleSignOut}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
