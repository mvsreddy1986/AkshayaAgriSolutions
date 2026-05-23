import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Akshaya Agri Solutions ERP",
  description:
    "Agriculture commodity trading ERP for procurement, financing, resale, GST invoices, ledgers and KPI reports.",
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
