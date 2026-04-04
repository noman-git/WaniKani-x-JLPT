import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "JLPT Dashboard — N4/N5 Study Tracker",
  description: "Track your JLPT N4 and N5 kanji and vocabulary progress with WaniKani integration",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <div className="nav-inner">
            <Link href="/" className="nav-brand">
              <span className="nav-brand-icon">⛩️</span>
              <span className="nav-brand-text">
                JLPT Tracker
                <span className="nav-brand-sub">N4 / N5</span>
              </span>
            </Link>
            <ul className="nav-links">
              <li><Link href="/" className="nav-link">Dashboard</Link></li>
              <li><Link href="/items" className="nav-link">Browse</Link></li>
              <li><Link href="/settings" className="nav-link">Settings</Link></li>
            </ul>
          </div>
        </nav>
        <main className="container">
          {children}
        </main>
      </body>
    </html>
  );
}
