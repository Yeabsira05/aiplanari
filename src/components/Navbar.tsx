import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-extrabold text-gray-900">
          StudyFlow
        </Link>

        <div className="flex items-center gap-4 text-sm font-medium">
          <Link href="/pricing" className="text-gray-600 hover:text-black">
            Pricing
          </Link>

          <Link
            href="/connect-canvas"
            className="rounded-xl bg-black px-4 py-2 text-white hover:bg-gray-800"
          >
            Login with Canvas
          </Link>
        </div>
      </div>
    </nav>
  );
}