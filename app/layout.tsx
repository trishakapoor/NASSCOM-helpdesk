import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IT Helpdesk AI — Intelligent Ticket Routing & Resolution Agent",
  description: "AI-powered, privacy-first Enterprise IT Helpdesk Agent with RAG-based resolution, PII redaction, confidence scoring, and agentic workflows. Built for NASSCOM Hackathon 2026.",
  keywords: ["AI helpdesk", "ticket routing", "RAG", "PII redaction", "enterprise knowledge assistant", "agentic AI"],
} as Metadata;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
