"use client";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import useSWR, { useSWRConfig } from "swr";
import { turnoDaFase, useFase, usePanorama } from "@/hooks/data";
import { fmtPct } from "@/lib/format";
import { corPartido } from "@/lib/parties";
import { comParams } from "@/lib/qs";
import { UFS } from "@/lib/ufs";

export function Background() {
  return (
    <>
      <div className="aurora" aria-hidden>
        <i />
        <i />
        <i />
      </div>
      <div className="grid-floor" aria-hidden />
      <div className="grain" aria-hidden />
    </>
  );
}

/** Atualiza --mx/--my no painel sob o cursor (holofote + borda iluminada) */
export function Spotlight() {
  useEffect(() => {
    const on = (e: PointerEvent) => {
      const el = (e.target as HTMLElement)?.closest?.(".spot") as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    window.addEventListener("pointermove", on, { passive: true });
    return () => window.removeEventListener("pointermove", on);
  }, []);
  return null;
}

// relógio compartilhado: um único setInterval para toda a página; no servidor é null (evita erro de hidratação)
const relogio = {
  ouvintes: new Set<() => void>(),
  agora: 0,
  timer: undefined as ReturnType<typeof setInterval> | undefined,
  assinar(fn: () => void) {
    relogio.ouvintes.add(fn);
    if (!relogio.timer) {
      relogio.agora = Date.now();
      relogio.timer = setInterval(() => {
        relogio.agora = Date.now();
        relogio.ouvintes.forEach((f) => f());
      }, 1000);
    }
    return () => {
      relogio.ouvintes.delete(fn);
      if (!relogio.ouvintes.size) {
        clearInterval(relogio.timer);
        relogio.timer = undefined;
      }
    };
  },
};
/** relógio compartilhado (1 s) para outros componentes */
export function useRelogioPublico() {
  return useRelogio();
}

function useRelogio() {
  const t = useSyncExternalStore(
    relogio.assinar,
    () => (relogio.agora ||= Date.now()),
    () => 0,
  );
  return t ? new Date(t) : null;
}

export function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-3">
      <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/10 to-white/0">
        <svg viewBox="0 0 40 20" className="w-7 text-lime">
          <path
            d="M0 10h9l3-7 5 14 4-10 3 3h16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={100}
            strokeDasharray="100 100"
            className="[animation:ekg_2.4s_linear_infinite]"
            style={{ filter: "drop-shadow(0 0 4px var(--lime))" }}
          />
        </svg>
        <style>{`@keyframes ekg{0%{stroke-dashoffset:100}55%{stroke-dashoffset:0}100%{stroke-dashoffset:-100}}`}</style>
      </div>
      <div className="leading-none">
        <div className="font-display text-[17px] font-bold tracking-tight">
          PULSO<span className="text-lime">.</span>
        </div>
        <div className="mt-1 font-mono text-[9.5px] tracking-[0.22em] text-muted">ELEIÇÕES 2026</div>
      </div>
    </Link>
  );
}

/** menu muda com a fase: no 1º turno é tudo na home; depois, a home é o 2º turno e o 1º turno vai para abas */
function navPara(fase?: string) {
  if (!fase || fase === "1t")
    return [
      { href: "/#presidente", label: "Presidente" },
      { href: "/#segundo-turno", label: "Simulador 2º turno" },
      { href: "/governadores", label: "Governadores" },
      { href: "/senado", label: "Senado" },
      { href: "/camara", label: "Câmara" },
      { href: "/assembleias", label: "Assembleias" },
    ];
  return [
    { href: "/", label: "2º turno" },
    { href: "/primeiro-turno", label: "Presidente · 1º turno" },
    { href: "/governadores", label: "Governadores" },
    { href: "/senado", label: "Senado" },
    { href: "/camara", label: "Câmara" },
    { href: "/assembleias", label: "Assembleias" },
  ];
}

export function Header() {
  const { data: faseInfo } = useFase();
  const pathname = usePathname();
  const NAV = navPara(faseInfo?.fase);
  const agora = useRelogio();
  const { data } = usePanorama("presidente");
  const [cmdk, setCmdk] = useState(false);
  const sim = data?.fonte === "simulacao";

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdk((v) => !v);
      }
      if (e.key === "/" && !(e.target as HTMLElement).closest("input,textarea")) {
        e.preventDefault();
        setCmdk(true);
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  const hora = agora
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(agora)
    : "--:--:--";

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#040509]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-6 px-4 sm:px-8">
          <Logo />
          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.map((n) => {
              const ativo = n.href === pathname;
              return (
                <Link
                  key={n.href}
                  href={comParams(n.href)}
                  className={clsx(
                    "rounded-full px-3.5 py-1.5 text-[13px] transition hover:bg-white/5 hover:text-text",
                    ativo ? "bg-white/[0.07] text-text" : "text-muted",
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {sim ? (
              <span className="chip hidden border-pink/50 md:inline-flex bg-pink/10 text-pink" title="Dados fictícios gerados localmente">
                <span className="live-dot !h-1.5 !w-1.5" /> SIMULAÇÃO
              </span>
            ) : (
              <span className="chip hidden border-[#ff3b3b]/50 md:inline-flex bg-[#ff3b3b]/10 text-[#ff5a5a]">
                <span className="live-dot !h-1.5 !w-1.5" /> AO VIVO · TSE
              </span>
            )}
            <TimerChip />
            <span className="hidden font-mono text-[13px] tabular-nums text-muted xl:block">
              <span className="text-dim">BRT</span> {hora}
            </span>
            <button
              onClick={() => setCmdk(true)}
              className="flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 text-[13px] text-muted transition hover:border-white/20 hover:text-text"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <span className="hidden 2xl:inline">Buscar estado ou cidade</span>
              <kbd className="hidden rounded border border-white/10 px-1.5 font-mono text-[10px] sm:inline">⌘K</kbd>
            </button>
          </div>
        </div>
        <HeaderProgress />
      </header>
      <AnimatePresence>{cmdk && <CommandPalette onClose={() => setCmdk(false)} />}</AnimatePresence>
    </>
  );
}

const IBGE_UF_CMD: Record<string, string> = {
  "11": "ro", "12": "ac", "13": "am", "14": "rr", "15": "pa", "16": "ap", "17": "to", "21": "ma", "22": "pi", "23": "ce",
  "24": "rn", "25": "pb", "26": "pe", "27": "al", "28": "se", "29": "ba", "31": "mg", "32": "es", "33": "rj", "35": "sp",
  "41": "pr", "42": "sc", "43": "rs", "50": "ms", "51": "mt", "52": "go", "53": "df",
};
type ItemBusca = { tipo: "uf"; uf: string; nome: string; extra: string } | { tipo: "cidade"; uf: string; id: string; nome: string; extra: string };

function CommandPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  // índice leve de cidades (~50 KB), só baixado quando a busca abre
  const { data: cidades } = useSWR<[string, string][]>("/geo/cidades.json", (u: string) => fetch(u).then((r) => r.json()), {
    revalidateOnFocus: false,
    revalidateIfStale: false,
  });
  const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const indice = useMemo(() => (cidades ?? []).map(([id, n]) => [id, n, norm(n)] as const), [cidades]);
  const lista = useMemo<ItemBusca[]>(() => {
    const t = norm(q.trim());
    const ufs: ItemBusca[] = UFS.filter((u) => !t || norm(u.nome).includes(t) || u.sigla === t).map((u) => ({
      tipo: "uf",
      uf: u.sigla,
      nome: u.nome,
      extra: u.regiao,
    }));
    if (t.length < 2) return ufs;
    const exato: ItemBusca[] = [];
    const comeca: ItemBusca[] = [];
    const contem: ItemBusca[] = [];
    for (const [id, nome, n] of indice) {
      const uf = IBGE_UF_CMD[id.slice(0, 2)];
      const item: ItemBusca = { tipo: "cidade", uf, id, nome, extra: uf.toUpperCase() };
      if (n === t) exato.push(item);
      else if (n.startsWith(t)) { if (comeca.length < 12) comeca.push(item); }
      else if (contem.length < 12 && n.includes(t)) contem.push(item);
    }
    return [...exato, ...ufs.slice(0, 3), ...comeca, ...contem].slice(0, 14);
  }, [q, indice]);
  useEffect(() => input.current?.focus(), []);
  const ir = (it: ItemBusca) => {
    onClose();
    router.push(comParams(`/uf/${it.uf}`, { cidade: it.tipo === "cidade" ? it.id : undefined }));
  };
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-[12vh]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="panel w-full max-w-lg overflow-hidden !rounded-3xl !bg-[#0b0d14]"
        initial={{ y: 20, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 10, scale: 0.98 }}
        transition={{ type: "spring", damping: 26, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") setSel((s) => Math.min(lista.length - 1, s + 1));
              if (e.key === "ArrowUp") setSel((s) => Math.max(0, s - 1));
              if (e.key === "Enter" && lista[sel]) ir(lista[sel]);
            }}
            placeholder="Estado ou cidade…"
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-dim"
          />
          <kbd className="rounded border border-white/10 px-1.5 font-mono text-[10px] text-dim">ESC</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {lista.map((it, i) => (
            <button
              key={it.tipo === "uf" ? it.uf : it.id}
              onMouseEnter={() => setSel(i)}
              onClick={() => ir(it)}
              className={clsx("flex w-full items-center gap-4 rounded-xl px-3 py-2.5 text-left transition", i === sel && "bg-white/[0.06]")}
            >
              {it.tipo === "uf" ? (
                <span className="font-display w-9 text-sm font-semibold text-lime">{it.uf.toUpperCase()}</span>
              ) : (
                <span className="flex w-9 justify-center text-muted">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
                </span>
              )}
              <span className="flex-1 text-sm">{it.nome}</span>
              <span className="font-mono text-[11px] text-dim">{it.extra}</span>
            </button>
          ))}
          {!lista.length && <div className="px-3 py-6 text-center text-sm text-muted">Nada encontrado</div>}
          {q.trim().length >= 2 && !cidades && <div className="px-3 py-3 text-center font-mono text-[11px] text-dim">carregando cidades…</div>}
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Letreiro com o avanço por UF (presidente) */
export function Ticker() {
  const { data: f } = useFase();
  const { data } = usePanorama("presidente", turnoDaFase(f));
  const pathname = usePathname();
  const itens = data?.ufs.filter((u) => u.lideres.length && u.pct > 0) ?? [];
  if (!itens.length || pathname.startsWith("/uf/")) return <div className="h-10 border-b border-white/[0.05]" />;
  const linha = (k: string) =>
    itens.map((u) => {
      const l = u.lideres[0];
      return (
        <Link key={k + u.uf} href={`/uf/${u.uf}`} className="flex items-center gap-2.5 whitespace-nowrap px-5 text-[12px] hover:text-white">
          <span className="font-display font-semibold text-white">{u.uf.toUpperCase()}</span>
          <span className="font-mono text-dim">{fmtPct(u.pct, 1)}%</span>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: corPartido(l.partido), boxShadow: `0 0 8px ${corPartido(l.partido)}` }} />
          <span className="text-muted">{l.nome}</span>
          <span className="font-mono text-text">{fmtPct(l.pct, 1)}%</span>
          <span className="text-white/10">/</span>
        </Link>
      );
    });
  return (
    <div className="marquee relative h-10 overflow-hidden border-b border-white/[0.05] bg-white/[0.012]">
      <div className="marquee-track flex h-full w-max items-center">
        {linha("a")}
        {linha("b")}
      </div>
    </div>
  );
}

/* ================= Fase da apuração: antes → em andamento → encerrada ================= */

export type Fase = "antes" | "andamento" | "encerrada";

const p2 = (n: number) => String(n).padStart(2, "0");
export function hms(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return { h: p2(Math.floor(t / 3600)), m: p2(Math.floor((t % 3600) / 60)), s: p2(t % 60) };
}

export function useFaseApuracao() {
  const agora = useRelogio();
  const { data: f } = useFase();
  const { data } = usePanorama("presidente", turnoDaFase(f));
  const { mutate } = useSWRConfig();
  const inicio = data ? new Date(data.inicioApuracao).getTime() : null;
  const t = agora?.getTime() ?? null;
  const fase: Fase | null =
    inicio == null || t == null ? null : data?.nacional?.final ? "encerrada" : t < inicio ? "antes" : "andamento";

  // no instante em que vira "em andamento", busca tudo de novo na hora (sem esperar o próximo ciclo de 15 s)
  const anterior = useRef<Fase | null>(null);
  useEffect(() => {
    if (anterior.current === "antes" && fase === "andamento") {
      mutate(() => true);
      const t2 = setTimeout(() => mutate(() => true), 4000);
      anterior.current = fase;
      return () => clearTimeout(t2);
    }
    anterior.current = fase;
  }, [fase, mutate]);

  return {
    fase,
    faseSite: f?.fase,
    falta2t: f && t != null ? new Date(f.inicio2t).getTime() - t : 0,
    falta: inicio != null && t != null ? inicio - t : 0,
    decorrido: inicio != null && t != null ? t - inicio : 0,
    pct: data?.nacional?.secoes.pct ?? 0,
    temDados: !!data?.nacional && data.nacional.status !== "aguardando",
    simulacao: data?.fonte === "simulacao",
  };
}

/** Chip do cabeçalho: "COMEÇA EM 01:12:33" → "EM ANDAMENTO 00:05:10" → "ENCERRADA" */
export function TimerChip() {
  const { fase, falta, decorrido, faseSite, falta2t } = useFaseApuracao();
  if (faseSite === "entre") {
    const dias = Math.floor(Math.max(0, falta2t) / 86_400_000);
    const x2 = hms(falta2t % 86_400_000);
    return (
      <span className="chip !h-8 gap-2 border-cyan/40 bg-cyan/[0.08] tabular-nums text-cyan">
        <span className="hidden sm:inline">2º TURNO EM</span>
        <span className="text-text">
          {dias > 0 ? `${dias}d ` : ""}
          {x2.h}:{x2.m}:{x2.s}
        </span>
      </span>
    );
  }
  if (!fase) return <span className="chip w-[176px] animate-pulse text-dim">· · ·</span>;
  const x = fase === "antes" ? hms(falta) : hms(decorrido);
  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={fase}
        initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
        transition={{ duration: 0.35 }}
        className={clsx(
          "chip !h-8 gap-2 tabular-nums",
          fase === "antes" && "border-cyan/40 bg-cyan/[0.08] text-cyan",
          fase === "andamento" && "border-lime/50 bg-lime/10 text-lime shadow-[0_0_24px_-6px_var(--lime)]",
          fase === "encerrada" && "text-muted",
        )}
      >
        {fase === "antes" && (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" /></svg>
            <span className="hidden sm:inline">APURAÇÃO EM</span>
            <span className="text-text">{x.h}:{x.m}:{x.s}</span>
          </>
        )}
        {fase === "andamento" && (
          <>
            <span className="live-dot !h-1.5 !w-1.5" />
            <span className="hidden sm:inline">EM ANDAMENTO</span>
            <span className="text-text">{x.h}:{x.m}:{x.s}</span>
          </>
        )}
        {fase === "encerrada" && <>✓ APURAÇÃO ENCERRADA</>}
      </motion.span>
    </AnimatePresence>
  );
}

/** Linha de progresso no rodapé do cabeçalho (seções totalizadas no país) */
export function HeaderProgress() {
  const { fase, pct } = useFaseApuracao();
  if (fase !== "andamento" && fase !== "encerrada") return null;
  return (
    <div className="absolute inset-x-0 -bottom-px h-[2px] bg-white/[0.04]">
      <motion.div
        className="h-full bg-gradient-to-r from-lime via-cyan to-violet shadow-[0_0_12px_var(--lime)]"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

function Digitos({ x, cls }: { x: ReturnType<typeof hms>; cls: string }) {
  return (
    <div className="font-display text-6xl font-bold tabular-nums tracking-tight sm:text-8xl">
      <span className={cls}>{x.h}</span>
      <span className="animate-pulse text-dim">:</span>
      <span className={cls}>{x.m}</span>
      <span className="animate-pulse text-dim">:</span>
      <span className={cls}>{x.s}</span>
    </div>
  );
}

/** Bloco grande do topo enquanto não há números: contagem regressiva e, depois das 17h, cronômetro "em andamento" */
export function Cronometro() {
  const { fase, falta, decorrido, simulacao } = useFaseApuracao();
  if (!fase || fase === "encerrada") return null;
  const x = fase === "antes" ? hms(falta) : hms(decorrido);
  return (
    <AnimatePresence mode="wait">
      {fase === "antes" ? (
        <motion.div
          key="antes"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.08, filter: "blur(12px)" }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-4 py-12 text-center"
        >
          <div className="kicker">A apuração começa em</div>
          <Digitos x={x} cls="text-gradient" />
          <div className="max-w-md text-sm text-muted">
            {simulacao
              ? "Simulação: a contagem fictícia começa quando o relógio zerar."
              : "O TSE começa a divulgar os resultados às 17h de Brasília, quando fecham as últimas seções. A página vira sozinha."}
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="andamento"
          initial={{ opacity: 0, scale: 0.9, filter: "blur(12px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex flex-col items-center gap-4 py-12 text-center"
        >
          <motion.div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime/20 blur-[80px]"
            initial={{ scale: 0.2, opacity: 1 }}
            animate={{ scale: 1.6, opacity: 0.35 }}
            transition={{ duration: 1.4, ease: "easeOut" }}
          />
          <span className="chip !h-8 border-lime/50 bg-lime/10 !px-4 text-lime">
            <span className="live-dot !h-2 !w-2" /> APURAÇÃO EM ANDAMENTO
          </span>
          <div className="kicker mt-2">Tempo de apuração</div>
          <Digitos x={x} cls="text-white" />
          <div className="max-w-md text-sm text-muted">
            Aguardando o primeiro boletim do TSE. Os números aparecem aqui assim que forem publicados.
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
