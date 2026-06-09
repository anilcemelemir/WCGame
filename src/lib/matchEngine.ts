import { tacticDefinitions } from "../data/tactics";
import { MatchEvent, MatchResult, Player, SetPieceTakers, Tactic, TacticalPlan } from "../types";
import { freeKickSkill, penaltySkill, resolveSetPieceTakers } from "./setPieces";

export interface SimTeam {
  country: string;
  lineup: Player[];
  tactic: Tactic;
  tacticalPlan?: TacticalPlan;
  setPieceTakers?: SetPieceTakers;
}

interface TeamProfile {
  overall: number;
  attack: number;
  defense: number;
  control: number;
  transition: number;
  goalkeeping: number;
  attackStrength: number;
  defenseStrength: number;
  fitScore: number;
  fitMultiplier: number;
  tacticFit: number;
  power: number;
  counts: Record<"GK" | "DEF" | "MID" | "FWD", number>;
}

interface PlayerAttributes {
  pac: number;
  tec: number;
  phy: number;
  men: number;
  def: number;
  atk: number;
  gk: number;
}

type TacticArchetype =
  | "gegenpress"
  | "possession"
  | "tikiTaka"
  | "counter"
  | "longBall"
  | "parkBus"
  | "highAttack"
  | "control";

const tacticMatrix: Record<TacticArchetype, Record<TacticArchetype, number>> = {
  gegenpress: { gegenpress: 1, possession: 1.25, tikiTaka: 1.05, counter: 0.8, longBall: 1.1, parkBus: 0.9, highAttack: 1.05, control: 1.1 },
  possession: { gegenpress: 0.85, possession: 1, tikiTaka: 1.05, counter: 1.1, longBall: 1.25, parkBus: 0.95, highAttack: 0.9, control: 1.05 },
  tikiTaka: { gegenpress: 0.95, possession: 0.95, tikiTaka: 1, counter: 1.2, longBall: 0.8, parkBus: 0.9, highAttack: 1, control: 1.05 },
  counter: { gegenpress: 1.2, possession: 0.9, tikiTaka: 0.85, counter: 1, longBall: 1.15, parkBus: 0.75, highAttack: 0.9, control: 1.1 },
  longBall: { gegenpress: 0.9, possession: 0.8, tikiTaka: 1.2, counter: 0.85, longBall: 1, parkBus: 0.85, highAttack: 1.1, control: 0.95 },
  parkBus: { gegenpress: 1.1, possession: 1.05, tikiTaka: 1.1, counter: 1.25, longBall: 1.15, parkBus: 1, highAttack: 1.2, control: 1.05 },
  highAttack: { gegenpress: 0.95, possession: 1.1, tikiTaka: 1, counter: 1.1, longBall: 0.9, parkBus: 0.8, highAttack: 1, control: 1.2 },
  control: { gegenpress: 0.9, possession: 0.95, tikiTaka: 0.95, counter: 0.9, longBall: 1.05, parkBus: 0.95, highAttack: 0.85, control: 1 },
};

const tacticAttributeWeights: Record<TacticArchetype, Omit<PlayerAttributes, "gk">> = {
  gegenpress: { pac: 1.8, tec: 1.2, phy: 1.6, men: 1.4, def: 0.9, atk: 1.1 },
  possession: { pac: 0.9, tec: 1.8, phy: 0.8, men: 1.6, def: 1, atk: 1 },
  tikiTaka: { pac: 1.1, tec: 2, phy: 0.7, men: 1.7, def: 0.8, atk: 1 },
  counter: { pac: 2, tec: 0.8, phy: 1, men: 1.2, def: 0.5, atk: 1.8 },
  longBall: { pac: 1.2, tec: 0.7, phy: 1.8, men: 1, def: 0.8, atk: 1.6 },
  parkBus: { pac: 0.7, tec: 0.7, phy: 1.5, men: 1.3, def: 2, atk: 0.4 },
  highAttack: { pac: 1.5, tec: 1.2, phy: 1, men: 1.1, def: 0.45, atk: 2 },
  control: { pac: 1, tec: 1.5, phy: 1, men: 1.6, def: 1.2, atk: 1.2 },
};

const positionAttributeWeights: Record<Player["position"], Omit<PlayerAttributes, "gk">> = {
  GK: { pac: 0.5, tec: 0.8, phy: 1, men: 1.2, def: 1.8, atk: 0.2 },
  DEF: { pac: 1.05, tec: 0.9, phy: 1.3, men: 1.15, def: 1.75, atk: 0.55 },
  MID: { pac: 1.1, tec: 1.4, phy: 1, men: 1.4, def: 1.1, atk: 1 },
  FWD: { pac: 1.45, tec: 1.2, phy: 1.1, men: 1.05, def: 0.35, atk: 1.8 },
};

const BASE_XG_RATE = 1.3;
const HOME_ADVANTAGE_BONUS = 0.08;

function planFor(team: SimTeam): TacticalPlan {
  return team.tacticalPlan ?? tacticDefinitions[team.tactic].plan;
}

function shapeFromPlan(plan: TacticalPlan) {
  return {
    attack: 0.76 + plan.mentality / 250 + plan.attackingWidth / 650 + plan.tempo / 600,
    defense: 1.18 - plan.mentality / 360 + (100 - plan.defensiveLine) / 450 + (100 - plan.tempo) / 900,
    control: 0.72 + (100 - plan.passingDirectness) / 250 + (100 - Math.abs(52 - plan.tempo)) / 550,
    transition: 0.68 + plan.buildUpSpeed / 250 + plan.passingDirectness / 330 + plan.counterPress / 650,
    press: 0.72 + plan.pressIntensity / 260 + plan.counterPress / 420 + plan.defensiveLine / 700,
    tempo: 0.78 + plan.tempo / 285,
  };
}

function tacticMatchup(teamPlan: TacticalPlan, opponentPlan: TacticalPlan): number {
  const highPressTrap = teamPlan.pressIntensity > 72 && opponentPlan.buildUpSpeed < 45 ? 0.07 : 0;
  const pressBypassed = teamPlan.pressIntensity > 76 && opponentPlan.passingDirectness > 72 ? -0.06 : 0;
  const counterSpace = teamPlan.passingDirectness > 68 && opponentPlan.defensiveLine > 66 ? 0.09 : 0;
  const lowBlockVsAttack = teamPlan.defensiveLine < 32 && opponentPlan.mentality > 68 ? 0.05 : 0;
  const sterilePossession = teamPlan.passingDirectness < 30 && opponentPlan.defensiveLine < 34 ? -0.05 : 0;
  const widthVsNarrowBlock = teamPlan.attackingWidth > 72 && opponentPlan.defensiveLine < 42 ? 0.04 : 0;

  return highPressTrap + pressBypassed + counterSpace + lowBlockVsAttack + sterilePossession + widthVsNarrowBlock;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toFmScale(value: number | undefined, fallback: number): number {
  const source = Number.isFinite(value) ? value! : fallback;
  return clamp((source / 100) * 20, 1, 20);
}

function playerAttributes(player: Player): PlayerAttributes {
  const pac = toFmScale(player.pace, player.overall);
  const shooting = toFmScale(player.shooting, player.overall);
  const passing = toFmScale(player.passing, player.overall);
  const dribbling = toFmScale(player.dribbling, player.overall);
  const defending = toFmScale(player.defending, player.position === "FWD" ? player.overall - 15 : player.overall);
  const physic = toFmScale(player.physic, player.overall);
  const goalkeeping = toFmScale(player.goalkeeping, player.position === "GK" ? player.overall : player.overall - 32);
  const ageCurve = clamp(1 - Math.abs(player.age - 27) / 32, 0.72, 1);
  const men = clamp((player.overall / 100) * 15 + passing * 0.22 + ageCurve * 2.2, 1, 20);

  return {
    pac,
    tec: clamp((passing + shooting + dribbling) / 3, 1, 20),
    phy: physic,
    men,
    def: player.position === "GK" ? clamp((goalkeeping + men) / 2, 1, 20) : defending,
    atk: clamp((shooting * 0.52 + dribbling * 0.22 + pac * 0.18 + physic * 0.08), 1, 20),
    gk: goalkeeping,
  };
}

function tacticArchetype(team: SimTeam): TacticArchetype {
  if (team.tactic === "gegenpress" || team.tactic === "highPress") return "gegenpress";
  if (team.tactic === "tikiTaka") return "tikiTaka";
  if (team.tactic === "counter") return "counter";
  if (team.tactic === "directPlay" || team.tactic === "wingPlay") return "longBall";
  if (team.tactic === "lowBlock" || team.tactic === "defensive") return "parkBus";
  if (team.tactic === "attacking") return "highAttack";
  return "control";
}

function playerWeightedOverall(player: Player): number {
  const attrs = playerAttributes(player);
  const weights = positionAttributeWeights[player.position];
  const score =
    attrs.pac * weights.pac +
    attrs.tec * weights.tec +
    attrs.men * weights.men +
    attrs.phy * weights.phy +
    attrs.atk * weights.atk +
    attrs.def * weights.def;
  const maxScore = Object.values(weights).reduce((sum, weight) => sum + weight, 0) * 20;
  return (score / maxScore) * 100;
}

function fitMultiplier(score: number): number {
  if (score >= 85) return 1.15;
  if (score >= 70) return 1.08;
  if (score >= 55) return 1;
  if (score >= 40) return 0.95;
  return 0.88;
}

function average(players: Player[]): number {
  if (players.length === 0) return 65;
  return players.reduce((sum, player) => sum + playerWeightedOverall(player), 0) / players.length;
}

function stat(player: Player, key: keyof Player, fallbackOffset = 0): number {
  const value = player[key];
  return typeof value === "number" && Number.isFinite(value) ? value : player.overall + fallbackOffset;
}

function countPositions(players: Player[]): TeamProfile["counts"] {
  return players.reduce<TeamProfile["counts"]>(
    (counts, player) => {
      counts[player.position] += 1;
      return counts;
    },
    { GK: 0, DEF: 0, MID: 0, FWD: 0 },
  );
}

function weighted(players: Player[], side: "attack" | "defense" | "control" | "transition" | "goalkeeping"): number {
  const values = players.map((player) => {
    if (side === "attack") {
      const value = stat(player, "shooting") * 0.45 + stat(player, "dribbling") * 0.25 + stat(player, "pace") * 0.2 + player.overall * 0.1;
      const weight = player.position === "FWD" ? 1.45 : player.position === "MID" ? 1.1 : player.position === "DEF" ? 0.7 : 0.25;
      return { value, weight };
    }

    if (side === "defense") {
      const value = stat(player, "defending") * 0.5 + stat(player, "physic") * 0.2 + player.overall * 0.3;
      const weight = player.position === "GK" ? 1.15 : player.position === "DEF" ? 1.35 : player.position === "MID" ? 0.9 : 0.45;
      return { value, weight };
    }

    if (side === "control") {
      const value = stat(player, "passing") * 0.45 + stat(player, "dribbling") * 0.3 + player.overall * 0.25;
      const weight = player.position === "MID" ? 1.35 : player.position === "FWD" ? 0.85 : player.position === "DEF" ? 0.8 : 0.35;
      return { value, weight };
    }

    if (side === "transition") {
      const value = stat(player, "pace") * 0.4 + stat(player, "physic") * 0.22 + stat(player, "passing") * 0.18 + player.overall * 0.2;
      const weight = player.position === "FWD" ? 1.2 : player.position === "MID" ? 1.1 : player.position === "DEF" ? 0.9 : 0.35;
      return { value, weight };
    }

    const value = stat(player, "goalkeeping", player.position === "GK" ? 0 : -25);
    const weight = player.position === "GK" ? 3 : 0.04;
    return { value, weight };
  });

  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
  return values.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
}

function positionAverage(players: Player[], position: Player["position"], selector: (attrs: PlayerAttributes) => number): number {
  const selected = players.filter((player) => player.position === position);
  const pool = selected.length ? selected : players;
  if (!pool.length) return 12;
  return pool.reduce((sum, player) => sum + selector(playerAttributes(player)), 0) / pool.length;
}

function teamFitScore(players: Player[], archetype: TacticArchetype): number {
  const weights = tacticAttributeWeights[archetype];
  const playerFit = (player: Player) => {
    const attrs = playerAttributes(player);
    const score =
      attrs.pac * weights.pac +
      attrs.tec * weights.tec +
      attrs.men * weights.men +
      attrs.phy * weights.phy +
      attrs.atk * weights.atk +
      attrs.def * weights.def;
    const maxScore = Object.values(weights).reduce((sum, weight) => sum + weight, 0) * 20;
    return (score / maxScore) * 100;
  };
  const byPosition = (position: Player["position"]) => {
    const selected = players.filter((player) => player.position === position);
    const pool = selected.length ? selected : players;
    return pool.reduce((sum, player) => sum + playerFit(player), 0) / Math.max(1, pool.length);
  };

  return (byPosition("GK") * 0.8 + byPosition("DEF") * 1 + byPosition("MID") * 1.3 + byPosition("FWD") * 1.2) / 4.3;
}

function teamStrengths(players: Player[]) {
  const midAtk = positionAverage(players, "MID", (attrs) => attrs.atk);
  const fwdAtk = positionAverage(players, "FWD", (attrs) => attrs.atk);
  const fwdPac = positionAverage(players, "FWD", (attrs) => attrs.pac);
  const gkOverall = positionAverage(players, "GK", (attrs) => attrs.gk * 5);
  const defDef = positionAverage(players, "DEF", (attrs) => attrs.def);
  const defPhy = positionAverage(players, "DEF", (attrs) => attrs.phy);
  const midDef = positionAverage(players, "MID", (attrs) => attrs.def);

  return {
    attackStrength: (midAtk * 1.1 + fwdAtk * 1.5 + fwdPac * 0.8) / 3.4,
    defenseStrength: ((gkOverall / 5) * 1.2 + defDef * 1.5 + defPhy * 0.8 + midDef * 0.7) / 4.2,
  };
}

function tacticFit(players: Player[], tactic: Tactic, plan: TacticalPlan, profileBase?: Partial<TeamProfile>): number {
  const baseScore = teamFitScore(players, tacticArchetype({ country: "", lineup: players, tactic, tacticalPlan: plan }));
  const counts = profileBase?.counts ?? countPositions(players);
  const shapePenalty =
    plan.pressIntensity > 76 && counts.MID < 3
      ? -4
      : plan.defensiveLine < 28 && counts.DEF < 4
        ? -5
        : plan.attackingWidth > 76 && counts.FWD < 2
          ? -3
          : 0;

  return fitMultiplier(clamp(baseScore + shapePenalty, 0, 100));
}

function buildProfile(team: SimTeam): TeamProfile {
  const plan = planFor(team);
  const archetype = tacticArchetype(team);
  const counts = countPositions(team.lineup);
  const attack = weighted(team.lineup, "attack");
  const defense = weighted(team.lineup, "defense");
  const control = weighted(team.lineup, "control");
  const transition = weighted(team.lineup, "transition");
  const goalkeeping = weighted(team.lineup, "goalkeeping");
  const overall = average(team.lineup);
  const fitScore = teamFitScore(team.lineup, archetype);
  const strengths = teamStrengths(team.lineup);
  const fit = tacticFit(team.lineup, team.tactic, plan, { attack, defense, control, transition, goalkeeping, counts });

  return {
    overall,
    attack,
    defense,
    control,
    transition,
    goalkeeping,
    attackStrength: strengths.attackStrength,
    defenseStrength: strengths.defenseStrength,
    fitScore,
    fitMultiplier: fit,
    tacticFit: fit,
    power:
      overall * 0.26 +
      attack * 0.14 +
      defense * 0.14 +
      control * 0.1 +
      transition * 0.08 +
      goalkeeping * 0.08 +
      strengths.attackStrength * 2.5 +
      strengths.defenseStrength * 2.5,
    counts,
  };
}

function expectedGoals(team: SimTeam, opponent: SimTeam, teamProfile: TeamProfile, opponentProfile: TeamProfile, isHome = false): number {
  const teamPlan = planFor(team);
  const opponentPlan = planFor(opponent);
  const teamShape = shapeFromPlan(teamPlan);
  const opponentShape = shapeFromPlan(opponentPlan);
  const matrixMultiplier = tacticMatrix[tacticArchetype(team)][tacticArchetype(opponent)];
  const microMatchup = 1 + tacticMatchup(teamPlan, opponentPlan);
  const attackStrength = teamProfile.attackStrength * teamShape.attack * (isHome ? 1 + HOME_ADVANTAGE_BONUS : 1);
  const defenseStrength = opponentProfile.defenseStrength * opponentShape.defense * (isHome ? 1 : 1 + HOME_ADVANTAGE_BONUS * 0.5);
  const chanceRate = clamp((attackStrength / Math.max(4, defenseStrength)) * matrixMultiplier * microMatchup * teamProfile.fitMultiplier, 0.3, 3);
  const tempoAdjustment = clamp((teamShape.tempo + opponentShape.tempo) / 2, 0.78, 1.26);
  const qualityAdjustment = clamp(1 + (teamProfile.power - opponentProfile.power) / 180, 0.82, 1.18);
  const takers = resolveSetPieceTakers(team.lineup, team.setPieceTakers);
  const setPieceBoost = clamp(
    1 +
      ((takers.penalty ? penaltySkill(takers.penalty) - 70 : 0) / 1400) +
      ((takers.freeKick ? freeKickSkill(takers.freeKick) - 70 : 0) / 1200),
    0.96,
    1.1,
  );
  const underdogBrake = teamProfile.overall + 14 < opponentProfile.overall ? 0.9 : 1;

  return clamp(BASE_XG_RATE * chanceRate * tempoAdjustment * qualityAdjustment * setPieceBoost * underdogBrake, 0.25, 3.5);
}

function poisson(lambda: number): number {
  const limit = Math.exp(-lambda);
  let product = 1;
  let value = 0;

  do {
    value += 1;
    product *= Math.random();
  } while (product > limit);

  return value - 1;
}

function applyGoalVariance(goals: number, xg: number): number {
  const variance = 1 + (Math.random() - 0.5) * 0.22;
  const adjusted = Math.round(goals * variance);
  return clamp(adjusted, 0, Math.max(1, Math.ceil(xg + 3)));
}

function pickPlayer(team: SimTeam, mode: "scorer" | "creator" | "defender"): Player {
  const candidates = team.lineup.flatMap((player) => {
    if (mode === "scorer") {
      const repeats = player.position === "FWD" ? 7 : player.position === "MID" ? 4 : player.position === "DEF" ? 1 : 0;
      return Array.from({ length: repeats }, () => player);
    }
    if (mode === "creator") {
      const repeats = player.position === "MID" ? 6 : player.position === "FWD" ? 3 : player.position === "DEF" ? 2 : 0;
      return Array.from({ length: repeats }, () => player);
    }
    const repeats = player.position === "GK" ? 4 : player.position === "DEF" ? 6 : player.position === "MID" ? 2 : 1;
    return Array.from({ length: repeats }, () => player);
  });

  return candidates[Math.floor(Math.random() * candidates.length)] ?? team.lineup[0];
}

function pickGoalkeeper(team: SimTeam): Player {
  return team.lineup.find((player) => player.position === "GK") ?? pickPlayer(team, "defender");
}

function weightedPick(players: Player[], score: (player: Player) => number): Player {
  const weighted = players.map((player) => ({ player, weight: Math.max(1, score(player)) }));
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) return item.player;
  }
  return players[0];
}

function pickCornerTarget(team: SimTeam): Player {
  const candidates = team.lineup.filter((player) => player.position === "DEF" || player.position === "MID");
  const pool = candidates.length ? candidates : team.lineup;
  return weightedPick(pool, (player) => stat(player, "physic") * 0.42 + stat(player, "defending") * 0.25 + player.overall * 0.33);
}

function pickLongShotTaker(team: SimTeam): Player {
  const candidates = team.lineup.filter((player) => player.position === "MID" || player.position === "FWD");
  const pool = candidates.length ? candidates : team.lineup;
  return weightedPick(pool, (player) => stat(player, "shooting") * 0.56 + stat(player, "dribbling") * 0.18 + player.overall * 0.26);
}

function scoreProbabilities(homePower: number, awayPower: number, homeXg: number, awayXg: number) {
  const delta = clamp((homePower - awayPower) / 11 + (homeXg - awayXg) / 2.2, -2.2, 2.2);
  const home = 1 / (1 + Math.exp(-delta));
  const draw = clamp(0.29 - Math.abs(delta) * 0.055, 0.12, 0.31);
  const remaining = 1 - draw;
  return {
    home: clamp(home * remaining, 0.03, 0.92),
    away: clamp((1 - home) * remaining, 0.03, 0.92),
    draw,
  };
}

function goalMinutes(totalGoals: number): number[] {
  return Array.from({ length: totalGoals }, () => 2 + Math.floor(Math.random() * 88)).sort((a, b) => a - b);
}

function pickOne<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function tacticLabel(team: SimTeam): string {
  return tacticDefinitions[team.tactic].label.toLowerCase();
}

function planIntent(team: SimTeam): string {
  const plan = planFor(team);
  if (plan.pressIntensity > 72 && plan.defensiveLine > 62) return "önde baskıyla rakibi hataya zorluyor";
  if (plan.defensiveLine < 34 && plan.passingDirectness > 62) return "blok halinde bekleyip çıkış pasını arıyor";
  if (plan.passingDirectness < 34 && plan.tempo < 58) return "topa sabırla sahip olup oyunun ritmini düşürüyor";
  if (plan.attackingWidth > 70) return "kenarları genişletip savunmayı yana çekmeye çalışıyor";
  if (plan.buildUpSpeed > 70) return "kazandığı topları hızla üçüncü bölgeye taşıyor";
  return "dengeli yerleşimle riskleri tartarak ilerliyor";
}

function scoreLineText(home: SimTeam, away: SimTeam, homeScore: number, awayScore: number): string {
  if (homeScore === awayScore) return `${home.country} ${homeScore} - ${awayScore} ${away.country}, denge bozulmadı`;
  const leader = homeScore > awayScore ? home : away;
  const leadScore = homeScore > awayScore ? homeScore : awayScore;
  const trailScore = homeScore > awayScore ? awayScore : homeScore;
  return `${leader.country} ${leadScore}-${trailScore} önde`;
}

function goalPattern(team: SimTeam, creator: Player, scorer: Player): string {
  const plan = planFor(team);
  const patterns = [
    `${creator.name} yarım alanda yüzünü kaleye döndü ve savunma çizgisinin arkasına ince bir pas bıraktı`,
    `${creator.name} baskıdan çıkıp topu ters kanada çevirdi; ${team.country} ceza sahasına kalabalık geliyor`,
    `${team.country} ikinci topları topladı, ${creator.name} bekletmeden son pası düşündü`,
  ];

  if (plan.passingDirectness > 68) {
    patterns.push(`${creator.name} savunma arkasına erken oynadı; ${scorer.name} zamanlamayı çok iyi ayarladı`);
  }
  if (plan.pressIntensity > 70) {
    patterns.push(`${team.country} ön alanda topu kaptı, ${creator.name} hiç bekletmeden dikine oynadı`);
  }
  if (plan.attackingWidth > 70) {
    patterns.push(`${creator.name} çizgiye indi, yerden sert çevirdi; ${scorer.name} penaltı noktası civarında`);
  }
  if (plan.passingDirectness < 35) {
    patterns.push(`${team.country} sabırlı paslaşmayla bloğu çekti, ${creator.name} boşluğu görünce ara pasını attı`);
  }

  return pickOne(patterns);
}

function chancePattern(team: SimTeam, actor: Player): string {
  const plan = planFor(team);
  const patterns = [
    `${team.country} merkezde kısa paslarla ritim buldu, ${actor.name} ceza yayı çevresinde topu önüne aldı`,
    `${actor.name} iki oyuncunun arasından sıyrıldı, savunma bir an dengesini kaybetti`,
    `${team.country} taç çizgisine yakın bölgede üçgeni kurdu, ${actor.name} içeriye kat ediyor`,
    `${team.country} korner sonrası seken topu topladı, ${actor.name} ceza sahası çevresinde ikinci şansı hazırlıyor`,
    `${actor.name} uzak mesafede başını kaldırdı; kaleci bir adım önde yakalanmış olabilir`,
    `${team.country} arka direkte eşleşmeyi buldu, ${actor.name} savunmanın arasına doğru sızıyor`,
  ];

  if (plan.buildUpSpeed > 68) patterns.push(`${team.country} geçişi çok hızlı oynadı, ${actor.name} savunma yerleşmeden kaleyi gördü`);
  if (plan.pressIntensity > 72) patterns.push(`${actor.name} pres sonrası kazanılan topu aldı; rakip savunma eksik yakalandı`);
  if (plan.defensiveLine < 36) patterns.push(`${team.country} uzun süre beklediği kontra alanını buldu, ${actor.name} boş koridora koştu`);
  if (plan.attackingWidth > 70) patterns.push(`${team.country} kanadı genişletti, ${actor.name} arka direğe doğru hareketlendi`);
  if (plan.passingDirectness > 66) patterns.push(`${team.country} erken ortayla savunmayı geriye koşturdu, ${actor.name} ceza sahasında temas anını bekliyor`);

  return pickOne(patterns);
}

function chanceOutcome(type: "save" | "miss" | "post", actor: Player, defender: Player, team: SimTeam, opponent: SimTeam): string {
  if (type === "save") {
    if (defender.position === "GK") {
      const gkQuality = stat(defender, "goalkeeping", 0);
      if (gkQuality >= 82 && Math.random() > 0.32) {
        return pickOne([
          `${actor.name} topu çatala gönderdi, ${defender.name} inanılmaz bir refleksle parmaklarının ucuyla çıkardı.`,
          `${actor.name} yakın mesafeden vurdu, ${defender.name} çizgi üzerinde büyüdü ve mutlak golü engelledi.`,
          `${actor.name} doksana doğru sert vurdu, ${defender.name} ters ayakta yakalanmasına rağmen uçarak topu kornere tokatladı.`,
          `${actor.name} kalabalığın arasından köşeyi buldu, ${defender.name} son anda uzanıp tribünleri ayağa kaldıran bir kurtarış yaptı.`,
        ]);
      }
      return pickOne([
        `${actor.name} sert vurdu, ${defender.name} refleksle uzandı ve topu kornere çeldi.`,
        `${actor.name} yakın köşeyi denedi, ${defender.name} doğru adımı atıp topu çıkardı.`,
        `${actor.name} kaleciyle karşı karşıya kaldı ama ${defender.name} açıyı mükemmel kapattı.`,
      ]);
    }

    return pickOne([
      `${actor.name} sert vurdu, ${defender.name} vücudunu topun önüne koyup şutu blokladı.`,
      `${actor.name} yakın köşeyi denedi, ${opponent.country} savunması son anda kapanıp şutu engelledi.`,
      `${actor.name} kaleyi gördü, ${defender.name} zamanında kayarak şut kanalını kapattı.`,
    ]);
  }

  if (type === "post") {
    return pickOne([
      `${actor.name} çok temiz vurdu, top direkten oyun alanına geri döndü.`,
      `${team.country} gole çok yaklaştı; ${actor.name} köşeyi buldu ama direk izin vermedi.`,
      `${actor.name} kaleciyi geçti, top yan direğe çarpıp dışarı sekti.`,
      `${actor.name} ceza sahası dışından doksana doğru gönderdi, top üst direkten patlayıp geri geldi.`,
      `${actor.name} kornerde iyi yükseldi, kafa vuruşu direğin içinden dönmedi.`,
    ]);
  }

  return pickOne([
    `${actor.name} vuruşu aceleye getirdi; top direğin dibinden dışarı çıktı.`,
    `${team.country} net fırsatı buldu ama ${actor.name} topun altına fazla girdi.`,
    `${actor.name} plaseyi düşündü, top az farkla auta gitti. Tribünlerden derin bir nefes sesi yükseldi.`,
    `${actor.name} serbest vuruşta falsayı iyi verdi ama top yan ağlarda kaldı.`,
    `${actor.name} uzaktan çok sert vurdu, top üstten az farkla dışarı çıktı.`,
    `${actor.name} kornerde kafayı vurdu, top kalabalığın arasından sıyrılıp auta gitti.`,
  ]);
}

function tacticalObservation(home: SimTeam, away: SimTeam, homeProfile: TeamProfile, awayProfile: TeamProfile, minute: number): MatchEvent {
  const stronger = homeProfile.control >= awayProfile.control ? home : away;
  const weaker = stronger.country === home.country ? away : home;
  const text = pickOne([
    `${minute}'. ${stronger.country} orta sahada pas açılarını iyi kapatıyor; ${weaker.country} çıkarken ikinci pası bulmakta zorlanıyor.`,
    `${minute}'. ${stronger.country} ${planIntent(stronger)}. ${weaker.country} savunma mesafesini korumaya çalışıyor.`,
    `${minute}'. Oyun temposu kısa süreliğine düştü. ${home.country} ${tacticLabel(home)}, ${away.country} ${tacticLabel(away)} planından vazgeçmiyor.`,
    `${minute}'. Teknik alan hareketli; iki takım da pres tetikleyicilerini ve beklerin konumunu sürekli ayarlıyor.`,
  ]);

  return { minute, type: "analysis", text, team: stronger.country };
}

function setPieceConversionChance(player: Player | undefined, kind: "penalty" | "freeKick"): number {
  if (!player) return kind === "penalty" ? 0.66 : 0.08;
  const skill = kind === "penalty" ? penaltySkill(player) : freeKickSkill(player);
  return kind === "penalty" ? clamp(0.58 + skill / 260, 0.62, 0.92) : clamp(0.04 + skill / 520, 0.08, 0.24);
}

type GoalKind = "open-play" | "penalty" | "freeKick" | "cornerHeader" | "longShot";

function setPieceGoalKind(team: SimTeam): GoalKind {
  const takers = resolveSetPieceTakers(team.lineup, team.setPieceTakers);
  const penaltyBias = takers.penalty ? clamp((penaltySkill(takers.penalty) - 66) / 260, 0.02, 0.12) : 0.04;
  const freeKickBias = takers.freeKick ? clamp((freeKickSkill(takers.freeKick) - 66) / 360, 0.015, 0.09) : 0.03;
  const roll = Math.random();
  if (roll < penaltyBias) return "penalty";
  if (roll < penaltyBias + freeKickBias) return "freeKick";
  return "open-play";
}

function attackingGoalKind(team: SimTeam): GoalKind {
  const setPieceKind = setPieceGoalKind(team);
  if (setPieceKind !== "open-play") return setPieceKind;

  const plan = planFor(team);
  const cornerTarget = pickCornerTarget(team);
  const longShotTaker = pickLongShotTaker(team);
  const cornerBias = clamp(
    0.05 + (stat(cornerTarget, "physic") - 70) / 700 + (plan.attackingWidth - 50) / 1000,
    0.035,
    0.16,
  );
  const longShotBias = clamp(
    0.05 + (stat(longShotTaker, "shooting") - 70) / 650 + (plan.passingDirectness - 50) / 1150,
    0.035,
    0.17,
  );
  const roll = Math.random();
  if (roll < cornerBias) return "cornerHeader";
  if (roll < cornerBias + longShotBias) return "longShot";
  return "open-play";
}

function addSetPieceChance(events: MatchEvent[], team: SimTeam, opponent: SimTeam, minute: number, kind: "penalty" | "freeKick") {
  const takers = resolveSetPieceTakers(team.lineup, team.setPieceTakers);
  const taker = kind === "penalty" ? takers.penalty : takers.freeKick;
  if (!taker) return;
  const goalkeeper = pickGoalkeeper(opponent);
  const conversion = setPieceConversionChance(taker, kind);
  const post = Math.random() > 0.86;
  const saved = !post && Math.random() < conversion * 0.45;

  events.push({
    minute,
    type: kind === "penalty" ? "penalty" : "free-kick",
    text:
      kind === "penalty"
        ? `${minute}'. Penaltı! Topun başında ${taker.name}. Bitiricilik ve soğukkanlılık burada belirleyici olacak.`
        : `${minute}'. Ceza sahası yayı çevresinde tehlikeli serbest vuruş. ${taker.name} topun başına geçti; falso ve isabet kaleyi tehdit ediyor.`,
    team: team.country,
    suspense: true,
    whistle: true,
  });

  events.push({
    minute,
    type: post ? "post" : saved ? "save" : "miss",
    text: post
        ? `${taker.name} çok iyi vurdu, top direkten oyun alanına döndü.`
        : saved
          ? kind === "penalty"
            ? `${taker.name} penaltıda köşeyi düşündü ama ${goalkeeper.name} doğru tahminle gole izin vermedi.`
            : `${taker.name} barajın üstünden iyi kesti, ${goalkeeper.name} uzanıp topu çıkardı.`
          : kind === "penalty"
          ? `${taker.name} penaltıda köşeyi fazla aradı, top direğin yanından dışarı gitti.`
          : `${taker.name} falsolu vurdu, top az farkla dışarı çıktı.`,
    team: team.country,
    whistle: false,
  });
}

function createNarrative(
  home: SimTeam,
  away: SimTeam,
  homeProfile: TeamProfile,
  awayProfile: TeamProfile,
  homeScore: number,
  awayScore: number,
  decidedByPenalties?: string,
): { events: MatchEvent[]; goals: MatchResult["goals"] } {
  const events: MatchEvent[] = [
    {
      minute: 0,
      type: "kickoff",
      text: `Hakem düdüğü çaldı. ${home.country} ${tacticDefinitions[home.tactic].label} planıyla ${planIntent(home)}; ${away.country} ise ${tacticDefinitions[away.tactic].label} düzeninde ${planIntent(away)}.`,
      whistle: true,
    },
    {
      minute: 1,
      type: "analysis",
      text: `Maç önü tablo: güç dengesi ${home.country} ${Math.round(homeProfile.power)} - ${away.country} ${Math.round(awayProfile.power)}. Taktik uyumu ${Math.round(homeProfile.tacticFit * 100)} / ${Math.round(awayProfile.tacticFit * 100)}; bu fark özellikle orta saha yerleşiminde hissedilebilir.`,
    },
  ];
  const goals: MatchResult["goals"] = [];
  const homeGoalMinutes = goalMinutes(homeScore);
  const awayGoalMinutes = goalMinutes(awayScore);
  const halfHomeScore = homeGoalMinutes.filter((minute) => minute <= 45).length;
  const halfAwayScore = awayGoalMinutes.filter((minute) => minute <= 45).length;

  const addGoalSequence = (team: SimTeam, minute: number) => {
    const takers = resolveSetPieceTakers(team.lineup, team.setPieceTakers);
    const goalKind = attackingGoalKind(team);
    if (goalKind === "penalty" && takers.penalty) {
      const scorer = takers.penalty;
      events.push({
        minute,
        type: "penalty",
        text: `${minute}'. Penaltı! ${scorer.name} topun başında. Penaltı becerisi yüksek oyuncular bu baskı anında fark yaratır... Gol olacak mı?`,
        team: team.country,
        suspense: true,
        whistle: true,
      });
      events.push({
        minute,
        type: "goal",
        text: `GOL! ${scorer.name} penaltıyı net kullandı. ${team.country} duran top görev dağılımının karşılığını aldı.`,
        team: team.country,
        scorer: scorer.name,
        whistle: true,
      });
      goals.push({ minute, scorer: scorer.name, team: team.country });
      return;
    }

    if (goalKind === "freeKick" && takers.freeKick) {
      const scorer = takers.freeKick;
      events.push({
        minute,
        type: "free-kick",
        text: `${minute}'. Tehlikeli serbest vuruş. ${scorer.name} topun başına geçti; falso, isabet ve vuruş kalitesi burada belirleyici... Gol olacak mı?`,
        team: team.country,
        suspense: true,
        whistle: true,
      });
      events.push({
        minute,
        type: "goal",
        text: `GOL! ${scorer.name} barajın üstünden müthiş kesti, top köşeden ağlara gitti.`,
        team: team.country,
        scorer: scorer.name,
        whistle: true,
      });
      goals.push({ minute, scorer: scorer.name, team: team.country });
      return;
    }

    if (goalKind === "cornerHeader") {
      const scorer = pickCornerTarget(team);
      const creator = pickPlayer(team, "creator");
      events.push({
        minute,
        type: "chance",
        text: `${minute}'. Korner bayrağının orada ${creator.name} topun başında. ${team.country} ceza sahasına uzun oyuncularını gönderdi; ${scorer.name} markajdan sıyrılmaya çalışıyor... Gol olacak mı?`,
        team: team.country,
        suspense: true,
        whistle: true,
      });
      events.push({
        minute,
        type: "goal",
        text: `GOL! ${scorer.name} kornerde çok iyi yükseldi ve kafayı köşeye bıraktı. Savunma oyuncusundan tam bir duran top golü.`,
        team: team.country,
        scorer: scorer.name,
        whistle: true,
      });
      goals.push({ minute, scorer: scorer.name, team: team.country });
      return;
    }

    if (goalKind === "longShot") {
      const scorer = pickLongShotTaker(team);
      events.push({
        minute,
        type: "chance",
        text: `${minute}'. ${scorer.name} ceza yayı gerisinde topu önüne aldı. Savunma bir adım geç çıktı; uzak köşe tamamen açık görünüyor... Gol olacak mı?`,
        team: team.country,
        suspense: true,
      });
      events.push({
        minute,
        type: "goal",
        text: `GOL! ${scorer.name} uzaktan mükemmel vurdu, top doksana takıldı. Kalecinin uzanışı sadece fotoğrafta kaldı.`,
        team: team.country,
        scorer: scorer.name,
        whistle: true,
      });
      goals.push({ minute, scorer: scorer.name, team: team.country });
      return;
    }

    const creator = pickPlayer(team, "creator");
    const scorer = pickPlayer(team, "scorer");
    events.push({
      minute,
      type: "chance",
      text: `${minute}'. ${goalPattern(team, creator, scorer)}... ${scorer.name} hareketlendi. Gol olacak mı?`,
      team: team.country,
      suspense: true,
    });
    events.push({
      minute,
      type: "goal",
      text: `GOL! ${scorer.name} soğukkanlı bitirdi. ${team.country} planladığı hücum prensibini tabelaya çevirdi.`,
      team: team.country,
      scorer: scorer.name,
      whistle: true,
    });
    goals.push({ minute, scorer: scorer.name, team: team.country });
  };

  homeGoalMinutes.forEach((minute) => addGoalSequence(home, minute));
  awayGoalMinutes.forEach((minute) => addGoalSequence(away, minute));

  const observationMinutes = [9, 23, 39, 53, 67, 82];
  observationMinutes.forEach((minute) => {
    if (Math.random() > 0.72) return;
    events.push(tacticalObservation(home, away, homeProfile, awayProfile, minute));
  });

  [
    { minute: 27 + Math.floor(Math.random() * 8), team: home, opponent: away },
    { minute: 63 + Math.floor(Math.random() * 12), team: away, opponent: home },
  ].forEach(({ minute, team, opponent }) => {
    const pressure = team.country === home.country ? homeProfile.attack - awayProfile.defense : awayProfile.attack - homeProfile.defense;
    const freeKickChance = clamp(0.1 + pressure / 260 + freeKickSkill(resolveSetPieceTakers(team.lineup, team.setPieceTakers).freeKick ?? team.lineup[0]) / 820, 0.12, 0.28);
    const penaltyChance = clamp(0.018 + pressure / 1200 + penaltySkill(resolveSetPieceTakers(team.lineup, team.setPieceTakers).penalty ?? team.lineup[0]) / 3200, 0.018, 0.06);
    const roll = Math.random();
    if (roll < penaltyChance) addSetPieceChance(events, team, opponent, minute, "penalty");
    else if (roll < penaltyChance + freeKickChance) addSetPieceChance(events, team, opponent, minute, "freeKick");
  });

  const chanceCount = 8 + Math.floor((homeProfile.attack + awayProfile.attack - 140) / 10) + Math.floor(Math.random() * 4);
  for (let index = 0; index < chanceCount; index += 1) {
    const minute = 4 + Math.floor(Math.random() * 84);
    if (homeGoalMinutes.includes(minute) || awayGoalMinutes.includes(minute)) continue;
    const homePressure = Math.max(1, homeProfile.attack + homeProfile.control * 0.35 - awayProfile.defense * 0.38);
    const awayPressure = Math.max(1, awayProfile.attack + awayProfile.control * 0.35 - homeProfile.defense * 0.38);
    const team = Math.random() < clamp(homePressure / (homePressure + awayPressure), 0.35, 0.65) ? home : away;
    const opponent = team.country === home.country ? away : home;
    const actor = pickPlayer(team, "creator");
    const roll = Math.random();
    const type = roll > 0.94 ? "post" : roll > 0.5 ? "save" : "miss";
    const defender = type === "save" && Math.random() > 0.38 ? pickGoalkeeper(opponent) : pickPlayer(opponent, "defender");
    events.push({
      minute,
      type: "chance",
      text: `${minute}'. ${chancePattern(team, actor)}... Gol olacak mı?`,
      team: team.country,
      suspense: Math.random() > 0.35,
    });
    events.push({
      minute,
      type,
      text: chanceOutcome(type, actor, defender, team, opponent),
      team: team.country,
    });
  }

  [17, 34, 58, 76].forEach((baseMinute) => {
    if (Math.random() > 0.62) return;
    const minute = baseMinute + Math.floor(Math.random() * 4);
    const foulingTeam = Math.random() > 0.5 ? home : away;
    const foulPlan = planFor(foulingTeam);
    const cardRoll = Math.random() + foulPlan.pressIntensity / 260 + foulPlan.counterPress / 420;
    const cardType: MatchEvent["type"] | null = cardRoll > 1.42 ? "red-card" : cardRoll > 1.02 ? "yellow-card" : null;

    events.push({
      minute,
      type: "foul",
      text: `${minute}'. ${foulingTeam.country} geçiş anını faulle kesti. Hakem avantajı oynatmadı ve düdüğünü çaldı.`,
      team: foulingTeam.country,
      whistle: true,
    });

    if (cardType) {
      events.push({
        minute,
        type: cardType,
        text:
          cardType === "red-card"
            ? `${minute}'. Çok sert müdahale. Hakem tereddüt etmeden kırmızı kartını çıkardı; ${foulingTeam.country} artık eksik.`
            : `${minute}'. Hakem uyarıyla yetinmedi, sarı kart çıktı. ${foulingTeam.country} bundan sonra temaslarda daha dikkatli olmalı.`,
        team: foulingTeam.country,
        whistle: true,
      });
    }
  });

  events.push({
    minute: 45,
    type: "half-time",
    text: `İlk yarı bitti. ${scoreLineText(home, away, halfHomeScore, halfAwayScore)}. Teknik ekiplerin ikinci yarıda pres mesafesi ve geçiş savunmasına dokunması bekleniyor.`,
    whistle: true,
  });

  if (decidedByPenalties) {
    events.push({
      minute: 120,
      type: "penalties",
      text: `Uzatmalarda denge bozulmadı. Penaltı noktasında daha sakin kalan taraf ${decidedByPenalties}; turu onlar alıyor.`,
      team: decidedByPenalties,
      whistle: true,
    });
  }

  events.push(
    decidedByPenalties
      ? {
          minute: 120,
          type: "full-time",
          text: `Seri penaltılar tamamlandı. Hakem son düdüğü çaldı; ${decidedByPenalties} baskıyı daha iyi yönetti.`,
          whistle: true,
        }
      : {
          minute: 90,
          type: "full-time",
          text: `Maç sona erdi. ${scoreLineText(home, away, homeScore, awayScore)}. Hakem son düdüğü çaldı; plan, kalite ve küçük detaylar sonucu belirledi.`,
          whistle: true,
        },
  );

  return {
    events: events.sort((a, b) => a.minute - b.minute || eventWeight(a.type) - eventWeight(b.type)),
    goals: goals.sort((a, b) => a.minute - b.minute),
  };
}

function eventWeight(type: MatchEvent["type"]): number {
  if (type === "penalty" || type === "free-kick") return 1;
  if (type === "chance") return 1;
  if (type === "goal") return 2;
  if (type === "miss" || type === "save" || type === "post") return 3;
  if (type === "foul") return 5;
  if (type === "yellow-card" || type === "red-card") return 6;
  if (type === "penalties") return 8;
  if (type === "half-time") return 8;
  if (type === "full-time") return 9;
  return 5;
}

export function simulateMatch(home: SimTeam, away: SimTeam, options: { knockout?: boolean } = {}): MatchResult {
  const homeProfile = buildProfile(home);
  const awayProfile = buildProfile(away);
  const homeXg = expectedGoals(home, away, homeProfile, awayProfile, true);
  const awayXg = expectedGoals(away, home, awayProfile, homeProfile);
  const probabilities = scoreProbabilities(homeProfile.power, awayProfile.power, homeXg, awayXg);
  let homeScore = applyGoalVariance(poisson(homeXg), homeXg);
  let awayScore = applyGoalVariance(poisson(awayXg), awayXg);
  let decidedByPenalties: string | undefined;
  let winner: string | undefined;

  const homeUnderdog = homeProfile.overall + 14 < awayProfile.overall;
  const awayUnderdog = awayProfile.overall + 14 < homeProfile.overall;

  if (homeUnderdog && homeScore > awayScore && Math.random() > 0.18) {
    homeScore = Math.max(0, awayScore - (Math.random() > 0.45 ? 0 : 1));
  }
  if (awayUnderdog && awayScore > homeScore && Math.random() > 0.18) {
    awayScore = Math.max(0, homeScore - (Math.random() > 0.45 ? 0 : 1));
  }

  if (options.knockout && homeScore === awayScore) {
    const homePenaltyEdge = homeProfile.power + homeProfile.goalkeeping * 0.2 + Math.random() * 9;
    const awayPenaltyEdge = awayProfile.power + awayProfile.goalkeeping * 0.2 + Math.random() * 9;
    decidedByPenalties = homePenaltyEdge >= awayPenaltyEdge ? home.country : away.country;
    winner = decidedByPenalties;
  } else if (homeScore !== awayScore) {
    winner = homeScore > awayScore ? home.country : away.country;
  }

  const narrative = createNarrative(home, away, homeProfile, awayProfile, homeScore, awayScore, decidedByPenalties);

  return {
    id: `${home.country}-${away.country}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    home: home.country,
    away: away.country,
    homeScore,
    awayScore,
    goals: narrative.goals,
    events: narrative.events,
    homeWinProbability: probabilities.home,
    awayWinProbability: probabilities.away,
    drawProbability: probabilities.draw,
    homeTacticFit: homeProfile.tacticFit,
    awayTacticFit: awayProfile.tacticFit,
    homePower: homeProfile.power,
    awayPower: awayProfile.power,
    winner,
    decidedByPenalties,
  };
}
