import type { Assento, Candidato, Corrida, Eleito } from "./types";

/**
 * Distribuição de cadeiras no sistema proporcional brasileiro (Código Eleitoral, arts. 106–109,
 * com a redação da Lei 14.211/2021 e o entendimento do STF na ADI 7228):
 *  1. Quociente eleitoral (QE) = válidos / vagas (arredonda: fração > 0,5 sobe).
 *  2. Quociente partidário: cada agremiação (partido ou federação) leva floor(votos/QE) cadeiras,
 *     ocupadas por candidatos com pelo menos 10% do QE.
 *  3. Sobras pela maior média: só agremiações com ≥ 80% do QE e candidatos com ≥ 20% do QE.
 *  4. Se ainda sobrar, todas as agremiações disputam pela maior média.
 * É uma PROJEÇÃO a partir dos votos apurados até o momento; a oficial é a do TSE.
 */
export function projetarCadeiras(corrida: Corrida): { eleitos: Candidato[]; oficial: boolean } {
  const temOficial = corrida.candidatos.some((c) => c.eleito);
  if (corrida.final || temOficial) {
    return { eleitos: corrida.candidatos.filter((c) => c.eleito), oficial: true };
  }

  const V = corrida.vagas;
  const validos = corrida.votos.validos;
  if (!V || !validos) return { eleitos: [], oficial: false };

  const QE = Math.max(1, Math.round(validos / V));
  const ags = corrida.agremiacoes
    .map((a) => ({
      id: a.id,
      votos: a.votos,
      cands: corrida.candidatos
        .filter((c) => c.agremiacao === a.id && c.valido)
        .sort((x, y) => y.votos - x.votos),
      cadeiras: 0,
    }))
    .filter((a) => a.votos > 0);

  const eleitos: Candidato[] = [];
  const proximo = (a: (typeof ags)[number], minimo: number) => {
    const c = a.cands[a.cadeiras];
    return c && c.votos >= minimo ? c : undefined;
  };
  const ocupar = (a: (typeof ags)[number]) => {
    eleitos.push(a.cands[a.cadeiras]);
    a.cadeiras++;
  };

  // fase 1: quociente partidário
  for (const a of ags) {
    const qp = Math.floor(a.votos / QE);
    for (let i = 0; i < qp; i++) {
      if (!proximo(a, 0.1 * QE)) break;
      ocupar(a);
    }
  }

  let restantes = V - eleitos.length;
  // fase 2: sobras com cláusulas 80/20
  while (restantes > 0) {
    let melhor: (typeof ags)[number] | undefined;
    let melhorMedia = -1;
    for (const a of ags) {
      if (a.votos < 0.8 * QE || !proximo(a, 0.2 * QE)) continue;
      const media = a.votos / (a.cadeiras + 1);
      if (media > melhorMedia) {
        melhorMedia = media;
        melhor = a;
      }
    }
    if (!melhor) break;
    ocupar(melhor);
    restantes--;
  }
  // fase 3: todas as agremiações
  while (restantes > 0) {
    let melhor: (typeof ags)[number] | undefined;
    let melhorMedia = -1;
    for (const a of ags) {
      if (!proximo(a, 0)) continue;
      const media = a.votos / (a.cadeiras + 1);
      if (media > melhorMedia) {
        melhorMedia = media;
        melhor = a;
      }
    }
    if (!melhor) break;
    ocupar(melhor);
    restantes--;
  }

  return { eleitos, oficial: false };
}

export function contarPorPartido(eleitos: Pick<Candidato, "partido" | "votos">[]): Assento[] {
  const m = new Map<string, Assento>();
  for (const e of eleitos) {
    const a = m.get(e.partido) ?? { partido: e.partido, cadeiras: 0, votos: 0 };
    a.cadeiras++;
    a.votos += e.votos;
    m.set(e.partido, a);
  }
  return [...m.values()].sort((a, b) => b.cadeiras - a.cadeiras || b.votos - a.votos);
}

export function somarAssentos(listas: Assento[][]): Assento[] {
  const m = new Map<string, Assento>();
  for (const l of listas)
    for (const a of l) {
      const x = m.get(a.partido) ?? { partido: a.partido, cadeiras: 0, votos: 0 };
      x.cadeiras += a.cadeiras;
      x.votos += a.votos;
      m.set(a.partido, x);
    }
  return [...m.values()].sort((a, b) => b.cadeiras - a.cadeiras || b.votos - a.votos);
}

export const paraEleito = (c: Candidato, uf?: string): Eleito => ({
  id: c.id,
  nome: c.nome,
  partido: c.partido,
  votos: c.votos,
  pct: c.pct,
  numero: c.numero,
  foto: c.foto,
  uf,
});

/** Senado: os N mais votados (ou os marcados como eleitos pelo TSE) */
export function eleitosMajoritario(corrida: Corrida): { eleitos: Candidato[]; oficial: boolean } {
  const oficiais = corrida.candidatos.filter((c) => c.eleito);
  if (corrida.final || oficiais.length) return { eleitos: oficiais, oficial: true };
  return {
    eleitos: corrida.candidatos.filter((c) => c.valido && c.votos > 0).slice(0, corrida.vagas),
    oficial: false,
  };
}
