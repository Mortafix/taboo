import type {
  CardResult,
  GameSettings,
  MatchState,
  MatchSummary,
  Team,
} from "./types";

export type GameAction =
  | { type: "start-turn"; now: number }
  | { type: "pause"; now: number }
  | { type: "resume"; now: number }
  | { type: "card"; result: CardResult; now: number }
  | { type: "time-up"; now: number };

const randomId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export function shuffle<T>(input: readonly T[], random = Math.random): T[] {
  const output = [...input];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }
  return output;
}

function refillDeck(state: MatchState): string[] {
  const deck = shuffle(state.cardPool);
  if (
    deck.length > 1 &&
    state.currentCardId &&
    deck[0] === state.currentCardId
  ) {
    [deck[0], deck[1]] = [deck[1], deck[0]];
  }
  return deck;
}

function drawNext(state: MatchState): Pick<
  MatchState,
  "deck" | "currentCardId" | "previousCardId"
> {
  const deck = state.deck.length ? [...state.deck] : refillDeck(state);
  const currentCardId = deck.shift();
  if (!currentCardId) {
    throw new Error("Non ci sono carte disponibili per la partita.");
  }
  return {
    deck,
    currentCardId,
    previousCardId: state.currentCardId,
  };
}

export function teamAccuracy(team: Team): number {
  const attempts = team.correct + team.wrong + team.skipped;
  return attempts ? team.correct / attempts : 0;
}

function compareTeams(left: Team, right: Team): number {
  if (left.score !== right.score) return right.score - left.score;
  if (left.skipped !== right.skipped) return left.skipped - right.skipped;
  return teamAccuracy(right) - teamAccuracy(left);
}

function resolveWinner(teams: Team[], targetScore: number): string | null {
  if (!teams.some((team) => team.score >= targetScore)) return null;
  const ranked = [...teams].sort(compareTeams);
  if (!ranked[1] || compareTeams(ranked[0], ranked[1]) !== 0) {
    return ranked[0].id;
  }
  return null;
}

export function createMatch(
  settings: GameSettings,
  cardIds: readonly string[],
  now = Date.now(),
): MatchState {
  if (settings.teams.length < 2 || settings.teams.length > 4) {
    throw new Error("Una partita richiede da 2 a 4 squadre.");
  }
  if (!cardIds.length) throw new Error("Seleziona almeno un mazzo.");

  const shuffled = shuffle(cardIds);
  const currentCardId = shuffled.shift();
  if (!currentCardId) throw new Error("Il mazzo selezionato è vuoto.");

  return {
    id: randomId(),
    schemaVersion: 1,
    phase: "handoff",
    settings,
    teams: settings.teams.map((team) => ({
      ...team,
      score: 0,
      correct: 0,
      wrong: 0,
      skipped: 0,
      turns: 0,
      skipsRemaining: settings.skipsPerTeam,
    })),
    activeTeamIndex: 0,
    round: 1,
    cardPool: [...cardIds],
    deck: shuffled,
    currentCardId,
    previousCardId: null,
    remainingMs: settings.durationSec * 1000,
    turnEndsAt: null,
    winnerTeamId: null,
    createdAt: now,
    updatedAt: now,
  };
}

function endTurn(state: MatchState, now: number): MatchState {
  const teams = state.teams.map((team, index) =>
    index === state.activeTeamIndex ? { ...team, turns: team.turns + 1 } : team,
  );
  const nextTeamIndex = (state.activeTeamIndex + 1) % teams.length;
  const completedRound = nextTeamIndex === 0;
  const winnerTeamId = completedRound
    ? resolveWinner(teams, state.settings.targetScore)
    : null;

  return {
    ...state,
    ...drawNext({ ...state, teams }),
    teams,
    activeTeamIndex: nextTeamIndex,
    round: completedRound ? state.round + (winnerTeamId ? 0 : 1) : state.round,
    phase: winnerTeamId ? "finished" : "handoff",
    winnerTeamId,
    remainingMs: state.settings.durationSec * 1000,
    turnEndsAt: null,
    updatedAt: now,
  };
}

export function gameReducer(state: MatchState, action: GameAction): MatchState {
  switch (action.type) {
    case "start-turn":
    case "resume": {
      if (
        (action.type === "start-turn" && state.phase !== "handoff") ||
        (action.type === "resume" && state.phase !== "paused")
      ) {
        return state;
      }
      return {
        ...state,
        phase: "playing",
        turnEndsAt: action.now + state.remainingMs,
        updatedAt: action.now,
      };
    }
    case "pause": {
      if (state.phase !== "playing" || !state.turnEndsAt) return state;
      return {
        ...state,
        phase: "paused",
        remainingMs: Math.max(0, state.turnEndsAt - action.now),
        turnEndsAt: null,
        updatedAt: action.now,
      };
    }
    case "card": {
      if (state.phase !== "playing") return state;
      const activeTeam = state.teams[state.activeTeamIndex];
      if (
        action.result === "skip" &&
        activeTeam.skipsRemaining !== null &&
        activeTeam.skipsRemaining <= 0
      ) {
        return state;
      }

      const teams = state.teams.map((team, index) => {
        if (index !== state.activeTeamIndex) return team;
        if (action.result === "correct") {
          return { ...team, correct: team.correct + 1, score: team.score + 1 };
        }
        if (action.result === "wrong") {
          return { ...team, wrong: team.wrong + 1, score: team.score - 1 };
        }
        return {
          ...team,
          skipped: team.skipped + 1,
          skipsRemaining:
            team.skipsRemaining === null ? null : team.skipsRemaining - 1,
        };
      });

      return {
        ...state,
        ...drawNext({ ...state, teams }),
        teams,
        updatedAt: action.now,
      };
    }
    case "time-up": {
      if (state.phase !== "playing") return state;
      return endTurn(state, action.now);
    }
    default:
      return state;
  }
}

export function restoreMatch(state: MatchState): MatchState {
  if (state.phase !== "playing") return state;
  const frozenRemaining = state.turnEndsAt
    ? Math.max(0, state.turnEndsAt - state.updatedAt)
    : state.remainingMs;
  return {
    ...state,
    phase: "paused",
    remainingMs: frozenRemaining,
    turnEndsAt: null,
  };
}

export function toSummary(state: MatchState): MatchSummary {
  if (!state.winnerTeamId) {
    throw new Error("Una partita non conclusa non può essere archiviata.");
  }
  return {
    id: state.id,
    completedAt: state.updatedAt,
    durationSec: state.settings.durationSec,
    targetScore: state.settings.targetScore,
    rounds: state.round,
    categoryIds: state.settings.categoryIds,
    winnerTeamId: state.winnerTeamId,
    teams: state.teams.map((team) => ({
      id: team.id,
      name: team.name,
      color: team.color,
      score: team.score,
      correct: team.correct,
      wrong: team.wrong,
      skipped: team.skipped,
      accuracy: teamAccuracy(team),
    })),
  };
}
