import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prestige Hair Society — Book online",
  description: "Book specialist textured-hair care with Nekeia Griffith at KOOP Studio, Battersea.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-GB"><body>{children}</body></html>;
}
