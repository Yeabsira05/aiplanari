import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Planari — AI Study Planner",
  description: "Connect Canvas, get AI-powered deadline prioritization and study guides.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable}>
      <body className="min-h-screen bg-slate-50 font-[family-name:var(--font-geist)] antialiased">
        {children}
      </body>
    </html>
  );
}
