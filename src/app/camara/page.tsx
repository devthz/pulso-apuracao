import type { Metadata } from "next";
import { CamaraSection } from "@/components/Sections";

export const metadata: Metadata = { title: "Câmara dos Deputados · PULSO Eleições 2026" };

export default function Page() {
  return <CamaraSection className="mt-2" />;
}
