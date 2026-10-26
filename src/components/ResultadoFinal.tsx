"use client";
import clsx from "clsx";
import { motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { fmtInt, fmtPct } from "@/lib/format";
import { corPartido } from "@/lib/parties";
import { comParams } from "@/lib/qs";
import type { Comparativo, ComparativoUF, FaseInfo, Finalista } from "@/lib/tse/source";
import type { ResumoUF } from "@/lib/tse/types";
import { UF_MAP } from "@/lib/ufs";
import { BrazilMap } from "./BrazilMap";
import { AbasPrimeiroTurno } from "./EntreTurnos";
import { LinhaDoTempoModelo } from "./LinhaDoTempo";
import { MunicipalMap } from "./MunicipalMap";
import { GovernadoresSection } from "./Sections";
import { Avatar, Num, Panel, SectionTitle, Skeleton } from "./ui";

const jf = async (u: string) => {
  const r = await fetch(comParams(u));
  if (!r.ok) throw new Error("aguardando");
  return r.json();
};

const pct = (v: number, tot: number) => (tot ? (v / tot) * 100 : 0);
/** participação de A entre os dois finalistas (0–100) */
const parA = (u: ComparativoUF["t1"] | ComparativoUF["t2"], a: string, b: string) => pct(u.votos[a] ?? 0, (u.votos[a] ?? 0) + (u.votos[b] ?? 0));

export function ResultadoFinal({ info }: { info: FaseInfo }) {
  const { data: c } = useSWR<Comparativo>("/api/comparativo", jf, { refreshInterval: 60_000, keepPreviousData: true });
  return (
    <>
      <HeroFinal c={c} info={info} />
      <ComparativoMapas c={c} />
      <TabelaEstados c={c} />
      <LinhaDoTempoModelo />
      {info.gov2t.length > 0 && <GovernadoresSection turno={2} somente={info.gov2t.map((g) => g.uf)} />}
      <div className="mt-16">
        <AbasPrimeiroTurno />
      </div>
    </>
  );
}

/* ---------------- herói: vencedor e 1º → 2º turno ---------------- */
function HeroFinal({ c, info }: { c?: Comparativo; info: FaseInfo }) {
  if (!c) return <Skeleton className="h-[520px]" />;
  const n = c.nacional;
  const fins = [...c.finalistas].sort((x, y) => (n.t2.votos[y.numero] ?? 0) - (n.t2.votos[x.numero] ?? 0));
  const [v, p] = fins;
  const vencedor = info.vencedor ?? v;
  const dif = (n.t2.votos[v.numero] ?? 0) - (n.t2.votos[p.numero] ?? 0);
  return (
    <section>
      <Panel className="overflow-hidden p-6 sm:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 -z-10 h-[560px] w-[560px] rounded-full opacity-[0.16] blur-[90px]"
          style={{ background: `conic-gradient(from 90deg, ${corPartido(vencedor.partido)}, var(--violet), ${corPartido(vencedor.partido)})` }}
        />
        <div className="kicker mb-4 flex items-center gap-3">
          <span className="h-px w-8 bg-gradient-to-r from-lime to-transparent" />
          Resultado final · 2º turno · 25 de outubro de 2026
        </div>
        <div className="flex flex-wrap items-end gap-6">
          <Avatar nome={vencedor.nome} foto={vencedor.foto ?? v.foto} partido={vencedor.partido} size={120} />
          <div>
            <h1 className="font-display text-[48px] font-bold leading-[0.95] tracking-[-0.03em] sm:text-[88px]">{vencedor.nome}</h1>
            <div className="mt-3 flex items-center gap-3">
              <span className="chip border-lime/50 bg-lime/10 text-lime">✓ ELEITO PRESIDENTE</span>
              <span className="font-mono text-[12px] text-muted">
                por {fmtInt(dif)} votos · {fmtPct(pct(dif, n.t2.validos), 2)} p.p.
              </span>
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 md:gap-8">
          {fins.map((f, i) => (
            <CartaoComparativo key={f.numero} f={f} n={n} vence={i === 0} lado={i as 0 | 1} />
          ))}
        </div>
        <div className="mt-8">
          <div className="relative flex h-4 w-full gap-[3px] overflow-hidden rounded-full">
            {fins.map((f) => (
              <motion.div
                key={f.numero}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ background: corPartido(f.partido) }}
                initial={{ flexGrow: 0 }}
                animate={{ flexGrow: n.t2.votos[f.numero] ?? 0 }}
                transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
              />
            ))}
            <div className="absolute inset-y-[-4px] left-1/2 w-[2px] bg-white shadow-[0_0_10px_#fff]" />
          </div>
        </div>
      </Panel>
    </section>
  );
}

function CartaoComparativo({ f, n, vence, lado }: { f: Finalista; n: ComparativoUF; vence: boolean; lado: 0 | 1 }) {
  const cor = corPartido(f.partido);
  const p1 = pct(n.t1.votos[f.numero] ?? 0, n.t1.validos);
  const p2 = pct(n.t2.votos[f.numero] ?? 0, n.t2.validos);
  const ganho = (n.t2.votos[f.numero] ?? 0) - (n.t1.votos[f.numero] ?? 0);
  return (
    <div
      className={clsx("relative overflow-hidden rounded-[22px] border p-6", vence ? "border-white/20" : "border-white/[0.07]")}
      style={{ background: `radial-gradient(120% 90% at ${lado ? "100%" : "0%"} 0%, ${cor}2e, transparent 60%), rgba(255,255,255,.02)` }}
    >
      <div className="flex items-center gap-3">
        <Avatar nome={f.nome} foto={f.foto} partido={f.partido} size={48} />
        <div>
          <div className="font-display text-[20px] font-semibold">{f.nome}</div>
          <div className="font-mono text-[11px] text-dim">{f.partido}</div>
        </div>
      </div>
      <div
        className="mt-5 font-display text-[64px] font-bold leading-[0.85] tracking-[-0.04em] sm:text-[80px]"
        style={{ backgroundImage: `linear-gradient(180deg, #fff 30%, ${cor})`, WebkitBackgroundClip: "text", color: "transparent" }}
      >
        <Num value={p2} kind="pct" />
        <span className="text-[0.4em] tracking-normal">%</span>
      </div>
      <div className="mt-2 font-mono text-[12px] text-muted">{fmtInt(n.t2.votos[f.numero] ?? 0)} votos no 2º turno</div>
      <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3 border-t border-white/[0.07] pt-4 font-mono text-[11px]">
        <div>
          <div className="text-dim">1º TURNO</div>
          <div className="mt-1 whitespace-nowrap text-[13px] sm:text-[15px] text-text">{fmtPct(p1, 2)}%</div>
        </div>
        <div>
          <div className="text-dim">VARIAÇÃO</div>
          <div className="mt-1 whitespace-nowrap text-[13px] sm:text-[15px] text-lime">{p2 >= p1 ? "+" : ""}{fmtPct(p2 - p1, 2)} p.p.</div>
        </div>
        <div>
          <div className="text-dim">GANHO</div>
          <div className="mt-1 whitespace-nowrap text-[13px] sm:text-[15px] text-text">{ganho >= 0 ? "+" : ""}{fmtInt(ganho)}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- mapas 1º x 2º turno ---------------- */
function ComparativoMapas({ c }: { c?: Comparativo }) {
  const [modo, setModo] = useState<"uf" | "mun">("uf");
  const dados = useMemo(() => {
    if (!c) return null;
    const [A, B] = c.finalistas;
    const cand = (f: Finalista, votos: number, tot: number) => ({
      id: f.numero, numero: f.numero, nome: f.nome, partido: f.partido, votos, pct: pct(votos, tot), eleito: false, segundoTurno: false, situacao: "", foto: f.foto,
    });
    const base = (u: ComparativoUF): Omit<ResumoUF, "lideres" | "validos"> => ({ uf: u.uf, pct: 100, final: true, status: "final", vagas: 1, atualizadoEm: null });
    const t1: ResumoUF[] = c.ufs.map((u) => {
      const l = u.t1.lider;
      const outros = [A, B].filter((f) => f.numero !== l?.numero).map((f) => cand(f, u.t1.votos[f.numero] ?? 0, u.t1.validos));
      const lideres = l ? [{ id: l.numero, numero: l.numero, nome: l.nome, partido: l.partido, votos: l.votos, pct: l.pct, eleito: false, segundoTurno: false, situacao: "", foto: l.foto }, ...outros] : outros;
      return { ...base(u), validos: u.t1.validos, lideres };
    });
    const t2: ResumoUF[] = c.ufs.map((u) => {
      const ls = [A, B].map((f) => cand(f, u.t2.votos[f.numero] ?? 0, u.t2.validos)).sort((x, y) => y.votos - x.votos);
      return { ...base(u), validos: u.t2.validos, lideres: ls };
    });
    // variação: quanto a participação de cada um entre os dois finalistas mudou do 1º para o 2º turno
    const sw: ResumoUF[] = c.ufs.map((u) => {
      const d = parA(u.t2, A.numero, B.numero) - parA(u.t1, A.numero, B.numero);
      const quem = d >= 0 ? A : B;
      const outro = d >= 0 ? B : A;
      return {
        ...base(u),
        validos: u.t2.validos,
        lideres: [cand(quem, u.t2.votos[quem.numero] ?? 0, u.t2.validos), cand(outro, u.t2.votos[outro.numero] ?? 0, u.t2.validos)].map((x, i) => ({ ...x, pct: i === 0 ? Math.abs(d) : 0 })),
      };
    });
    return { t1, t2, sw, A, B };
  }, [c]);

  return (
    <section className="mt-24">
      <SectionTitle
        id="comparativo"
        kicker="Como o país mudou entre os turnos"
        title={
          <>
            1º turno × 2º turno<span className="text-cyan">.</span>
          </>
        }
        right={
          <div className="flex rounded-full border border-white/10 bg-white/[0.03] p-1">
            {(["uf", "mun"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setModo(m)}
                className={clsx("rounded-full px-3.5 py-1 text-[12px] transition", modo === m ? "bg-white text-black" : "text-muted hover:text-text")}
              >
                {m === "uf" ? "Estados" : "Municípios"}
              </button>
            ))}
          </div>
        }
      />
      {!dados ? (
        <Skeleton className="h-[460px]" />
      ) : modo === "uf" ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <MapaCard titulo="1º turno" sub="quem liderou em cada estado">
            <BrazilMap ufs={dados.t1} navegar={false} rotulo={(u) => `${fmtPct(u.lideres[0]?.pct ?? 0, 0)}%`} />
          </MapaCard>
          <MapaCard titulo="2º turno" sub="quem venceu em cada estado">
            <BrazilMap ufs={dados.t2} navegar={false} rotulo={(u) => `${fmtPct(u.lideres[0]?.pct ?? 0, 0)}%`} />
          </MapaCard>
          <MapaCard titulo="Variação" sub="para quem o estado se moveu entre os turnos (p.p.)">
            <BrazilMap
              ufs={dados.sw}
              navegar={false}
              rotulo={(u) => `+${fmtPct(u.lideres[0]?.pct ?? 0, 1)}`}
              intensidade={(u) => 0.25 + Math.min(0.75, (u.lideres[0]?.pct ?? 0) / 12)}
            />
            <div className="mt-3 flex items-center justify-center gap-2 font-mono text-[10px] text-dim">
              <span style={{ color: corPartido(dados.B.partido) }}>{dados.B.nome.split(" ")[0]}</span>
              <span className="h-2 w-28 rounded-full" style={{ background: `linear-gradient(90deg, ${corPartido(dados.B.partido)}, #3a3f50, ${corPartido(dados.A.partido)})` }} />
              <span style={{ color: corPartido(dados.A.partido) }}>{dados.A.nome.split(" ")[0]}</span>
            </div>
          </MapaCard>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <MapaCard titulo="1º turno" sub="quem liderou em cada cidade">
            <MunicipalMap turno={1} />
          </MapaCard>
          <MapaCard titulo="2º turno" sub="quem venceu em cada cidade">
            <MunicipalMap turno={2} />
          </MapaCard>
        </div>
      )}
    </section>
  );
}

function MapaCard({ titulo, sub, children }: { titulo: string; sub: string; children: React.ReactNode }) {
  return (
    <Panel className="p-5 sm:p-6">
      <div className="mb-3">
        <div className="font-display text-xl font-semibold">{titulo}</div>
        <div className="font-mono text-[10.5px] text-dim">{sub}</div>
      </div>
      {children}
    </Panel>
  );
}

/* ---------------- estado a estado ---------------- */
type Ordem = "nome" | "variacao" | "margem";

function TabelaEstados({ c }: { c?: Comparativo }) {
  const [ordem, setOrdem] = useState<Ordem>("nome");
  if (!c) return null;
  const [A, B] = c.finalistas;
  const cA = corPartido(A.partido);
  const cB = corPartido(B.partido);
  const linhas = c.ufs.map((u) => {
    const a1 = pct(u.t1.votos[A.numero] ?? 0, u.t1.validos);
    const b1 = pct(u.t1.votos[B.numero] ?? 0, u.t1.validos);
    const a2 = pct(u.t2.votos[A.numero] ?? 0, u.t2.validos);
    const b2 = pct(u.t2.votos[B.numero] ?? 0, u.t2.validos);
    const sw = parA(u.t2, A.numero, B.numero) - parA(u.t1, A.numero, B.numero);
    const lider1 = a1 >= b1 ? A : B;
    const venc2 = a2 >= b2 ? A : B;
    return { u, a1, b1, a2, b2, sw, lider1, venc2, virou: lider1.numero !== venc2.numero };
  });
  linhas.sort((x, y) =>
    ordem === "nome"
      ? (UF_MAP[x.u.uf]?.nome ?? "").localeCompare(UF_MAP[y.u.uf]?.nome ?? "", "pt-BR")
      : ordem === "variacao"
        ? y.sw - x.sw
        : Math.abs(x.a2 - x.b2) - Math.abs(y.a2 - y.b2),
  );
  const maxSw = Math.max(4, ...linhas.map((l) => Math.abs(l.sw)));
  const viradas = linhas.filter((l) => l.virou).length;

  return (
    <section className="mt-24">
      <SectionTitle
        id="estados"
        kicker={`${viradas} ${viradas === 1 ? "estado mudou" : "estados mudaram"} de lado entre os turnos`}
        title={
          <>
            Estado a estado<span className="text-lime">.</span>
          </>
        }
        right={
          <div className="flex gap-2">
            {(
              [
                ["nome", "A–Z"],
                ["variacao", "Maior variação"],
                ["margem", "Mais apertados"],
              ] as const
            ).map(([k, r]) => (
              <button
                key={k}
                onClick={() => setOrdem(k)}
                className={clsx("chip !h-8 !px-4 transition", ordem === k ? "!border-transparent !bg-white !text-black" : "text-muted hover:text-text")}
              >
                {r}
              </button>
            ))}
          </div>
        }
      />
      <Panel className="overflow-x-auto p-2 sm:p-4">
        <table className="w-full min-w-[820px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="font-mono text-[10px] uppercase tracking-wider text-dim">
              <th className="px-3 py-3 text-left font-normal">Estado</th>
              <th className="px-3 py-3 text-right font-normal">1º turno</th>
              <th className="px-3 py-3 text-right font-normal">2º turno</th>
              <th className="px-3 py-3 text-center font-normal">Variação entre os dois</th>
              <th className="px-3 py-3 text-left font-normal">Vencedor</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.u.uf} className="group">
                <td className="border-t border-white/[0.05] px-3 py-3">
                  <Link href={comParams(`/uf/${l.u.uf}`)} className="flex items-center gap-3 hover:text-white">
                    <span className="font-display w-7 text-[12px] font-bold text-muted">{l.u.uf.toUpperCase()}</span>
                    <span>{UF_MAP[l.u.uf]?.nome}</span>
                  </Link>
                </td>
                <td className="border-t border-white/[0.05] px-3 py-3 text-right font-mono tabular-nums">
                  <span style={{ color: cA }}>{fmtPct(l.a1, 1)}</span>
                  <span className="text-dim"> · </span>
                  <span style={{ color: cB }}>{fmtPct(l.b1, 1)}</span>
                </td>
                <td className="border-t border-white/[0.05] px-3 py-3 text-right font-mono tabular-nums">
                  <span style={{ color: cA }}>{fmtPct(l.a2, 1)}</span>
                  <span className="text-dim"> · </span>
                  <span style={{ color: cB }}>{fmtPct(l.b2, 1)}</span>
                </td>
                <td className="border-t border-white/[0.05] px-3 py-3">
                  {/* barra divergente: para a direita = A ganhou espaço; esquerda = B */}
                  <div className="relative mx-auto h-2.5 w-48 rounded-full bg-white/[0.05]">
                    <div className="absolute inset-y-[-3px] left-1/2 w-px bg-white/30" />
                    <div
                      className="absolute inset-y-0 rounded-full"
                      style={{
                        background: l.sw >= 0 ? cA : cB,
                        left: l.sw >= 0 ? "50%" : `${50 - (Math.abs(l.sw) / maxSw) * 50}%`,
                        width: `${(Math.abs(l.sw) / maxSw) * 50}%`,
                      }}
                    />
                  </div>
                  <div className="mt-1 text-center font-mono text-[10px] text-dim">
                    {l.sw >= 0 ? A.nome.split(" ")[0] : B.nome.split(" ")[0]} +{fmtPct(Math.abs(l.sw), 1)} p.p.
                  </div>
                </td>
                <td className="border-t border-white/[0.05] px-3 py-3">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: corPartido(l.venc2.partido) }} />
                    {l.venc2.nome}
                    {l.virou && <span className="chip !h-5 border-cyan/40 text-cyan">VIROU</span>}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-3 pb-2 pt-4 font-mono text-[10.5px] text-dim">
          Percentuais sobre votos válidos de cada turno. “Variação” = mudança na fatia de cada finalista dentro dos votos dados aos dois, do 1º para o 2º
          turno. “Virou” = o estado mudou de lado entre os dois finalistas.
        </div>
      </Panel>
    </section>
  );
}
