import type { Metadata } from "next";
import { AssembleiasSection } from "@/components/Sections";

export const metadata: Metadata = { title: "Assembleias · PULSO Eleições 2026" };

export default function Page() {
  return <AssembleiasSection className="mt-2" />;
}
