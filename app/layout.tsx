import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Barlow_Semi_Condensed } from "next/font/google";
import type { ReactNode } from "react";
import { DemoTour } from "@/components/DemoTour";
import "./globals.css";

const display = Barlow_Semi_Condensed({ weight: "500", subsets: ["latin"], variable: "--font-display" });
const body = Atkinson_Hyperlegible_Next({ weight: ["400", "500"], subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "VC Pipeline",
  description: "Which investors are worth a message this week, and why",
};

const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        {/* Apply a saved light/dark choice before paint (components/ThemeToggle.tsx). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {children}
        <DemoTour />
      </body>
    </html>
  );
}
