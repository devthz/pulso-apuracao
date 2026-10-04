"use client";
import clsx from "clsx";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { useBancada, useCorrida } from "@/hooks/data";
import { fmtInt, fmtPct, soHora } from "@/lib/format";
import { corPartido } from "@/lib/parties";
import type { CargoKey, Corrida } from "@/lib/tse/types";
import { UF_MAP, UFS } from "@/lib/ufs";
import { Hemicycle } from "./Hemicycle";
import { MunicipalMap } from "./MunicipalMap";
import { Avatar, Bar, Num, Panel, PartyTag, ProgressRing, Skeleton, StatusTag, Vazio } from "./ui";

export function UFView({ uf }: { uf: string }) {
  const info = UF_MAP[uf];
  const { data: gov } = useCorrida("governador", uf);
  const i = UFS.findIndex((u) => u.sigla === uf);
  const ant = UFS[(i - 1 + UFS.length) % UFS.length];
  const prox = UFS[(i + 1) % UFS.length];

  return (
    <div>
      {/* Hero */}
      <div className="relative overflow-hidden pb-4 pt-6">
        <div
          aria-hidden
          className="font-display outline-text pointer-events-none absolute -right-6 -top-10 select-none [mask-image:linear-gradient(#000_35%,transparent_85%)] text-[clamp(180px,32vw,460px)] font-black leading-none tracking-[-0.06em]"
        >
          {uf.toUpperCase()}
        </div>
        <div className="flex items-center gap-3 font-mono text-[12px] text-muted">
          <Link href="/" className="hover:text-text">← Brasil</Link>
          <span className="text-dim">/</span>
          <span>{info.regiao}</span>
        </div>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-8">
          <div>
            <div className="kicker mb-3">Apuração estadual</div>
            <h1 className="font-display text-[48px] font-bold leading-[0.95] tracking-[-0.03em] sm:text-[84px]">{info.nome}</h1>
            <div className="mt-5 flex gap-2">
              <Link href={`/uf/${ant.sigla}`} className="chip !h-8 hover:border-white/30">← {ant.sigla.toUpperCase()}</Link>
              <Link href={`/uf/${prox.sigla}`} className="chip !h-8 hover:border-white/30">{prox.sigla.toUpperCase()} →</Link>
            </div>
          </div>
          {gov && (
            <div className="flex items-center gap-8">
              <MiniStat k="Eleitorado" v={gov.eleitorado.total} />
              <MiniStat k="Comparecimento" v={gov.eleitorado.comparecimento} />
              <ProgressRing pct={gov.secoes.pct} size={120}>
                <div className="font-display text-xl font-bold">
                  <Num value={gov.secoes.pct} kind="pct" casas={1} />
                  <span className="text-xs text-muted">%</span>
                </div>
                <div className="font-mono text-[9px] tracking-widest text-muted">SEÇÕES</div>
              </ProgressRing>
            </div>
          )}
        </div>
      </div>

      <Panel className="mt-10 p-6 sm:p-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="kicker">Presidente · quem lidera em cada cidade</div>
            <div className="font-display mt-2 text-2xl font-semibold">Mapa de {info.nome}</div>
          </div>
          <div className="font-mono text-[11px] text-dim">duplo clique aproxima · arraste para mover</div>
        </div>
        <MunicipalMap uf={uf} className="mx-auto max-w-[900px]" />
      </Panel>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <RaceCard cargo="governador" uf={uf} titulo="Governador" />
        <RaceCard cargo="senador" uf={uf} titulo="Senado" sub="2 vagas" />
      </div>
      <div className="mt-6">
        <RaceCard cargo="presidente" uf={uf} titulo={`Presidente em ${info.nome}`} horizontal />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <BancadaCard cargo="depfed" uf={uf} titulo="Câmara dos Deputados" sub={`Bancada de ${info.nome}`} />
        <BancadaCard cargo="depest" uf={uf} titulo={uf === "df" ? "Câmara Legislativa" : "Assembleia Legislativa"} sub="Deputados estaduais" />
      </div>
    </div>
  );
}

function MiniStat({ k, v }: { k: string; v: number }) {
  return (
    <div className="hidden text-right sm:block">
      <div className="kicker !text-[10px]">{k}</div>
      <div className="font-display mt-2 text-2xl font-semibold">
        <Num value={v} kind="compact" />
      </div>
    </div>
  );
}

function CabecalhoCard({ titulo, sub, corrida }: { titulo: string; sub?: string; corrida?: Corrida }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <div className="font-display text-2xl font-semibold">{titulo}</div>
        <div className="mt-1 font-mono text-[11px] text-dim">
          {sub ? `${sub} · ` : ""}
          {corrida ? `${fmtPct(corrida.secoes.pct, 2)}% das seções · ${soHora(corrida.atualizadoEm)}` : "—"}
        </div>
      </div>
      {corrida && <StatusTag status={corrida.status} />}
    </div>
  );
}

function RaceCard({ cargo, uf, titulo, sub, horizontal }: { cargo: CargoKey; uf: string; titulo: string; sub?: string; horizontal?: boolean }) {
  const { data, error } = useCorrida(cargo, uf);
  const [todos, setTodos] = useState(false);
  const cands = data?.candidatos.filter((c) => c.valido) ?? [];
  const lista = todos ? cands : cands.slice(0, horizontal ? 8 : 6);
  const vagas = data?.vagas ?? 1;

  return (
    <Panel className="p-6 sm:p-8">
      <CabecalhoCard titulo={titulo} sub={sub} corrida={data} />
      {!data && !error && <Skeleton className="h-64" />}
      {error && <Vazio titulo="Aguardando o TSE" texto="Esta disputa ainda não tem totalização publicada." />}
      <div className={clsx("grid gap-x-8", horizontal ? "gap-y-4 md:grid-cols-2" : "gap-y-4")}>
        {lista.map((c, i) => {
          const cor = corPartido(c.partido);
          const destaque = i < vagas;
          return (
            <motion.div key={c.id} layout className="flex items-center gap-4">
              <span className="w-4 font-mono text-[11px] text-dim">{i + 1}</span>
              <Avatar nome={c.nome} foto={c.foto} partido={c.partido} size={destaque ? 52 : 40} ring={destaque} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={clsx("truncate", destaque ? "text-[16px] font-medium" : "text-[14px] text-text/80")}>{c.nome}</span>
                  {(c.eleito || c.segundoTurno) && <StatusTag eleito={c.eleito} segundoTurno={c.segundoTurno} />}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <Bar pct={c.pct} cor={cor} glow={destaque} className={destaque ? "!h-2" : "!h-1"} />
                  <span className="hidden font-mono text-[10px] text-dim sm:inline">{c.partido}</span>
                </div>
                <div className="mt-1 font-mono text-[10.5px] text-dim">{fmtInt(c.votos)} votos{c.vice ? ` · vice ${c.vice}` : ""}</div>
              </div>
              <div className={clsx("font-display text-right tabular-nums", destaque ? "text-[28px] font-bold" : "text-lg")} style={destaque ? { color: cor } : undefined}>
                <Num value={c.pct} kind="pct" />
                <span className="text-[0.5em] text-muted">%</span>
              </div>
            </motion.div>
          );
        })}
      </div>
      {cands.length > lista.length || todos ? (
        <button onClick={() => setTodos((v) => !v)} className="mt-6 text-[13px] text-lime hover:underline">
          {todos ? "Mostrar menos" : `Ver todos os ${cands.length} candidatos`}
        </button>
      ) : null}
    </Panel>
  );
}

function BancadaCard({ cargo, uf, titulo, sub }: { cargo: "depfed" | "depest"; uf: string; titulo: string; sub: string }) {
  const { data: b } = useBancada(cargo, uf);
  const [todos, setTodos] = useState(false);
  const eleitos = b ? (todos ? b.eleitos : b.eleitos.slice(0, 10)) : [];
  return (
    <Panel className="p-6 sm:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="font-display text-2xl font-semibold">{titulo}</div>
          <div className="mt-1 font-mono text-[11px] text-dim">
            {sub} · {b ? `${fmtPct(b.pctApurado, 1)}% apurado` : "—"}
          </div>
        </div>
        {b && (
          <span className={clsx("chip", b.oficial ? "border-lime/40 text-lime" : "border-amber/40 text-amber")}>
            {b.oficial ? "OFICIAL" : "PROJEÇÃO"}
          </span>
        )}
      </div>
      {b ? <Hemicycle partidos={b.partidos} total={b.totalVagas} compact label="CADEIRAS" /> : <Skeleton className="aspect-[2/1]" />}
      <div className="mt-8 border-t border-white/[0.06] pt-6">
        <div className="kicker mb-4">{b?.oficial ? "Eleitos" : "Eleitos pela projeção"}</div>
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {eleitos.map((e) => (
            <div key={e.id} className="flex items-center gap-3">
              <Avatar nome={e.nome} foto={e.foto} partido={e.partido} size={32} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px]">{e.nome}</div>
                <div className="flex items-center gap-2 font-mono text-[10px] text-dim">
                  <span style={{ color: corPartido(e.partido) }}>{e.partido}</span> {fmtInt(e.votos)}
                </div>
              </div>
            </div>
          ))}
        </div>
        {b && b.eleitos.length > 10 && (
          <button onClick={() => setTodos((v) => !v)} className="mt-5 text-[13px] text-lime hover:underline">
            {todos ? "Mostrar menos" : `Ver os ${b.eleitos.length}`}
          </button>
        )}
      </div>
    </Panel>
  );
}

export { PartyTag };
