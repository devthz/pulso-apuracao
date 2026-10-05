"use client";
import clsx from "clsx";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { fmtInt, fmtPct } from "@/lib/format";
import { corPartido } from "@/lib/parties";
import { comParams } from "@/lib/qs";
import type { BaseSegundoTurno } from "@/lib/tse/source";
import type { ResumoUF } from "@/lib/tse/types";
import { BrazilMap } from "./BrazilMap";
import { Avatar, Num, Panel, SectionTitle } from "./ui";


const jf = async (u: string) => {
  const r = await fetch(comParams(u));
  if (!r.ok) throw new Error("aguardando");
  return r.json();
};

/** para cada grupo de eleitores do 1º turno: quanto vai votar (part) e como se divide (lado = % para o finalista B) */
interface Transf {
  part: number;
  lado: number;
}
type Preset = "proporcional" | "igual" | "ninguem";

const OUTROS = "outros";
const BN = "bn";

export function SegundoTurnoSection() {
  const { data: base } = useSWR<BaseSegundoTurno>("/api/segundo-turno", jf, { refreshInterval: 30_000, keepPreviousData: true });
  if (!base || base.candidatos.length < 2) return null;
  return <Simulador base={base} />;
}

function Simulador({ base }: { base: BaseSegundoTurno }) {
  const [fin, setFin] = useState<[string, string]>([base.candidatos[0].numero, base.candidatos[1].numero]);
  const A = base.candidatos.find((c) => c.numero === fin[0]) ?? base.candidatos[0];
  const B = base.candidatos.find((c) => c.numero === fin[1]) ?? base.candidatos[1];
  const eliminados = base.candidatos.filter((c) => c.numero !== A.numero && c.numero !== B.numero);

  const ladoProporcional = (B.votos / Math.max(1, A.votos + B.votos)) * 100;
  const presetValor = (p: Preset, grupo: string): Transf => {
    if (grupo === BN) return { part: p === "ninguem" ? 0 : 10, lado: 50 };
    if (p === "ninguem") return { part: 0, lado: 50 };
    if (p === "igual") return { part: 75, lado: 50 };
    return { part: 75, lado: Math.round(ladoProporcional) };
  };
  const [preset, setPreset] = useState<Preset>("proporcional");
  const [ajustes, setAjustes] = useState<Record<string, Transf>>({});
  const [comparecimento, setComparecimento] = useState(0); // pontos percentuais do eleitorado

  const t = (g: string): Transf => ajustes[g] ?? presetValor(preset, g);
  const ajustar = (g: string, k: keyof Transf, v: number) => setAjustes((a) => ({ ...a, [g]: { ...t(g), [k]: v } }));
  const aplicarPreset = (p: Preset) => {
    setPreset(p);
    setAjustes({});
  };

  // cálculo por UF
  const r = useMemo(() => {
    const grupos = [...eliminados.map((c) => c.numero), OUTROS, BN];
    const tr = Object.fromEntries(grupos.map((g) => [g, ajustes[g] ?? presetValor(preset, g)]));
    const porUF = base.ufs.map((u) => {
      let a = u.votos[A.numero] ?? 0;
      let b = u.votos[B.numero] ?? 0;
      const somar = (v: number, g: string) => {
        const x = tr[g];
        const vai = (v * x.part) / 100;
        b += (vai * x.lado) / 100;
        a += (vai * (100 - x.lado)) / 100;
      };
      for (const c of eliminados) somar(u.votos[c.numero] ?? 0, c.numero);
      somar(u.outros, OUTROS);
      somar(u.brancosNulos, BN);
      // variação de comparecimento: eleitores a mais/a menos, divididos como o resultado da UF
      const extra = (u.eleitorado * comparecimento) / 100;
      const s = a + b || 1;
      a = Math.max(0, a + (extra * a) / s);
      b = Math.max(0, b + (extra * b) / s);
      return { uf: u.uf, a, b };
    });
    const totA = porUF.reduce((x, u) => x + u.a, 0);
    const totB = porUF.reduce((x, u) => x + u.b, 0);
    const tot = totA + totB || 1;
    return { totA, totB, pA: (totA / tot) * 100, pB: (totB / tot) * 100, porUF };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, A.numero, B.numero, ajustes, preset, comparecimento]);

  const venceA = r.pA >= r.pB;
  const vencedor = venceA ? A : B;
  const dif = Math.abs(r.pA - r.pB);

  const mapa: ResumoUF[] = r.porUF
    .filter((u) => u.uf !== "zz")
    .map((u) => {
      const s = u.a + u.b || 1;
      const la = { id: A.numero, numero: A.numero, nome: A.nome, partido: A.partido, votos: Math.round(u.a), pct: (u.a / s) * 100, eleito: false, segundoTurno: false, situacao: "", foto: A.foto };
      const lb = { id: B.numero, numero: B.numero, nome: B.nome, partido: B.partido, votos: Math.round(u.b), pct: (u.b / s) * 100, eleito: false, segundoTurno: false, situacao: "", foto: B.foto };
      return { uf: u.uf, pct: 100, final: false, status: "apurando", vagas: 1, validos: Math.round(s), atualizadoEm: null, lideres: u.a >= u.b ? [la, lb] : [lb, la] };
    });
  const ufsA = mapa.filter((u) => u.lideres[0].numero === A.numero).length;

  return (
    <section className="mt-28">
      <SectionTitle
        id="segundo-turno"
        kicker="Cenário hipotético · arraste os controles"
        title={
          <>
            Simulador de 2º turno<span className="text-cyan">.</span>
          </>
        }
        right={
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["proporcional", "Proporcional ao 1º turno"],
                ["igual", "Divisão igual"],
                ["ninguem", "Ninguém transfere"],
              ] as const
            ).map(([k, rot]) => (
              <button
                key={k}
                onClick={() => aplicarPreset(k)}
                className={clsx(
                  "chip !h-8 !px-4 transition",
                  preset === k && !Object.keys(ajustes).length ? "!border-transparent !bg-white !text-black" : "text-muted hover:text-text",
                )}
              >
                {rot}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-12">
        {/* resultado */}
        <Panel className="overflow-hidden p-6 sm:p-10 xl:col-span-7">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { c: A, p: r.pA, v: r.totA, idx: 0 as const },
              { c: B, p: r.pB, v: r.totB, idx: 1 as const },
            ].map(({ c, p, v, idx }) => {
              const cor = corPartido(c.partido);
              const ganha = (idx === 0) === venceA;
              return (
                <div
                  key={idx}
                  className={clsx("relative overflow-hidden rounded-[22px] border p-6", ganha ? "border-white/20" : "border-white/[0.07]")}
                  style={{ background: `radial-gradient(120% 90% at ${idx ? "100%" : "0%"} 0%, ${cor}2a, transparent 60%), rgba(255,255,255,.02)` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <Avatar nome={c.nome} foto={c.foto} partido={c.partido} size={64} />
                    <select
                      value={fin[idx]}
                      onChange={(e) => {
                        const n = e.target.value;
                        setFin((f) => (idx === 0 ? [n, f[1] === n ? f[0] : f[1]] : [f[0] === n ? f[1] : f[0], n]));
                        setAjustes({});
                      }}
                      className="max-w-[150px] rounded-lg border border-white/10 bg-[#0b0d14] px-2 py-1 font-mono text-[11px] text-muted outline-none"
                      aria-label="Trocar finalista"
                    >
                      {base.candidatos.slice(0, 5).map((x) => (
                        <option key={x.numero} value={x.numero}>
                          {x.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-4 font-display text-[22px] font-semibold leading-tight">{c.nome}</div>
                  <div className="mt-1 font-mono text-[11px] text-dim">
                    {c.partido} · 1º turno {fmtPct(c.pct, 1)}%
                  </div>
                  <div
                    className="mt-5 font-display text-[60px] font-bold leading-[0.85] tracking-[-0.04em] sm:text-[76px]"
                    style={{ backgroundImage: `linear-gradient(180deg, #fff 30%, ${cor})`, WebkitBackgroundClip: "text", color: "transparent" }}
                  >
                    <Num value={p} kind="pct" />
                    <span className="text-[0.4em] tracking-normal">%</span>
                  </div>
                  <div className="mt-3 font-mono text-[12px] text-muted">
                    <Num value={v} /> votos
                  </div>
                  {ganha && <span className="chip absolute right-4 top-[72px] border-lime/40 bg-lime/10 text-lime">VENCERIA</span>}
                </div>
              );
            })}
          </div>

          <div className="mt-8">
            <div className="relative flex h-4 w-full gap-[3px] overflow-hidden rounded-full">
              <motion.div className="h-full rounded-l-full" style={{ background: corPartido(A.partido) }} animate={{ flexGrow: r.pA }} transition={{ duration: 0.6 }} />
              <motion.div className="h-full rounded-r-full" style={{ background: corPartido(B.partido) }} animate={{ flexGrow: r.pB }} transition={{ duration: 0.6 }} />
              <div className="absolute inset-y-[-4px] left-1/2 w-[2px] bg-white shadow-[0_0_10px_#fff]" />
            </div>
            <p className="mt-5 text-[15px] leading-relaxed text-muted">
              Nesse cenário, <span className="font-semibold text-text">{vencedor.nome}</span> venceria por{" "}
              <span className="font-semibold text-text">{fmtPct(dif, 1)} pontos</span> ({fmtInt(Math.abs(r.totA - r.totB))} votos), ganhando em{" "}
              <span className="font-semibold text-text">{venceA ? ufsA : mapa.length - ufsA}</span> de {mapa.length} estados.
            </p>
          </div>

          <div className="mt-8">
            <BrazilMap ufs={mapa} navegar={false} rotulo={(u) => `${fmtPct(u.lideres[0]?.pct ?? 0, 0)}%`} className="mx-auto w-full max-w-[520px]" />
            <div className="mt-2 text-center font-mono text-[10px] text-dim">quem venceria em cada estado neste cenário</div>
          </div>
        </Panel>

        {/* controles */}
        <Panel className="p-6 sm:p-8 xl:col-span-5">
          <div className="kicker mb-2">Para onde vão os votos do 1º turno</div>
          <p className="mb-6 text-[12.5px] leading-relaxed text-dim">
            Para cada grupo, escolha quantos eleitores voltam a votar em alguém e como se dividem entre{" "}
            <span style={{ color: corPartido(A.partido) }}>{A.nome.split(" ")[0]}</span> e{" "}
            <span style={{ color: corPartido(B.partido) }}>{B.nome.split(" ")[0]}</span>. O resto anula, vota em branco ou se abstém.
          </p>
          <div className="space-y-6">
            {eliminados.map((c) => (
              <Controle key={c.numero} rotulo={c.nome} sub={`${c.partido} · ${fmtPct(c.pct, 1)}%`} cor={corPartido(c.partido)} t={t(c.numero)} A={A} B={B} on={(k, v) => ajustar(c.numero, k, v)} foto={c.foto} partido={c.partido} />
            ))}
            <Controle rotulo="Demais candidatos" sub="soma dos menores" cor="#7a8199" t={t(OUTROS)} A={A} B={B} on={(k, v) => ajustar(OUTROS, k, v)} />
            <Controle rotulo="Brancos e nulos do 1º turno" sub="quantos passam a escolher alguém" cor="#e6e8f0" t={t(BN)} A={A} B={B} on={(k, v) => ajustar(BN, k, v)} />
          </div>
          <div className="mt-8 border-t border-white/[0.06] pt-6">
            <div className="flex items-center justify-between text-[13px]">
              <span>Variação no comparecimento</span>
              <span className="font-mono text-muted">
                {comparecimento > 0 ? "+" : ""}
                {comparecimento} p.p.
              </span>
            </div>
            <input type="range" min={-6} max={6} step={0.5} value={comparecimento} onChange={(e) => setComparecimento(+e.target.value)} className="faixa mt-3 w-full" />
          </div>
          <p className="mt-6 text-[11px] leading-relaxed text-dim">
            Simulação hipotética feita a partir dos votos do 1º turno {base.pctApurado < 99.9 ? `(${fmtPct(base.pctApurado, 1)}% apurado, projetado para 100% das seções)` : ""}. Não é pesquisa nem previsão.
          </p>
        </Panel>
      </div>
    </section>
  );
}

function Controle({
  rotulo,
  sub,
  cor,
  t,
  A,
  B,
  on,
  foto,
  partido,
}: {
  rotulo: string;
  sub: string;
  cor: string;
  t: Transf;
  A: { nome: string; partido: string };
  B: { nome: string; partido: string };
  on: (k: keyof Transf, v: number) => void;
  foto?: string;
  partido?: string;
}) {
  const cA = corPartido(A.partido);
  const cB = corPartido(B.partido);
  const vaiA = (t.part * (100 - t.lado)) / 100;
  const vaiB = (t.part * t.lado) / 100;
  return (
    <div>
      <div className="flex items-center gap-3">
        {partido ? <Avatar nome={rotulo} foto={foto} partido={partido} size={30} /> : <span className="h-3 w-3 rounded-full" style={{ background: cor }} />}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px]">{rotulo}</div>
          <div className="font-mono text-[10px] text-dim">{sub}</div>
        </div>
      </div>
      {/* barra resultado: A | nulo/abstenção | B */}
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div style={{ width: `${vaiA}%`, background: cA }} />
        <div className="flex-1" />
        <div style={{ width: `${vaiB}%`, background: cB }} />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px]">
        <span style={{ color: cA }}>{Math.round(vaiA)}% {A.nome.split(" ")[0]}</span>
        <span className="text-dim">{Math.round(100 - t.part)}% nulo/abst.</span>
        <span style={{ color: cB }}>
          {B.nome.split(" ")[0]} {Math.round(vaiB)}%
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-4">
        <label className="block">
          <span className="font-mono text-[9.5px] uppercase tracking-wider text-dim">votam em alguém</span>
          <input type="range" min={0} max={100} value={t.part} onChange={(e) => on("part", +e.target.value)} className="faixa w-full" />
        </label>
        <label className="block">
          <span className="font-mono text-[9.5px] uppercase tracking-wider text-dim">divisão</span>
          <input
            type="range"
            min={0}
            max={100}
            value={t.lado}
            onChange={(e) => on("lado", +e.target.value)}
            className="faixa w-full"
            style={{ background: `linear-gradient(90deg, ${cA}, ${cB})` }}
          />
        </label>
      </div>
    </div>
  );
}
