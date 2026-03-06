import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plucky Reach - Proposal Generator",
  description: "Generate branded merchandise proposals from CommonSKU presentations",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
