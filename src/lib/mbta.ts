import { alertTouchesTrip, type TripPlan, type UpcomingTrain } from "@/lib/decision";
import type { AlertView } from "@/lib/types";

type Relationship = { data?: { id: string; type: string } | null };

type Resource<T> = {
  id: string;
  type: string;
  attributes: T;
  relationships?: Record<string, Relationship>;
};

type PredictionAttributes = {
  arrival_time: string | null;
  departure_time: string | null;
  direction_id: number;
  status: string | null;
  schedule_relationship: string | null;
};

type TripAttributes = {
  headsign: string | null;
};

type AlertAttributes = {
  header: string | null;
  short_header: string | null;
  effect: string | null;
  lifecycle: string | null;
  informed_entity?: AlertInformedEntity[];
  active_period?: { start: string | null; end: string | null }[];
};

type AlertInformedEntity = {
  route?: string | null;
  route_type?: number | null;
  stop?: string | null;
  direction_id?: number | null;
  trip?: string | null;
};

const MBTA_BASE = "https://api-v3.mbta.com";

export async function fetchTripFeed(plan: TripPlan, now = Date.now()): Promise<{
  trains: UpcomingTrain[];
  alerts: AlertView[];
}> {
  const predictionParams = new URLSearchParams({
    "filter[route]": "Red",
    "filter[stop]": plan.origin.id,
    "filter[direction_id]": String(plan.directionId),
    include: "trip",
    "page[limit]": "20",
  });

  const [predictions, alerts] = await Promise.all([
    mbtaGet<{ data: Resource<PredictionAttributes>[]; included?: Resource<TripAttributes>[] }>(
      `/predictions?${predictionParams}`,
    ),
    mbtaGet<{ data: Resource<AlertAttributes>[] }>("/alerts?filter[route]=Red"),
  ]);

  const trips = new Map(
    (predictions.included ?? [])
      .filter((item) => item.type === "trip")
      .map((item) => [item.id, item.attributes.headsign ?? "Red Line"]),
  );

  const trains = predictions.data
    .map((prediction) => toTrain(prediction, trips, plan, now))
    .filter((train): train is UpcomingTrain => train !== null)
    .sort((a, b) => a.minutes - b.minutes)
    .slice(0, 4);

  const tripIds = new Set(
    trains.map((train) => train.tripId).filter((id): id is string => Boolean(id)),
  );

  const matchingAlerts = alerts.data
    .filter((alert) => isActive(alert.attributes, now))
    .filter((alert) =>
      alertTouchesTrip(
        (alert.attributes.informed_entity ?? []).map((entity) => ({
          route: entity.route,
          routeType: entity.route_type,
          stop: entity.stop,
          directionId: entity.direction_id,
          trip: entity.trip,
        })),
        plan,
        tripIds,
      ),
    )
    .slice(0, 3)
    .map((alert) => ({
      id: alert.id,
      title: plainText(
        alert.attributes.short_header || alert.attributes.header || "Service alert",
      ),
      effect: effectLabel(alert.attributes.effect),
    }));

  return { trains, alerts: matchingAlerts };
}

async function mbtaGet<T>(path: string): Promise<T> {
  const headers: HeadersInit = { accept: "application/vnd.api+json" };
  const apiKey = process.env.MBTA_API_KEY;
  if (apiKey) headers["x-api-key"] = apiKey;

  const response = await fetch(`${MBTA_BASE}${path}`, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`MBTA request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

function toTrain(
  prediction: Resource<PredictionAttributes>,
  trips: Map<string, string>,
  plan: TripPlan,
  now: number,
): UpcomingTrain | null {
  const relationship = prediction.attributes.schedule_relationship;
  if (relationship === "CANCELLED" || relationship === "SKIPPED") return null;

  const status = prediction.attributes.status ?? "";
  if (/cancel/i.test(status)) return null;

  const tripId = prediction.relationships?.trip?.data?.id ?? null;
  const headsign = (tripId && trips.get(tripId)) || "Red Line";
  if (
    plan.headsign &&
    !headsign.toLowerCase().includes(plan.headsign.toLowerCase())
  ) {
    return null;
  }

  const minutes = minutesUntil(
    prediction.attributes.departure_time ?? prediction.attributes.arrival_time,
    status,
    now,
  );
  if (minutes === null) return null;

  return {
    id: prediction.id,
    tripId,
    minutes,
    headsign,
  };
}

function minutesUntil(
  iso: string | null,
  status: string,
  now: number,
): number | null {
  if (!iso) {
    return /board|arriv|approach/i.test(status) ? 0 : null;
  }

  const delta = new Date(iso).getTime() - now;
  if (Number.isNaN(delta) || delta < -30_000) return null;
  return Math.max(0, Math.round(delta / 60_000));
}

function isActive(alert: AlertAttributes, now: number): boolean {
  if (alert.lifecycle === "CANCELED" || alert.lifecycle === "ENDED") return false;
  const periods = alert.active_period ?? [];
  if (periods.length === 0) return true;

  return periods.some((period) => {
    const start = period.start ? new Date(period.start).getTime() : Number.NEGATIVE_INFINITY;
    const end = period.end ? new Date(period.end).getTime() : Number.POSITIVE_INFINITY;
    return now >= start && now <= end;
  });
}

function plainText(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function effectLabel(effect: string | null): string {
  if (!effect) return "Alert";
  return effect
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
