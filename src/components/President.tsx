"use client";
import clsx from "clsx";
import { motion } from "motion/react";
import { useCorrida, usePanorama } from "@/hooks/data";
import { fmtInt, fmtPct, soHora } from "@/lib/format";
import { corPartido } from "@/lib/parties";
import type { Candidato, Corrida, ResumoUF } from "@/lib/tse/types";
import { BrazilMap } from "./BrazilMap";
import { Cronometro, hms, useFaseApuracao } from "./chrome";
import { Avatar, Bar, Num, Panel, PartyTag, ProgressRing, Skeleton, StatusTag, Vazio } from "./ui";

export function PresidentSection() {
  const { data, error, isLoading } = usePanorama("presidente");
  // o total nacional vem do endpoint próprio (1 arquivo, atualiza a cada 5 s); usa o mais avançado dos dois
  const { data: br } = useCorrida("presidente", "br");
  const pan = data?.nacional;
  const nac = br && (!pan || br.secoes.totalizadas >= pan.secoes.totalizadas) ? br : pan;
  const semDados = !isLoading && (!nac || nac.status === "aguardando");

  return (
    <section id="presidente" className="scroll-mt-24">
      <div className="grid gap-6 xl:grid-cols-12">
        <Panel className="overflow-hidden p-6 sm:p-10 xl:col-span-7">
          <Glow />
          <HeroHeader corrida={nac} />
          {isLoading && <HeroSkeleton />}
          {semDados && (
            <>
              <Cronometro />
              {error && <Vazio titulo="Sem conexão com o servidor" texto="Tentando de novo em instantes…" />}
            </>
          )}
          {nac && nac.status !== "aguardando" && <FaceOff corrida={nac} />}
        </Panel>
        <Panel className="flex flex-col p-6 sm:p-8 xl:col-span-5">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="kicker">Quem lidera em cada estado</div>
              <div className="font-display mt-2 text-xl font-semibold">Mapa da apuração</div>
            </div>
            <span className="chip text-muted">PRESIDENTE</span>
          </div>
          <div className="flex flex-1 items-center">
            {data ? <BrazilMap ufs={data.ufs} className="mx-auto w-full max-w-[560px]" /> : <Skeleton className="aspect-square w-full" />}
          </div>
          {data && <LegendaMapa ufs={data.ufs} />}
        </Panel>
      </div>
      {nac && nac.status !== "aguardando" && <StatsStrip corrida={nac} />}
    </section>
  );
}

function Glow() {
  return (
    <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 -z-10 h-[520px] w-[520px] rounded-full bg-[conic-gradient(from_90deg,var(--lime),var(--cyan),var(--violet),var(--pink),var(--lime))] opacity-[0.13] blur-[90px]" />
  );
}

function HeroHeader({ corrida }: { corrida?: Corrida }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0 flex-1">
        <div className="kicker mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="h-px w-8 bg-gradient-to-r from-lime to-transparent" />
          1º turno · 4 de outubro de 2026
          <FaseInline />
        </div>
        <h1 className="font-display text-[44px] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[68px]">
          Presidente
          <br />
          <span className="outline-text">da República</span>
        </h1>
      </div>
      {corrida && corrida.status !== "aguardando" && (
        <div className="hidden shrink-0 sm:block"><ProgressRing pct={corrida.secoes.pct} size={136} stroke={7}>
          <div className="font-display text-[26px] font-bold leading-none">
            <Num value={corrida.secoes.pct} kind="pct" casas={2} />
            <span className="text-sm text-muted">%</span>
          </div>
          <div className="mt-1.5 font-mono text-[9px] tracking-[0.18em] text-muted">SEÇÕES</div>
          <div className="font-mono text-[9px] text-dim">{soHora(corrida.atualizadoEm)}</div>
        </ProgressRing></div>
      )}
    </div>
  );
}

function FaseInline() {
  const { fase, decorrido, temDados } = useFaseApuracao();
  if (!temDados || !fase || fase === "antes") return null;
  if (fase === "encerrada") return <span className="text-lime">· apuração encerrada</span>;
  const x = hms(decorrido);
  return (
    <span className="flex items-center gap-2 text-lime">
      · <span className="live-dot !h-1.5 !w-1.5" /> em andamento há{" "}
      <span className="tabular-nums text-text">
        {x.h}:{x.m}:{x.s}
      </span>
    </span>
  );
}

function HeroSkeleton() {
  return (
    <div className="mt-10 grid gap-4 sm:grid-cols-2">
      <Skeleton className="h-64" />
      <Skeleton className="h-64" />
      <Skeleton className="h-10 sm:col-span-2" />
    </div>
  );
}

function FaceOff({ corrida }: { corrida: Corrida }) {
  const cands = corrida.candidatos.filter((c) => c.valido);
  const [a, b, ...resto] = cands;
  if (!a) return null;
  const gap = b ? a.pct - b.pct : a.pct;
  return (
    <div className="mt-10">
      <div className="relative grid gap-4 md:grid-cols-2 md:gap-10">
        <CandidatoGrande c={a} lider status={corrida.status} />
        {b && <CandidatoGrande c={b} status={corrida.status} />}
        {b && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 md:block">
            <div className="flex h-[64px] w-[64px] flex-col items-center justify-center rounded-full border border-white/10 bg-[#07080d] shadow-[0_0_40px_rgba(0,0,0,.8)]">
              <div className="font-mono text-[9px] tracking-widest text-dim">DIF.</div>
              <div className="font-display text-sm font-bold text-lime">
                <Num value={gap} kind="pct" casas={1} />
              </div>
              <div className="font-mono text-[9px] text-dim">p.p.</div>
            </div>
          </div>
        )}
      </div>

      <CaboDeGuerra cands={cands} />

      {resto.length > 0 && (
        <div className="mt-8 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {resto.map((c, i) => (
            <motion.div
              key={c.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3"
            >
              <span className="w-4 font-mono text-[11px] text-dim">{i + 3}</span>
              <Avatar nome={c.nome} foto={c.foto} partido={c.partido} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[14px]">{c.nome}</span>
                  <span className="font-mono text-[13px] tabular-nums">
                    <Num value={c.pct} kind="pct" />%
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <Bar pct={c.pct * 2} cor={corPartido(c.partido)} glow={false} className="!h-1" />
                  <span className="w-10 text-right font-mono text-[10px] text-dim">{c.partido}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function CandidatoGrande({ c, lider, status }: { c: Candidato; lider?: boolean; status: Corrida["status"] }) {
  const cor = corPartido(c.partido);
  return (
    <motion.div
      layout
      className={clsx("relative overflow-hidden rounded-[22px] border p-6", lider ? "border-white/15" : "border-white/[0.07]")}
      style={{ background: `radial-gradient(120% 90% at ${lider ? "0% 0%" : "100% 0%"}, ${cor}2e, transparent 60%), rgba(255,255,255,.02)` }}
    >
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${cor}, transparent)` }} />
      <div className="flex items-start justify-between gap-3">
        <Avatar nome={c.nome} foto={c.foto} partido={c.partido} size={84} />
        <div className="flex flex-col items-end gap-2">
          {lider && status !== "final" && <span className="chip border-white/20 bg-white text-black">LIDERA</span>}
          {(c.eleito || c.segundoTurno) && <StatusTag eleito={c.eleito} segundoTurno={c.segundoTurno} />}
          <PartyTag sigla={c.partido} />
        </div>
      </div>
      <div className="mt-5">
        <div className="font-display text-[22px] font-semibold leading-tight sm:text-[26px]">{c.nome}</div>
        {c.vice && <div className="mt-1 text-[12px] text-muted">Vice: {c.vice}</div>}
      </div>
      <div className="mt-6 flex items-end justify-between gap-2">
        <div
          className="font-display text-[64px] font-bold leading-[0.85] tracking-[-0.04em] sm:text-[84px]"
          style={{ backgroundImage: `linear-gradient(180deg, #fff 30%, ${cor})`, WebkitBackgroundClip: "text", color: "transparent" }}
        >
          <Num value={c.pct} kind="pct" />
          <span className="text-[0.4em] tracking-normal">%</span>
        </div>
      </div>
      <div className="mt-3 font-mono text-[12px] text-muted">
        <Num value={c.votos} /> votos
      </div>
    </motion.div>
  );
}

function CaboDeGuerra({ cands }: { cands: Candidato[] }) {
  const tot = cands.reduce((a, c) => a + c.pct, 0) || 1;
  return (
    <div className="mt-8">
      <div className="mb-2 flex justify-between font-mono text-[10px] tracking-widest text-dim">
        <span>VOTOS VÁLIDOS</span>
        <span>50% + 1 VENCE NO 1º TURNO</span>
      </div>
      <div className="relative flex h-4 w-full gap-[3px] overflow-hidden rounded-full">
        {cands.map((c) => (
          <motion.div
            key={c.id}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ background: corPartido(c.partido), boxShadow: `0 0 20px ${corPartido(c.partido)}88` }}
            initial={{ flexGrow: 0 }}
            animate={{ flexGrow: c.pct / tot }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
            title={`${c.nome}: ${fmtPct(c.pct)}%`}
          />
        ))}
        <div className="absolute inset-y-[-4px] left-1/2 w-[2px] bg-white shadow-[0_0_10px_#fff]" />
      </div>
    </div>
  );
}

function LegendaMapa({ ufs }: { ufs: ResumoUF[] }) {
  const cont = new Map<string, { nome: string; partido: string; n: number }>();
  for (const u of ufs) {
    const l = u.lideres[0];
    if (!l || u.pct <= 0) continue;
    const x = cont.get(l.nome) ?? { nome: l.nome, partido: l.partido, n: 0 };
    x.n++;
    cont.set(l.nome, x);
  }
  const lista = [...cont.values()].sort((a, b) => b.n - a.n);
  if (!lista.length) return <div className="mt-4 text-center font-mono text-[11px] text-dim">Estados hachurados ainda não têm votos apurados</div>;
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      {lista.map((l) => (
        <span key={l.nome} className="chip">
          <span className="h-2 w-2 rounded-full" style={{ background: corPartido(l.partido), boxShadow: `0 0 8px ${corPartido(l.partido)}` }} />
          <span className="text-text">{l.nome}</span>
          <span className="text-dim">lidera em {l.n}</span>
        </span>
      ))}
    </div>
  );
}

export function StatsStrip({ corrida }: { corrida: Corrida }) {
  const e = corrida.eleitorado;
  const v = corrida.votos;
  const items = [
    { k: "Seções totalizadas", val: corrida.secoes.totalizadas, sub: `de ${fmtInt(corrida.secoes.total)}`, pct: corrida.secoes.pct, cor: "#d4ff3a" },
    { k: "Comparecimento", val: e.comparecimento, sub: `${fmtPct(e.pctComparecimento)}% do eleitorado apurado`, pct: e.pctComparecimento, cor: "#3df2ff" },
    { k: "Abstenção", val: e.abstencao, sub: `${fmtPct(e.pctAbstencao)}%`, pct: e.pctAbstencao, cor: "#8b5cff" },
    { k: "Brancos", val: v.brancos, sub: `${fmtPct(v.pctBrancos)}%`, pct: v.pctBrancos * 5, cor: "#e6e8f0" },
    { k: "Nulos", val: v.nulos, sub: `${fmtPct(v.pctNulos)}%`, pct: v.pctNulos * 5, cor: "#ff3d9a" },
  ];
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {items.map((i, idx) => (
        <Panel key={i.k} className={clsx("!rounded-[20px] p-5", idx === 0 && "col-span-2 md:col-span-1")}>
          <div className="kicker !text-[10px]">{i.k}</div>
          <div className="font-display mt-3 text-[26px] font-semibold leading-none tracking-tight">
            <Num value={i.val} kind="compact" />
          </div>
          <div className="mt-2 truncate font-mono text-[11px] text-muted">{i.sub}</div>
          <Bar pct={i.pct} cor={i.cor} className="mt-4 !h-1" />
        </Panel>
      ))}
    </div>
  );
}
