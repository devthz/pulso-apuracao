import { Logo } from "./chrome";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-4 py-10 sm:px-8 md:flex-row md:items-center md:justify-between">
        <Logo />
        <div className="max-w-2xl text-[12px] leading-relaxed text-dim">
          Dados: arquivos públicos de divulgação de resultados do{" "}
          <a className="text-muted underline-offset-2 hover:underline" href="https://resultados.tse.jus.br" target="_blank" rel="noreferrer">
            Tribunal Superior Eleitoral
          </a>
          , atualizados a cada poucos segundos. Projeções de bancadas são estimativas pelas regras do quociente eleitoral a partir dos votos já apurados — o resultado oficial é o do TSE. Projeto independente, sem vínculo com a Justiça Eleitoral. Mapa:{" "}
          <a className="text-muted hover:underline" href="https://github.com/VictorCazanave/svg-maps" target="_blank" rel="noreferrer">
            svg-maps/brazil
          </a>{" "}
          (CC BY 4.0).
        </div>
      </div>
    </footer>
  );
}
