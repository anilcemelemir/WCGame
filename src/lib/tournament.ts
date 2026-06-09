import { TournamentGroup } from "../data/worldCup2026";
import { thirdPlaceAllocationByGroups } from "../data/thirdPlaceAllocations";
import { GroupResult, KnockoutRound, MatchResult, Player, Standing, Tactic, TournamentResult } from "../types";
import { getCountryPlayerPool } from "./dataset";
import { SimTeam, simulateMatch } from "./matchEngine";
import { defaultSetPieceTakers } from "./setPieces";

type GroupRank = "1" | "2" | "3";

interface RankedTeam extends SimTeam {
  groupId: string;
  rank: GroupRank;
  standing: Standing;
}

interface KnockoutSlot {
  matchNo: number;
  home: string;
  away: string;
  homeThirdGroups?: string[];
  awayThirdGroups?: string[];
}

const groupMatchOrder = [
  [0, 1],
  [2, 3],
  [0, 2],
  [3, 1],
  [3, 0],
  [1, 2],
];

const roundOf32Slots: KnockoutSlot[] = [
  { matchNo: 73, home: "2A", away: "2B" },
  { matchNo: 74, home: "1E", away: "3", awayThirdGroups: ["A", "B", "C", "D", "F"] },
  { matchNo: 75, home: "1F", away: "2C" },
  { matchNo: 76, home: "1C", away: "2F" },
  { matchNo: 77, home: "1I", away: "3", awayThirdGroups: ["C", "D", "F", "G", "H"] },
  { matchNo: 78, home: "2E", away: "2I" },
  { matchNo: 79, home: "1A", away: "3", awayThirdGroups: ["C", "E", "F", "H", "I"] },
  { matchNo: 80, home: "1L", away: "3", awayThirdGroups: ["E", "H", "I", "J", "K"] },
  { matchNo: 81, home: "1D", away: "3", awayThirdGroups: ["B", "E", "F", "I", "J"] },
  { matchNo: 82, home: "1G", away: "3", awayThirdGroups: ["A", "E", "H", "I", "J"] },
  { matchNo: 83, home: "2K", away: "2L" },
  { matchNo: 84, home: "1H", away: "2J" },
  { matchNo: 85, home: "1B", away: "3", awayThirdGroups: ["E", "F", "G", "I", "J"] },
  { matchNo: 86, home: "1J", away: "2H" },
  { matchNo: 87, home: "1K", away: "3", awayThirdGroups: ["D", "E", "I", "J", "L"] },
  { matchNo: 88, home: "2D", away: "2G" },
];

const nextRoundMap = [
  { matchNo: 89, previous: [74, 77] },
  { matchNo: 90, previous: [73, 75] },
  { matchNo: 91, previous: [76, 78] },
  { matchNo: 92, previous: [79, 80] },
  { matchNo: 93, previous: [83, 84] },
  { matchNo: 94, previous: [81, 82] },
  { matchNo: 95, previous: [86, 88] },
  { matchNo: 96, previous: [85, 87] },
  { matchNo: 97, previous: [89, 90] },
  { matchNo: 98, previous: [93, 94] },
  { matchNo: 99, previous: [91, 92] },
  { matchNo: 100, previous: [95, 96] },
  { matchNo: 101, previous: [97, 98] },
  { matchNo: 102, previous: [99, 100] },
  { matchNo: 103, previous: [101, 102] },
  { matchNo: 104, previous: [101, 102] },
];

function autoLineup(country: string, players: Player[]): Player[] {
  const pool = getCountryPlayerPool(country, players);
  const pick = (positions: string[], count: number) =>
    pool.filter((player) => positions.includes(player.position)).slice(0, count);

  const lineup = [
    ...pick(["GK"], 1),
    ...pick(["DEF"], 4),
    ...pick(["MID"], 3),
    ...pick(["FWD"], 3),
  ];

  return lineup.length >= 11 ? lineup.slice(0, 11) : pool.slice(0, 11);
}

function createTeam(country: string, players: Player[], managedTeams: Map<string, SimTeam>): SimTeam {
  const managedTeam = managedTeams.get(country);
  if (managedTeam) return managedTeam;
  const lineup = autoLineup(country, players);

  return {
    country,
    lineup,
    tactic: "balanced",
    setPieceTakers: defaultSetPieceTakers(lineup),
  };
}

function createStanding(team: string, groupId?: string): Standing {
  return {
    team,
    groupId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  };
}

function applyMatch(standings: Map<string, Standing>, match: MatchResult) {
  const home = standings.get(match.home)!;
  const away = standings.get(match.away)!;

  home.played += 1;
  away.played += 1;
  home.goalsFor += match.homeScore;
  home.goalsAgainst += match.awayScore;
  away.goalsFor += match.awayScore;
  away.goalsAgainst += match.homeScore;

  if (match.homeScore > match.awayScore) {
    home.won += 1;
    away.lost += 1;
    home.points += 3;
  } else if (match.homeScore < match.awayScore) {
    away.won += 1;
    home.lost += 1;
    away.points += 3;
  } else {
    home.drawn += 1;
    away.drawn += 1;
    home.points += 1;
    away.points += 1;
  }
}

function goalDifference(standing: Standing): number {
  return standing.goalsFor - standing.goalsAgainst;
}

function sortStandings(standings: Standing[]): Standing[] {
  return [...standings].sort((a, b) => {
    return (
      b.points - a.points ||
      goalDifference(b) - goalDifference(a) ||
      b.goalsFor - a.goalsFor ||
      a.team.localeCompare(b.team)
    );
  });
}

function simulateGroup(group: TournamentGroup, teams: SimTeam[]): GroupResult {
  const standings = new Map(teams.map((team) => [team.country, createStanding(team.country, group.id)]));
  const matches: MatchResult[] = [];

  groupMatchOrder.forEach(([homeIndex, awayIndex]) => {
    const home = teams[homeIndex];
    const away = teams[awayIndex];
    const match = simulateMatch(home, away);
    matches.push(match);
    applyMatch(standings, match);
  });

  return {
    name: group.name,
    matches,
    standings: sortStandings(Array.from(standings.values())),
  };
}

function rankedTeamFromStanding(
  standing: Standing,
  rank: GroupRank,
  teamByCountry: Map<string, SimTeam>,
): RankedTeam {
  return {
    ...teamByCountry.get(standing.team)!,
    groupId: standing.groupId!,
    rank,
    standing,
  };
}

function rankThirdPlaced(groups: GroupResult[], teamByCountry: Map<string, SimTeam>): RankedTeam[] {
  return sortStandings(groups.map((group) => group.standings[2])).map((standing) =>
    rankedTeamFromStanding(standing, "3", teamByCountry),
  );
}

function resolveThirdPlaceSlots(slots: KnockoutSlot[], thirdPlaced: RankedTeam[]): Map<number, RankedTeam> {
  const assignments = new Map<number, RankedTeam>();
  const advancingThirds = thirdPlaced.slice(0, 8);
  const allocationKey = advancingThirds.map((team) => team.groupId).sort().join("");
  const allocation = thirdPlaceAllocationByGroups[allocationKey];

  slots.forEach((slot) => {
    const allocatedGroup = allocation?.[slot.matchNo];
    if (!allocatedGroup) return;
    const team = advancingThirds.find((candidate) => candidate.groupId === allocatedGroup);
    if (team) assignments.set(slot.matchNo, team);
  });

  return assignments;
}

function teamFromSlot(
  slot: string,
  groupWinners: Map<string, RankedTeam>,
  groupRunnersUp: Map<string, RankedTeam>,
  thirdAssignments: Map<number, RankedTeam>,
  matchNo: number,
): RankedTeam {
  if (slot === "3") return thirdAssignments.get(matchNo)!;

  const rank = slot[0];
  const groupId = slot[1];
  return rank === "1" ? groupWinners.get(groupId)! : groupRunnersUp.get(groupId)!;
}

function simulateKnockoutMatch(matchNo: number, home: SimTeam, away: SimTeam): MatchResult {
  const match = simulateMatch(home, away, { knockout: true });
  return {
    ...match,
    id: `M${matchNo}-${match.id}`,
  };
}

function winnerOf(match: MatchResult, teamByCountry: Map<string, SimTeam>): SimTeam {
  return teamByCountry.get(match.winner ?? (match.homeScore > match.awayScore ? match.home : match.away))!;
}

function loserOf(match: MatchResult, teamByCountry: Map<string, SimTeam>): SimTeam {
  const winner = match.winner ?? (match.homeScore > match.awayScore ? match.home : match.away);
  return teamByCountry.get(winner === match.home ? match.away : match.home)!;
}

export function simulateTournament(
  userTeam:
    | { country: string; lineup: Player[]; tactic: Tactic; tacticalPlan?: import("../types").TacticalPlan; setPieceTakers?: import("../types").SetPieceTakers }
    | Array<{ country: string; lineup: Player[]; tactic: Tactic; tacticalPlan?: import("../types").TacticalPlan; setPieceTakers?: import("../types").SetPieceTakers }>,
  players: Player[],
  tournamentGroups: TournamentGroup[],
): TournamentResult {
  const managedTeams = new Map(
    (Array.isArray(userTeam) ? userTeam : [userTeam]).map((team) => [team.country, team as SimTeam]),
  );
  const teamByCountry = new Map<string, SimTeam>();

  tournamentGroups.flatMap((group) => group.teams).forEach((country) => {
    teamByCountry.set(country, createTeam(country, players, managedTeams));
  });

  const groups = tournamentGroups.map((group) =>
    simulateGroup(group, group.teams.map((country) => teamByCountry.get(country)!)),
  );

  const groupWinners = new Map<string, RankedTeam>();
  const groupRunnersUp = new Map<string, RankedTeam>();

  groups.forEach((group) => {
    const groupId = group.standings[0].groupId!;
    groupWinners.set(groupId, rankedTeamFromStanding(group.standings[0], "1", teamByCountry));
    groupRunnersUp.set(groupId, rankedTeamFromStanding(group.standings[1], "2", teamByCountry));
  });

  const thirdPlaceRanking = rankThirdPlaced(groups, teamByCountry);
  const thirdAssignments = resolveThirdPlaceSlots(roundOf32Slots, thirdPlaceRanking);
  const matchByNumber = new Map<number, MatchResult>();

  const roundOf32Matches = roundOf32Slots.map((slot) => {
    const home = teamFromSlot(slot.home, groupWinners, groupRunnersUp, thirdAssignments, slot.matchNo);
    const away = teamFromSlot(slot.away, groupWinners, groupRunnersUp, thirdAssignments, slot.matchNo);
    const match = simulateKnockoutMatch(slot.matchNo, home, away);
    matchByNumber.set(slot.matchNo, match);
    return match;
  });

  const buildRound = (name: string, matchNumbers: number[]): KnockoutRound => {
    const matches = matchNumbers.map((matchNo) => {
      const setup = nextRoundMap.find((round) => round.matchNo === matchNo)!;
      const [homePrevious, awayPrevious] = setup.previous.map((previousMatchNo) => matchByNumber.get(previousMatchNo)!);
      const home = matchNo === 103 ? loserOf(homePrevious, teamByCountry) : winnerOf(homePrevious, teamByCountry);
      const away = matchNo === 103 ? loserOf(awayPrevious, teamByCountry) : winnerOf(awayPrevious, teamByCountry);
      const match = simulateKnockoutMatch(matchNo, home, away);
      matchByNumber.set(matchNo, match);
      return match;
    });

    return { name, matches };
  };

  const roundOf16 = buildRound("Son 16", [89, 90, 91, 92, 93, 94, 95, 96]);
  const quarterFinals = buildRound("Çeyrek Final", [97, 98, 99, 100]);
  const semiFinals = buildRound("Yarı Final", [101, 102]);
  const thirdPlace = buildRound("Üçüncülük Maçı", [103]);
  const final = buildRound("Final", [104]);
  const finalMatch = final.matches[0];
  const thirdPlaceMatch = thirdPlace.matches[0];

  return {
    groups,
    thirdPlaceTable: thirdPlaceRanking.map((team) => team.standing),
    knockouts: [{ name: "Son 32", matches: roundOf32Matches }, roundOf16, quarterFinals, semiFinals, thirdPlace, final],
    champion: winnerOf(finalMatch, teamByCountry).country,
    thirdPlaceWinner: winnerOf(thirdPlaceMatch, teamByCountry).country,
  };
}
