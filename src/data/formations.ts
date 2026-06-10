import { Formation, Player, PlayerPosition, PlayerRole } from "../types";

export interface FormationSlot {
  id: string;
  label: string;
  position: PlayerPosition;
  role?: PlayerRole;
  x: number;
  y: number;
}

export interface FormationDefinition {
  id: Formation;
  label: string;
  slots: FormationSlot[];
}

function slot(id: string, label: string, position: PlayerPosition, role: PlayerRole, x: number, y: number): FormationSlot {
  return { id, label, position, role, x, y };
}

const gk = slot("gk", "KL", "GK", "GK", 50, 90);

export const formationDefinitions: Record<Formation, FormationDefinition> = {
  "4-3-3": {
    id: "4-3-3",
    label: "4-3-3",
    slots: [
      gk,
      { id: "lb", label: "SLB", position: "DEF", x: 18, y: 72 },
      { id: "lcb", label: "STP", position: "DEF", x: 39, y: 75 },
      { id: "rcb", label: "STP", position: "DEF", x: 61, y: 75 },
      { id: "rb", label: "SGB", position: "DEF", x: 82, y: 72 },
      { id: "lcm", label: "MO", position: "MID", x: 32, y: 52 },
      { id: "cm", label: "MO", position: "MID", x: 50, y: 56 },
      { id: "rcm", label: "MO", position: "MID", x: 68, y: 52 },
      { id: "lw", label: "SAK", position: "FWD", x: 22, y: 25 },
      { id: "st", label: "SF", position: "FWD", x: 50, y: 18 },
      { id: "rw", label: "SAG", position: "FWD", x: 78, y: 25 },
    ],
  },
  "4-2-3-1": {
    id: "4-2-3-1",
    label: "4-2-3-1",
    slots: [
      gk,
      { id: "lb", label: "SLB", position: "DEF", x: 18, y: 72 },
      { id: "lcb", label: "STP", position: "DEF", x: 39, y: 75 },
      { id: "rcb", label: "STP", position: "DEF", x: 61, y: 75 },
      { id: "rb", label: "SGB", position: "DEF", x: 82, y: 72 },
      { id: "ldm", label: "DOS", position: "MID", x: 40, y: 58 },
      { id: "rdm", label: "DOS", position: "MID", x: 60, y: 58 },
      { id: "lam", label: "SLO", position: "MID", x: 25, y: 39 },
      { id: "cam", label: "OO", position: "MID", x: 50, y: 35 },
      { id: "ram", label: "SGO", position: "MID", x: 75, y: 39 },
      { id: "st", label: "SF", position: "FWD", x: 50, y: 17 },
    ],
  },
  "4-4-2": {
    id: "4-4-2",
    label: "4-4-2",
    slots: [
      gk,
      { id: "lb", label: "SLB", position: "DEF", x: 18, y: 72 },
      { id: "lcb", label: "STP", position: "DEF", x: 39, y: 75 },
      { id: "rcb", label: "STP", position: "DEF", x: 61, y: 75 },
      { id: "rb", label: "SGB", position: "DEF", x: 82, y: 72 },
      { id: "lm", label: "SO", position: "MID", x: 20, y: 48 },
      { id: "lcm", label: "MO", position: "MID", x: 42, y: 52 },
      { id: "rcm", label: "MO", position: "MID", x: 58, y: 52 },
      { id: "rm", label: "SGO", position: "MID", x: 80, y: 48 },
      { id: "lst", label: "SF", position: "FWD", x: 42, y: 20 },
      { id: "rst", label: "SF", position: "FWD", x: 58, y: 20 },
    ],
  },
  "4-1-4-1": {
    id: "4-1-4-1",
    label: "4-1-4-1",
    slots: [
      gk,
      { id: "lb", label: "SLB", position: "DEF", x: 18, y: 72 },
      { id: "lcb", label: "STP", position: "DEF", x: 39, y: 75 },
      { id: "rcb", label: "STP", position: "DEF", x: 61, y: 75 },
      { id: "rb", label: "SGB", position: "DEF", x: 82, y: 72 },
      { id: "dm", label: "DOS", position: "MID", x: 50, y: 60 },
      { id: "lm", label: "SO", position: "MID", x: 18, y: 43 },
      { id: "lcm", label: "MO", position: "MID", x: 40, y: 45 },
      { id: "rcm", label: "MO", position: "MID", x: 60, y: 45 },
      { id: "rm", label: "SGO", position: "MID", x: 82, y: 43 },
      { id: "st", label: "SF", position: "FWD", x: 50, y: 17 },
    ],
  },
  "4-3-1-2": {
    id: "4-3-1-2",
    label: "4-3-1-2",
    slots: [
      gk,
      { id: "lb", label: "SLB", position: "DEF", x: 18, y: 72 },
      { id: "lcb", label: "STP", position: "DEF", x: 39, y: 75 },
      { id: "rcb", label: "STP", position: "DEF", x: 61, y: 75 },
      { id: "rb", label: "SGB", position: "DEF", x: 82, y: 72 },
      { id: "lcm", label: "MO", position: "MID", x: 34, y: 54 },
      { id: "cm", label: "DOS", position: "MID", x: 50, y: 58 },
      { id: "rcm", label: "MO", position: "MID", x: 66, y: 54 },
      { id: "cam", label: "OO", position: "MID", x: 50, y: 36 },
      { id: "lst", label: "SF", position: "FWD", x: 42, y: 18 },
      { id: "rst", label: "SF", position: "FWD", x: 58, y: 18 },
    ],
  },
  "4-2-2-2": {
    id: "4-2-2-2",
    label: "4-2-2-2",
    slots: [
      gk,
      { id: "lb", label: "SLB", position: "DEF", x: 18, y: 72 },
      { id: "lcb", label: "STP", position: "DEF", x: 39, y: 75 },
      { id: "rcb", label: "STP", position: "DEF", x: 61, y: 75 },
      { id: "rb", label: "SGB", position: "DEF", x: 82, y: 72 },
      { id: "ldm", label: "DOS", position: "MID", x: 40, y: 57 },
      { id: "rdm", label: "DOS", position: "MID", x: 60, y: 57 },
      { id: "lam", label: "OO", position: "MID", x: 36, y: 37 },
      { id: "ram", label: "OO", position: "MID", x: 64, y: 37 },
      { id: "lst", label: "SF", position: "FWD", x: 42, y: 18 },
      { id: "rst", label: "SF", position: "FWD", x: 58, y: 18 },
    ],
  },
  "3-5-2": {
    id: "3-5-2",
    label: "3-5-2",
    slots: [
      gk,
      { id: "lcb", label: "STP", position: "DEF", x: 32, y: 74 },
      { id: "cb", label: "STP", position: "DEF", x: 50, y: 78 },
      { id: "rcb", label: "STP", position: "DEF", x: 68, y: 74 },
      { id: "lm", label: "KAN", position: "MID", x: 16, y: 50 },
      { id: "lcm", label: "MO", position: "MID", x: 38, y: 54 },
      { id: "cm", label: "DOS", position: "MID", x: 50, y: 60 },
      { id: "rcm", label: "MO", position: "MID", x: 62, y: 54 },
      { id: "rm", label: "KAN", position: "MID", x: 84, y: 50 },
      { id: "lst", label: "SF", position: "FWD", x: 42, y: 18 },
      { id: "rst", label: "SF", position: "FWD", x: 58, y: 18 },
    ],
  },
  "3-4-3": {
    id: "3-4-3",
    label: "3-4-3",
    slots: [
      gk,
      { id: "lcb", label: "STP", position: "DEF", x: 32, y: 74 },
      { id: "cb", label: "STP", position: "DEF", x: 50, y: 78 },
      { id: "rcb", label: "STP", position: "DEF", x: 68, y: 74 },
      { id: "lm", label: "KAN", position: "MID", x: 18, y: 52 },
      { id: "lcm", label: "MO", position: "MID", x: 42, y: 55 },
      { id: "rcm", label: "MO", position: "MID", x: 58, y: 55 },
      { id: "rm", label: "KAN", position: "MID", x: 82, y: 52 },
      { id: "lw", label: "SAK", position: "FWD", x: 22, y: 25 },
      { id: "st", label: "SF", position: "FWD", x: 50, y: 17 },
      { id: "rw", label: "SAG", position: "FWD", x: 78, y: 25 },
    ],
  },
  "3-4-2-1": {
    id: "3-4-2-1",
    label: "3-4-2-1",
    slots: [
      gk,
      { id: "lcb", label: "STP", position: "DEF", x: 32, y: 74 },
      { id: "cb", label: "STP", position: "DEF", x: 50, y: 78 },
      { id: "rcb", label: "STP", position: "DEF", x: 68, y: 74 },
      { id: "lm", label: "KAN", position: "MID", x: 18, y: 52 },
      { id: "lcm", label: "MO", position: "MID", x: 42, y: 56 },
      { id: "rcm", label: "MO", position: "MID", x: 58, y: 56 },
      { id: "rm", label: "KAN", position: "MID", x: 82, y: 52 },
      { id: "lam", label: "OO", position: "MID", x: 40, y: 34 },
      { id: "ram", label: "OO", position: "MID", x: 60, y: 34 },
      { id: "st", label: "SF", position: "FWD", x: 50, y: 16 },
    ],
  },
  "5-3-2": {
    id: "5-3-2",
    label: "5-3-2",
    slots: [
      gk,
      { id: "lwb", label: "SLB", position: "DEF", x: 13, y: 68 },
      { id: "lcb", label: "STP", position: "DEF", x: 33, y: 76 },
      { id: "cb", label: "STP", position: "DEF", x: 50, y: 79 },
      { id: "rcb", label: "STP", position: "DEF", x: 67, y: 76 },
      { id: "rwb", label: "SGB", position: "DEF", x: 87, y: 68 },
      { id: "lcm", label: "MO", position: "MID", x: 38, y: 52 },
      { id: "cm", label: "DOS", position: "MID", x: 50, y: 58 },
      { id: "rcm", label: "MO", position: "MID", x: 62, y: 52 },
      { id: "lst", label: "SF", position: "FWD", x: 42, y: 18 },
      { id: "rst", label: "SF", position: "FWD", x: 58, y: 18 },
    ],
  },
  "5-4-1": {
    id: "5-4-1",
    label: "5-4-1",
    slots: [
      gk,
      { id: "lwb", label: "SLB", position: "DEF", x: 13, y: 68 },
      { id: "lcb", label: "STP", position: "DEF", x: 33, y: 76 },
      { id: "cb", label: "STP", position: "DEF", x: 50, y: 79 },
      { id: "rcb", label: "STP", position: "DEF", x: 67, y: 76 },
      { id: "rwb", label: "SGB", position: "DEF", x: 87, y: 68 },
      { id: "lm", label: "SO", position: "MID", x: 20, y: 47 },
      { id: "lcm", label: "MO", position: "MID", x: 42, y: 51 },
      { id: "rcm", label: "MO", position: "MID", x: 58, y: 51 },
      { id: "rm", label: "SGO", position: "MID", x: 80, y: 47 },
      { id: "st", label: "SF", position: "FWD", x: 50, y: 17 },
    ],
  },
  "5-2-3": {
    id: "5-2-3",
    label: "5-2-3",
    slots: [
      gk,
      { id: "lwb", label: "SLB", position: "DEF", x: 13, y: 68 },
      { id: "lcb", label: "STP", position: "DEF", x: 33, y: 76 },
      { id: "cb", label: "STP", position: "DEF", x: 50, y: 79 },
      { id: "rcb", label: "STP", position: "DEF", x: 67, y: 76 },
      { id: "rwb", label: "SGB", position: "DEF", x: 87, y: 68 },
      { id: "lcm", label: "MO", position: "MID", x: 42, y: 52 },
      { id: "rcm", label: "MO", position: "MID", x: 58, y: 52 },
      { id: "lw", label: "SAK", position: "FWD", x: 22, y: 25 },
      { id: "st", label: "SF", position: "FWD", x: 50, y: 17 },
      { id: "rw", label: "SAG", position: "FWD", x: 78, y: 25 },
    ],
  },
};

export const formationList = Object.values(formationDefinitions);

export function roleForSlot(slot: FormationSlot): PlayerRole {
  if (slot.role) return slot.role;
  const id = slot.id.toLowerCase();
  if (id === "gk") return "GK";
  if (id.includes("lwb")) return "LWB";
  if (id.includes("rwb")) return "RWB";
  if (id === "lb") return "LB";
  if (id === "rb") return "RB";
  if (id.includes("cb")) return "CB";
  if (id.includes("dm")) return "CDM";
  if (id.includes("cam") || id.includes("am")) return "CAM";
  if (id === "lm") return "LM";
  if (id === "rm") return "RM";
  if (id.includes("cm")) return "CM";
  if (id === "lw") return "LW";
  if (id === "rw") return "RW";
  if (id.includes("st")) return "ST";
  return slot.position === "DEF" ? "CB" : slot.position === "MID" ? "CM" : slot.position === "FWD" ? "ST" : "GK";
}

export function autoAssignLineup(players: Player[], formation: Formation): Record<string, string> {
  const assignments: Record<string, string> = {};
  const used = new Set<string>();

  formationDefinitions[formation].slots.forEach((slot) => {
    const exact = players.find((player) => player.position === slot.position && !used.has(player.id));
    const fallback = players.find((player) => !used.has(player.id));
    const selected = exact ?? fallback;
    if (!selected) return;
    assignments[slot.id] = selected.id;
    used.add(selected.id);
  });

  return assignments;
}

export function playersFromAssignments(players: Player[], assignments: Record<string, string>): Player[] {
  const playerById = new Map(players.map((player) => [player.id, player]));
  return Object.values(assignments)
    .map((id) => playerById.get(id))
    .filter((player): player is Player => Boolean(player));
}
