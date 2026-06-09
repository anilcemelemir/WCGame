export type GroupLetter =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L";

export interface TournamentGroup {
  id: GroupLetter;
  name: string;
  teams: string[];
}

export const officialWorldCup2026Groups: TournamentGroup[] = [
  { id: "A", name: "A Grubu", teams: ["Mexico", "South Africa", "Korea Republic", "Czechia"] },
  { id: "B", name: "B Grubu", teams: ["Canada", "Bosnia and Herzegovina", "Qatar", "Switzerland"] },
  { id: "C", name: "C Grubu", teams: ["Brazil", "Morocco", "Haiti", "Scotland"] },
  { id: "D", name: "D Grubu", teams: ["United States", "Paraguay", "Australia", "Türkiye"] },
  { id: "E", name: "E Grubu", teams: ["Germany", "Curacao", "Côte d'Ivoire", "Ecuador"] },
  { id: "F", name: "F Grubu", teams: ["Netherlands", "Japan", "Sweden", "Tunisia"] },
  { id: "G", name: "G Grubu", teams: ["Belgium", "Egypt", "Iran", "New Zealand"] },
  { id: "H", name: "H Grubu", teams: ["Spain", "Cabo Verde", "Saudi Arabia", "Uruguay"] },
  { id: "I", name: "I Grubu", teams: ["France", "Senegal", "Iraq", "Norway"] },
  { id: "J", name: "J Grubu", teams: ["Argentina", "Algeria", "Austria", "Jordan"] },
  { id: "K", name: "K Grubu", teams: ["Portugal", "Congo DR", "Uzbekistan", "Colombia"] },
  { id: "L", name: "L Grubu", teams: ["England", "Croatia", "Ghana", "Panama"] },
];

export const officialWorldCup2026Teams = officialWorldCup2026Groups.flatMap((group) => group.teams);

export function createCustomGroups(teams: string[]): TournamentGroup[] {
  const letters: GroupLetter[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

  return letters.map((letter, index) => ({
    id: letter,
    name: `${letter} Grubu`,
    teams: teams.slice(index * 4, index * 4 + 4),
  }));
}
