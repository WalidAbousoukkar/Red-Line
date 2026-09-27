"use server";

import { revalidatePath } from "next/cache";
import { saveCommute as writeCommute, setTravelingTo as writeDirection } from "@/lib/db";
import type { TravelingTo } from "@/lib/types";

export async function saveCommute(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const walkMinutes = Number(formData.get("walkMinutes"));
  const result = writeCommute({
    homeStopId: String(formData.get("homeStopId") ?? ""),
    workStopId: String(formData.get("workStopId") ?? ""),
    walkMinutes,
  });

  if (!result.ok) return result;
  revalidatePath("/");
  return { ok: true };
}

export async function setTravelingTo(travelingTo: TravelingTo): Promise<void> {
  writeDirection(travelingTo);
  revalidatePath("/");
}
