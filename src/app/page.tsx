"use client";

import Link from "next/link";
import Calculator from "@/components/Calculator";
import TvlTable from "@/components/TvlTable";
import ThemeToggle from "@/components/ThemeToggle";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-black border-b-2 border-black dark:border-white">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-black dark:bg-white flex items-center justify-center">
                <span className="text-white dark:text-black font-bold text-sm">N</span>
              </div>
              <div>
                <h1 className="text-lg font-bold uppercase text-black dark:text-white">
                  Neutral YT Calculator
                </h1>
                <p className="text-xs text-black/60 dark:text-white/60 uppercase tracking-wide">
                  Estimate Pendle Yield Token Returns & Points
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/inflation"
                className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black text-sm font-bold uppercase border-2 border-black dark:border-white hover:bg-transparent hover:text-black dark:hover:bg-transparent dark:hover:text-white transition-colors"
              >
                Inflation
              </Link>
              <a
                href="https://app.neutrl.fi"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-sm font-bold uppercase text-black dark:text-white border-2 border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors flex items-center gap-1"
              >
                Neutrl
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-8 bg-white dark:bg-black">
        <div className="max-w-6xl mx-auto px-6 space-y-8">
          <Calculator />
          <TvlTable />
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
