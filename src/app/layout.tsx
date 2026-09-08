import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { appUrl } from "@/lib/env";
import { OG_IMAGE } from "@/lib/seo";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "Prestige Hair Society — Hair care, elevated to an art.",
  description:
    "A calm, considered salon experience designed around your hair, your routine and how you want to feel. Battersea, London.",
  icons: {
    // icon.png is picked up automatically by its filename; the Apple one is
    // not, and iOS composites onto black, so it keeps its cream ground.
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "Prestige Hair Society",
    locale: "en_GB",
    url: appUrl,
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image", images: [OG_IMAGE.url] },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en-GB"
      className={`${cormorant.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
