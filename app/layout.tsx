import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Captain Obvious: IT Helpdesk AI — Intelligent Triage & Resolution Agent",
  description: "AI-powered, privacy-first Enterprise IT Helpdesk Council with RAG-based resolution, PII redaction, confidence scoring, and agentic workflows. Built for NASSCOM Hackathon 2026.",
  keywords: ["AI helpdesk", "ticket routing", "RAG", "PII redaction", "enterprise knowledge assistant", "agentic AI", "ONNX", "Council"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col font-sans bg-slate-50 dark:bg-[#030303] text-slate-900 dark:text-slate-200 transition-colors duration-300">{children}</body>
    </html>
  );
}
