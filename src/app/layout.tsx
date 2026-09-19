import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VoiceLedger",
  description: "Voice-first bookkeeping for cash traders.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
