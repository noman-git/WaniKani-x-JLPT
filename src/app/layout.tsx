import type { Metadata } from "next";
import "./globals.css";
import { ClientLayout } from "./components/ClientLayout";

export const metadata: Metadata = {
  title: "Folio — a JLPT study journal",
  description: "An editorial study journal for JLPT N4 & N5 — kanji, vocabulary, radicals, and grammar with WaniKani-style SRS.",
};

// Inline script — runs before paint to set the theme attribute and
// avoid a flash of the wrong palette. Defaults to light; honors a
// user's saved choice in localStorage if present. The `theme-ready`
// class is added on the next frame so the cross-fade only applies to
// subsequent toggles.
const themeBootstrap = `(function(){try{var s=localStorage.getItem('folio-theme');var t=s==='dark'?'dark':'light';document.documentElement.setAttribute('data-theme',t);requestAnimationFrame(function(){document.documentElement.classList.add('theme-ready');});}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
