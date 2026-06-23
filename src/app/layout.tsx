import type { Metadata } from "next";
import { Playfair_Display, Cormorant_Garamond, Source_Sans_3, DM_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { SpeedInsights } from "@vercel/speed-insights/next";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kimchi — by Second Ladder",
  description: "Kimchi reads your resume, understands your story, and prepares every application. An editorial onboarding experience.",
  keywords: ["Kimchi", "Second Ladder", "job search", "resume", "career", "AI"],
  authors: [{ name: "Second Ladder" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${playfair.variable} ${cormorant.variable} ${sourceSans.variable} ${dmMono.variable} antialiased`}
        style={{ background: "#F7F5F2", fontFamily: "var(--font-ui)" }}
      >
        {children}
        <Toaster />
        <SpeedInsights />
      </body>
    </html>
  );
}
