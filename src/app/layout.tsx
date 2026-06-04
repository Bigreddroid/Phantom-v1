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
  title: "Phantom — AI Personal Brand on Autopilot",
  description: "Phantom posts tweets, threads, replies, and LinkedIn content 24/7 — all in your voice, all controlled from Telegram. Built for founders who are too busy to build in public manually.",
  openGraph: {
    title: "Phantom — AI Personal Brand on Autopilot",
    description: "96 automated actions per day. Zero manual effort. Your audience grows while you build.",
    siteName: "Phantom",
  },
};

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
