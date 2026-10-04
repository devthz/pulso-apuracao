"use client";
import clsx from "clsx";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { fmtCompact, fmtInt, fmtPct, iniciais } from "@/lib/format";
import { corPartido } from "@/lib/parties";

export function Num({
  value,
  kind = "int",
  casas = 2,
  className,
}: {
  value: number;
  kind?: "int" | "pct" | "compact";
  casas?: number;
  className?: string;
}) {
  const mv = useMotionValue(0);
  const txt = useTransform(mv, (v) => (kind === "pct" ? fmtPct(v, casas) : kind === "compact" ? fmtCompact(v) : fmtInt(v)));
  useEffect(() => {
    const c = animate(mv, value, { duration: 1.4, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [value, mv]);
  return <motion.span className={clsx("tnum", className)}>{txt}</motion.span>;
}

export function Avatar({
  nome,
  foto,
  partido,
  size = 48,
  className,
  ring = true,
}: {
  nome: string;
  foto?: string;
  partido: string;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const [erro, setErro] = useState(false);
  const cor = corPartido(partido);
  return (
    <div
      className={clsx("relative shrink-0 rounded-full", className)}
      style={{
        width: size,
        height: size,
        padding: ring ? Math.max(2, size / 28) : 0,
        background: ring ? `conic-gradient(from 210deg, ${cor}, transparent 40%, ${cor} 75%, ${cor})` : undefined,
        boxShadow: ring ? `0 0 ${size / 2.5}px -${size / 8}px ${cor}` : undefined,
      }}
    >
      <div className="h-full w-full overflow-hidden rounded-full bg-[#11131b]">
        {foto && !erro ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={foto}
            alt={nome}
            loading="lazy"
            onError={() => setErro(true)}
            className="h-full w-full object-cover object-top grayscale-[15%]"
          />
        ) : (
          <div
            className="font-display flex h-full w-full items-center justify-center font-semibold"
            style={{
              fontSize: size * 0.34,
              background: `radial-gradient(circle at 30% 20%, ${cor}55, transparent 70%), #0d0f16`,
              color: cor,
            }}
          >
            {iniciais(nome)}
          </div>
        )}
      </div>
    </div>
  );
}

export function PartyTag({ sigla, className }: { sigla: string; className?: string }) {
  const cor = corPartido(sigla);
  return (
    <span className={clsx("chip", className)} style={{ borderColor: `${cor}55`, color: cor, background: `${cor}14` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: cor, boxShadow: `0 0 8px ${cor}` }} />
      {sigla}
    </span>
  );
}

export function StatusTag({
  eleito,
  segundoTurno,
  status,
  projecao,
}: {
  eleito?: boolean;
  segundoTurno?: boolean;
  status?: "aguardando" | "apurando" | "final";
  projecao?: boolean;
}) {
  if (eleito)
    return (
      <span className="chip border-lime/50 bg-lime/10 text-lime">
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1.5 5.2 4 7.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
        {projecao ? "PROJ. ELEITO" : "ELEITO"}
      </span>
    );
  if (segundoTurno) return <span className="chip border-cyan/50 bg-cyan/10 text-cyan">2º TURNO</span>;
  if (status === "aguardando") return <span className="chip text-dim">AGUARDANDO</span>;
  if (status === "final") return <span className="chip text-muted">FINALIZADO</span>;
  return (
    <span className="chip border-amber/40 text-amber">
      <span className="live-dot !h-1.5 !w-1.5" /> APURANDO
    </span>
  );
}

export function Panel({ children, className, as = "div", id }: { children: ReactNode; className?: string; as?: "div" | "section" | "article"; id?: string }) {
  const C = as;
  return (
    <C id={id} className={clsx("panel spot", className)}>
      {children}
    </C>
  );
}

export function SectionTitle({ kicker, title, right, id }: { kicker: string; title: ReactNode; right?: ReactNode; id?: string }) {
  return (
    <div id={id} className="mb-6 flex scroll-mt-28 flex-wrap items-end justify-between gap-4">
      <div>
        <div className="kicker mb-3 flex items-center gap-3">
          <span className="h-px w-8 bg-gradient-to-r from-lime to-transparent" />
          {kicker}
        </div>
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">{title}</h2>
      </div>
      {right}
    </div>
  );
}

export function Bar({ pct, cor, className, glow = true }: { pct: number; cor: string; className?: string; glow?: boolean }) {
  return (
    <div className={clsx("relative h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]", className)}>
      <motion.div
        className="shine absolute inset-y-0 left-0 rounded-full"
        style={{ background: `linear-gradient(90deg, ${cor}aa, ${cor})`, boxShadow: glow ? `0 0 16px ${cor}` : undefined }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

export function ProgressRing({ pct, size = 120, stroke = 6, children }: { pct: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ringg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--lime)" />
            <stop offset="100%" stopColor="var(--cyan)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth={1} strokeDasharray="2 6" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ringg)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.min(100, pct) / 100) }}
          transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: "drop-shadow(0 0 8px rgba(212,255,58,.6))" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton", className)} />;
}

export function Vazio({ titulo, texto }: { titulo: string; texto?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <div className="relative mb-2 h-10 w-10">
        <span className="absolute inset-0 animate-ping rounded-full bg-cyan/20" />
        <span className="absolute inset-2 rounded-full bg-cyan/60 blur-[2px]" />
      </div>
      <div className="font-display text-lg">{titulo}</div>
      {texto && <div className="max-w-sm text-sm text-muted">{texto}</div>}
    </div>
  );
}
