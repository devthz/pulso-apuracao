import { PresidentSection } from "@/components/President";
import { AssembleiasSection, CamaraSection, GovernadoresSection, SenadoSection } from "@/components/Sections";

export default function Home() {
  return (
    <>
      <PresidentSection />
      <GovernadoresSection />
      <SenadoSection />
      <CamaraSection />
      <AssembleiasSection />
    </>
  );
}
