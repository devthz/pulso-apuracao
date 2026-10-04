import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UFView } from "@/components/UFView";
import { UF_MAP, UFS } from "@/lib/ufs";

export function generateStaticParams() {
  return UFS.map((u) => ({ uf: u.sigla }));
}

export async function generateMetadata({ params }: PageProps<"/uf/[uf]">): Promise<Metadata> {
  const { uf } = await params;
  const info = UF_MAP[uf];
  return { title: info ? `${info.nome} · PULSO Eleições 2026` : "PULSO" };
}

export default async function Page({ params, searchParams }: PageProps<"/uf/[uf]">) {
  const { uf } = await params;
  if (!UF_MAP[uf]) notFound();
  const cidade = (await searchParams).cidade;
  return <UFView uf={uf} cidade={typeof cidade === "string" ? cidade : undefined} />;
}
