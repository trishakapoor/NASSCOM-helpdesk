import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Captain Obvious - IT Helpdesk",
  description: "Agentic Zero-Trust IT Resolution System",
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
