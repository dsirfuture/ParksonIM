import type { Metadata } from "next";
import "./globals.css";
import { getLang } from "@/lib/i18n-server";

export const metadata: Metadata = {
  title: "ParksonIM",
  description: "Parkson Inspection Management Platform",
  icons: {
    icon: "/BSLOGO.png",
    shortcut: "/BSLOGO.png",
    apple: "/BSLOGO.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const lang = await getLang();

  return (
    <html lang={lang} suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
