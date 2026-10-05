"use client";
import clsx from "clsx";
import { motion } from "motion/react";
import { useProjecao } from "@/hooks/data";
import { fmtCompact, fmtPct } from "@/lib/format";
import { corPartido } from "@/lib/parties";
import type { Candidato } from "@/lib/tse/types";
import { Avatar, Num, Panel } from "./ui";

const pctTxt = (p: number) => (p >= 0.995 ? ">99" : p <= 0.005 ? "<1" : String(Math.round(p * 100)));

function Medidor({ valor, rotulo, cor }: { valor: number; rotulo: string; cor: string }) {
  const r = 54;
  const c = Math.PI * r; // semicírculo
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[78px] w-[140px]">
        <svg viewBox="0 0 140 78" className="h-full w-full overflow-visible">
          <path d="M16 70 A54 54 0 0 1 124 70" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="10" strokeLinecap="round" />
          <motion.path
            d="M16 70 A54 54 0 0 1 124 70"
            fill="none"
            stroke={cor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: c * (1 - valor) }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
            style={{ filter: `drop-shadow(0 0 8px ${cor})` }}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center font-display text-[28px] font-bold leading-none">
          {pctTxt(valor)}
          <span className="text-sm text-muted">%</span>
        </div>
      </div>
      <div className="mt-2 max-w-[160px] text-center text-[12px] leading-snug text-muted">{rotulo}</div>
    </div>
  );
}

export function ProjecaoPanel({ candidatos, turno = 1 }: { candidatos: Candidato[]; turno?: 1 | 2 }) {
  const { data: p } = useProjecao(turno);
  if (!p || p.pctApurado <= 0) return null;
  const lista = p.candidatos.slice(0, 4);
  const max = Math.max(55, Math.ceil(Math.max(...lista.map((c) => c.p95)) / 5) * 5 + 5);
  const x = (v: number) => `${(v / max) * 100}%`;
  const lider = lista[0];
  const fotoDe = (n: string) => candidatos.find((c) => c.numero === n)?.foto;
  const conf = { baixa: "border-pink/40 text-pink", media: "border-amber/40 text-amber", alta: "border-lime/40 text-lime" }[p.confianca];
  const decidido = p.pctApurado >= 99.99;

  return (
    <Panel className="mt-6 overflow-hidden p-6 sm:p-10">
      <div aria-hidden className="pointer-events-none absolute -left-32 -top-32 -z-10 h-80 w-80 rounded-full bg-violet/20 blur-[100px]" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="kicker mb-3 flex items-center gap-3">
            <span className="h-px w-8 bg-gradient-to-r from-violet to-transparent" />
            Modelo PULSO · {fmtCompact(p.simulacoes)} simulações
          </div>
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Projeção <span className="text-dim">&</span> probabilidades
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={clsx("chip", conf)}>CONFIANÇA {p.confianca.toUpperCase()}</span>
          <span className="chip text-muted">
            ~{fmtCompact(p.votosRestantes)} VOTOS VÁLIDOS A APURAR
          </span>
        </div>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-12">
        <div className="flex flex-wrap items-start justify-center gap-8 lg:col-span-4 lg:flex-col lg:items-center">
          {turno === 2 ? (
            lista.slice(0, 2).map((c) => (
              <Medidor key={c.numero} valor={c.pPrimeiro} rotulo={`chance de ${c.nome.split(" ")[0]} vencer`} cor={corPartido(c.partido)} />
            ))
          ) : (
            <>
              <Medidor valor={p.pSegundoTurno} rotulo="chance de haver 2º turno" cor="#3df2ff" />
              {lider && (
                <Medidor
                  valor={lider.pMaioria}
                  rotulo={`chance de ${lider.nome.split(" ")[0]} vencer no 1º turno`}
                  cor={corPartido(lider.partido)}
                />
              )}
            </>
          )}
        </div>

        <div className="lg:col-span-8">
          <div className="mb-3 grid grid-cols-[1fr_auto_auto] gap-4 font-mono text-[10px] tracking-widest text-dim">
            <span>RESULTADO FINAL PROJETADO</span>
            <span className="w-16 text-right">{turno === 2 ? "VITÓRIA" : "1º LUGAR"}</span>
            <span className="w-16 text-right">{turno === 2 ? "" : "NO 2º TURNO"}</span>
          </div>
          <div className="space-y-6">
            {lista.map((c) => {
              const cor = corPartido(c.partido);
              return (
                <div key={c.numero} className="grid grid-cols-[1fr_auto_auto] items-center gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <Avatar nome={c.nome} foto={fotoDe(c.numero)} partido={c.partido} size={34} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[14px] font-medium">{c.nome}</span>
                          <span className="font-display text-xl font-bold tabular-nums" style={{ color: cor }}>
                            <Num value={c.proj} kind="pct" casas={1} />%
                          </span>
                        </div>
                        <div className="flex justify-between font-mono text-[10px] text-dim">
                          <span>{c.partido} · agora {fmtPct(c.atual, 1)}%</span>
                          {!decidido && (
                            <span>
                              90%: {fmtPct(c.p05, 1)}–{fmtPct(c.p95, 1)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* eixo com intervalo de 90%, projeção e valor atual */}
                    <div className="relative mt-3 h-3 rounded-full bg-white/[0.04]">
                      <div className="absolute inset-y-[-6px] w-px bg-white/40" style={{ left: x(50) }} />
                      <motion.div
                        className="absolute inset-y-0 rounded-full"
                        style={{ background: `${cor}55`, boxShadow: `0 0 18px ${cor}66` }}
                        animate={{ left: x(c.p05), width: `calc(${x(Math.max(0.3, c.p95 - c.p05))})` }}
                        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                      />
                      <motion.div
                        className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#040509]"
                        style={{ background: cor, boxShadow: `0 0 12px ${cor}` }}
                        animate={{ left: x(c.proj) }}
                        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                      />
                      <motion.div
                        className="absolute inset-y-[-3px] w-[2px] -translate-x-1/2 bg-white"
                        animate={{ left: x(c.atual) }}
                        transition={{ duration: 1.2 }}
                        title="apurado agora"
                      />
                    </div>
                  </div>
                  <div className="w-16 text-right font-display text-lg font-semibold tabular-nums">{pctTxt(c.pPrimeiro)}%</div>
                  <div className="w-16 text-right font-display text-lg font-semibold tabular-nums text-muted">{turno === 2 ? "" : `${pctTxt(c.pTop2)}%`}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-5 font-mono text-[10px] text-dim">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-white/70" /> projeção</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-5 rounded-full bg-white/25" /> 90% dos cenários</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-[2px] bg-white" /> apurado agora</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-px bg-white/40" /> 50%</span>
          </div>
        </div>
      </div>

      <p className="mt-8 max-w-3xl text-[12px] leading-relaxed text-dim">
        Como funciona: para cada estado e para o exterior, estimamos quantos votos ainda faltam (eleitorado não apurado × comparecimento × taxa de
        votos válidos) e simulamos como eles podem se dividir, partindo do que já foi apurado ali, com incerteza maior onde pouco foi contado e um
        desvio nacional comum a todos os estados. É uma estimativa estatística, não o resultado oficial do TSE.
      </p>
    </Panel>
  );
}
