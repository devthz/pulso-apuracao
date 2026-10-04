"use client";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { fmtInt, fmtPct } from "@/lib/format";
import { corPartido } from "@/lib/parties";
import type { MunicipiosPayload } from "@/lib/tse/municipios";
import { UF_MAP } from "@/lib/ufs";

interface Geo {
  w: number;
  h: number;
  bbox: Record<string, [number, number, number, number]>;
  ufs: Record<string, string>;
  mun: [string, string, string][]; // [código IBGE, nome, path]
}

const IBGE_UF: Record<string, string> = {
  "11": "ro", "12": "ac", "13": "am", "14": "rr", "15": "pa", "16": "ap", "17": "to", "21": "ma", "22": "pi", "23": "ce",
  "24": "rn", "25": "pb", "26": "pe", "27": "al", "28": "se", "29": "ba", "31": "mg", "32": "es", "33": "rj", "35": "sp",
  "41": "pr", "42": "sc", "43": "rs", "50": "ms", "51": "mt", "52": "go", "53": "df",
};

const comModo = (p: string) => {
  if (typeof window === "undefined") return p;
  const m = new URLSearchParams(window.location.search).get("modo");
  return m ? `${p}?modo=${m}` : p;
};
const jf = (u: string) => fetch(comModo(u)).then((r) => r.json());

/** faixas de vantagem (pontos percentuais sobre o 2º) → opacidade */
const FAIXAS = [10, 25, 45];
const opacidade = (margem: number) => (margem < FAIXAS[0] ? 0.42 : margem < FAIXAS[1] ? 0.62 : margem < FAIXAS[2] ? 0.82 : 1);

type Linha = (number | string)[];

const Caminhos = memo(function Caminhos({ geo, dados, uf }: { geo: Geo; dados: MunicipiosPayload | undefined; uf?: string }) {
  return (
    <>
      {geo.mun.map(([id, , d], i) => {
        if (uf && IBGE_UF[id.slice(0, 2)] !== uf) return null;
        const r = dados?.m[id] as Linha | undefined;
        let fill = "url(#hatchm)";
        let op = 1;
        if (r && r.length >= 4) {
          const vv = Number(r[1]) || 1;
          const v1 = Number(r[3]);
          const v2 = Number(r[5] ?? 0);
          const partido = dados!.cand[String(r[2])]?.[1];
          fill = corPartido(partido);
          op = opacidade(((v1 - v2) / vv) * 100);
        }
        return <path key={id} d={d} data-i={i} fill={fill} fillOpacity={op} />;
      })}
    </>
  );
});

export function MunicipalMap({ uf, className, alturaMax }: { uf?: string; className?: string; alturaMax?: number }) {
  const router = useRouter();
  const { data: geo } = useSWR<Geo>("/geo/municipios.json", (u: string) => fetch(u).then((r) => r.json()), {
    revalidateOnFocus: false,
    revalidateIfStale: false,
  });
  const { data } = useSWR<MunicipiosPayload>("/api/municipios", jf, { refreshInterval: 15_000, keepPreviousData: true });

  const [hover, setHover] = useState<number | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0, w: 600, h: 600 });
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const arrasto = useRef<{ x: number; y: number; vx: number; vy: number; moveu: boolean } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  const vb = useMemo(() => {
    if (!geo) return { x: 0, y: 0, w: 1000, h: 1000 };
    if (uf && geo.bbox[uf]) {
      const [x0, y0, x1, y1] = geo.bbox[uf];
      const pad = Math.max(x1 - x0, y1 - y0) * 0.06;
      return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
    }
    return { x: 0, y: 0, w: geo.w, h: geo.h };
  }, [geo, uf]);

  const zoom = useCallback(
    (fator: number, cx = 0.5, cy = 0.5) =>
      setView((v) => {
        const k = Math.min(12, Math.max(1, v.k * fator));
        // mantém o ponto (cx,cy) da tela fixo
        const px = v.x + (cx * vb.w) / v.k;
        const py = v.y + (cy * vb.h) / v.k;
        let x = px - (cx * vb.w) / k;
        let y = py - (cy * vb.h) / k;
        x = Math.min(Math.max(0, x), vb.w - vb.w / k);
        y = Math.min(Math.max(0, y), vb.h - vb.h / k);
        return { k, x, y };
      }),
    [vb],
  );

  const info = useMemo(() => {
    if (hover == null || !geo) return null;
    const [id, nome] = geo.mun[hover];
    const r = data?.m[id] as Linha | undefined;
    const vv = r ? Number(r[1]) : 0;
    const top: { nome: string; partido: string; votos: number; pct: number }[] = [];
    if (r)
      for (let i = 2; i + 1 < r.length; i += 2) {
        const [n, p] = data!.cand[String(r[i])] ?? [String(r[i]), ""];
        top.push({ nome: n, partido: p, votos: Number(r[i + 1]), pct: vv ? (Number(r[i + 1]) / vv) * 100 : 0 });
      }
    return { id, nome, uf: IBGE_UF[id.slice(0, 2)], pct: r ? Number(r[0]) / 10 : 0, vv, top };
  }, [hover, geo, data]);

  // contagem de municípios por partido líder
  const lideres = useMemo(() => {
    const cont = new Map<string, number>();
    if (!data) return [];
    for (const [id, r] of Object.entries(data.m)) {
      if (uf && IBGE_UF[id.slice(0, 2)] !== uf) continue;
      const p = data.cand[String(r[2])]?.[1];
      if (p) cont.set(p, (cont.get(p) ?? 0) + 1);
    }
    return [...cont.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [data, uf]);

  if (!geo) return <div className={clsx("skeleton aspect-square w-full", className)} />;

  const viewBox = `${vb.x + view.x} ${vb.y + view.y} ${vb.w / view.k} ${vb.h / view.k}`;
  const espessura = (vb.w / 1000) / view.k;

  return (
    <div className={className}>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] text-muted">
        {lideres.map(([p, n]) => (
          <span key={p} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: corPartido(p) }} />
            <span className="text-text">{p}</span> {fmtInt(n)}
          </span>
        ))}
        {lideres.length > 0 && <span className="text-dim">municípios</span>}
        <span className="ml-auto flex items-center gap-1.5 text-dim">
          {[0.42, 0.62, 0.82, 1].map((o) => (
            <span key={o} className="h-2 w-3 rounded-sm bg-white" style={{ opacity: o * 0.8 }} />
          ))}
          até {FAIXAS.join(" · ")} · mais pontos
        </span>
      </div>

      <div
        ref={wrap}
        className="relative touch-none select-none overflow-hidden rounded-2xl"
        style={alturaMax ? { maxHeight: alturaMax } : undefined}
        onDoubleClick={(e) => {
          const r = wrap.current!.getBoundingClientRect();
          zoom(e.shiftKey ? 1 / 2 : 2, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
        }}
        onPointerDown={(e) => {
          arrasto.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moveu: false };
        }}
        onPointerMove={(e) => {
          const r = wrap.current!.getBoundingClientRect();
          setPos({ x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height });
          const a = arrasto.current;
          if (a && view.k > 1) {
            const dx = ((e.clientX - a.x) / r.width) * (vb.w / view.k);
            const dy = ((e.clientY - a.y) / r.height) * (vb.h / view.k);
            if (Math.abs(e.clientX - a.x) + Math.abs(e.clientY - a.y) > 4) a.moveu = true;
            setView((v) => ({
              ...v,
              x: Math.min(Math.max(0, a.vx - dx), vb.w - vb.w / v.k),
              y: Math.min(Math.max(0, a.vy - dy), vb.h - vb.h / v.k),
            }));
          }
          const t = e.target as SVGElement;
          const i = t.getAttribute?.("data-i");
          setHover(i != null ? Number(i) : null);
        }}
        onPointerUp={(e) => {
          const a = arrasto.current;
          arrasto.current = null;
          if (a?.moveu) return;
          const i = (e.target as SVGElement).getAttribute?.("data-i");
          if (i != null && !uf && view.k === 1 && e.detail === 1) router.push(`/uf/${IBGE_UF[geo.mun[Number(i)][0].slice(0, 2)]}${window.location.search}`);
        }}
        onPointerLeave={() => {
          setHover(null);
          arrasto.current = null;
        }}
      >
        <svg viewBox={viewBox} className={clsx("h-auto w-full", view.k > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-pointer")}>
          <defs>
            <pattern id="hatchm" width={4 * (vb.w / 1000)} height={4 * (vb.w / 1000)} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="100%" height="100%" fill="#0c0e15" />
              <line x1="0" y1="0" x2="0" y2={4 * (vb.w / 1000)} stroke="rgba(255,255,255,.06)" strokeWidth={1.5 * (vb.w / 1000)} />
            </pattern>
          </defs>
          <g stroke="rgba(4,5,9,.55)" strokeWidth={0.25 * espessura} strokeLinejoin="round">
            <Caminhos geo={geo} dados={data} uf={uf} />
          </g>
          {/* bordas das UFs */}
          <g fill="none" stroke="rgba(255,255,255,.55)" strokeWidth={0.7 * espessura} pointerEvents="none">
            {Object.entries(geo.ufs).map(([k, d]) => (!uf || k === uf ? <path key={k} d={d} /> : null))}
          </g>
          {hover != null && (
            <path d={geo.mun[hover][2]} fill="none" stroke="#fff" strokeWidth={1.6 * espessura} pointerEvents="none" />
          )}
        </svg>

        <div className="absolute bottom-3 left-3 flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0b0d14]/80 backdrop-blur">
          <button aria-label="Aproximar" onClick={() => zoom(1.6)} className="h-8 w-8 text-lg text-muted hover:bg-white/5 hover:text-text">+</button>
          <button aria-label="Afastar" onClick={() => zoom(1 / 1.6)} className="h-8 w-8 border-t border-white/10 text-lg text-muted hover:bg-white/5 hover:text-text">−</button>
          {view.k > 1 && (
            <button aria-label="Ver tudo" onClick={() => setView({ k: 1, x: 0, y: 0 })} className="h-8 w-8 border-t border-white/10 text-[11px] text-muted hover:bg-white/5 hover:text-text">⤢</button>
          )}
        </div>
        {data && data.carregados < data.total && (
          <div className="absolute bottom-3 right-3 rounded-full border border-white/10 bg-[#0b0d14]/80 px-3 py-1 font-mono text-[10px] text-muted backdrop-blur">
            carregando municípios {fmtInt(data.carregados)}/{fmtInt(data.total)}
          </div>
        )}

        {info && (
          <div
            className="pointer-events-none absolute left-0 top-0 z-20 w-64 rounded-2xl border border-white/10 bg-[#0b0d14]/95 p-4 shadow-2xl backdrop-blur-xl"
            style={{
              transform: `translate(${Math.max(0, Math.min(pos.x + 16, pos.w - 270))}px, ${Math.max(0, Math.min(pos.y + 16, pos.h - 190))}px)`,
            }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <div className="truncate font-display text-[15px] font-semibold">{info.nome}</div>
              <div className="font-mono text-[10px] text-muted">{info.uf?.toUpperCase()}</div>
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-dim">
              {info.top.length ? `${fmtPct(info.pct, 1)}% das seções · ${fmtInt(info.vv)} válidos` : "aguardando dados"}
            </div>
            <div className="mt-3 space-y-2.5">
              {info.top.map((c) => (
                <div key={c.nome}>
                  <div className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: corPartido(c.partido) }} />
                      <span className="truncate">{c.nome}</span>
                    </span>
                    <span className="font-mono tabular-nums">{fmtPct(c.pct)}%</span>
                  </div>
                  <div className="ml-4 font-mono text-[10px] text-dim">
                    {c.partido} · {fmtInt(c.votos)} votos
                  </div>
                </div>
              ))}
            </div>
            {!uf && info.uf && <div className="mt-3 border-t border-white/5 pt-2 font-mono text-[10px] text-dim">clique para abrir {UF_MAP[info.uf]?.nome}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
