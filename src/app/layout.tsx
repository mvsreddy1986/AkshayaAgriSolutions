import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAP ABAP Consultant | 14+ Years Experience",
  description:
    "Professional profile for an experienced SAP ABAP consultant with 14+ years delivering enterprise SAP projects.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
