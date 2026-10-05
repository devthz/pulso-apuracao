import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@vercel/analytics/next";
import { Background, Header, Spotlight, Ticker } from "@/components/chrome";
import { Footer } from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "PULSO · Apuração Eleições 2026 ao vivo",
  description: "Acompanhe a apuração das eleições 2026 em todo o Brasil em tempo real: Presidente, Governadores, Senado, Câmara e Assembleias, com dados oficiais do TSE.",
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
