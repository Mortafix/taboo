import { describe, expect, it } from "vitest";
import {
  createMatch,
  gameReducer,
  restoreMatch,
  teamAccuracy,
} from "../app/lib/game";
import type { GameSettings, MatchState } from "../app/lib/types";

const settings: GameSettings = {
  durationSec: 30,
  skipsPerTeam: 5,
  targetScore: 10,
  categoryIds: ["test"],
  teams: [
    { id: "a", name: "A", color: "coral" },
    { id: "b", name: "B", color: "blue" },
    { id: "c", name: "C", color: "amber" },
  ],
};

const cardIds = Array.from({ length: 40 }, (_, index) => `card-${index}`);

function start(state: MatchState, now = 1_000) {
  return gameReducer(state, { type: "start-turn", now });
}

describe("game engine", () => {
  it("creates a match for 2–4 teams with a persistent shuffled deck", () => {
    const state = createMatch(settings, cardIds, 100);
    expect(state.phase).toBe("handoff");
    expect(state.teams).toHaveLength(3);
    expect(state.currentCardId).toBeTruthy();
    expect(state.deck).toHaveLength(cardIds.length - 1);
    expect(new Set([state.currentCardId, ...state.deck]).size).toBe(cardIds.length);
  });

  it("scores actions independently and consumes only limited skips", () => {
    let state = start(createMatch(settings, cardIds, 100));
    const firstCard = state.currentCardId;
    state = gameReducer(state, { type: "card", result: "correct", now: 1_100 });
    const secondCard = state.currentCardId;
    state = gameReducer(state, { type: "card", result: "wrong", now: 1_200 });
    const thirdCard = state.currentCardId;
    state = gameReducer(state, { type: "card", result: "skip", now: 1_300 });

    expect(new Set([firstCard, secondCard, thirdCard, state.currentCardId])).toHaveLength(4);
    expect(state.teams[0]).toMatchObject({
      score: 0,
      correct: 1,
      wrong: 1,
      skipped: 1,
      skipsRemaining: 4,
    });
    expect(teamAccuracy(state.teams[0])).toBeCloseTo(1 / 3);
  });

  it("gives every team a turn before resolving the winner", () => {
    let state = start(createMatch(settings, cardIds, 100));
    for (let index = 0; index < 10; index += 1) {
      state = gameReducer(state, {
        type: "card",
        result: "correct",
        now: 2_000 + index,
      });
    }
    state = gameReducer(state, { type: "time-up", now: 3_000 });
    expect(state.phase).toBe("handoff");
    expect(state.activeTeamIndex).toBe(1);

    state = start(state, 4_000);
    state = gameReducer(state, { type: "time-up", now: 5_000 });
    state = start(state, 6_000);
    state = gameReducer(state, { type: "time-up", now: 7_000 });

    expect(state.phase).toBe("finished");
    expect(state.winnerTeamId).toBe("a");
  });

  it("freezes the timer on pause and restores a running match as paused", () => {
    let state = start(createMatch(settings, cardIds, 100), 1_000);
    state = gameReducer(state, { type: "pause", now: 11_000 });
    expect(state.remainingMs).toBe(20_000);
    expect(state.phase).toBe("paused");

    const running = { ...state, phase: "playing" as const, turnEndsAt: 31_000 };
    const restored = restoreMatch(running);
    expect(restored.phase).toBe("paused");
    expect(restored.turnEndsAt).toBeNull();
  });

  it("does not consume a skip when none remain", () => {
    const noSkip = { ...settings, skipsPerTeam: 0 as const };
    const state = start(createMatch(noSkip, cardIds, 100));
    const same = gameReducer(state, {
      type: "card",
      result: "skip",
      now: 2_000,
    });
    expect(same).toBe(state);
  });
});
