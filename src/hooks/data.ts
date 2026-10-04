"use client";
import useSWR from "swr";
import type { Bancada, CargoKey, Corrida, Panorama } from "@/lib/tse/types";

export const REFRESH_MS = 5_000;

class ApiErro extends Error {
  constructor(public status: number, msg: string) {
    super(msg);
  }
}

function comModo(path: string) {
  if (typeof window === "undefined") return path;
  const m = new URLSearchParams(window.location.search).get("modo");
  return m ? `${path}${path.includes("?") ? "&" : "?"}modo=${m}` : path;
}

async function fetcher<T>(path: string): Promise<T> {
  const r = await fetch(comModo(path));
  if (!r.ok) throw new ApiErro(r.status, (await r.json().catch(() => ({})))?.erro ?? "erro");
  return r.json();
}

const opts = { refreshInterval: REFRESH_MS, keepPreviousData: true, revalidateOnFocus: true, dedupingInterval: 1500 };

export const useCorrida = (cargo: CargoKey, abr: string | null) =>
  useSWR<Corrida, ApiErro>(abr ? `/api/corrida/${cargo}/${abr}` : null, fetcher, opts);

export const usePanorama = (cargo: "presidente" | "governador" | "senador") =>
  useSWR<Panorama, ApiErro>(`/api/panorama/${cargo}`, fetcher, { ...opts, refreshInterval: 6_000 });

export const useBancada = (cargo: "depfed" | "depest" | "senador", uf?: string | null) =>
  useSWR<Bancada, ApiErro>(
    cargo === "depest" && !uf ? null : `/api/bancada/${cargo}${uf ? `?uf=${uf}` : ""}`,
    fetcher,
    { ...opts, refreshInterval: 15_000 },
  );
