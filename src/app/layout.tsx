import type { Metadata } from "next";
import "./globals.css";
import { ClientLayout } from "./components/ClientLayout";

export const metadata: Metadata = {
  title: "Folio — a JLPT study journal",
  description: "An editorial study journal for JLPT N4 & N5 — kanji, vocabulary, radicals, and grammar with WaniKani-style SRS.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
