import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://clear-road-zeta.vercel.app"),
  openGraph: {
    title: "CLEAR ROAD",
    description: "SEE WHAT'S AHEAD. Crowdsourced road awareness for Lagos.",
    type: "website",
    images: [
      {
        url: "/clear-road-desktop.png",
        width: 1440,
        height: 900,
        alt: "Clear Road desktop map of Lagos with nearby road sightings and reporting controls.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [
      {
        url: "/clear-road-desktop.png",
        alt: "Clear Road desktop map of Lagos with nearby road sightings and reporting controls.",
      },
    ],
  },
  title: "CLEAR ROAD",
  description: "SEE WHAT'S AHEAD. Crowdsourced road awareness for Lagos.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
