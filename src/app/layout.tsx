import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { WiserdProvider } from "@/components/providers/wiserd-provider";
import { SiteShell } from "@/components/layout/site-shell";

// WISERD Brand Typography: Bricolage Grotesque (editorial headlines, UI & body)
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// WISERD Condensed Numeric & Technical Typography: Barlow Condensed
const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: {
    default: "WISERD — Independent Commerce",
    template: "%s | WISERD",
  },
  description:
    "Discover physical goods, digital products, gaming items, and services from independent sellers on WISERD, with structured escrow workflows, direct messaging, and community discussions.",
  openGraph: {
    title: "WISERD — Independent Commerce",
    description:
      "Independent marketplace for physical goods, digital products, gaming hardware, and studio services with structured escrow.",
    siteName: "WISERD",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WISERD — Independent Commerce",
    description:
      "Independent marketplace for physical goods, digital products, gaming hardware, and studio services with structured escrow.",
  },
};

export const viewport: Viewport = {
  themeColor: "#F7F7F5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <body className="min-h-dvh bg-[#F7F7F5] text-[#171717] selection:bg-[#5278E8]/20 selection:text-[#171717]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[120] focus:rounded-lg focus:bg-[#315FC8] focus:px-4 focus:py-2 text-xs font-medium text-white shadow-lg focus:outline-none"
        >
          Skip to main content
        </a>
        <WiserdProvider>
          <SiteShell>{children}</SiteShell>
        </WiserdProvider>
      </body>
    </html>
  );
}
