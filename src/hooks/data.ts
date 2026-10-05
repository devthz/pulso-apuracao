"use client";
import useSWR from "swr";
import { comParams } from "@/lib/qs";
import type { Projecao } from "@/lib/tse/projecao";
import type { FaseInfo } from "@/lib/tse/source";
import type { Bancada, CargoKey, Corrida, Panorama } from "@/lib/tse/types";

export const REFRESH_MS = 5_000;
export type Turno = 1 | 2;

class ApiErro extends Error {
  constructor(public status: number, msg: string) {
    super(msg);
  }
}

async function fetcher<T>(path: string): Promise<T> {
  const r = await fetch(comParams(path));
  if (!r.ok) throw new ApiErro(r.status, (await r.json().catch(() => ({})))?.erro ?? "erro");
  return r.json();
}

const opts = { refreshInterval: REFRESH_MS, keepPreviousData: true, revalidateOnFocus: true, dedupingInterval: 1500 };
const t2 = (turno: Turno, sep = "?") => (turno === 2 ? `${sep}turno=2` : "");

export const useCorrida = (cargo: CargoKey, abr: string | null, turno: Turno = 1) =>
  useSWR<Corrida, ApiErro>(abr ? `/api/corrida/${cargo}/${abr}${t2(turno)}` : null, fetcher, opts);

export const usePanorama = (cargo: "presidente" | "governador" | "senador", turno: Turno = 1) =>
  useSWR<Panorama, ApiErro>(`/api/panorama/${cargo}${t2(turno)}`, fetcher, { ...opts, refreshInterval: 6_000 });

export const useBancada = (cargo: "depfed" | "depest" | "senador", uf?: string | null) =>
  useSWR<Bancada, ApiErro>(
    cargo === "depest" && !uf ? null : `/api/bancada/${cargo}${uf ? `?uf=${uf}` : ""}`,
    fetcher,
    { ...opts, refreshInterval: 15_000 },
  );

export const useProjecao = (turno: Turno = 1) =>
  useSWR<Projecao, ApiErro>(`/api/projecao${t2(turno)}`, fetcher, { ...opts, refreshInterval: 10_000 });

/** fase do site (1º turno, entre turnos, 2º turno) */
export const useFase = () => useSWR<FaseInfo, ApiErro>("/api/fase", fetcher, { refreshInterval: 60_000, keepPreviousData: true });
export const turnoDaFase = (f?: FaseInfo) => (f?.fase === "2t" ? 2 : 1) as Turno;
