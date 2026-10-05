import type { Metadata } from "next";
import { GovernadoresSection } from "@/components/Sections";

export const metadata: Metadata = { title: "Governadores · 1º turno · PULSO Eleições 2026" };

export default function Page() {
  return <GovernadoresSection className="mt-2" />;
}
