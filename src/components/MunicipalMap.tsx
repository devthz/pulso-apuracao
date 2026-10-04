"use client";
/**
 * Mapa por município desenhado em <canvas> (5.500+ formas).
 * Em SVG cada município vira um nó no DOM e o navegador repinta tudo a cada movimento — fica lento.
 * Aqui: Path2D pré-montados, um único desenho por atualização de dados/zoom, teste de mouse com caixa
 * delimitadora + isPointInPath, destaque numa camada separada e arrasto movendo a imagem pronta (CSS transform).
 */
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { fmtInt, fmtPct } from "@/lib/format";
import { corPartido } from "@/lib/parties";
import type { MunicipiosPayload } from "@/lib/tse/municipios";
import { UF_MAP } from "@/lib/ufs";

export interface Geo {
  w: number;
  h: number;
  bbox: Record<string, [number, number, number, number]>;
  ufs: Record<string, string>;
  mun: [string, string, string][]; // [código IBGE, nome, path]
}

interface Forma {
  i: number;
  id: string;
  nome: string;
  uf: string;
  p: Path2D;
  bb: [number, number, number, number];
}

export const IBGE_UF: Record<string, string> = {
  "11": "ro", "12": "ac", "13": "am", "14": "rr", "15": "pa", "16": "ap", "17": "to", "21": "ma", "22": "pi", "23": "ce",
  "24": "rn", "25": "pb", "26": "pe", "27": "al", "28": "se", "29": "ba", "31": "mg", "32": "es", "33": "rj", "35": "sp",
  "41": "pr", "42": "sc", "43": "rs", "50": "ms", "51": "mt", "52": "go", "53": "df",
};

export const normalizar = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const comModo = (p: string) => {
  if (typeof window === "undefined") return p;
  const m = new URLSearchParams(window.location.search).get("modo");
  return m ? `${p}?modo=${m}` : p;
};
/**
 * Acumula os resultados no navegador: se uma resposta vier de um servidor "frio" (com menos municípios),
 * o mapa não volta para trás — cada município só é trocado por uma leitura igual ou mais avançada.
 * O acumulado vive no módulo, então sobrevive à navegação entre páginas.
 */
let acumulado: MunicipiosPayload | null = null;
async function buscarMunicipios(u: string): Promise<MunicipiosPayload> {
  const novo = (await fetch(comModo(u)).then((r) => r.json())) as MunicipiosPayload;
  if (!acumulado || acumulado.fonte !== novo.fonte) return (acumulado = novo);
  const m = { ...acumulado.m };
  let mudou = false;
  for (const [id, r] of Object.entries(novo.m)) {
    const velho = m[id];
    if (!velho || Number(r[0]) >= Number(velho[0])) {
      if (!velho || velho.join() !== r.join()) mudou = true;
      m[id] = r;
    }
  }
  if (!mudou) return acumulado;
  acumulado = {
    ...novo,
    cand: { ...acumulado.cand, ...novo.cand },
    m,
    carregados: Object.keys(m).length,
    total: Math.max(novo.total, acumulado.total),
  };
  return acumulado;
}
export const geoFetcher = (u: string) => fetch(u).then((r) => r.json());
export const GEO_URL = "/geo/municipios.json";
const geoOpts = { revalidateOnFocus: false, revalidateIfStale: false, revalidateOnReconnect: false };

const FAIXAS = [10, 25, 45];
const ALFAS = [0.42, 0.62, 0.82, 1];
const alfa = (margem: number) => (margem < FAIXAS[0] ? ALFAS[0] : margem < FAIXAS[1] ? ALFAS[1] : margem < FAIXAS[2] ? ALFAS[2] : ALFAS[3]);
const SEM_DADOS = "#141720";

function bboxDoPath(d: string): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const re = /(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    const x = +m[1], y = +m[2];
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}

/** formas já montadas (Path2D) ficam guardadas entre páginas */
const cacheFormas = new WeakMap<Geo, Map<string, Forma[]>>();

/** compara pelo conteúdo para não redesenhar quando a API devolve os mesmos números */
const assinatura = (d?: MunicipiosPayload) =>
  d ? `${d.carregados}:${Object.values(d.m).reduce((a, r) => a + Number(r[0]) + Number(r[1]), 0)}` : "";

export function MunicipalMap({ uf, foco, className }: { uf?: string; foco?: string; className?: string }) {
  const router = useRouter();
  const caixa = useRef<HTMLDivElement>(null);
  const tela = useRef<HTMLCanvasElement>(null);
  const camada = useRef<HTMLCanvasElement>(null);
  const [visivel, setVisivel] = useState(false);
  const [largura, setLargura] = useState(0);

  // só baixa a geometria quando o mapa chega perto da tela
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setVisivel(true), { rootMargin: "300px" });
    io.observe(el);
    const ro = new ResizeObserver(() => setLargura(el.clientWidth));
    ro.observe(el);
    return () => {
      io.disconnect();
      ro.disconnect();
    };
  }, []);

  const { data: geo } = useSWR<Geo>(visivel ? GEO_URL : null, geoFetcher, geoOpts);
  const { data } = useSWR<MunicipiosPayload>(visivel ? "/api/municipios" : null, buscarMunicipios, {
    refreshInterval: 20_000,
    keepPreviousData: true,
    fallbackData: acumulado ?? undefined,
    compare: (a, b) => a === b || assinatura(a) === assinatura(b),
  });

  const formas = useMemo<Forma[]>(() => {
    if (!geo) return [];
    const chave = uf ?? "br";
    const cache = cacheFormas.get(geo);
    if (cache?.has(chave)) return cache.get(chave)!;
    const out: Forma[] = [];
    geo.mun.forEach(([id, nome, d], i) => {
      const u = IBGE_UF[id.slice(0, 2)];
      if (uf && u !== uf) return;
      out.push({ i, id, nome, uf: u, p: new Path2D(d), bb: bboxDoPath(d) });
    });
    if (!cacheFormas.has(geo)) cacheFormas.set(geo, new Map());
    cacheFormas.get(geo)!.set(chave, out);
    return out;
  }, [geo, uf]);
  const bordas = useMemo(
    () => (geo ? Object.entries(geo.ufs).filter(([k]) => !uf || k === uf).map(([, d]) => new Path2D(d)) : []),
    [geo, uf],
  );

  const vb = useMemo(() => {
    if (!geo) return { x: 0, y: 0, w: 1000, h: 1000 };
    if (uf && geo.bbox[uf]) {
      const [x0, y0, x1, y1] = geo.bbox[uf];
      const pad = Math.max(x1 - x0, y1 - y0) * 0.05;
      return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
    }
    return { x: 0, y: 0, w: geo.w, h: geo.h };
  }, [geo, uf]);

  const altura = largura ? Math.round((largura * vb.h) / vb.w) : 0;
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const [hover, setHover] = useState<Forma | null>(null);
  const [fixo, setFixo] = useState<Forma | null>(null); // cidade escolhida na busca
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const arrasto = useRef<{ x: number; y: number; vx: number; vy: number; dx: number; dy: number; moveu: boolean } | null>(null);
  const raf = useRef(0);
  const escala = largura ? largura / (vb.w / view.k) : 1;

  const cores = useMemo(() => {
    const m = new Map<string, [string, number]>();
    if (!data) return m;
    for (const f of formas) {
      const r = data.m[f.id];
      if (!r || r.length < 4) continue;
      const vv = Number(r[1]) || 1;
      const partido = data.cand[String(r[2])]?.[1];
      m.set(f.id, [corPartido(partido), alfa(((Number(r[3]) - Number(r[5] ?? 0)) / vv) * 100)]);
    }
    return m;
  }, [data, formas]);

  // desenho principal: só quando dados, zoom ou tamanho mudam
  useEffect(() => {
    const c = tela.current;
    if (!c || !largura || !formas.length) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(largura * dpr);
    c.height = Math.round(altura * dpr);
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    const s = escala * dpr;
    ctx.setTransform(s, 0, 0, s, -(vb.x + view.x) * s, -(vb.y + view.y) * s);
    const jx0 = vb.x + view.x, jy0 = vb.y + view.y, jx1 = jx0 + vb.w / view.k, jy1 = jy0 + vb.h / view.k;
    const dentro = (f: Forma) => !(f.bb[2] < jx0 || f.bb[0] > jx1 || f.bb[3] < jy0 || f.bb[1] > jy1);
    for (const f of formas) {
      if (!dentro(f)) continue;
      const cor = cores.get(f.id);
      ctx.globalAlpha = cor ? cor[1] : 1;
      ctx.fillStyle = cor ? cor[0] : SEM_DADOS;
      ctx.fill(f.p);
    }
    ctx.globalAlpha = 1;
    if (uf || view.k >= 2) {
      ctx.strokeStyle = "rgba(4,5,9,.6)";
      ctx.lineWidth = 0.5 / escala;
      for (const f of formas) if (dentro(f)) ctx.stroke(f.p);
    }
    ctx.strokeStyle = "rgba(255,255,255,.55)";
    ctx.lineWidth = 1 / escala;
    ctx.lineJoin = "round";
    for (const b of bordas) ctx.stroke(b);
  }, [formas, bordas, cores, largura, altura, escala, vb, view, uf]);

  // camada de destaque (hover e cidade buscada)
  useEffect(() => {
    const c = camada.current;
    if (!c || !largura) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(largura * dpr);
    c.height = Math.round(altura * dpr);
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    const s = escala * dpr;
    ctx.setTransform(s, 0, 0, s, -(vb.x + view.x) * s, -(vb.y + view.y) * s);
    ctx.lineJoin = "round";
    if (fixo) {
      ctx.strokeStyle = "#d4ff3a";
      ctx.lineWidth = 2.4 / escala;
      ctx.shadowColor = "#d4ff3a";
      ctx.shadowBlur = 14;
      ctx.stroke(fixo.p);
    }
    if (hover && hover !== fixo) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2 / escala;
      ctx.shadowColor = "rgba(255,255,255,.6)";
      ctx.shadowBlur = 8;
      ctx.stroke(hover.p);
    }
  }, [hover, fixo, largura, altura, escala, vb, view]);

  const teste = useRef<CanvasRenderingContext2D | null>(null);
  const acharForma = useCallback(
    (px: number, py: number) => {
      const mx = vb.x + view.x + px / escala;
      const my = vb.y + view.y + py / escala;
      teste.current ??= document.createElement("canvas").getContext("2d");
      const ctx = teste.current!;
      for (let j = formas.length - 1; j >= 0; j--) {
        const f = formas[j];
        if (mx < f.bb[0] || mx > f.bb[2] || my < f.bb[1] || my > f.bb[3]) continue;
        if (ctx.isPointInPath(f.p, mx, my)) return f;
      }
      return null;
    },
    [formas, vb, view, escala],
  );

  const zoom = useCallback(
    (fator: number, cx = 0.5, cy = 0.5) =>
      setView((v) => {
        const k = Math.min(16, Math.max(1, v.k * fator));
        const px = v.x + (cx * vb.w) / v.k;
        const py = v.y + (cy * vb.h) / v.k;
        const x = Math.min(Math.max(0, px - (cx * vb.w) / k), vb.w - vb.w / k);
        const y = Math.min(Math.max(0, py - (cy * vb.h) / k), vb.h - vb.h / k);
        return { k, x, y };
      }),
    [vb],
  );

  /** aproxima e destaca uma cidade */
  const focar = useCallback(
    (f: Forma) => {
      const [x0, y0, x1, y1] = f.bb;
      const w = Math.max(x1 - x0, (y1 - y0) * (vb.w / vb.h)) * 6; // a cidade ocupa ~1/6 da largura
      const k = Math.min(16, Math.max(1, vb.w / Math.max(w, 1e-6)));
      const cx = (x0 + x1) / 2 - vb.x;
      const cy = (y0 + y1) / 2 - vb.y;
      setView({
        k,
        x: Math.min(Math.max(0, cx - vb.w / k / 2), vb.w - vb.w / k),
        y: Math.min(Math.max(0, cy - vb.h / k / 2), vb.h - vb.h / k),
      });
      setFixo(f);
      setHover(null);
    },
    [vb],
  );

  // foco vindo da URL (?cidade=código IBGE) — ajusta o estado quando as formas carregam
  const [focoAplicado, setFocoAplicado] = useState<string | null>(null);
  if (foco && formas.length && largura && focoAplicado !== foco) {
    const f = formas.find((x) => x.id === foco);
    setFocoAplicado(foco);
    if (f) queueMicrotask(() => focar(f));
  }

  // busca de cidade
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState(0);
  const resultados = useMemo(() => {
    const q = normalizar(busca.trim());
    if (q.length < 2) return [];
    const exato: Forma[] = [];
    const inicio: Forma[] = [];
    const meio: Forma[] = [];
    for (const f of formas) {
      const n = normalizar(f.nome);
      if (n === q) exato.push(f);
      else if (n.startsWith(q)) { if (inicio.length < 8) inicio.push(f); }
      else if (meio.length < 8 && n.includes(q)) meio.push(f);
    }
    return [...exato, ...inicio, ...meio].slice(0, 8);
  }, [busca, formas]);

  const alvo = hover ?? fixo;
  const info = useMemo(() => {
    if (!alvo) return null;
    const r = data?.m[alvo.id];
    const vv = r ? Number(r[1]) : 0;
    const top: { nome: string; partido: string; votos: number; pct: number }[] = [];
    if (r)
      for (let i = 2; i + 1 < r.length; i += 2) {
        const [n, p] = data!.cand[String(r[i])] ?? [String(r[i]), ""];
        top.push({ nome: n, partido: p, votos: Number(r[i + 1]), pct: vv ? (Number(r[i + 1]) / vv) * 100 : 0 });
      }
    return { nome: alvo.nome, uf: alvo.uf, pct: r ? Number(r[0]) / 10 : 0, vv, top };
  }, [alvo, data]);

  // posição do balão: mouse (hover) ou canto (cidade fixa)
  const balao = hover
    ? { x: Math.max(0, Math.min(pos.x + 16, largura - 270)), y: Math.max(0, Math.min(pos.y + 16, altura - 190)) }
    : { x: Math.max(0, largura - 276), y: 12 };

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

  const moverCanvas = (dx: number, dy: number) => {
    const t = dx || dy ? `translate(${dx}px, ${dy}px)` : "";
    if (tela.current) tela.current.style.transform = t;
    if (camada.current) camada.current.style.transform = t;
  };
  const soltar = () => {
    const a = arrasto.current;
    arrasto.current = null;
    if (!a?.moveu) return false;
    moverCanvas(0, 0);
    setView((v) => ({
      ...v,
      x: Math.min(Math.max(0, a.vx - a.dx / escala), vb.w - vb.w / v.k),
      y: Math.min(Math.max(0, a.vy - a.dy / escala), vb.h - vb.h / v.k),
    }));
    return true;
  };

  return (
    <div className={className}>
      {/* busca de cidade */}
      <div className="relative mb-3">
        <div className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 focus-within:border-lime/50">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") setSel((s) => Math.min(resultados.length - 1, s + 1));
              if (e.key === "ArrowUp") setSel((s) => Math.max(0, s - 1));
              if (e.key === "Escape") setBusca("");
              if (e.key === "Enter" && resultados[sel]) {
                focar(resultados[sel]);
                setBusca("");
              }
            }}
            placeholder={uf ? `Buscar cidade em ${UF_MAP[uf]?.nome ?? ""}…` : "Buscar cidade…"}
            className="h-full flex-1 bg-transparent text-[13px] outline-none placeholder:text-dim"
          />
          {fixo && (
            <button
              onClick={() => {
                setFixo(null);
                setView({ k: 1, x: 0, y: 0 });
              }}
              className="chip !h-6 border-lime/40 text-lime hover:bg-lime/10"
            >
              {fixo.nome} ✕
            </button>
          )}
        </div>
        {resultados.length > 0 && (
          <div className="absolute inset-x-0 top-11 z-30 overflow-hidden rounded-xl border border-white/10 bg-[#0b0d14] p-1 shadow-2xl">
            {resultados.map((f, i) => {
              const r = data?.m[f.id];
              const p = r ? data!.cand[String(r[2])]?.[1] : undefined;
              return (
                <button
                  key={f.id}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => {
                    focar(f);
                    setBusca("");
                  }}
                  className={clsx("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px]", i === sel && "bg-white/[0.06]")}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: p ? corPartido(p) : SEM_DADOS }} />
                  <span className="flex-1 truncate">{f.nome}</span>
                  <span className="font-mono text-[10px] text-dim">{f.uf.toUpperCase()}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mb-3 flex min-h-[18px] flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] text-muted">
        {lideres.map(([p, n]) => (
          <span key={p} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: corPartido(p) }} />
            <span className="text-text">{p}</span> {fmtInt(n)}
          </span>
        ))}
        {lideres.length > 0 && <span className="text-dim">municípios</span>}
        <span className="ml-auto flex items-center gap-1.5 text-dim">
          {ALFAS.map((o) => (
            <span key={o} className="h-2 w-3 rounded-sm bg-white" style={{ opacity: o * 0.8 }} />
          ))}
          até {FAIXAS.join(" · ")} · mais pontos
        </span>
      </div>

      <div
        ref={caixa}
        className={clsx(
          "relative touch-none select-none overflow-hidden rounded-2xl",
          view.k > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        )}
        style={{ height: altura || undefined, aspectRatio: altura ? undefined : `${vb.w} / ${vb.h}` }}
        onDoubleClick={(e) => {
          const r = caixa.current!.getBoundingClientRect();
          zoom(e.shiftKey ? 1 / 2 : 2, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
        }}
        onPointerDown={(e) => {
          arrasto.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, dx: 0, dy: 0, moveu: false };
        }}
        onPointerMove={(e) => {
          const r = caixa.current!.getBoundingClientRect();
          const px = e.clientX - r.left;
          const py = e.clientY - r.top;
          const a = arrasto.current;
          if (a && view.k > 1) {
            a.dx = e.clientX - a.x;
            a.dy = e.clientY - a.y;
            if (Math.abs(a.dx) + Math.abs(a.dy) > 4) a.moveu = true;
            if (a.moveu) {
              moverCanvas(a.dx, a.dy);
              setHover(null);
              return;
            }
          }
          cancelAnimationFrame(raf.current);
          raf.current = requestAnimationFrame(() => {
            setPos({ x: px, y: py });
            const f = acharForma(px, py);
            setHover((h) => (h?.i === f?.i ? h : f));
          });
        }}
        onPointerUp={(e) => {
          if (soltar()) return;
          if (!uf && view.k === 1 && e.detail === 1 && hover) router.push(`/uf/${hover.uf}?cidade=${hover.id}`);
          else if (hover && e.detail === 1) setFixo(hover);
        }}
        onPointerLeave={() => {
          cancelAnimationFrame(raf.current);
          setHover(null);
          soltar();
        }}
      >
        {!geo && <div className="skeleton absolute inset-0" />}
        <canvas ref={tela} className="absolute inset-0 h-full w-full" />
        <canvas ref={camada} className="pointer-events-none absolute inset-0 h-full w-full" />

        <div className="absolute bottom-3 left-3 flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0b0d14]/90">
          <button aria-label="Aproximar" onClick={() => zoom(1.8)} className="h-8 w-8 text-lg text-muted hover:bg-white/5 hover:text-text">+</button>
          <button aria-label="Afastar" onClick={() => zoom(1 / 1.8)} className="h-8 w-8 border-t border-white/10 text-lg text-muted hover:bg-white/5 hover:text-text">−</button>
          {view.k > 1 && (
            <button aria-label="Ver tudo" onClick={() => setView({ k: 1, x: 0, y: 0 })} className="h-8 w-8 border-t border-white/10 text-[11px] text-muted hover:bg-white/5 hover:text-text">⤢</button>
          )}
        </div>
        {data && data.carregados < data.total && (
          <div className="absolute bottom-3 right-3 rounded-full border border-white/10 bg-[#0b0d14]/90 px-3 py-1 font-mono text-[10px] text-muted">
            carregando municípios {fmtInt(data.carregados)}/{fmtInt(data.total)}
          </div>
        )}

        {info && (
          <div
            className={clsx(
              "pointer-events-none absolute left-0 top-0 z-20 w-64 rounded-2xl border bg-[#0b0d14]/95 p-4 shadow-2xl",
              !hover ? "border-lime/30" : "border-white/10",
            )}
            style={{ transform: `translate(${balao.x}px, ${balao.y}px)` }}
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
            {!uf && hover && <div className="mt-3 border-t border-white/5 pt-2 font-mono text-[10px] text-dim">clique para abrir {UF_MAP[hover.uf]?.nome}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
