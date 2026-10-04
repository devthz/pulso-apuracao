const nf = new Intl.NumberFormat("pt-BR");
const nfc = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

export const fmtInt = (n: number) => nf.format(Math.round(n));
export const fmtCompact = (n: number) => nfc.format(n);
export const fmtPct = (n: number, casas = 2) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

export const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter((p) => p.length > 2 || /^[A-ZÁÉÍÓÚ]/.test(p))
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

/** hora do TSE vem como "dd/mm/aaaa hh:mm:ss" */
export const soHora = (s?: string | null) => (s ? (s.split(" ")[1] ?? s) : "—");
