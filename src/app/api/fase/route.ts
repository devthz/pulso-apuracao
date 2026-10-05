import { faseDe, json, modoDe } from "@/lib/api-util";
import { getFase } from "@/lib/tse/source";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  return json(await getFase(modoDe(req), faseDe(req)));
}
