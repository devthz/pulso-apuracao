import type { Metadata } from "next";
import { PresidentSection } from "@/components/President";

export const metadata: Metadata = { title: "Presidente · 1º turno · PULSO Eleições 2026" };

export default function Page() {
  return <PresidentSection turno={1} />;
}
