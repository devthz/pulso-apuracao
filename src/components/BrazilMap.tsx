"use client";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { BRAZIL_UFS, BRAZIL_VIEWBOX } from "@/lib/brazil-map";
import { fmtInt, fmtPct } from "@/lib/format";
import { corPartido } from "@/lib/parties";
import { comParams } from "@/lib/qs";
import type { ResumoUF } from "@/lib/tse/types";
import { UF_MAP } from "@/lib/ufs";

// UFs pequenas: rótulo fora do mapa, com linha guia
const RotuloFora: Record<string, [number, number]> = {
  rn: [600, 196], pb: [604, 222], pe: [606, 250], al: [600, 278], se: [586, 304], df: [470, 318], es: [548, 432], rj: [520, 486],
};

export function BrazilMap({
  ufs,
  destaque,
  modo = "lider",
  className,
  rotulo,
  navegar = true,
}: {
  ufs: ResumoUF[];
  destaque?: string;
  modo?: "lider";
  className?: string;
  /** texto embaixo da sigla e no topo do balão (padrão: % apurado) */
  rotulo?: (u: ResumoUF) => string;
  navegar?: boolean;
}) {
  const router = useRouter();
  const [hover, setHover] = useState<string | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [centros, setCentros] = useState<Record<string, { x: number; y: number }>>({});
  const refs = useRef<Record<string, SVGPathElement | null>>({});
  const wrap = useRef<HTMLDivElement>(null);
  const porUF = useMemo(() => Object.fromEntries(ufs.map((u) => [u.uf, u])), [ufs]);

  useLayoutEffect(() => {
    const c: Record<string, { x: number; y: number }> = {};
    for (const [id, el] of Object.entries(refs.current)) {
      if (!el) continue;
      const b = el.getBBox();
      c[id] = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    }
    // ajustes finos de centro visual
    if (c.go) c.go = { x: c.go.x - 8, y: c.go.y + 8 };
    if (c.pa) c.pa.y += 10;
    if (c.ma) c.ma.y += 8;
    if (c.ba) c.ba.x += 8;
    if (c.mg) c.mg.y += 6;
    if (c.sc) c.sc.x += 6;
    const raf = requestAnimationFrame(() => setCentros(c));
    return () => cancelAnimationFrame(raf);
  }, []);

  const info = hover ? porUF[hover] : undefined;
  void modo;

  return (
    <div
      ref={wrap}
      className={clsx("relative", className)}
      onPointerMove={(e) => {
        const r = wrap.current!.getBoundingClientRect();
        setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
      }}
      onPointerLeave={() => setHover(null)}
    >
      <svg viewBox={BRAZIL_VIEWBOX.replace("613", "640")} className="h-auto w-full overflow-visible">
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#0c0e15" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,.07)" strokeWidth="2" />
          </pattern>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* sombra/halo do país */}
        <g opacity={0.5} filter="url(#glow)">
          {BRAZIL_UFS.map((l) => (
            <path key={"h" + l.id} d={l.path} fill="none" stroke="rgba(61,242,255,.18)" strokeWidth={3} />
          ))}
        </g>

        {BRAZIL_UFS.map((l) => {
          const u = porUF[l.id];
          const lider = u?.lideres[0];
          const vice = u?.lideres[1];
          const cor = lider && u.pct > 0 ? corPartido(lider.partido) : null;
          // intensidade: margem do líder + quanto já foi apurado
          const margem = lider && vice ? lider.pct - vice.pct : lider ? lider.pct : 0;
          const op = cor ? 0.35 + Math.min(0.65, (margem / 25) * 0.4 + (u.pct / 100) * 0.35) : 1;
          const ativo = hover === l.id || destaque === l.id;
          return (
            <path
              key={l.id}
              ref={(el) => {
                refs.current[l.id] = el;
              }}
              d={l.path}
              className="uf-path"
              fill={cor ?? "url(#hatch)"}
              fillOpacity={op}
              stroke={ativo ? "#fff" : "rgba(4,5,9,.9)"}
              strokeWidth={ativo ? 1.6 : 0.9}
              style={{ color: cor ?? "#3df2ff" }}
              onPointerEnter={() => setHover(l.id)}
              onClick={() => navegar && router.push(comParams(`/uf/${l.id}`))}
            />
          );
        })}

        {/* rótulos */}
        {Object.entries(centros).map(([id, c]) => {
          const fora = RotuloFora[id];
          const u = porUF[id];
          const txt = (
            <>
              <tspan className="font-display" fontWeight={700} fontSize={fora ? 10 : 11.5} fill="#fff">
                {id.toUpperCase()}
              </tspan>
              {u && u.pct > 0 && !fora && (
                <tspan x={c.x} dy={11} fontSize={8} fill="rgba(255,255,255,.7)" className="font-mono">
                  {rotulo ? rotulo(u) : `${fmtPct(u.pct, 0)}%`}
                </tspan>
              )}
            </>
          );
          if (fora)
            return (
              <g key={"t" + id} pointerEvents="none">
                <line x1={c.x} y1={c.y} x2={fora[0] - 12} y2={fora[1] - 3} stroke="rgba(255,255,255,.25)" strokeWidth={0.6} />
                <circle cx={c.x} cy={c.y} r={1.6} fill="#fff" />
                <text x={fora[0]} y={fora[1]} textAnchor="middle" style={{ paintOrder: "stroke" }} stroke="#040509" strokeWidth={3}>
                  {txt}
                </text>
              </g>
            );
          return (
            <text
              key={"t" + id}
              x={c.x}
              y={c.y}
              textAnchor="middle"
              pointerEvents="none"
              style={{ paintOrder: "stroke", textShadow: "0 1px 6px rgba(0,0,0,.6)" }}
              stroke="rgba(4,5,9,.55)"
              strokeWidth={2.5}
            >
              {txt}
            </text>
          );
        })}
      </svg>

      <AnimatePresence>
        {hover && (
          <motion.div
            key="tip"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1, x: pos.x + 18, y: pos.y + 18 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 400, opacity: { duration: 0.15 } }}
            className="pointer-events-none absolute left-0 top-0 z-20 w-64 rounded-2xl border border-white/10 bg-[#0b0d14]/95 p-4 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-baseline justify-between">
              <div className="font-display text-base font-semibold">{UF_MAP[hover]?.nome}</div>
              <div className="font-mono text-[11px] text-muted">{info ? (rotulo ? rotulo(info) : `${fmtPct(info.pct, 1)}%`) : "—"}</div>
            </div>
            <div className="mt-1 h-0.5 w-full overflow-hidden rounded bg-white/10">
              <div className="h-full bg-gradient-to-r from-lime to-cyan" style={{ width: `${rotulo ? 0 : (info?.pct ?? 0)}%` }} />
            </div>
            <div className="mt-3 space-y-2.5">
              {info?.lideres.slice(0, 3).map((l) => (
                <div key={l.id}>
                  <div className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: corPartido(l.partido) }} />
                      <span className="truncate">{l.nome}</span>
                      <span className="font-mono text-[10px] text-dim">{l.partido}</span>
                    </span>
                    <span className="font-mono tabular-nums">{fmtPct(l.pct)}%</span>
                  </div>
                  <div className="ml-4 font-mono text-[10px] text-dim">{fmtInt(l.votos)} votos</div>
                  <div className="mt-1 h-1 rounded bg-white/5">
                    <div className="h-full rounded" style={{ width: `${l.pct}%`, background: corPartido(l.partido) }} />
                  </div>
                </div>
              ))}
              {!info?.lideres.length && <div className="text-[12px] text-muted">Aguardando dados</div>}
            </div>
            {info && info.validos > 0 && (
              <div className="mt-3 border-t border-white/5 pt-2 font-mono text-[10px] text-dim">
                {fmtInt(info.validos)} votos válidos{navegar ? " · clique para abrir" : ""}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
