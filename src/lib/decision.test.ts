import { describe, expect, it } from "vitest";
import {
  alertTouchesTrip,
  chooseDeparture,
  planTrip,
  type TripPlan,
  type UpcomingTrain,
} from "@/lib/decision";

function train(id: string, minutes: number): UpcomingTrain {
  return { id, tripId: null, minutes, headsign: "Alewife" };
}

function assertPlan(
  plan: TripPlan | { error: string },
): asserts plan is TripPlan {
  if ("error" in plan) {
    throw new Error(plan.error);
  }
}

describe("chooseDeparture", () => {
  it("aims at the first train the walk can reach", () => {
    const { aimed, missed } = chooseDeparture(
      [train("soon", 1), train("yours", 6), train("later", 12)],
      5,
    );

    expect(aimed?.id).toBe("yours");
    expect(missed?.id).toBe("soon");
  });

  it("catches a train that arrives as the walk ends", () => {
    const { aimed, missed } = chooseDeparture(
      [train("on-time", 5), train("later", 12)],
      5,
    );

    expect(aimed?.id).toBe("on-time");
    expect(missed).toBeNull();
  });

  it("has no train when every one is too soon", () => {
    const { aimed, missed } = chooseDeparture(
      [train("a", 1), train("b", 4)],
      5,
    );

    expect(aimed).toBeNull();
    expect(missed).toBeNull();
  });
});

describe("planTrip", () => {
  it("uses the Alewife direction from JFK/UMass", () => {
    const plan = planTrip("place-jfk", "place-alfcl");
    assertPlan(plan);

    expect(plan.directionId).toBe(1);
    expect(plan.headsign).toBe("Alewife");
  });

  it("uses the southbound direction from Alewife to JFK/UMass", () => {
    const plan = planTrip("place-alfcl", "place-jfk");
    assertPlan(plan);

    expect(plan.directionId).toBe(0);
  });
});

describe("alertTouchesTrip", () => {
  it("keeps an alert on the trip and drops one off the path", () => {
    const plan = planTrip("place-jfk", "place-alfcl");
    assertPlan(plan);

    expect(
      alertTouchesTrip(
        [{ route: "Red", stop: "place-pktrm" }],
        plan,
        new Set(),
      ),
    ).toBe(true);
    expect(
      alertTouchesTrip(
        [{ route: "Red", stop: "place-brntn" }],
        plan,
        new Set(),
      ),
    ).toBe(false);
  });
});
