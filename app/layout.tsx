import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "lorn.lol — OSINT Intelligence Platform",
  description:
    "Free, modular open-source intelligence platform for lawful, defensive digital investigations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
