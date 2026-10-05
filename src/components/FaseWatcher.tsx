"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useFase } from "@/hooks/data";

/** quando a fase muda (ex.: 25/10 às 17h vira "2º turno ao vivo"), recarrega a home sozinha */
export function FaseWatcher({ fase }: { fase: string }) {
  const { data } = useFase();
  const router = useRouter();
  useEffect(() => {
    if (data && data.fase !== fase) router.refresh();
  }, [data, fase, router]);
  return null;
}
