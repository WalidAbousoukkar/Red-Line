import fs from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@tursodatabase/serverless/compat";
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

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS commute (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    home_stop_id TEXT NOT NULL,
    work_stop_id TEXT NOT NULL,
    walk_minutes INTEGER NOT NULL,
    traveling_to TEXT NOT NULL
  )
`;

const SEED = `
  INSERT INTO commute (id, home_stop_id, work_stop_id, walk_minutes, traveling_to)
  VALUES (1, 'place-qnctr', 'place-pktrm', 8, 'work')
`;

type LocalDatabase = {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    get: () => unknown;
    run: (...args: unknown[]) => void;
  };
};

const globalForDb = globalThis as unknown as {
  commuteDb?: LocalDatabase;
  turso?: Promise<Client>;
};

function cleanSetting(value: string | undefined): string {
  return (value ?? "").trim().replace(/^['"]|['"]$/g, "");
}

function tursoSettings(): { url: string; authToken: string } | null {
  const url = cleanSetting(process.env.TURSO_DATABASE_URL);
  const authToken = cleanSetting(process.env.TURSO_AUTH_TOKEN);
  if (!url || !authToken) return null;
  return { url, authToken };
}

async function openLocalDatabase(): Promise<LocalDatabase> {
  if (globalForDb.commuteDb) return globalForDb.commuteDb;

  const { DatabaseSync } = await import("node:sqlite");
  const directory = path.join(process.cwd(), "data");
  fs.mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(path.join(directory, "commute.sqlite"));
  db.exec(SCHEMA);

  const existing = db.prepare("SELECT id FROM commute WHERE id = 1").get();
  if (!existing) db.prepare(SEED).run();

  globalForDb.commuteDb = db;
  return db;
}

async function openTurso(): Promise<Client> {
  if (!globalForDb.turso) {
    const settings = tursoSettings();
    if (!settings) {
      throw new Error("Turso settings are missing on Vercel.");
    }

    globalForDb.turso = (async () => {
      try {
        const client = createClient(settings);
        await client.execute(SCHEMA);
        const existing = await client.execute(
          "SELECT id FROM commute WHERE id = 1",
        );
        if (existing.rows.length === 0) await client.execute(SEED);
        return client;
      } catch (error) {
        globalForDb.turso = undefined;
        throw error;
      }
    })();
  }

  return globalForDb.turso;
}

function toCommute(row: CommuteRow): Commute {
  return {
    homeStopId: String(row.home_stop_id),
    workStopId: String(row.work_stop_id),
    walkMinutes: Number(row.walk_minutes),
    travelingTo: row.traveling_to === "home" ? "home" : "work",
  };
}

function assertDatabaseAvailable(): void {
  if (!tursoSettings() && process.env.VERCEL) {
    throw new Error("Turso settings are missing on Vercel.");
  }
}

export async function getCommute(): Promise<Commute> {
  assertDatabaseAvailable();
  if (tursoSettings()) {
    const result = await (
      await openTurso()
    ).execute(
      `SELECT home_stop_id, work_stop_id, walk_minutes, traveling_to
       FROM commute WHERE id = 1`,
    );
    return toCommute(result.rows[0] as unknown as CommuteRow);
  }

  const row = (await openLocalDatabase())
    .prepare(
      `SELECT home_stop_id, work_stop_id, walk_minutes, traveling_to
       FROM commute WHERE id = 1`,
    )
    .get() as CommuteRow;

  return toCommute(row);
}

function validateCommute(input: {
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
  return { ok: true };
}

export async function saveCommute(input: {
  homeStopId: string;
  workStopId: string;
  walkMinutes: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const validation = validateCommute(input);
  if (!validation.ok) return validation;

  assertDatabaseAvailable();
  if (tursoSettings()) {
    await (
      await openTurso()
    ).execute({
      sql: `UPDATE commute
            SET home_stop_id = ?, work_stop_id = ?, walk_minutes = ?
            WHERE id = 1`,
      args: [input.homeStopId, input.workStopId, input.walkMinutes],
    });
    return { ok: true };
  }

  (await openLocalDatabase())
    .prepare(
      `UPDATE commute
       SET home_stop_id = ?, work_stop_id = ?, walk_minutes = ?
       WHERE id = 1`,
    )
    .run(input.homeStopId, input.workStopId, input.walkMinutes);

  return { ok: true };
}

export async function setTravelingTo(travelingTo: TravelingTo): Promise<void> {
  assertDatabaseAvailable();
  if (tursoSettings()) {
    await (
      await openTurso()
    ).execute({
      sql: "UPDATE commute SET traveling_to = ? WHERE id = 1",
      args: [travelingTo],
    });
    return;
  }

  (await openLocalDatabase())
    .prepare("UPDATE commute SET traveling_to = ? WHERE id = 1")
    .run(travelingTo);
}
