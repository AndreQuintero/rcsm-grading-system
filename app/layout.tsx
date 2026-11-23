import type { Metadata } from "next";
import { Geist, Geist_Mono, Zilla_Slab } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";
import { Suspense } from "react";
import { EnableBiometricsPrompt } from "./EnableBiometricsPrompt";
import { NavigationProgress } from "./NavigationProgress";
import { SiteHeader } from "./SiteHeader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const zillaSlab = Zilla_Slab({
  variable: "--font-zilla-slab",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "Revival Cry School of Ministry",
  description: "Teacher registry for Revival Cry School of Ministry",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${zillaSlab.variable}`}>
      <body className="min-h-screen md:flex">
        <NavigationProgress />
        <TooltipProvider delayDuration={300}>
          <SiteHeader />
          <div className="min-w-0 flex-1">
            <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 md:py-12">{children}</div>
          </div>
          <Suspense>
            <EnableBiometricsPrompt />
          </Suspense>
          {/* the app is light-only, so the toasts are too */}
          <Toaster theme="light" position="top-right" closeButton toastOptions={{ classNames: { toast: "cn-toast !gap-3 !shadow-lg", title: "!text-sm !font-medium", error: "!border-l-4 !border-l-destructive" } }} />
        </TooltipProvider>
      </body>
    </html>
  );
}
