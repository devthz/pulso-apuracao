import { json, modoDe } from "@/lib/api-util";
import { getBaseSegundoTurno } from "@/lib/tse/source";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const b = await getBaseSegundoTurno(modoDe(req));
  if (!b) return json({ erro: "aguardando" }, 404);
  return json(b);
}
