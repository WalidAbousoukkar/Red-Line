import { RED_LINE_STOPS, getStop, type Stop } from "@/lib/stops";

export type TripPlan = {
  origin: Stop;
  destination: Stop;
  directionId: 0 | 1;
  pathIds: string[];
  headsign: "Alewife" | "Ashmont" | "Braintree" | null;
  branchLabel: string;
};

export type UpcomingTrain = {
  id: string;
  tripId: string | null;
  minutes: number;
  headsign: string;
};

export function planTrip(
  originId: string,
  destinationId: string,
): TripPlan | { error: string } {
  const origin = getStop(originId);
  const destination = getStop(destinationId);

  if (!origin || !destination) {
    return { error: "Choose two Red Line stops." };
  }

  if (origin.id === destination.id) {
    return { error: "Home and work need to be different stops." };
  }

  if (
    (origin.branch === "ashmont" && destination.branch === "braintree") ||
    (origin.branch === "braintree" && destination.branch === "ashmont")
  ) {
    return {
      error:
        "Those stops are on different branches, so there isn’t one train between them.",
    };
  }

  const line = lineBetween(origin, destination);
  const originIndex = line.findIndex((stop) => stop.id === origin.id);
  const destinationIndex = line.findIndex((stop) => stop.id === destination.id);
  const inbound = destinationIndex < originIndex;
  const path = inbound
    ? line.slice(destinationIndex, originIndex + 1).reverse()
    : line.slice(originIndex, destinationIndex + 1);

  const usesBraintree = path.some((stop) => stop.branch === "braintree");
  const usesAshmont = path.some((stop) => stop.branch === "ashmont");
  const bothTrunk = origin.branch === "trunk" && destination.branch === "trunk";

  let headsign: TripPlan["headsign"] = null;
  if (inbound) {
    headsign = "Alewife";
  } else if (usesBraintree && !bothTrunk) {
    headsign = "Braintree";
  } else if (usesAshmont && !bothTrunk) {
    headsign = "Ashmont";
  }

  return {
    origin,
    destination,
    directionId: inbound ? 1 : 0,
    pathIds: path.map((stop) => stop.id),
    headsign,
    branchLabel: usesBraintree
      ? "Braintree"
      : usesAshmont
        ? "Ashmont"
        : "Red Line",
  };
}

export function chooseDeparture(
  trains: UpcomingTrain[],
  walkMinutes: number,
): { aimed: UpcomingTrain | null; missed: UpcomingTrain | null } {
  const ordered = [...trains].sort((a, b) => a.minutes - b.minutes);
  const aimed = ordered.find((train) => train.minutes >= walkMinutes) ?? null;
  const first = ordered[0];
  const missed = aimed && first && first.id !== aimed.id ? first : null;
  return { aimed, missed };
}

export type AlertEntity = {
  route?: string | null;
  routeType?: number | null;
  stop?: string | null;
  directionId?: number | null;
  trip?: string | null;
};

export function alertTouchesTrip(
  entities: AlertEntity[],
  plan: TripPlan,
  tripIds: Set<string>,
): boolean {
  return entities.some((entity) => {
    if (entity.route && entity.route !== "Red") return false;
    if (!entity.route && entity.routeType != null && entity.routeType !== 1) {
      return false;
    }
    if (!entity.route && !entity.stop) return false;
    if (
      entity.directionId != null &&
      entity.directionId !== plan.directionId
    ) {
      return false;
    }
    if (entity.stop && !plan.pathIds.includes(entity.stop)) return false;
    if (entity.trip && tripIds.size > 0 && !tripIds.has(entity.trip)) {
      return false;
    }
    return true;
  });
}

function lineBetween(origin: Stop, destination: Stop): Stop[] {
  const trunk = RED_LINE_STOPS.filter((stop) => stop.branch === "trunk");
  if (origin.branch === "braintree" || destination.branch === "braintree") {
    return trunk.concat(
      RED_LINE_STOPS.filter((stop) => stop.branch === "braintree"),
    );
  }
  if (origin.branch === "ashmont" || destination.branch === "ashmont") {
    return trunk.concat(
      RED_LINE_STOPS.filter((stop) => stop.branch === "ashmont"),
    );
  }
  return trunk;
}
