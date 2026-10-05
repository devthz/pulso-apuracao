import { PresidentSection } from "@/components/President";
import { SegundoTurnoSection } from "@/components/SegundoTurno";
import { AssembleiasSection, CamaraSection, GovernadoresSection, SenadoSection } from "@/components/Sections";

export default function Home() {
  return (
    <>
      <PresidentSection />
      <SegundoTurnoSection />
      <GovernadoresSection />
      <SenadoSection />
      <CamaraSection />
      <AssembleiasSection />
    </>
  );
}
