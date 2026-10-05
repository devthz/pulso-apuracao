import type { Metadata } from "next";
import { SenadoSection } from "@/components/Sections";

export const metadata: Metadata = { title: "Senado · PULSO Eleições 2026" };

export default function Page() {
  return <SenadoSection className="mt-2" />;
}
