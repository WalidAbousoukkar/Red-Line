"use client";

import { useEffect, useState, useTransition } from "react";
import { saveCommute, setTravelingTo } from "@/app/actions";
import { stopsByBranch } from "@/lib/stops";
import type { Board } from "@/lib/types";

const REFRESH_MS = 30_000;

export function CommuteScreen({ initial }: { initial: Board }) {
  const [board, setBoard] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setBoard(initial);
  }, [initial]);

  useEffect(() => {
    const timer = setInterval(() => {
      void reload();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  async function reload() {
    try {
      const response = await fetch("/api/commute", { cache: "no-store" });
      if (!response.ok) throw new Error("refresh failed");
      const next = (await response.json()) as Board;
      setBoard(next);
      setRefreshError(false);
    } catch {
      setRefreshError(true);
    }
  }

  function changeDirection(travelingTo: Board["travelingTo"]) {
    if (travelingTo === board.travelingTo) return;
    startTransition(async () => {
      await setTravelingTo(travelingTo);
      await reload();
    });
  }

  const headline = verdictText(board);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col px-5 py-8">
      <p className="text-xs font-semibold tracking-[0.22em] text-[#e23b32]">
        RED LINE
      </p>
      <p className="mt-3 text-sm text-[#cbb8b0]">
        {board.originName}
        <span className="px-2 text-[#8d736b]">to</span>
        {board.destinationName}
      </p>

      <h1
        className="mt-6 text-5xl font-semibold tracking-tight text-[#f4ece6]"
        aria-live="polite"
      >
        {headline}
      </h1>
      <p className="mt-4 text-lg leading-7 text-[#e7d7d0]">{board.detail}</p>
      {board.note ? (
        <p className="mt-2 text-sm text-[#d7b48a]">{board.note}</p>
      ) : null}

      <section className="mt-8" aria-label="Upcoming trains">
        <h2 className="text-xs font-semibold tracking-[0.16em] text-[#8d736b]">
          THIS BRANCH
        </h2>
        {board.trains.length === 0 ? (
          <p className="mt-3 text-sm text-[#cbb8b0]">No trains listed yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/10">
            {board.trains.map((train) => (
              <li
                key={train.id}
                className="flex items-baseline justify-between py-3"
              >
                <span className="font-mono text-lg tabular-nums">
                  {train.minutes} min
                </span>
                <span className="text-sm text-[#cbb8b0]">
                  {train.headsign}
                  {train.aimed ? (
                    <span className="ml-2 text-[#f4ece6]">Your train</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6" aria-label="Alerts on this trip">
        <h2 className="text-xs font-semibold tracking-[0.16em] text-[#8d736b]">
          THIS TRIP
        </h2>
        {board.alerts.length === 0 ? (
          <p className="mt-3 text-sm text-[#b7c7a4]">No alerts on this trip.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {board.alerts.map((alert) => (
              <li
                key={alert.id}
                className="rounded-xl bg-[#3a2218] px-4 py-3 text-sm text-[#f0c9a0]"
              >
                <span className="font-semibold">{alert.effect}. </span>
                {alert.title}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8 grid grid-cols-2 gap-2">
        <button
          type="button"
          aria-pressed={board.travelingTo === "work"}
          disabled={pending}
          onClick={() => changeDirection("work")}
          className={`rounded-full px-4 py-3 text-sm font-medium ${
            board.travelingTo === "work"
              ? "bg-[#e23b32] text-white"
              : "bg-white/5 text-[#f4ece6]"
          }`}
        >
          To work
        </button>
        <button
          type="button"
          aria-pressed={board.travelingTo === "home"}
          disabled={pending}
          onClick={() => changeDirection("home")}
          className={`rounded-full px-4 py-3 text-sm font-medium ${
            board.travelingTo === "home"
              ? "bg-[#e23b32] text-white"
              : "bg-white/5 text-[#f4ece6]"
          }`}
        >
          To home
        </button>
      </div>

      <section className="mt-6 rounded-2xl bg-[#241416] p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Saved stops</h2>
          <button
            type="button"
            onClick={() => {
              setEditing((open) => !open);
              setFormError(null);
            }}
            className="text-sm text-[#e7d7d0] underline decoration-white/20 underline-offset-4"
          >
            {editing ? "Close" : "Edit"}
          </button>
        </div>
        <p className="mt-2 text-sm text-[#cbb8b0]">
          {stopName(board.homeStopId)} and {stopName(board.workStopId)}.{" "}
          {board.walkMinutes} minute walk.
        </p>

        {editing ? (
          <form
            className="mt-4 space-y-3"
            action={(formData) => {
              startTransition(async () => {
                const result = await saveCommute(formData);
                if (!result.ok) {
                  setFormError(result.error);
                  return;
                }
                setFormError(null);
                setEditing(false);
                await reload();
              });
            }}
          >
            <StopField
              label="Home"
              name="homeStopId"
              defaultValue={board.homeStopId}
            />
            <StopField
              label="Work"
              name="workStopId"
              defaultValue={board.workStopId}
            />
            <label className="block text-sm">
              <span className="text-[#cbb8b0]">Walk to the platform</span>
              <input
                name="walkMinutes"
                type="number"
                min={1}
                max={45}
                defaultValue={board.walkMinutes}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2"
              />
            </label>
            {formError ? (
              <p className="text-sm text-[#f0c9a0]">{formError}</p>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-full bg-[#f4ece6] px-4 py-3 text-sm font-medium text-[#1a0c0e] disabled:opacity-60"
            >
              Save commute
            </button>
          </form>
        ) : null}
      </section>

      <p className="mt-6 text-xs text-[#8d736b]">
        {refreshError || board.error
          ? "Couldn’t refresh predictions. Showing the last update."
          : `Predictions refresh every 30 seconds. Updated ${formatTime(board.updatedAt)}.`}
      </p>
    </main>
  );
}

function StopField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-[#cbb8b0]">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2"
      >
        <optgroup label="Alewife to JFK/UMass">
          {stopsByBranch("trunk").map((stop) => (
            <option key={stop.id} value={stop.id}>
              {stop.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="Ashmont">
          {stopsByBranch("ashmont").map((stop) => (
            <option key={stop.id} value={stop.id}>
              {stop.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="Braintree">
          {stopsByBranch("braintree").map((stop) => (
            <option key={stop.id} value={stop.id}>
              {stop.name}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}

function verdictText(board: Board): string {
  if (board.verdict.kind === "leave-now") return "Leave now";
  if (board.verdict.kind === "leave-in") {
    const minutes = board.verdict.minutes;
    return `Leave in ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  }
  if (board.verdict.kind === "none") return "Wait for the next one";
  return "Check back";
}

function stopName(id: string): string {
  const groups = [
    ...stopsByBranch("trunk"),
    ...stopsByBranch("ashmont"),
    ...stopsByBranch("braintree"),
  ];
  return groups.find((stop) => stop.id === id)?.name ?? "Unknown stop";
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "just now";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
