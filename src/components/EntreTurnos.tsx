"use client";
import { motion } from "motion/react";
import Link from "next/link";
import { fmtInt, fmtPct } from "@/lib/format";
import { corPartido } from "@/lib/parties";
import { comParams } from "@/lib/qs";
import type { FaseInfo, Finalista } from "@/lib/tse/source";
import { UF_MAP } from "@/lib/ufs";
import { hms, useRelogioPublico } from "./chrome";
import { Avatar, Panel, SectionTitle } from "./ui";

const ABAS = [
  { href: "/primeiro-turno", rot: "Presidente" },
  { href: "/governadores", rot: "Governadores" },
  { href: "/senado", rot: "Senado" },
  { href: "/camara", rot: "Câmara" },
  { href: "/assembleias", rot: "Assembleias" },
];

export function AbasPrimeiroTurno({ titulo = "Resultados do 1º turno" }: { titulo?: string }) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <span className="kicker mr-2">{titulo}</span>
      {ABAS.map((a) => (
        <Link key={a.href} href={comParams(a.href)} className="chip !h-8 !px-4 text-muted transition hover:border-white/30 hover:text-text">
          {a.rot} →
        </Link>
      ))}
    </div>
  );
}

function Contagem({ alvo }: { alvo: string }) {
  const agora = useRelogioPublico();
  if (!agora) return <div className="h-[96px]" />;
  const ms = Math.max(0, new Date(alvo).getTime() - agora.getTime());
  const dias = Math.floor(ms / 86_400_000);
  const x = hms(ms % 86_400_000);
  const blocos = [
    [String(dias), "dias"],
    [x.h, "horas"],
    [x.m, "min"],
    [x.s, "seg"],
  ];
  return (
    <div className="flex items-end gap-3 sm:gap-5">
      {blocos.map(([v, r], i) => (
        <div key={r} className="flex items-end gap-3 sm:gap-5">
          <div className="text-center">
            <div className="font-display text-5xl font-bold tabular-nums tracking-tight sm:text-7xl">
              <span className="text-gradient">{v}</span>
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-dim">{r}</div>
          </div>
          {i < blocos.length - 1 && <span className="pb-6 font-display text-3xl text-dim sm:text-5xl">:</span>}
        </div>
      ))}
    </div>
  );
}

function CartaoFinalista({ f, lado, rotulo }: { f: Finalista; lado: 0 | 1; rotulo: string }) {
  const cor = corPartido(f.partido);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: lado * 0.1 }}
      className="relative overflow-hidden rounded-[24px] border border-white/10 p-6 sm:p-8"
      style={{ background: `radial-gradient(120% 90% at ${lado ? "100%" : "0%"} 0%, ${cor}33, transparent 60%), rgba(255,255,255,.02)` }}
    >
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${cor}, transparent)` }} />
      <div className="flex items-start justify-between">
        <Avatar nome={f.nome} foto={f.foto} partido={f.partido} size={96} />
        <span className="chip" style={{ color: cor, borderColor: `${cor}55` }}>
          {f.partido} · {f.numero}
        </span>
      </div>
      <div className="mt-6 font-display text-[28px] font-semibold leading-tight sm:text-[34px]">{f.nome}</div>
      <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-dim">{rotulo}</div>
      <div className="mt-1 flex items-baseline gap-3">
        <span className="font-display text-5xl font-bold tabular-nums" style={{ color: cor }}>
          {fmtPct(f.pct, 2)}%
        </span>
        <span className="font-mono text-[12px] text-muted">{fmtInt(f.votos)} votos</span>
      </div>
    </motion.div>
  );
}

export function EntreTurnosHero({ info }: { info: FaseInfo }) {
  const [a, b] = info.finalistas;
  return (
    <section>
      <Panel className="overflow-hidden p-6 sm:p-12">
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 -z-10 h-[520px] w-[520px] rounded-full bg-[conic-gradient(from_90deg,var(--cyan),var(--violet),var(--pink),var(--cyan))] opacity-[0.12] blur-[90px]" />
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div>
            <div className="kicker mb-4 flex items-center gap-3">
              <span className="h-px w-8 bg-gradient-to-r from-cyan to-transparent" />
              Domingo, 25 de outubro de 2026
            </div>
            <h1 className="font-display text-[44px] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[76px]">
              Rumo ao
              <br />
              <span className="outline-text">2º turno</span>
            </h1>
          </div>
          <div>
            <div className="kicker mb-3">A apuração começa em</div>
            <Contagem alvo={info.inicio2t} />
          </div>
        </div>

        {info.presidenteEleito ? (
          <div className="mt-12 max-w-xl">
            <CartaoFinalista f={info.presidenteEleito} lado={0} rotulo="eleito presidente no 1º turno" />
          </div>
        ) : (
          a &&
          b && (
            <div className="relative mt-12 grid gap-4 md:grid-cols-2 md:gap-10">
              <CartaoFinalista f={a} lado={0} rotulo="1º lugar no 1º turno" />
              <CartaoFinalista f={b} lado={1} rotulo="2º lugar no 1º turno" />
              <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#07080d] font-display text-sm font-bold text-muted md:flex">
                VS
              </div>
            </div>
          )
        )}
        <AbasPrimeiroTurno />
      </Panel>
    </section>
  );
}

export function GovernadoresSegundoTurno({ info }: { info: FaseInfo }) {
  if (!info.gov2t.length) return null;
  return (
    <section className="mt-28">
      <SectionTitle
        id="governadores-2t"
        kicker={`${info.gov2t.length} estados escolhem o governador no 2º turno`}
        title={
          <>
            Governadores no 2º turno<span className="text-lime">.</span>
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {info.gov2t.map((g) => (
          <Link key={g.uf} href={comParams(`/uf/${g.uf}`)} className="block">
            <Panel className="group h-full overflow-hidden !rounded-[22px] p-5 transition duration-300 hover:-translate-y-1">
              <div aria-hidden className="font-display outline-text pointer-events-none absolute -bottom-7 -right-2 text-[110px] font-black leading-none opacity-50">
                {g.uf.toUpperCase()}
              </div>
              <div className="text-[15px] font-medium">{UF_MAP[g.uf]?.nome}</div>
              <div className="mt-0.5 font-mono text-[10.5px] text-dim">resultado do 1º turno</div>
              <div className="mt-5 space-y-3">
                {g.finalistas.map((f) => (
                  <div key={f.numero} className="flex items-center gap-3">
                    <Avatar nome={f.nome} foto={f.foto} partido={f.partido} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-medium">{f.nome}</div>
                      <div className="font-mono text-[10.5px] text-dim">
                        {f.partido} · {fmtInt(f.votos)} votos
                      </div>
                    </div>
                    <div className="font-display text-xl font-bold tabular-nums" style={{ color: corPartido(f.partido) }}>
                      {fmtPct(f.pct, 1)}%
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </Link>
        ))}
      </div>
    </section>
  );
}
