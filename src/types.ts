export type PlayerPosition = "GK" | "DEF" | "MID" | "FWD";

export type Tactic =
  | "balanced"
  | "attacking"
  | "defensive"
  | "counter"
  | "gegenpress"
  | "tikiTaka"
  | "wingPlay"
  | "directPlay"
  | "lowBlock"
  | "highPress";

export type Formation =
  | "4-3-3"
  | "4-2-3-1"
  | "4-4-2"
  | "4-1-4-1"
  | "4-3-1-2"
  | "4-2-2-2"
  | "3-5-2"
  | "3-4-3"
  | "3-4-2-1"
  | "5-3-2"
  | "5-4-1"
  | "5-2-3";

export type Stage = "team" | "squad" | "lineup" | "tournament";

export type PlayMode = "offline" | "online";

export interface LobbyPlayer {
  id: string;
  nickname: string;
  team: string | null;
  ready: boolean;
  isHost: boolean;
  setupReady?: boolean;
}

export interface LobbyRoom {
  code: string;
  hostId: string;
  status: "lobby" | "started";
  maxPlayers: number;
  players: LobbyPlayer[];
}

export interface Player {
  id: string;
  name: string;
  nationality: string;
  club: string;
  overall: number;
  position: PlayerPosition;
  age: number;
  pace?: number;
  shooting?: number;
  passing?: number;
  dribbling?: number;
  defending?: number;
  physic?: number;
  goalkeeping?: number;
  curve?: number;
  freeKickAccuracy?: number;
  penalties?: number;
}

export interface TeamPlan {
  country: string;
  squad: Player[];
  startingEleven: Player[];
  bench: Player[];
  formation: Formation;
  tactic: Tactic;
  tacticalPlan: TacticalPlan;
  setPieceTakers?: SetPieceTakers;
  assignedRoles?: Record<string, PlayerPosition>;
}

export interface OnlineTeamPlan {
  playerId: string;
  country: string;
  lineup: Player[];
  tactic: Tactic;
  tacticalPlan: TacticalPlan;
  setPieceTakers?: SetPieceTakers;
  assignedRoles?: Record<string, PlayerPosition>;
}

export interface SetPieceTakers {
  penaltyTakerId?: string;
  freeKickTakerId?: string;
}

export interface TacticalPlan {
  mentality: number;
  defensiveLine: number;
  pressIntensity: number;
  counterPress: number;
  buildUpSpeed: number;
  passingDirectness: number;
  attackingWidth: number;
  tempo: number;
}

export interface GoalEvent {
  minute: number;
  scorer: string;
  team: string;
}

export type MatchEventType =
  | "kickoff"
  | "whistle"
  | "foul"
  | "chance"
  | "penalty"
  | "free-kick"
  | "goal"
  | "miss"
  | "post"
  | "save"
  | "yellow-card"
  | "red-card"
  | "half-time"
  | "full-time"
  | "penalties"
  | "analysis";

export interface MatchEvent {
  minute: number;
  type: MatchEventType;
  text: string;
  team?: string;
  scorer?: string;
  suspense?: boolean;
  whistle?: boolean;
}

export interface MatchResult {
  id: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  goals: GoalEvent[];
  events: MatchEvent[];
  homeWinProbability: number;
  awayWinProbability: number;
  drawProbability: number;
  homeTacticFit: number;
  awayTacticFit: number;
  homePower: number;
  awayPower: number;
  winner?: string;
  decidedByPenalties?: string;
}

export interface Standing {
  team: string;
  groupId?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface GroupResult {
  name: string;
  matches: MatchResult[];
  standings: Standing[];
}

export interface KnockoutRound {
  name: string;
  matches: MatchResult[];
}

export interface TournamentResult {
  groups: GroupResult[];
  thirdPlaceTable: Standing[];
  knockouts: KnockoutRound[];
  champion: string;
  thirdPlaceWinner?: string;
}
