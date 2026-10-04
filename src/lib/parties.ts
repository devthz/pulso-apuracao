/** Cores vivas por sigla. Partidos reais + os fictícios usados no modo simulação. */
const CORES: Record<string, string> = {
  // reais
  PT: "#FF2D55",
  PL: "#2F6BFF",
  MDB: "#22D46B",
  PSD: "#B6F53D",
  UNIÃO: "#00C2FF",
  UNIAO: "#00C2FF",
  PP: "#7C5CFF",
  REPUBLICANOS: "#13D6C1",
  PSB: "#FFC21A",
  PDT: "#FF5FA2",
  PSDB: "#4FA8FF",
  PSOL: "#FFE14D",
  NOVO: "#FF7A00",
  PODE: "#A855F7",
  PCdoB: "#D61F3A",
  PCDOB: "#D61F3A",
  PV: "#5BE584",
  REDE: "#2EE6D6",
  CIDADANIA: "#FF4FD8",
  AVANTE: "#FF9B45",
  SOLIDARIEDADE: "#FF7A8A",
  AGIR: "#9CA3FF",
  DC: "#8EE3FF",
  PRTB: "#3D7BFF",
  PMB: "#FF8FD1",
  MOBILIZA: "#F5D76E",
  PCB: "#C81E1E",
  PSTU: "#E53B3B",
  PCO: "#B4232F",
  UP: "#F04E23",
  MISSÃO: "#7AE7FF",
  MISSAO: "#7AE7FF",
  // fictícios (simulação)
  PAV: "#FF2D6F",
  MNB: "#2F7BFF",
  PFR: "#C6FF3D",
  UDC: "#00D1FF",
  PSV: "#FFB31A",
  AVL: "#A45CFF",
  PCN: "#14E3B5",
  MVP: "#FF5ACD",
  FPS: "#FF7A1A",
  ORB: "#6E8BFF",
  PDM: "#3BEA7A",
  SOMOS: "#FFE24A",
  PIA: "#5CF2FF",
  LUZ: "#FF8A9E",
  MRC: "#B8A2FF",
};

function hashCor(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 85% 62%)`;
}

export function corPartido(sigla?: string | null) {
  if (!sigla) return "#7A8199";
  return CORES[sigla] ?? CORES[sigla.toUpperCase()] ?? hashCor(sigla);
}

export const NEUTRO = "#2A2F3D";
