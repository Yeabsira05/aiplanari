import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="text-base font-extrabold tracking-tight text-slate-900">
          Planari
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/pricing" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
            Pricing
          </Link>
          <Link
            href="/connect-canvas"
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            Get started
          </Link>
        </div>
      </div>
    </nav>
  );
}
