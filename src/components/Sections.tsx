"use client";
import clsx from "clsx";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { useBancada, usePanorama } from "@/hooks/data";
import { fmtInt, fmtPct } from "@/lib/format";
import { corPartido } from "@/lib/parties";
import type { Bancada, ResumoUF } from "@/lib/tse/types";
import { REGIOES, UF_MAP, UFS, type Regiao } from "@/lib/ufs";
import { Hemicycle } from "./Hemicycle";
import { Avatar, Bar, Num, Panel, PartyTag, SectionTitle, Skeleton, StatusTag, Vazio } from "./ui";

/* ================= Governadores ================= */
export function GovernadoresSection() {
  const { data } = usePanorama("governador");
  const [reg, setReg] = useState<Regiao | "Todas">("Todas");
  const ufs = (data?.ufs ?? []).filter((u) => reg === "Todas" || UF_MAP[u.uf]?.regiao === reg);
  const eleitos = data?.ufs.filter((u) => u.lideres.some((l) => l.eleito)).length ?? 0;
  const seg = data?.ufs.filter((u) => u.lideres.some((l) => l.segundoTurno)).length ?? 0;
  const apurando = (data?.ufs.length ?? 0) - eleitos - seg;

  return (
    <section className="mt-28">
      <SectionTitle
        id="governadores"
        kicker="27 disputas estaduais"
        title={
          <>
            Governadores<span className="text-lime">.</span>
          </>
        }
        right={
          <div className="flex gap-6">
            <Contador n={eleitos} label="eleitos no 1º turno" cor="var(--lime)" />
            <Contador n={seg} label="vão ao 2º turno" cor="var(--cyan)" />
            <Contador n={apurando} label="em apuração" cor="var(--amber)" />
          </div>
        }
      />
      <div className="scrollbar-none mb-5 flex gap-2 overflow-x-auto">
        {(["Todas", ...REGIOES] as const).map((r) => (
          <button
            key={r}
            onClick={() => setReg(r)}
            className={clsx(
              "chip !h-8 !px-4 transition",
              reg === r ? "!border-white/0 !bg-white !text-black" : "text-muted hover:text-text",
            )}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {!data && Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        {ufs.map((u, i) => (
          <motion.div key={u.uf} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}>
            <CardUF u={u} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Contador({ n, label, cor }: { n: number; label: string; cor: string }) {
  return (
    <div className="text-right">
      <div className="font-display text-3xl font-bold leading-none" style={{ color: cor }}>
        <Num value={n} />
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}

function CardUF({ u }: { u: ResumoUF }) {
  const [a, b] = u.lideres;
  const cor = a && u.pct > 0 ? corPartido(a.partido) : "#3a3f50";
  return (
    <Link href={`/uf/${u.uf}`} className="block">
      <Panel className="group h-full overflow-hidden !rounded-[22px] p-5 transition duration-300 hover:-translate-y-1">
        <div
          aria-hidden
          className="font-display outline-text pointer-events-none absolute -bottom-7 -right-2 text-[110px] font-black leading-none opacity-50 transition duration-500 group-hover:-translate-y-2 group-hover:opacity-100"
        >
          {u.uf.toUpperCase()}
        </div>
        <div className="absolute inset-y-0 left-0 w-[3px]" style={{ background: `linear-gradient(${cor}, transparent)` }} />
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[15px] font-medium">{UF_MAP[u.uf]?.nome}</div>
            <div className="mt-0.5 font-mono text-[10.5px] text-dim">{fmtPct(u.pct, 1)}% apurado</div>
          </div>
          <StatusTag
            eleito={u.lideres.some((l) => l.eleito)}
            segundoTurno={u.lideres.some((l) => l.segundoTurno)}
            status={u.status}
          />
        </div>
        <Bar pct={u.pct} cor="#ffffff" glow={false} className="mt-3 !h-[3px] opacity-50" />
        {a ? (
          <div className="mt-5 space-y-3">
            {[a, b].filter(Boolean).map((c, i) => (
              <div key={c!.id} className={clsx("flex items-center gap-3", i === 1 && "opacity-70")}>
                <Avatar nome={c!.nome} foto={c!.foto} partido={c!.partido} size={i === 0 ? 44 : 32} />
                <div className="min-w-0 flex-1">
                  <div className={clsx("truncate", i === 0 ? "text-[15px] font-medium" : "text-[13px]")}>{c!.nome}</div>
                  <div className="font-mono text-[10.5px] text-dim">{c!.partido}</div>
                </div>
                <div className={clsx("font-display tabular-nums", i === 0 ? "text-2xl font-bold" : "text-base")} style={i === 0 ? { color: cor } : undefined}>
                  <Num value={c!.pct} kind="pct" casas={1} />
                  <span className="text-[0.55em] text-muted">%</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6 space-y-2">
            <div className="skeleton h-4 w-2/3" />
            <div className="skeleton h-3 w-1/3" />
          </div>
        )}
      </Panel>
    </Link>
  );
}

/* ================= Senado ================= */
export function SenadoSection() {
  const { data: b } = useBancada("senador");
  const { data: p } = usePanorama("senador");
  return (
    <section className="mt-28">
      <SectionTitle
        id="senado"
        kicker="2/3 das cadeiras em disputa · 2 por estado"
        title={
          <>
            Senado Federal<span className="text-cyan">.</span>
          </>
        }
        right={b && <ProjTag b={b} />}
      />
      <div className="grid gap-6 xl:grid-cols-12">
        <Panel className="flex flex-col justify-center p-6 sm:p-10 xl:col-span-5">
          {b ? <Hemicycle partidos={b.partidos} total={b.totalVagas || 54} label="VAGAS EM JOGO" /> : <Skeleton className="aspect-[2/1]" />}
        </Panel>
        <Panel className="p-4 sm:p-6 xl:col-span-7">
          <div className="grid gap-x-6 sm:grid-cols-2">
            {(p?.ufs ?? []).map((u) => (
              <Link key={u.uf} href={`/uf/${u.uf}`} className="flex items-center gap-3 border-b border-white/[0.05] py-2.5 transition hover:bg-white/[0.02]">
                <span className="font-display w-8 text-[13px] font-bold text-muted">{u.uf.toUpperCase()}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  {u.lideres.slice(0, 2).map((l) => (
                    <div key={l.id} className="flex items-center gap-2 text-[12.5px]">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: corPartido(l.partido) }} />
                      <span className="truncate">{l.nome}</span>
                      <span className="font-mono text-[10px] text-dim">{l.partido}</span>
                      {l.eleito && <span className="text-[10px] text-lime">✓</span>}
                      <span className="ml-auto font-mono tabular-nums text-muted">{fmtPct(l.pct, 1)}%</span>
                    </div>
                  ))}
                  {!u.lideres.length && <div className="skeleton h-3 w-1/2" />}
                </div>
              </Link>
            ))}
            {!p && Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="my-2 h-9" />)}
          </div>
        </Panel>
      </div>
    </section>
  );
}

function ProjTag({ b }: { b: Bancada }) {
  return b.oficial ? (
    <span className="chip border-lime/40 bg-lime/10 text-lime">RESULTADO OFICIAL TSE</span>
  ) : (
    <span className="chip border-amber/40 text-amber" title="Calculada a partir dos votos apurados até agora">
      PROJEÇÃO · {fmtPct(b.pctApurado, 1)}% APURADO
    </span>
  );
}

/* ================= Câmara ================= */
export function CamaraSection() {
  const { data: b } = useBancada("depfed");
  const top = b?.partidos.slice(0, 10) ?? [];
  const max = top[0]?.cadeiras ?? 1;
  return (
    <section className="mt-28">
      <SectionTitle
        id="camara"
        kicker="Bancadas eleitas · regra do quociente eleitoral"
        title={
          <>
            Câmara dos Deputados<span className="text-pink">.</span>
          </>
        }
        right={b && <ProjTag b={b} />}
      />
      <div className="grid gap-6 xl:grid-cols-12">
        <Panel className="overflow-hidden p-6 sm:p-10 xl:col-span-8">
          {b ? (
            b.totalVagas ? (
              <Hemicycle partidos={b.partidos} total={b.totalVagas} sub={b.oficial ? "eleitos" : "projeção"} />
            ) : (
              <Vazio titulo="Aguardando dados" />
            )
          ) : (
            <Skeleton className="aspect-[2/1]" />
          )}
        </Panel>
        <div className="flex flex-col gap-6 xl:col-span-4">
          <Panel className="p-6">
            <div className="kicker mb-4">Maiores bancadas</div>
            <div className="space-y-3">
              {top.map((p, i) => (
                <div key={p.partido} className="flex items-center gap-3">
                  <span className="w-4 font-mono text-[10px] text-dim">{i + 1}</span>
                  <span className="w-[86px] truncate text-[13px] font-medium">{p.partido}</span>
                  <Bar pct={(p.cadeiras / max) * 100} cor={corPartido(p.partido)} className="!h-2" />
                  <span className="font-display w-9 text-right text-[15px] font-semibold tabular-nums">
                    <Num value={p.cadeiras} />
                  </span>
                </div>
              ))}
              {!b && Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-4" />)}
            </div>
          </Panel>
          <Panel className="flex-1 p-6">
            <div className="kicker mb-4">Mais votados do país</div>
            <div className="space-y-3">
              {b?.eleitos.slice(0, 6).map((e, i) => (
                <div key={e.id + (e.uf ?? "")} className="flex items-center gap-3">
                  <span className="w-4 font-mono text-[10px] text-dim">{i + 1}</span>
                  <Avatar nome={e.nome} foto={e.foto} partido={e.partido} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px]">{e.nome}</div>
                    <div className="font-mono text-[10px] text-dim">
                      {e.partido} · {e.uf?.toUpperCase()}
                    </div>
                  </div>
                  <span className="font-mono text-[12px] tabular-nums text-muted">{fmtInt(e.votos)}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </section>
  );
}

/* ================= Assembleias ================= */
export function AssembleiasSection() {
  const [uf, setUf] = useState("sp");
  const { data: b, isLoading } = useBancada("depest", uf);
  return (
    <section className="mt-28">
      <SectionTitle
        id="assembleias"
        kicker="Deputados estaduais e distritais"
        title={
          <>
            Assembleias<span className="text-violet">.</span>
          </>
        }
        right={b && <ProjTag b={b} />}
      />
      <div className="scrollbar-none mb-5 flex gap-1.5 overflow-x-auto pb-1">
        {UFS.map((u) => (
          <button
            key={u.sigla}
            onClick={() => setUf(u.sigla)}
            className={clsx(
              "font-display h-9 min-w-[44px] rounded-full border px-3 text-[12px] font-semibold transition",
              uf === u.sigla ? "border-transparent bg-white text-black" : "border-white/10 text-muted hover:border-white/25 hover:text-text",
            )}
          >
            {u.sigla.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-12">
        <Panel className="p-6 sm:p-10 xl:col-span-6">
          <div className="mb-4 flex items-baseline justify-between">
            <div className="font-display text-xl font-semibold">{uf === "df" ? "Câmara Legislativa do DF" : `Assembleia · ${UF_MAP[uf].nome}`}</div>
          </div>
          {b && !isLoading ? <Hemicycle key={uf} partidos={b.partidos} total={b.totalVagas} compact label="CADEIRAS" /> : <Skeleton className="aspect-[2/1]" />}
        </Panel>
        <Panel className="p-6 xl:col-span-6">
          <div className="kicker mb-4">Mais votados · {UF_MAP[uf].nome}</div>
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {b?.eleitos.slice(0, 14).map((e, i) => (
              <div key={e.id} className="flex items-center gap-3">
                <span className="w-4 font-mono text-[10px] text-dim">{i + 1}</span>
                <Avatar nome={e.nome} foto={e.foto} partido={e.partido} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px]">{e.nome}</div>
                  <div className="font-mono text-[10px] text-dim">{e.partido}</div>
                </div>
                <span className="font-mono text-[11px] tabular-nums text-muted">{fmtInt(e.votos)}</span>
              </div>
            ))}
            {!b && Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
          </div>
          <Link href={`/uf/${uf}`} className="mt-6 inline-flex items-center gap-2 text-[13px] text-lime hover:underline">
            Ver tudo de {UF_MAP[uf].nome} →
          </Link>
        </Panel>
      </div>
    </section>
  );
}

export { PartyTag };
