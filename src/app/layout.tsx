import type { Metadata } from "next";
import "./globals.css";
import { ClientLayout } from "./components/ClientLayout";

export const metadata: Metadata = {
  title: "JLPT Dashboard — N4/N5 Study Tracker",
  description: "Track your JLPT N4 and N5 kanji and vocabulary progress with WaniKani integration",
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
