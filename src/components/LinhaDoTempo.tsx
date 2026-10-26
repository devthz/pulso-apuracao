"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { fmtPct } from "@/lib/format";
import { corPartido } from "@/lib/parties";
import { Panel, SectionTitle } from "./ui";

/** formato de public/historico/presidente-2t.json (gerado por scripts/historico-modelo.ts) */
export interface Historico {
  metodo: string;
  gerado: string;
  finalistas: { numero: string; nome: string; partido: string }[];
  pontos: {
    h: string; // "19:42"
    pct: number; // % das seções apuradas (estimado)
    at: Record<string, number>; // % dos válidos apurados até ali
    pv: Record<string, number>; // chance de vitória segundo o modelo (0–1)
    pj: Record<string, [number, number, number]>; // [p05, projeção, p95]
  }[];
  marcos: { viradaModelo?: number; viradaContagem?: number; decisao?: number; final?: number };
}

const H1 = 230;
const H2 = 190;
const PAD = { l: 44, r: 16, t: 14, b: 26 };

export function LinhaDoTempoModelo() {
  const { data } = useSWR<Historico>("/historico/presidente-2t.json", (u: string) => fetch(u).then((r) => (r.ok ? r.json() : null)), {
    revalidateOnFocus: false,
  });
  if (!data || !data.pontos?.length) return null;
  return <Grafico h={data} />;
}

function Grafico({ h }: { h: Historico }) {
  const [A, B] = h.finalistas;
  const cA = corPartido(A.partido);
  const cB = corPartido(B.partido);
  const n = h.pontos.length;
  // largura real em px: o SVG desenha 1:1, então os textos ficam legíveis no celular
  const caixa = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(1000);
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const estreito = W < 560;
  const x = (i: number) => PAD.l + (i / Math.max(1, n - 1)) * (W - PAD.l - PAD.r);
  const y1 = (p: number) => PAD.t + (1 - p) * (H1 - PAD.t - PAD.b);
  // painel de apuração: escala focada em torno de 50%
  const extremos = h.pontos.flatMap((p) => [p.at[A.numero], p.at[B.numero]]).filter((v) => v > 0);
  const lo = Math.floor(Math.min(45, ...extremos) / 2) * 2;
  const hi = Math.ceil(Math.max(55, ...extremos) / 2) * 2;
  const y2 = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H2 - PAD.t - PAD.b);

  const caminho = (f: (p: Historico["pontos"][number]) => number | undefined, y: (v: number) => number) =>
    h.pontos
      .map((p, i) => {
        const v = f(p);
        return v == null || Number.isNaN(v) ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      })
      .filter(Boolean)
      .map((s, i) => (i ? "L" : "M") + s)
      .join("");

  const [foco, setFoco] = useState<number | null>(null);
  const mover = (e: React.PointerEvent) => {
    const r = caixa.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (n - 1));
    setFoco(Math.max(0, Math.min(n - 1, i)));
  };

  const m = h.marcos;
  const marcos = [
    m.viradaModelo != null && { i: m.viradaModelo, rot: "modelo vira", cor: "#d4ff3a" },
    m.viradaContagem != null && { i: m.viradaContagem, rot: "contagem vira", cor: "#3df2ff" },
    m.decisao != null && { i: m.decisao, rot: "99% de certeza", cor: "#ffffff" },
  ].filter(Boolean) as { i: number; rot: string; cor: string }[];

  // manchete gerada a partir dos marcos
  const manchete = useMemo(() => {
    if (m.viradaModelo == null) return null;
    const p = h.pontos[m.viradaModelo];
    const vencedor = p.pv[A.numero] > 0.5 ? A : B;
    const outro = vencedor === A ? B : A;
    const frente = (p.at[outro.numero] ?? 0) > (p.at[vencedor.numero] ?? 0);
    const cont = m.viradaContagem != null ? h.pontos[m.viradaContagem] : null;
    return { p, vencedor, outro, frente, cont };
  }, [h, m, A, B]);

  const pf = foco != null ? h.pontos[foco] : null;
  const xf = foco != null ? x(foco) : 0;

  return (
    <section className="mt-24">
      <SectionTitle
        id="modelo"
        kicker="Modelo PULSO · a noite do 2º turno"
        title={
          <>
            Como o modelo viu a apuração<span className="text-violet">.</span>
          </>
        }
      />
      <Panel className="p-6 sm:p-10">
        {manchete && (
          <p className="max-w-3xl text-[17px] leading-relaxed text-muted">
            Às <b className="text-text">{manchete.p.h}</b>, com {fmtPct(manchete.p.pct, 0)}% das seções apuradas
            {manchete.frente ? (
              <>
                {" "}e <b className="text-text">{manchete.outro.nome}</b> ainda à frente na contagem ({fmtPct(manchete.p.at[manchete.outro.numero], 1)}% a{" "}
                {fmtPct(manchete.p.at[manchete.vencedor.numero], 1)}%)
              </>
            ) : null}
            , o modelo passou a apontar <b className="text-text">{manchete.vencedor.nome}</b> como favorito (
            {fmtPct(manchete.p.pv[manchete.vencedor.numero] * 100, 0)}% de chance).
            {manchete.cont && (
              <>
                {" "}A contagem só virou às <b className="text-text">{manchete.cont.h}</b>.
              </>
            )}
            {m.decisao != null && (
              <>
                {" "}Às <b className="text-text">{h.pontos[m.decisao].h}</b> a chance passou de 99%.
              </>
            )}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-4 font-mono text-[11px] text-muted">
          {[A, B].map((f) => (
            <span key={f.numero} className="flex items-center gap-2">
              <span className="h-[3px] w-5 rounded-full" style={{ background: corPartido(f.partido) }} />
              {f.nome}
            </span>
          ))}
        </div>

        <div ref={caixa} className="relative mt-4 touch-pan-y select-none" onPointerMove={mover} onPointerDown={mover} onPointerLeave={() => setFoco(null)}>
          {/* gráfico 1: chance de vitória */}
          <div className="kicker mb-1 !text-[10px]">Chance de vitória segundo o modelo</div>
          <svg viewBox={`0 0 ${W} ${H1}`} className="h-auto w-full overflow-visible">
            {[0, 0.25, 0.5, 0.75, 1].map((g) => (
              <g key={g}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y1(g)} y2={y1(g)} stroke={g === 0.5 ? "rgba(255,255,255,.28)" : "rgba(255,255,255,.06)"} strokeDasharray={g === 0.5 ? "4 4" : undefined} />
                <text x={PAD.l - 8} y={y1(g) + 3} textAnchor="end" className="fill-[var(--dim)] font-mono text-[10px]">
                  {g * 100}%
                </text>
              </g>
            ))}
            {[...marcos]
              .sort((p, q) => p.i - q.i)
              .map((mk, k) => {
                const rot = estreito ? `${mk.rot.replace("99% de certeza", "99%")} · ${h.pontos[mk.i].h}` : `${mk.rot} · ${h.pontos[mk.i].h}`;
                const dir = x(mk.i) + 6 + rot.length * 6.2 > W - PAD.r; // não cabe à direita: texto à esquerda da linha
                return (
                  <g key={mk.rot}>
                    <line x1={x(mk.i)} x2={x(mk.i)} y1={PAD.t} y2={H1 - PAD.b} stroke={mk.cor} strokeOpacity={0.5} strokeDasharray="3 4" />
                    <text
                      x={x(mk.i) + (dir ? -6 : 6)}
                      y={H1 - PAD.b - 10 - k * 16}
                      textAnchor={dir ? "end" : "start"}
                      className="font-mono text-[10px]"
                      fill={mk.cor}
                      style={{ paintOrder: "stroke" }}
                      stroke="#0b0d14"
                      strokeWidth={4}
                    >
                      {rot}
                    </text>
                  </g>
                );
              })}
            <path d={caminho((p) => p.pv[B.numero], y1)} fill="none" stroke={cB} strokeWidth={2.4} strokeLinejoin="round" />
            <path d={caminho((p) => p.pv[A.numero], y1)} fill="none" stroke={cA} strokeWidth={2.4} strokeLinejoin="round" />
            {foco != null && <line x1={xf} x2={xf} y1={PAD.t} y2={H1 - PAD.b} stroke="rgba(255,255,255,.4)" />}
            {pf &&
              [A, B].map((f) => (
                <circle key={f.numero} cx={xf} cy={y1(pf.pv[f.numero])} r={5} fill={corPartido(f.partido)} stroke="#0b0d14" strokeWidth={2} />
              ))}
          </svg>

          {/* gráfico 2: votos apurados até cada momento */}
          <div className="kicker mb-1 mt-4 !text-[10px]">Votos válidos apurados até o momento</div>
          <svg viewBox={`0 0 ${W} ${H2}`} className="h-auto w-full overflow-visible">
            {Array.from({ length: Math.floor((hi - lo) / 2) + 1 }, (_, k) => lo + k * 2)
              .filter((g) => g % (hi - lo > 12 ? 4 : 2) === 0)
              .map((g) => (
                <g key={g}>
                  <line x1={PAD.l} x2={W - PAD.r} y1={y2(g)} y2={y2(g)} stroke={g === 50 ? "rgba(255,255,255,.28)" : "rgba(255,255,255,.06)"} strokeDasharray={g === 50 ? "4 4" : undefined} />
                  <text x={PAD.l - 8} y={y2(g) + 3} textAnchor="end" className="fill-[var(--dim)] font-mono text-[10px]">
                    {g}%
                  </text>
                </g>
              ))}
            {marcos.map((mk) => (
              <line key={mk.rot} x1={x(mk.i)} x2={x(mk.i)} y1={PAD.t} y2={H2 - PAD.b} stroke={mk.cor} strokeOpacity={0.35} strokeDasharray="3 4" />
            ))}
            <path d={caminho((p) => p.at[B.numero], y2)} fill="none" stroke={cB} strokeWidth={2} strokeLinejoin="round" />
            <path d={caminho((p) => p.at[A.numero], y2)} fill="none" stroke={cA} strokeWidth={2} strokeLinejoin="round" />
            {/* eixo do tempo */}
            {h.pontos.map((p, i) =>
              i % Math.max(1, Math.round(n / (estreito ? 4 : 8))) === 0 ? (
                <text key={i} x={x(i)} y={H2 - 6} textAnchor="middle" className="fill-[var(--dim)] font-mono text-[10px]">
                  {p.h}
                </text>
              ) : null,
            )}
            {foco != null && <line x1={xf} x2={xf} y1={PAD.t} y2={H2 - PAD.b} stroke="rgba(255,255,255,.4)" />}
            {pf &&
              [A, B].map((f) => (
                <circle key={f.numero} cx={xf} cy={y2(pf.at[f.numero])} r={5} fill={corPartido(f.partido)} stroke="#0b0d14" strokeWidth={2} />
              ))}
          </svg>

          {pf && (
            <div
              className="pointer-events-none absolute top-6 z-10 w-60 rounded-2xl border border-white/10 bg-[#0b0d14]/95 p-4 shadow-2xl"
              style={{ left: Math.max(0, Math.min(W - 240, xf / W > 0.6 ? xf - 256 : xf + 16)) }}
            >
              <div className="flex items-baseline justify-between">
                <div className="font-display text-lg font-semibold">{pf.h}</div>
                <div className="font-mono text-[10px] text-dim">{fmtPct(pf.pct, 1)}% das seções</div>
              </div>
              <div className="mt-3 space-y-2.5">
                {[A, B].map((f) => (
                  <div key={f.numero} className="text-[12px]">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: corPartido(f.partido) }} />
                        {f.nome}
                      </span>
                    </div>
                    <div className="ml-4 mt-0.5 grid grid-cols-2 font-mono text-[10.5px] text-muted">
                      <span>apurado {fmtPct(pf.at[f.numero] ?? 0, 2)}%</span>
                      <span className="text-right text-text">chance {fmtPct((pf.pv[f.numero] ?? 0) * 100, 0)}%</span>
                    </div>
                    <div className="ml-4 font-mono text-[10px] text-dim">
                      projeção {fmtPct(pf.pj[f.numero]?.[1] ?? 0, 1)}% ({fmtPct(pf.pj[f.numero]?.[0] ?? 0, 1)}–{fmtPct(pf.pj[f.numero]?.[2] ?? 0, 1)})
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="mt-6 max-w-3xl text-[11.5px] leading-relaxed text-dim">{h.metodo}</p>
      </Panel>
    </section>
  );
}
