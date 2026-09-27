import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getStop } from "@/lib/stops";
import type { TravelingTo } from "@/lib/types";

export type Commute = {
  homeStopId: string;
  workStopId: string;
  walkMinutes: number;
  travelingTo: TravelingTo;
};

type CommuteRow = {
  home_stop_id: string;
  work_stop_id: string;
  walk_minutes: number;
  traveling_to: string;
};

const globalForDb = globalThis as unknown as { commuteDb?: DatabaseSync };

function openDatabase(): DatabaseSync {
  if (globalForDb.commuteDb) return globalForDb.commuteDb;

  const directory = path.join(process.cwd(), "data");
  fs.mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(path.join(directory, "commute.sqlite"));
  db.exec(`
    CREATE TABLE IF NOT EXISTS commute (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      home_stop_id TEXT NOT NULL,
      work_stop_id TEXT NOT NULL,
      walk_minutes INTEGER NOT NULL,
      traveling_to TEXT NOT NULL
    )
  `);

  const existing = db.prepare("SELECT id FROM commute WHERE id = 1").get();
  if (!existing) {
    db.prepare(
      `INSERT INTO commute (id, home_stop_id, work_stop_id, walk_minutes, traveling_to)
       VALUES (1, 'place-qnctr', 'place-pktrm', 8, 'work')`,
    ).run();
  }

  globalForDb.commuteDb = db;
  return db;
}

export function getCommute(): Commute {
  const row = openDatabase()
    .prepare(
      `SELECT home_stop_id, work_stop_id, walk_minutes, traveling_to
       FROM commute WHERE id = 1`,
    )
    .get() as CommuteRow;

  return {
    homeStopId: row.home_stop_id,
    workStopId: row.work_stop_id,
    walkMinutes: row.walk_minutes,
    travelingTo: row.traveling_to === "home" ? "home" : "work",
  };
}

export function saveCommute(input: {
  homeStopId: string;
  workStopId: string;
  walkMinutes: number;
}): { ok: true } | { ok: false; error: string } {
  if (!getStop(input.homeStopId) || !getStop(input.workStopId)) {
    return { ok: false, error: "Choose two Red Line stops." };
  }
  if (input.homeStopId === input.workStopId) {
    return { ok: false, error: "Home and work need to be different stops." };
  }
  if (
    !Number.isInteger(input.walkMinutes) ||
    input.walkMinutes < 1 ||
    input.walkMinutes > 45
  ) {
    return { ok: false, error: "Walk time needs to be between 1 and 45 minutes." };
  }

  openDatabase()
    .prepare(
      `UPDATE commute
       SET home_stop_id = ?, work_stop_id = ?, walk_minutes = ?
       WHERE id = 1`,
    )
    .run(input.homeStopId, input.workStopId, input.walkMinutes);

  return { ok: true };
}

export function setTravelingTo(travelingTo: TravelingTo): void {
  openDatabase()
    .prepare("UPDATE commute SET traveling_to = ? WHERE id = 1")
    .run(travelingTo);
}
