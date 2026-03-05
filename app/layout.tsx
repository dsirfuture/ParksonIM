// app/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ParksonMX 验货平台",
  description: "ParksonMX Web Inspection Platform",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}
