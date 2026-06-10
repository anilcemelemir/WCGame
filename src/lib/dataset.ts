import { Player, PlayerPosition, PlayerRole } from "../types";
import { samplePlayers } from "../data/samplePlayers";

export interface Fc26RawPlayer {
  id?: string | number;
  player_id?: string | number;
  Name?: string;
  name?: string;
  short_name?: string;
  long_name?: string;
  Nationality?: string;
  nationality?: string;
  nationality_name?: string;
  Club?: string;
  club?: string;
  club_name?: string;
  Overall?: string | number;
  overall?: string | number;
  Position?: string;
  position?: string;
  player_positions?: string;
  Age?: string | number;
  age?: string | number;
  pace?: string | number;
  shooting?: string | number;
  passing?: string | number;
  dribbling?: string | number;
  defending?: string | number;
  physic?: string | number;
  goalkeeping_diving?: string | number;
  goalkeeping_handling?: string | number;
  goalkeeping_kicking?: string | number;
  goalkeeping_positioning?: string | number;
  goalkeeping_reflexes?: string | number;
  skill_curve?: string | number;
  skill_fk_accuracy?: string | number;
  mentality_penalties?: string | number;
}

const positionMap: Record<PlayerRole, PlayerPosition> = {
  GK: "GK",
  CB: "DEF",
  LB: "DEF",
  RB: "DEF",
  LWB: "DEF",
  RWB: "DEF",
  CDM: "MID",
  CM: "MID",
  CAM: "MID",
  LM: "MID",
  RM: "MID",
  LW: "FWD",
  RW: "FWD",
  ST: "FWD",
  CF: "FWD",
};

function normalizeRole(value: string): PlayerRole | null {
  const role = value.trim().toUpperCase();
  return role in positionMap ? (role as PlayerRole) : null;
}

function cleanName(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value
    .replace(/[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function displayName(row: Fc26RawPlayer): string | undefined {
  return cleanName(row.short_name ?? row.Name ?? row.name ?? row.long_name);
}

const tournamentSquadShape: PlayerPosition[] = [
  "GK",
  "GK",
  "GK",
  "DEF",
  "DEF",
  "DEF",
  "DEF",
  "DEF",
  "DEF",
  "DEF",
  "DEF",
  "MID",
  "MID",
  "MID",
  "MID",
  "MID",
  "MID",
  "MID",
  "MID",
  "FWD",
  "FWD",
  "FWD",
  "FWD",
];

function hashCountry(country: string) {
  return Array.from(country).reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function fallbackRating(country: string, existingPlayers: Player[]) {
  if (existingPlayers.length) {
    const topPlayers = existingPlayers.slice(0, Math.min(existingPlayers.length, 11));
    return Math.round(topPlayers.reduce((sum, player) => sum + player.overall, 0) / topPlayers.length) - 5;
  }

  return 58 + (hashCountry(country) % 9);
}

function positionForSupplement(existingPlayers: Player[], index: number): PlayerPosition {
  const counts = existingPlayers.reduce<Record<PlayerPosition, number>>(
    (positionCounts, player) => ({ ...positionCounts, [player.position]: positionCounts[player.position] + 1 }),
    { GK: 0, DEF: 0, MID: 0, FWD: 0 },
  );
  const target = tournamentSquadShape.find((position) => counts[position] < tournamentSquadShape.filter((item) => item === position).length);
  return target ?? tournamentSquadShape[index % tournamentSquadShape.length];
}

function createSupplementalPlayer(country: string, index: number, position: PlayerPosition, baseRating: number): Player {
  const safeCountry = country.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "team";
  const primaryRole: PlayerRole = position === "GK" ? "GK" : position === "DEF" ? "CB" : position === "MID" ? "CM" : "ST";

  return {
    id: `supplemental-${safeCountry}-${index + 1}`,
    name: `${country} Kadro Oyuncusu ${index + 1}`,
    nationality: country,
    club: "Milli Havuz",
    overall: Math.max(48, Math.min(72, baseRating - Math.floor(index / 3))),
    position,
    primaryRole,
    roles: [primaryRole],
    age: 21 + (index % 13),
    curve: Math.max(42, baseRating - 4),
    freeKickAccuracy: Math.max(40, baseRating - 6),
    penalties: Math.max(44, baseRating - 3),
  };
}

export function normalizeFc26Players(rows: Fc26RawPlayer[]): Player[] {
  return rows
    .map((row, index): Player | null => {
      const name = displayName(row);
      const fullName = cleanName(row.long_name);
      const nationality = row.nationality_name ?? row.Nationality ?? row.nationality;
      const club = row.club_name ?? row.Club ?? row.club ?? "Free Agent";
      const rawOverall = row.Overall ?? row.overall;
      const rawRoles = row.player_positions ?? row.Position ?? row.position ?? "CM";
      const roles = rawRoles
        .split(",")
        .map(normalizeRole)
        .filter((role): role is PlayerRole => Boolean(role));
      const primaryRole = roles[0] ?? "CM";
      const position = positionMap[primaryRole] ?? "MID";
      const overall = Number(rawOverall);
      const goalkeepingValues = [
        row.goalkeeping_diving,
        row.goalkeeping_handling,
        row.goalkeeping_kicking,
        row.goalkeeping_positioning,
        row.goalkeeping_reflexes,
      ]
        .map(Number)
        .filter(Number.isFinite);

      if (!name || !nationality || !Number.isFinite(overall)) return null;

      return {
        id: String(row.id ?? row.player_id ?? `${nationality}-${name}-${index}`),
        name,
        fullName,
        nationality,
        club,
        overall,
        position,
        primaryRole,
        roles: roles.length ? roles : [primaryRole],
        age: Number(row.Age ?? row.age ?? 24),
        pace: Number(row.pace) || undefined,
        shooting: Number(row.shooting) || undefined,
        passing: Number(row.passing) || undefined,
        dribbling: Number(row.dribbling) || undefined,
        defending: Number(row.defending) || undefined,
        physic: Number(row.physic) || undefined,
        curve: Number(row.skill_curve) || undefined,
        freeKickAccuracy: Number(row.skill_fk_accuracy) || undefined,
        penalties: Number(row.mentality_penalties) || undefined,
        goalkeeping: goalkeepingValues.length
          ? goalkeepingValues.reduce((sum, value) => sum + value, 0) / goalkeepingValues.length
          : undefined,
      } satisfies Player;
    })
    .filter((player): player is Player => Boolean(player));
}

export function getAvailableCountries(players: Player[] = samplePlayers, minPlayers = 23): string[] {
  const counts = players.reduce<Map<string, number>>((countryCounts, player) => {
    countryCounts.set(player.nationality, (countryCounts.get(player.nationality) ?? 0) + 1);
    return countryCounts;
  }, new Map());

  return Array.from(counts.entries())
    .filter(([, count]) => count >= minPlayers)
    .map(([country]) => country)
    .sort((a, b) => a.localeCompare(b));
}

export function getPlayersByCountry(country: string, players: Player[] = samplePlayers): Player[] {
  return players
    .filter((player) => player.nationality === country)
    .sort((a, b) => b.overall - a.overall);
}

export function getCountryPlayerPool(country: string, players: Player[] = samplePlayers, minPlayers = 23): Player[] {
  const realPlayers = getPlayersByCountry(country, players);
  if (realPlayers.length >= minPlayers) return realPlayers;

  const baseRating = fallbackRating(country, realPlayers);
  const supplementalPlayers: Player[] = [];

  while (realPlayers.length + supplementalPlayers.length < minPlayers) {
    const currentPool = [...realPlayers, ...supplementalPlayers];
    const position = positionForSupplement(currentPool, supplementalPlayers.length);
    supplementalPlayers.push(createSupplementalPlayer(country, supplementalPlayers.length, position, baseRating));
  }

  return [...realPlayers, ...supplementalPlayers].sort((a, b) => b.overall - a.overall);
}
