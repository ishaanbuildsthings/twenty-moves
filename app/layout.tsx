import type { Metadata } from "next";
import { Nunito, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { TRPCReactProvider } from "@/lib/trpc/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "twenty moves",
  description: "The social platform for speedcubers",
  icons: {
    icon: "/tm_logo_ccw.svg",
  },
};

// Root layout — wraps ALL pages (both (auth) and (app) route groups).
// Only contains global providers and styles. Auth-specific UI (like the
// header with sign-out button) lives in (app)/layout.tsx where the
// ViewerProvider is available.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <head>
        <link rel="stylesheet" href="/cubing-icons.css" />
      </head>
      <body className="h-full flex flex-col">
        <TRPCReactProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </TRPCReactProvider>
        <Analytics />
      </body>
    </html>
  );
}
