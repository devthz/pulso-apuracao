/** repassa ?modo= e ?fase= da página para as chamadas de API (simulação e testes de fase) */
export function comParams(path: string, extra?: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  if (typeof window !== "undefined") {
    const atual = new URLSearchParams(window.location.search);
    for (const k of ["modo", "fase"]) {
      const v = atual.get(k);
      if (v) qs.set(k, v);
    }
  }
  for (const [k, v] of Object.entries(extra ?? {})) if (v != null && v !== "") qs.set(k, String(v));
  const [base, q0] = path.split("?");
  if (q0) for (const [k, v] of new URLSearchParams(q0)) qs.set(k, v);
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

/** link interno preservando modo/fase */
export function linkCom(path: string) {
  return comParams(path);
}
