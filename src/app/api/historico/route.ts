import { json, turnoDe } from "@/lib/api-util";
import { getHistoricoGravado } from "@/lib/tse/source";

export const dynamic = "force-dynamic";

/** linha do tempo do modelo gravada ao vivo (vazia para 2026: a do 2º turno foi reconstruída, ver /historico/presidente-2t.json) */
export async function GET(req: Request) {
  return json(await getHistoricoGravado(turnoDe(req)));
}
