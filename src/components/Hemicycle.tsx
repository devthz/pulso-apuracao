"use client";
import { useMemo, useState } from "react";
import { fmtInt } from "@/lib/format";
import { corPartido, NEUTRO } from "@/lib/parties";
import type { Assento } from "@/lib/tse/types";

interface Seat { x: number; y: number; ang: number; row: number }

/** Posições das cadeiras num semicírculo (fileiras concêntricas, cadeiras proporcionais ao raio) */
function layout(n: number, W = 1000) {
  const R = W / 2;
  const rows = Math.max(2, Math.round(Math.sqrt(n / 3.4)));
  const inner = R * (n < 120 ? 0.46 : 0.36);
  const radii = Array.from({ length: rows }, (_, i) => inner + ((R - inner) * i) / (rows - 1 || 1));
  const somaR = radii.reduce((a, r) => a + r, 0);
  const porFila = radii.map((r) => Math.max(1, Math.round((n * r) / somaR)));
  let dif = n - porFila.reduce((a, b) => a + b, 0);
  for (let i = rows - 1; dif !== 0; i = (i - 1 + rows) % rows) {
    porFila[i] += Math.sign(dif);
    dif -= Math.sign(dif);
  }
  const seats: Seat[] = [];
  radii.forEach((r, row) => {
    const k = porFila[row];
    for (let j = 0; j < k; j++) {
      const ang = k === 1 ? Math.PI / 2 : Math.PI - (Math.PI * j) / (k - 1);
      seats.push({ x: R + r * Math.cos(ang), y: R - r * Math.sin(ang), ang, row });
    }
  });
  // da esquerda para a direita, de dentro para fora
  seats.sort((a, b) => b.ang - a.ang || a.row - b.row);
  const passo = (R - inner) / (rows - 1 || 1);
  const arco = (Math.PI * radii[0]) / Math.max(1, porFila[0] - 1);
  const raio = Math.min(passo, arco) * (n < 120 ? 0.36 : 0.42);
  return { seats, raio, W, H: R + raio + 4 };
}

export function Hemicycle({
  partidos,
  total,
  label,
  sub,
  compact = false,
}: {
  partidos: Assento[];
  total: number;
  label?: string;
  sub?: string;
  compact?: boolean;
}) {
  const [foco, setFoco] = useState<string | null>(null);
  const { seats, raio, W, H } = useMemo(() => layout(Math.max(1, total)), [total]);
  const cores = useMemo(() => {
    const arr: (string | null)[] = [];
    for (const p of partidos) for (let i = 0; i < p.cadeiras; i++) arr.push(p.partido);
    while (arr.length < seats.length) arr.push(null);
    return arr;
  }, [partidos, seats.length]);
  const maioria = Math.floor(total / 2) + 1;
  const focoP = foco ? partidos.find((p) => p.partido === foco) : null;

  return (
    <div>
      <div className="relative">
        <svg viewBox={`${-raio - 4} ${-raio - 4} ${W + 2 * raio + 8} ${H + raio + 8}`} className="h-auto w-full overflow-visible">
          <defs>
            <radialGradient id="hemiglow" cx="50%" cy="100%" r="60%">
              <stop offset="0%" stopColor="rgba(212,255,58,.10)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>
          {/* linha da maioria */}
          <line x1={W / 2} y1={-4} x2={W / 2} y2={W / 2 * 0.62} stroke="rgba(255,255,255,.22)" strokeDasharray="3 5" />
          {seats.map((s, i) => {
            const p = cores[i];
            const c = p ? corPartido(p) : NEUTRO;
            const dim = foco && p !== foco;
            return (
              <circle
                key={i}
                className="seat"
                cx={s.x}
                cy={s.y}
                r={raio}
                fill={c}
                opacity={dim ? 0.12 : 1}
                style={{ animationDelay: `${(Math.PI - s.ang) * 0.35 + s.row * 0.02}s` }}
                onPointerEnter={() => p && setFoco(p)}
                onPointerLeave={() => setFoco(null)}
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center">
          {focoP ? (
            <>
              <div className="font-display text-[clamp(28px,6vw,64px)] font-bold leading-none" style={{ color: corPartido(focoP.partido) }}>
                {focoP.cadeiras}
              </div>
              <div className="mt-1 font-mono text-[11px] tracking-widest text-muted">{focoP.partido}</div>
            </>
          ) : (
            <>
              <div className={`font-display font-bold leading-none ${compact ? "text-3xl" : total < 120 ? "text-[clamp(28px,4vw,52px)]" : "text-[clamp(32px,6vw,72px)]"}`}>{fmtInt(total)}</div>
              <div className="mt-1 font-mono text-[10px] tracking-[0.2em] text-muted">{label ?? "CADEIRAS"}</div>
              {sub && <div className="font-mono text-[10px] text-dim">{sub}</div>}
            </>
          )}
        </div>
      </div>
      {!compact && (
        <div className="mt-2 text-center font-mono text-[10px] tracking-widest text-dim">MAIORIA ABSOLUTA: {maioria}</div>
      )}
      <div className={`mt-5 flex flex-wrap justify-center ${compact ? "gap-1.5" : "gap-2"}`}>
        {partidos.map((p) => (
          <button
            key={p.partido}
            onPointerEnter={() => setFoco(p.partido)}
            onPointerLeave={() => setFoco(null)}
            className="chip transition hover:border-white/30"
            style={foco === p.partido ? { borderColor: corPartido(p.partido) } : undefined}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: corPartido(p.partido) }} />
            <span className="text-text">{p.partido}</span>
            <span className="text-muted">{p.cadeiras}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
