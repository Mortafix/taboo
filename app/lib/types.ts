export type TeamColor = "coral" | "blue" | "amber" | "violet";
export type MatchPhase = "handoff" | "playing" | "paused" | "finished";
export type CardResult = "correct" | "wrong" | "skip";

export interface Card {
  id: string;
  word: string;
  forbidden: readonly string[];
  categoryId: string;
}

export interface Category {
  id: string;
  title: string;
  icon: string;
  count: number;
}

export interface TeamConfig {
  id: string;
  name: string;
  color: TeamColor;
}

export interface Team extends TeamConfig {
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
  turns: number;
  skipsRemaining: number | null;
}

export interface GameSettings {
  durationSec: 30 | 60 | 120 | 300;
  skipsPerTeam: 0 | 5 | 10 | null;
  targetScore: 10 | 25 | 50;
  categoryIds: string[];
  teams: TeamConfig[];
}

export interface MatchState {
  id: string;
  schemaVersion: 1;
  phase: MatchPhase;
  settings: GameSettings;
  teams: Team[];
  activeTeamIndex: number;
  round: number;
  cardPool: string[];
  deck: string[];
  currentCardId: string;
  previousCardId: string | null;
  remainingMs: number;
  turnEndsAt: number | null;
  winnerTeamId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface MatchSummary {
  id: string;
  completedAt: number;
  durationSec: number;
  targetScore: number;
  rounds: number;
  categoryIds: string[];
  winnerTeamId: string;
  teams: Array<
    TeamConfig & {
      score: number;
      correct: number;
      wrong: number;
      skipped: number;
      accuracy: number;
    }
  >;
}

export interface Preferences {
  schemaVersion: 1;
  settings: GameSettings;
  volume: number;
  muted: boolean;
}
