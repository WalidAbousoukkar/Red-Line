export type Branch = "trunk" | "ashmont" | "braintree";

export type Stop = {
  id: string;
  name: string;
  branch: Branch;
  sequence: number;
};

export const RED_LINE_STOPS: Stop[] = [
  { id: "place-alfcl", name: "Alewife", branch: "trunk", sequence: 0 },
  { id: "place-davis", name: "Davis", branch: "trunk", sequence: 1 },
  { id: "place-portr", name: "Porter", branch: "trunk", sequence: 2 },
  { id: "place-harsq", name: "Harvard", branch: "trunk", sequence: 3 },
  { id: "place-cntsq", name: "Central", branch: "trunk", sequence: 4 },
  { id: "place-knncl", name: "Kendall/MIT", branch: "trunk", sequence: 5 },
  { id: "place-chmnl", name: "Charles/MGH", branch: "trunk", sequence: 6 },
  { id: "place-pktrm", name: "Park Street", branch: "trunk", sequence: 7 },
  { id: "place-dwnxg", name: "Downtown Crossing", branch: "trunk", sequence: 8 },
  { id: "place-sstat", name: "South Station", branch: "trunk", sequence: 9 },
  { id: "place-brdwy", name: "Broadway", branch: "trunk", sequence: 10 },
  { id: "place-andrw", name: "Andrew", branch: "trunk", sequence: 11 },
  { id: "place-jfk", name: "JFK/UMass", branch: "trunk", sequence: 12 },
  { id: "place-shmnl", name: "Savin Hill", branch: "ashmont", sequence: 13 },
  { id: "place-fldcr", name: "Fields Corner", branch: "ashmont", sequence: 14 },
  { id: "place-smmnl", name: "Shawmut", branch: "ashmont", sequence: 15 },
  { id: "place-asmnl", name: "Ashmont", branch: "ashmont", sequence: 16 },
  { id: "place-nqncy", name: "North Quincy", branch: "braintree", sequence: 13 },
  { id: "place-wlsta", name: "Wollaston", branch: "braintree", sequence: 14 },
  { id: "place-qnctr", name: "Quincy Center", branch: "braintree", sequence: 15 },
  { id: "place-qamnl", name: "Quincy Adams", branch: "braintree", sequence: 16 },
  { id: "place-brntn", name: "Braintree", branch: "braintree", sequence: 17 },
];

const byId = new Map(RED_LINE_STOPS.map((stop) => [stop.id, stop]));

export function getStop(id: string): Stop | undefined {
  return byId.get(id);
}

export function stopsByBranch(branch: Branch): Stop[] {
  return RED_LINE_STOPS.filter((stop) => stop.branch === branch);
}
