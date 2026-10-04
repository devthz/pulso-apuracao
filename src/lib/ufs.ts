export type Regiao = "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";

export interface UFInfo {
  sigla: string; // minúscula, como o TSE usa
  nome: string;
  regiao: Regiao;
  /** vagas na Câmara (usado só na simulação; no modo ao vivo vem do TSE: campo `nv`) */
  depfed: number;
  /** vagas na Assembleia/Câmara Legislativa (só simulação) */
  depest: number;
}

export const UFS: UFInfo[] = [
  { sigla: "ac", nome: "Acre", regiao: "Norte", depfed: 8, depest: 24 },
  { sigla: "al", nome: "Alagoas", regiao: "Nordeste", depfed: 9, depest: 27 },
  { sigla: "am", nome: "Amazonas", regiao: "Norte", depfed: 8, depest: 24 },
  { sigla: "ap", nome: "Amapá", regiao: "Norte", depfed: 8, depest: 24 },
  { sigla: "ba", nome: "Bahia", regiao: "Nordeste", depfed: 39, depest: 63 },
  { sigla: "ce", nome: "Ceará", regiao: "Nordeste", depfed: 22, depest: 46 },
  { sigla: "df", nome: "Distrito Federal", regiao: "Centro-Oeste", depfed: 8, depest: 24 },
  { sigla: "es", nome: "Espírito Santo", regiao: "Sudeste", depfed: 10, depest: 30 },
  { sigla: "go", nome: "Goiás", regiao: "Centro-Oeste", depfed: 17, depest: 41 },
  { sigla: "ma", nome: "Maranhão", regiao: "Nordeste", depfed: 18, depest: 42 },
  { sigla: "mg", nome: "Minas Gerais", regiao: "Sudeste", depfed: 53, depest: 77 },
  { sigla: "ms", nome: "Mato Grosso do Sul", regiao: "Centro-Oeste", depfed: 8, depest: 24 },
  { sigla: "mt", nome: "Mato Grosso", regiao: "Centro-Oeste", depfed: 8, depest: 24 },
  { sigla: "pa", nome: "Pará", regiao: "Norte", depfed: 17, depest: 41 },
  { sigla: "pb", nome: "Paraíba", regiao: "Nordeste", depfed: 12, depest: 36 },
  { sigla: "pe", nome: "Pernambuco", regiao: "Nordeste", depfed: 25, depest: 49 },
  { sigla: "pi", nome: "Piauí", regiao: "Nordeste", depfed: 10, depest: 30 },
  { sigla: "pr", nome: "Paraná", regiao: "Sul", depfed: 30, depest: 54 },
  { sigla: "rj", nome: "Rio de Janeiro", regiao: "Sudeste", depfed: 46, depest: 70 },
  { sigla: "rn", nome: "Rio Grande do Norte", regiao: "Nordeste", depfed: 8, depest: 24 },
  { sigla: "ro", nome: "Rondônia", regiao: "Norte", depfed: 8, depest: 24 },
  { sigla: "rr", nome: "Roraima", regiao: "Norte", depfed: 8, depest: 24 },
  { sigla: "rs", nome: "Rio Grande do Sul", regiao: "Sul", depfed: 31, depest: 55 },
  { sigla: "sc", nome: "Santa Catarina", regiao: "Sul", depfed: 16, depest: 40 },
  { sigla: "se", nome: "Sergipe", regiao: "Nordeste", depfed: 8, depest: 24 },
  { sigla: "sp", nome: "São Paulo", regiao: "Sudeste", depfed: 70, depest: 94 },
  { sigla: "to", nome: "Tocantins", regiao: "Norte", depfed: 8, depest: 24 },
];

export const UF_MAP: Record<string, UFInfo> = Object.fromEntries(UFS.map((u) => [u.sigla, u]));

export const isUF = (s: string) => s in UF_MAP;

export const nomeAbrangencia = (abr: string) =>
  abr === "br" ? "Brasil" : abr === "zz" ? "Exterior" : (UF_MAP[abr]?.nome ?? abr.toUpperCase());

export const REGIOES: Regiao[] = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"];
