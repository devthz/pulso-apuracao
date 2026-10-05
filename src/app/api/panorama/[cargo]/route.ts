import { json, modoDe, turnoDe } from "@/lib/api-util";
import { getPanorama } from "@/lib/tse/source";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request, { params }: { params: Promise<{ cargo: string }> }) {
  const { cargo } = await params;
  if (cargo !== "presidente" && cargo !== "governador" && cargo !== "senador") return json({ erro: "cargo inválido" }, 400);
  return json(await getPanorama(cargo, modoDe(req), turnoDe(req)));
}
