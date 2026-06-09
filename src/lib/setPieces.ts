import { Player, SetPieceTakers } from "../types";

function skill(player: Player, key: "penalties" | "freeKickAccuracy" | "curve" | "shooting" | "passing", fallback = 0) {
  const value = player[key];
  return typeof value === "number" && Number.isFinite(value) ? value : player.overall + fallback;
}

export function penaltySkill(player: Player) {
  return skill(player, "penalties", -2) * 0.58 + skill(player, "shooting", -3) * 0.27 + player.overall * 0.15;
}

export function freeKickSkill(player: Player) {
  return (
    skill(player, "freeKickAccuracy", -4) * 0.44 +
    skill(player, "curve", -5) * 0.28 +
    skill(player, "shooting", -4) * 0.16 +
    skill(player, "passing", -3) * 0.12
  );
}

export function bestPenaltyTaker(players: Player[]) {
  return [...players].sort((a, b) => penaltySkill(b) - penaltySkill(a))[0];
}

export function bestFreeKickTaker(players: Player[]) {
  return [...players].sort((a, b) => freeKickSkill(b) - freeKickSkill(a))[0];
}

export function defaultSetPieceTakers(players: Player[]): SetPieceTakers {
  return {
    penaltyTakerId: bestPenaltyTaker(players)?.id,
    freeKickTakerId: bestFreeKickTaker(players)?.id,
  };
}

export function resolveSetPieceTakers(players: Player[], takers?: SetPieceTakers) {
  const byId = new Map(players.map((player) => [player.id, player]));
  return {
    penalty: (takers?.penaltyTakerId && byId.get(takers.penaltyTakerId)) || bestPenaltyTaker(players),
    freeKick: (takers?.freeKickTakerId && byId.get(takers.freeKickTakerId)) || bestFreeKickTaker(players),
  };
}
