import { connection } from "next/server";
import { chooseDeparture, planTrip } from "@/lib/decision";
import { getCommute } from "@/lib/db";
import { fetchTripFeed } from "@/lib/mbta";
import { getStop } from "@/lib/stops";
import type { Board } from "@/lib/types";

export async function getBoard(): Promise<Board> {
  await connection();
  const commute = getCommute();
  const home = getStop(commute.homeStopId);
  const work = getStop(commute.workStopId);
  const origin = commute.travelingTo === "work" ? home : work;
  const destination = commute.travelingTo === "work" ? work : home;
  const updatedAt = new Date().toISOString();

  const base = {
    homeStopId: commute.homeStopId,
    workStopId: commute.workStopId,
    travelingTo: commute.travelingTo,
    walkMinutes: commute.walkMinutes,
    originName: origin?.name ?? "Home",
    destinationName: destination?.name ?? "Work",
    updatedAt,
  };

  if (!origin || !destination) {
    return {
      ...base,
      branchLabel: "Red Line",
      verdict: { kind: "unavailable" },
      detail: "Choose two Red Line stops.",
      note: null,
      trains: [],
      alerts: [],
      error: null,
    };
  }

  const plan = planTrip(origin.id, destination.id);
  if ("error" in plan) {
    return {
      ...base,
      branchLabel: "Red Line",
      verdict: { kind: "unavailable" },
      detail: plan.error,
      note: null,
      trains: [],
      alerts: [],
      error: null,
    };
  }

  try {
    const feed = await fetchTripFeed(plan);
    const { aimed, missed } = chooseDeparture(feed.trains, commute.walkMinutes);
    const trainLabel = `${plan.branchLabel} train`;

    const trains = feed.trains.map((train) => ({
      id: train.id,
      minutes: train.minutes,
      headsign: train.headsign,
      aimed: aimed?.id === train.id,
    }));

    if (!aimed) {
      return {
        ...base,
        branchLabel: plan.branchLabel,
        verdict: { kind: "none" },
        detail:
          feed.trains.length === 0
            ? "No upcoming trains for this trip."
            : `The next trains are too soon for a ${minutesLabel(commute.walkMinutes)} walk.`,
        note: null,
        trains,
        alerts: feed.alerts,
        error: null,
      };
    }

    const leaveIn = aimed.minutes - commute.walkMinutes;
    const verdict =
      leaveIn <= 0
        ? ({ kind: "leave-now" } as const)
        : ({ kind: "leave-in", minutes: leaveIn } as const);

    return {
      ...base,
      branchLabel: plan.branchLabel,
      verdict,
      detail: `${minutesLabel(commute.walkMinutes)} walk. Next ${trainLabel} in ${minutesLabel(aimed.minutes)}.`,
      note: missed
        ? missed.minutes === 0
          ? "The train at the platform is too soon."
          : `The train in ${minutesLabel(missed.minutes)} is too soon.`
        : null,
      trains,
      alerts: feed.alerts,
      error: null,
    };
  } catch {
    return {
      ...base,
      branchLabel: plan.branchLabel,
      verdict: { kind: "unavailable" },
      detail: "Predictions are unavailable right now.",
      note: null,
      trains: [],
      alerts: [],
      error: "The MBTA feed did not respond.",
    };
  }
}

function minutesLabel(minutes: number): string {
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}
