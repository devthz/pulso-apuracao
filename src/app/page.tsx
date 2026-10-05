import { AbasPrimeiroTurno, EntreTurnosHero, GovernadoresSegundoTurno } from "@/components/EntreTurnos";
import { FaseWatcher } from "@/components/FaseWatcher";
import { PresidentSection } from "@/components/President";
import { SegundoTurnoSection } from "@/components/SegundoTurno";
import { AssembleiasSection, CamaraSection, GovernadoresSection, SenadoSection } from "@/components/Sections";
import { MODO_DADOS } from "@/lib/tse/config";
import { getFase, type FaseInfo } from "@/lib/tse/source";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const modo = sp.modo === "simulacao" || sp.modo === "demo" ? "simulacao" : sp.modo === "tse" ? "tse" : MODO_DADOS;
  const f = sp.fase === "1t" || sp.fase === "entre" || sp.fase === "2t" ? sp.fase : undefined;
  let info: FaseInfo | null = null;
  try {
    info = await getFase(modo, f);
  } catch {
    info = null;
  }
  const fase = info?.fase ?? "1t";

  return (
    <>
      <FaseWatcher fase={fase} />
      {fase === "1t" && (
        <>
          <PresidentSection />
          <SegundoTurnoSection />
          <GovernadoresSection />
          <SenadoSection />
          <CamaraSection />
          <AssembleiasSection />
        </>
      )}
      {fase === "entre" && info && (
        <>
          <EntreTurnosHero info={info} />
          {!info.presidenteEleito && <SegundoTurnoSection />}
          <GovernadoresSegundoTurno info={info} />
        </>
      )}
      {fase === "2t" && info && (
        <>
          {!info.presidenteEleito && <PresidentSection turno={2} />}
          {info.gov2t.length > 0 && <GovernadoresSection turno={2} somente={info.gov2t.map((g) => g.uf)} />}
          <div className="mt-16">
            <AbasPrimeiroTurno />
          </div>
        </>
      )}
    </>
  );
}
