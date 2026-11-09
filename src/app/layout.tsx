import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@vercel/analytics/next";
import { Background, Header, Spotlight, Ticker } from "@/components/chrome";
import { Footer } from "@/components/Footer";
import "./globals.css";

const TITLE = "PULSO · Apuração Eleições 2026 ao vivo";
const DESCRIPTION =
  "Acompanhe a apuração das eleições 2026 em todo o Brasil em tempo real: Presidente, Governadores, Senado, Câmara e Assembleias, com dados oficiais do TSE.";

// Link previews: the image comes from src/app/opengraph-image.png (source in scripts/og/og.html).
export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "https://pulso-apuracao-y6bk.vercel.app"),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "PULSO",
    url: "/",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = { themeColor: "#040509", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen">
        <Background />
        <Spotlight />
        <Header />
        <Ticker />
        <main className="mx-auto max-w-[1500px] px-4 pb-24 pt-8 sm:px-8">{children}</main>
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
