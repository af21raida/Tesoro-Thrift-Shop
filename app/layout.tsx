import type { Metadata } from "next";
import { Cinzel, Cormorant_Garamond } from "next/font/google";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import "./globals.css";

// Medieval/royal auction-house type stack:
//  - Cinzel: inscriptional Roman capitals for every heading and for button
//    labels (SemiBold) — the closest readable web substitute for the
//    engraved stone-letterforms of an old European auction house.
//  - Cormorant Garamond: a high-contrast, bookish serif used for body text,
//    UI/labels, and prices (SemiBold/Bold for figures so they stand out).
//    It backs both --font-body and --font-mono so the "tag" motif (labels,
//    badges, timestamps) inherits the same elegant serif rather than the old
//    modern sans/mono pairing. Cinzel has no italic cut — the `italic`
//    utility used on the hero will render as synthetic oblique, which is fine.
const display = Cinzel({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600"],
});

// Cormorant Garamond backs both --font-body and --font-mono (two instances
// because this next/font version's `variable` option accepts a single CSS
// variable only — the @font-face URLs are identical, so the browser
// downloads the files once). This keeps the "tag" motif — labels, badges,
// timestamps, prices — on the same elegant serif as the body rather than
// the old modern sans/mono pairing.
const body = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

const mono = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Tesoro — Secondhand Marketplace & Auctions",
  description:
    "Browse secondhand finds, sell your own listings, and bid on limited-edition auction items.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
