export type TravelingTo = "work" | "home";

export type TrainView = {
  id: string;
  minutes: number;
  headsign: string;
  aimed: boolean;
};

export type AlertView = {
  id: string;
  title: string;
  effect: string;
};

export type Verdict =
  | { kind: "leave-now" }
  | { kind: "leave-in"; minutes: number }
  | { kind: "none" }
  | { kind: "unavailable" };

export type Board = {
  homeStopId: string;
  workStopId: string;
  travelingTo: TravelingTo;
  walkMinutes: number;
  originName: string;
  destinationName: string;
  branchLabel: string;
  verdict: Verdict;
  detail: string;
  note: string | null;
  trains: TrainView[];
  alerts: AlertView[];
  updatedAt: string;
  error: string | null;
};
