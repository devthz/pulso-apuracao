import { NextResponse } from "next/server";
import { modoDe } from "@/lib/api-util";
import { getMunicipios } from "@/lib/tse/municipios";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const data = await getMunicipios(modoDe(req));
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10" },
  });
}
