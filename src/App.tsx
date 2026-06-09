import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Check,
  ChevronLeft,
  Play,
  RotateCcw,
  Settings2,
  Shield,
  Trophy,
  Users,
  Volume2,
} from "lucide-react";
import { AdSlot } from "./components/AdSlot";
import { MatchEventAnimation, MatchAnimationType } from "./components/MatchEventAnimation";
import { loadFc26Players } from "./data/fc26Players";
import { autoAssignLineup, formationDefinitions, formationList, playersFromAssignments } from "./data/formations";
import { samplePlayers } from "./data/samplePlayers";
import { tacticDefinitions, tacticList } from "./data/tactics";
import { createCustomGroups, officialWorldCup2026Groups, officialWorldCup2026Teams } from "./data/worldCup2026";
import { getAvailableCountries, getCountryPlayerPool, getPlayersByCountry } from "./lib/dataset";
import { createLobbySocket } from "./lib/lobbyClient";
import { bestFreeKickTaker, bestPenaltyTaker, freeKickSkill, penaltySkill } from "./lib/setPieces";
import { simulateTournament } from "./lib/tournament";
import worldCupLogoUrl from "../Assets/world-cup.png";
import {
  Formation,
  GroupResult,
  LobbyRoom,
  MatchEvent,
  MatchResult,
  OnlineTeamPlan,
  Player,
  PlayMode,
  SetPieceTakers,
  Stage,
  Standing,
  Tactic,
  TacticalPlan,
  TournamentResult,
} from "./types";

interface TournamentStep {
  id: string;
  title: string;
  subtitle: string;
  matches: MatchResult[];
  kind: "group" | "knockout";
}

function averageOverall(players: Player[]) {
  if (!players.length) return 0;
  return Math.round(players.reduce((sum, player) => sum + player.overall, 0) / players.length);
}

function planValueLabel(value: number) {
  if (value >= 72) return "Yüksek";
  if (value <= 32) return "Düşük";
  return "Orta";
}

function createBenchIds(squad: Player[], assignments: Record<string, string>) {
  const assignedIds = new Set(Object.values(assignments));
  return squad.filter((player) => !assignedIds.has(player.id)).slice(0, 12).map((player) => player.id);
}

function normalizeRoomCode(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);
}

function liveEventDelay(event: MatchEvent) {
  if (event.type === "kickoff") return 1450;
  if (event.type === "analysis") return 1650;
  if (event.type === "chance") return event.suspense ? 2100 : 1500;
  if (event.type === "penalty" || event.type === "free-kick") return 2300;
  if (event.type === "goal") return 2400;
  if (event.type === "miss" || event.type === "save" || event.type === "post") return 1900;
  if (event.type === "yellow-card" || event.type === "red-card") return 1900;
  if (event.type === "half-time" || event.type === "full-time" || event.type === "penalties") return 2600;
  if (event.type === "foul") return 1400;
  return 1500;
}

function animationForEvent(event: MatchEvent): MatchAnimationType | null {
  if (event.type === "goal") return "goal";
  if (event.type === "post") return "post";
  if (event.type === "miss" || event.type === "save") return "miss";
  if (event.type === "yellow-card") return "yellow-card";
  if (event.type === "red-card") return "red-card";
  if (event.whistle || event.type === "whistle" || event.type === "foul") return "whistle";
  return null;
}

function animationLeadTime(type: MatchAnimationType | null) {
  if (!type) return 0;
  if (type === "goal") return 1750;
  if (type === "post" || type === "miss") return 1650;
  if (type === "yellow-card" || type === "red-card") return 1550;
  return 1050;
}

function goalDifference(standing: Standing) {
  return standing.goalsFor - standing.goalsAgainst;
}

function emptyStanding(team: string, groupId?: string): Standing {
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

function applyVisibleMatch(standings: Map<string, Standing>, match: MatchResult) {
  const home = standings.get(match.home);
  const away = standings.get(match.away);
  if (!home || !away) return;

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

function sortVisibleStandings(standings: Standing[]) {
  return [...standings].sort(
    (a, b) =>
      b.points - a.points ||
      goalDifference(b) - goalDifference(a) ||
      b.goalsFor - a.goalsFor ||
      a.team.localeCompare(b.team),
  );
}

function createTournamentSteps(tournamentResult: TournamentResult): TournamentStep[] {
  const groupSteps: TournamentStep[] = [0, 1, 2].map((matchday) => ({
    id: `group-${matchday + 1}`,
    title: `Grup ${matchday + 1}. maçlar`,
    subtitle: `${matchday + 1}. grup maç haftası`,
    kind: "group",
    matches: tournamentResult.groups.flatMap((group) => group.matches.slice(matchday * 2, matchday * 2 + 2)),
  }));

  return [
    ...groupSteps,
    ...tournamentResult.knockouts.map((round) => ({
      id: round.name,
      title: round.name,
      subtitle: "Eleme turu",
      kind: "knockout" as const,
      matches: round.matches,
    })),
  ];
}

function buildVisibleGroups(tournamentResult: TournamentResult | null, steps: TournamentStep[], revealedStepCount: number): GroupResult[] {
  if (!tournamentResult) return [];

  const revealedMatchIds = new Set(
    steps
      .slice(0, revealedStepCount)
      .filter((step) => step.kind === "group")
      .flatMap((step) => step.matches.map((match) => match.id)),
  );

  return tournamentResult.groups.map((group) => {
    const standings = new Map(group.standings.map((standing) => [standing.team, emptyStanding(standing.team, standing.groupId)]));
    const matches = group.matches.filter((match) => revealedMatchIds.has(match.id));
    matches.forEach((match) => applyVisibleMatch(standings, match));

    return {
      ...group,
      matches,
      standings: sortVisibleStandings(Array.from(standings.values())),
    };
  });
}

export function App() {
  const [players, setPlayers] = useState<Player[]>(samplePlayers);
  const [dataStatus, setDataStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const availableCountries = useMemo(() => getAvailableCountries(players), [players]);
  const [playMode, setPlayMode] = useState<PlayMode | null>(null);
  const [nickname, setNickname] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [lobbyRoom, setLobbyRoom] = useState<LobbyRoom | null>(null);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [lobbyError, setLobbyError] = useState("");
  const [lobbyConnectingAction, setLobbyConnectingAction] = useState<"create" | "join" | null>(null);
  const [lobbySocket, setLobbySocket] = useState<ReturnType<typeof createLobbySocket> | null>(null);
  const [stage, setStage] = useState<Stage>("team");
  const [country, setCountry] = useState("Türkiye");
  const [useOfficialTournament, setUseOfficialTournament] = useState(true);
  const [customTournamentTeams, setCustomTournamentTeams] = useState<string[]>(officialWorldCup2026Teams);
  const [squad, setSquad] = useState<Player[]>([]);
  const [formation, setFormation] = useState<Formation>("4-3-3");
  const [tactic, setTactic] = useState<Tactic>("balanced");
  const [tacticalPlan, setTacticalPlan] = useState<TacticalPlan>(tacticDefinitions.balanced.plan);
  const [setPieceTakers, setSetPieceTakers] = useState<SetPieceTakers>({});
  const [lineupAssignments, setLineupAssignments] = useState<Record<string, string>>({});
  const [benchIds, setBenchIds] = useState<string[]>([]);
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
  const [selectedMovePlayerId, setSelectedMovePlayerId] = useState<string | null>(null);
  const [startingEleven, setStartingEleven] = useState<Player[]>([]);
  const [result, setResult] = useState<TournamentResult | null>(null);
  const [tournamentSteps, setTournamentSteps] = useState<TournamentStep[]>([]);
  const [revealedStepCount, setRevealedStepCount] = useState(0);
  const [fastForwardedAfterElimination, setFastForwardedAfterElimination] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [liveMatch, setLiveMatch] = useState<MatchResult | null>(null);
  const [liveEvents, setLiveEvents] = useState<MatchEvent[]>([]);
  const [liveScore, setLiveScore] = useState({ home: 0, away: 0 });
  const [goalSuspense, setGoalSuspense] = useState(false);
  const [activeAnimation, setActiveAnimation] = useState<MatchAnimationType | null>(null);
  const liveTimersRef = useRef<number[]>([]);
  const liveFeedRef = useRef<HTMLDivElement | null>(null);
  const managerCountryRef = useRef(country);
  const selfIdRef = useRef<string | null>(null);
  const [onlinePlanSubmitted, setOnlinePlanSubmitted] = useState(false);
  const [onlinePlanCount, setOnlinePlanCount] = useState(0);
  const [onlinePlanTotal, setOnlinePlanTotal] = useState(0);
  const [onlineStepReadyIds, setOnlineStepReadyIds] = useState<string[]>([]);

  const tournamentTeams = useOfficialTournament ? officialWorldCup2026Teams : customTournamentTeams;
  const selfLobbyPlayer = lobbyRoom?.players.find((player) => player.id === selfId);
  const managerCountries = useOfficialTournament
    ? officialWorldCup2026Teams
    : availableCountries.filter((item) => tournamentTeams.includes(item));
  const countryPlayers = useMemo(() => getCountryPlayerPool(country, players), [country, players]);
  const tournamentGroups = useMemo(
    () => (useOfficialTournament ? officialWorldCup2026Groups : createCustomGroups(customTournamentTeams)),
    [customTournamentTeams, useOfficialTournament],
  );
  const latestPlayersRef = useRef(players);
  const latestGroupsRef = useRef(tournamentGroups);
  const selectedFormation = formationDefinitions[formation];
  const lineupPlayers = useMemo(() => playersFromAssignments(squad, lineupAssignments), [lineupAssignments, squad]);
  const benchPlayers = useMemo(() => {
    const playerById = new Map(squad.map((player) => [player.id, player]));
    return benchIds.map((id) => playerById.get(id)).filter((player): player is Player => Boolean(player));
  }, [benchIds, squad]);
  const visibleGroups = useMemo(
    () => buildVisibleGroups(result, tournamentSteps, revealedStepCount),
    [result, revealedStepCount, tournamentSteps],
  );
  const currentTournamentStep = tournamentSteps[revealedStepCount];
  const revealedSteps = tournamentSteps.slice(0, revealedStepCount);
  const allStepsRevealed = tournamentSteps.length > 0 && revealedStepCount >= tournamentSteps.length;
  const canStartSquad = tournamentTeams.length === 48 && tournamentTeams.includes(country);
  const canUseOnline = nickname.trim().length >= 2;
  const canJoinLobby = canUseOnline && normalizeRoomCode(joinCode).length === 6 && lobbyConnectingAction === null;
  const canCreateLobby = canUseOnline && lobbyConnectingAction === null;
  const isLobbyConnecting = lobbyConnectingAction !== null;
  const onlineSelfStepReady = Boolean(selfId && onlineStepReadyIds.includes(selfId));
  const onlineStepReadyCount = onlineStepReadyIds.length;
  const selectedPenaltyTaker = lineupPlayers.find((player) => player.id === setPieceTakers.penaltyTakerId) ?? bestPenaltyTaker(lineupPlayers);
  const selectedFreeKickTaker = lineupPlayers.find((player) => player.id === setPieceTakers.freeKickTakerId) ?? bestFreeKickTaker(lineupPlayers);
  const selectedMovePlayer = squad.find((player) => player.id === selectedMovePlayerId);

  useEffect(() => {
    return () => lobbySocket?.close();
  }, [lobbySocket]);

  useEffect(() => {
    return () => {
      liveTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      liveTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "icon";
      document.head.appendChild(icon);
    }
    icon.type = "image/png";
    icon.href = worldCupLogoUrl;
  }, []);

  useEffect(() => {
    latestPlayersRef.current = players;
  }, [players]);

  useEffect(() => {
    latestGroupsRef.current = tournamentGroups;
  }, [tournamentGroups]);

  useEffect(() => {
    managerCountryRef.current = country;
  }, [country]);

  useEffect(() => {
    selfIdRef.current = selfId;
  }, [selfId]);

  useEffect(() => {
    if (!liveFeedRef.current) return;
    liveFeedRef.current.scrollTop = liveFeedRef.current.scrollHeight;
  }, [liveEvents]);

  useEffect(() => {
    let cancelled = false;

    loadFc26Players()
      .then((loadedPlayers) => {
        if (cancelled) return;
        setPlayers(loadedPlayers);
        setDataStatus("ready");
        setCountry(officialWorldCup2026Teams.includes("Türkiye") ? "Türkiye" : officialWorldCup2026Teams[0]);
      })
      .catch(() => {
        if (cancelled) return;
        setPlayers(samplePlayers);
        setDataStatus("fallback");
        setCountry(getAvailableCountries(samplePlayers)[0] || "");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (managerCountries.length > 0 && !managerCountries.includes(country)) {
      setCountry(managerCountries[0]);
      setSquad([]);
      setStartingEleven([]);
      setLineupAssignments({});
      setBenchIds([]);
      setSetPieceTakers({});
    }
  }, [country, managerCountries]);

  useEffect(() => {
    setStartingEleven(lineupPlayers);
  }, [lineupPlayers]);

  useEffect(() => {
    if (lineupPlayers.length === 0) {
      setSetPieceTakers({});
      return;
    }

    setSetPieceTakers((current) => {
      const lineupIds = new Set(lineupPlayers.map((player) => player.id));
      const penaltyTakerId = current.penaltyTakerId && lineupIds.has(current.penaltyTakerId)
        ? current.penaltyTakerId
        : bestPenaltyTaker(lineupPlayers)?.id;
      const freeKickTakerId = current.freeKickTakerId && lineupIds.has(current.freeKickTakerId)
        ? current.freeKickTakerId
        : bestFreeKickTaker(lineupPlayers)?.id;

      if (penaltyTakerId === current.penaltyTakerId && freeKickTakerId === current.freeKickTakerId) return current;
      return { penaltyTakerId, freeKickTakerId };
    });
  }, [lineupPlayers]);

  function connectLobby(action: "create" | "join") {
    if (!canUseOnline) {
      setLobbyError("Takma ad en az 2 karakter olmalı.");
      return;
    }

    const code = normalizeRoomCode(joinCode);
    if (action === "join" && code.length !== 6) {
      setLobbyError("6 karakterli oda kodunu gir.");
      return;
    }

    lobbySocket?.close();
    setLobbyError(action === "create" ? "Oda oluşturuluyor..." : "Odaya katılınıyor...");
    setLobbyConnectingAction(action);
    let connectedSelfId = selfId;
    const socket = createLobbySocket((event) => {
      if (event.type === "error") {
        setLobbyError(event.payload.message);
        setLobbyConnectingAction(null);
        return;
      }

      if (event.type === "room:joined") {
        connectedSelfId = event.payload.selfId;
        selfIdRef.current = event.payload.selfId;
        setSelfId(event.payload.selfId);
        setLobbyRoom(event.payload.room);
        setPlayMode("online");
        setLobbyError("");
        setLobbyConnectingAction(null);
        return;
      }

      if (event.type === "room:update") {
        setLobbyRoom(event.payload.room);
        return;
      }

      if (event.type === "player:left") {
        setLobbyRoom(event.payload.room);
        setLobbyError(`${event.payload.nickname} lobiden ayrıldı.`);
        return;
      }

      if (event.type === "game:start") {
        setLobbyRoom(event.payload.room);
        const ownPlayerId = selfIdRef.current ?? connectedSelfId;
        const self = event.payload.room.players.find((player) => player.id === ownPlayerId);
        const selectedTeam = self?.team ?? managerCountryRef.current;
        managerCountryRef.current = selectedTeam;
        setCountry(selectedTeam);
        setSquad([]);
        setStartingEleven([]);
        setLineupAssignments({});
        setBenchIds([]);
        setSetPieceTakers({});
        setResult(null);
        setTournamentSteps([]);
        setRevealedStepCount(0);
        setFastForwardedAfterElimination(false);
        setOnlinePlanSubmitted(false);
        setOnlinePlanCount(0);
        setOnlinePlanTotal(event.payload.room.players.length);
        setOnlineStepReadyIds([]);
        setStage("squad");
        return;
      }

      if (event.type === "game:plans-update") {
        setLobbyRoom(event.payload.room);
        setOnlinePlanCount(event.payload.readyCount);
        setOnlinePlanTotal(event.payload.totalCount);
        return;
      }

      if (event.type === "game:plans-ready") {
        setLobbyRoom(event.payload.room);
        setOnlinePlanCount(event.payload.plans.length);
        setOnlinePlanTotal(event.payload.room.players.length);

        if (event.payload.room.hostId === connectedSelfId) {
          const nextResult = simulateTournament(
            event.payload.plans.map((plan) => ({
              country: plan.country,
              lineup: plan.lineup,
              tactic: plan.tactic,
              tacticalPlan: plan.tacticalPlan,
              setPieceTakers: plan.setPieceTakers,
            })),
            latestPlayersRef.current,
            latestGroupsRef.current,
          );
          socket.send("game:submit-tournament", {
            result: nextResult,
            steps: createTournamentSteps(nextResult),
          });
        }
        return;
      }

      if (event.type === "game:tournament") {
        setLobbyRoom(event.payload.room);
        setResult(event.payload.result);
        setTournamentSteps(event.payload.steps);
        setRevealedStepCount(0);
        setFastForwardedAfterElimination(false);
        setOnlineStepReadyIds([]);
        setStage("tournament");
        return;
      }

      if (event.type === "game:step-ready-update") {
        setOnlineStepReadyIds(event.payload.readyIds);
        return;
      }

      if (event.type === "game:step") {
        setStage("tournament");
        playOnlineTournamentStep(event.payload.stepIndex, event.payload.step);
        return;
      }

      if (event.type === "game:complete") {
        setLobbyRoom(event.payload.room);
      }
    });

    setLobbySocket(socket);
    socket.send(action === "create" ? "room:create" : "room:join", {
      nickname: nickname.trim(),
      code,
    });
  }

  function startOffline() {
    if (!canUseOnline) {
      setLobbyError("Takma ad en az 2 karakter olmalı.");
      return;
    }
    setPlayMode("offline");
    setLobbyRoom(null);
    setLobbyError("");
    setLobbyConnectingAction(null);
    setOnlinePlanSubmitted(false);
    setOnlinePlanCount(0);
    setOnlinePlanTotal(0);
    setOnlineStepReadyIds([]);
    setStage("team");
  }

  function selectOnlineTeam(team: string) {
    managerCountryRef.current = team;
    setCountry(team);
    setSquad([]);
    setStartingEleven([]);
    setLineupAssignments({});
    setBenchIds([]);
    setSetPieceTakers({});
    lobbySocket?.send("player:select-team", { team });
  }

  function setOnlineReady(ready: boolean) {
    lobbySocket?.send("player:ready", { ready });
  }

  function leaveLobby() {
    lobbySocket?.send("room:leave");
    lobbySocket?.close();
    setLobbySocket(null);
    setLobbyRoom(null);
    setSelfId(null);
    setPlayMode(null);
    setOnlinePlanSubmitted(false);
    setOnlinePlanCount(0);
    setOnlinePlanTotal(0);
    setOnlineStepReadyIds([]);
    setLobbyConnectingAction(null);
    setStage("team");
  }

  function toggleTournamentTeam(team: string) {
    setCustomTournamentTeams((current) => {
      if (current.includes(team)) {
        if (team === country) return current;
        return current.filter((item) => item !== team);
      }

      if (current.length >= 48) return current;
      return [...current, team];
    });
  }

  function selectManagerCountry(team: string) {
    managerCountryRef.current = team;
    setCountry(team);
    setSquad([]);
    setStartingEleven([]);
    setLineupAssignments({});
    setBenchIds([]);
    setSetPieceTakers({});

    if (!useOfficialTournament && !customTournamentTeams.includes(team)) {
      setCustomTournamentTeams((current) => {
        if (current.length < 48) return [...current, team];
        return [team, ...current.slice(0, 47)];
      });
    }
  }

  function toggleSquadPlayer(player: Player) {
    setSquad((current) => {
      if (current.some((item) => item.id === player.id)) {
        setLineupAssignments((assignments) =>
          Object.fromEntries(Object.entries(assignments).filter(([, playerId]) => playerId !== player.id)),
        );
        setBenchIds((ids) => ids.filter((id) => id !== player.id));
        return current.filter((item) => item.id !== player.id);
      }
      if (current.length >= 23) return current;
      return [...current, player].sort((a, b) => b.overall - a.overall);
    });
  }

  function setBestSquad() {
    const nextSquad = countryPlayers.slice(0, 23);
    setSquad(nextSquad);
    const assignments = autoAssignLineup(nextSquad, formation);
    setLineupAssignments(assignments);
    setBenchIds(createBenchIds(nextSquad, assignments));
  }

  function enterLineup() {
    const assignments = autoAssignLineup(squad, formation);
    setLineupAssignments(assignments);
    setBenchIds(createBenchIds(squad, assignments));
    setStage("lineup");
  }

  function changeFormation(nextFormation: Formation) {
    setFormation(nextFormation);
    const assignments = autoAssignLineup(squad, nextFormation);
    setLineupAssignments(assignments);
    setBenchIds(createBenchIds(squad, assignments));
  }

  function changeTactic(nextTactic: Tactic) {
    setTactic(nextTactic);
    setTacticalPlan(tacticDefinitions[nextTactic].plan);
  }

  function updateTacticalPlan(key: keyof TacticalPlan, value: number) {
    setTacticalPlan((current) => ({ ...current, [key]: value }));
  }

  function assignPlayerToSlot(playerId: string, slotId: string) {
    setLineupAssignments((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([id, value]) => id === slotId || value !== playerId));
      const replacedPlayerId = next[slotId];
      next[slotId] = playerId;

      setBenchIds((ids) => {
        const withoutMoved = ids.filter((id) => id !== playerId);
        if (replacedPlayerId && replacedPlayerId !== playerId && withoutMoved.length < 12) {
          return [...withoutMoved, replacedPlayerId];
        }
        return withoutMoved;
      });

      return next;
    });
    setSelectedMovePlayerId(null);
  }

  function sendPlayerToBench(playerId: string) {
    setLineupAssignments((current) =>
      Object.fromEntries(Object.entries(current).filter(([, assignedPlayerId]) => assignedPlayerId !== playerId)),
    );
    setBenchIds((ids) => (ids.includes(playerId) || ids.length >= 12 ? ids : [...ids, playerId]));
    setSelectedMovePlayerId(null);
  }

  function quickPlacePlayer(player: Player) {
    const emptySlot = selectedFormation.slots.find((slot) => !lineupAssignments[slot.id] && slot.position === player.position);
    const fallbackSlot = selectedFormation.slots.find((slot) => !lineupAssignments[slot.id]);
    const target = emptySlot ?? fallbackSlot;
    if (target) assignPlayerToSlot(player.id, target.id);
  }

  function selectPlayerForMove(playerId: string) {
    setSelectedMovePlayerId((current) => (current === playerId ? null : playerId));
  }

  function placeSelectedPlayer(slotId: string) {
    if (!selectedMovePlayerId) return;
    assignPlayerToSlot(selectedMovePlayerId, slotId);
  }

  function playWhistle(kind: "short" | "long" = "short") {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const now = context.currentTime;
    const duration = kind === "long" ? 0.72 : 0.28;
    const master = context.createGain();
    const tone = context.createOscillator();
    const toneGain = context.createGain();
    const noise = context.createBufferSource();
    const noiseFilter = context.createBiquadFilter();
    const noiseGain = context.createGain();

    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = (Math.random() * 2 - 1) * (1 - index / samples.length);
    }

    tone.type = "square";
    tone.frequency.setValueAtTime(kind === "long" ? 2550 : 3050, now);
    tone.frequency.exponentialRampToValueAtTime(kind === "long" ? 3450 : 3800, now + 0.055);
    tone.frequency.exponentialRampToValueAtTime(kind === "long" ? 2850 : 3300, now + duration);

    toneGain.gain.setValueAtTime(0.001, now);
    toneGain.gain.exponentialRampToValueAtTime(0.13, now + 0.018);
    toneGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.buffer = buffer;
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(3200, now);
    noiseFilter.Q.setValueAtTime(8, now);
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.045, now + 0.012);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.82);

    master.gain.setValueAtTime(0.8, now);
    master.gain.exponentialRampToValueAtTime(0.001, now + duration + 0.04);

    tone.connect(toneGain).connect(master);
    noise.connect(noiseFilter).connect(noiseGain).connect(master);
    master.connect(context.destination);

    tone.start(now);
    noise.start(now);
    tone.stop(now + duration);
    noise.stop(now + duration);
    window.setTimeout(() => void context.close(), (duration + 0.12) * 1000);
  }

  function findFeaturedMatch(step: TournamentStep): MatchResult {
    const managerCountry = managerCountryRef.current;
    return step.matches.find((match) => match.home === managerCountry || match.away === managerCountry) ?? step.matches[0];
  }

  function playLiveMatch(match: MatchResult, onComplete: () => void) {
    liveTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    liveTimersRef.current = [];
    setLiveMatch(match);
    setLiveEvents([]);
    setLiveScore({ home: 0, away: 0 });
    setGoalSuspense(false);
    setActiveAnimation(null);

    const fullTimeEvent = match.events.find((event) => event.type === "full-time");
    const penaltiesEvent = match.events.find((event) => event.type === "penalties");
    const eventsToPlay = match.events.slice(0, 24);
    match.events
      .filter((event) => event.type === "goal")
      .forEach((event) => {
        if (!eventsToPlay.includes(event)) eventsToPlay.push(event);
      });
    if (penaltiesEvent && !eventsToPlay.includes(penaltiesEvent)) eventsToPlay.push(penaltiesEvent);
    if (fullTimeEvent && !eventsToPlay.includes(fullTimeEvent)) eventsToPlay.push(fullTimeEvent);
    eventsToPlay.sort((a, b) => a.minute - b.minute);
    let completed = false;
    let index = 0;
    let safetyTimer = 0;

    const schedule = (callback: () => void, delay: number) => {
      const timerId = window.setTimeout(() => {
        liveTimersRef.current = liveTimersRef.current.filter((id) => id !== timerId);
        callback();
      }, delay);
      liveTimersRef.current.push(timerId);
      return timerId;
    };

    const finish = () => {
      if (completed) return;
      completed = true;
      liveTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      liveTimersRef.current = [];
      setGoalSuspense(false);
      setActiveAnimation(null);
      setLiveScore({ home: match.homeScore, away: match.awayScore });
      schedule(onComplete, 900);
    };

    const revealEvent = (event: MatchEvent) => {
      setLiveEvents((current) => [...current, event].slice(-12));
      if (event.type === "goal") {
        setLiveScore((current) => ({
          home: current.home + (event.team === match.home ? 1 : 0),
          away: current.away + (event.team === match.away ? 1 : 0),
        }));
      }
      if (event.suspense) setGoalSuspense(true);
      if (event.type === "goal" || event.type === "miss" || event.type === "post" || event.type === "save") {
        setGoalSuspense(false);
      }
    };

    const tick = () => {
      const event = eventsToPlay[index];

      if (!event) {
        finish();
        return;
      }

      const animation = animationForEvent(event);
      const leadTime = animationLeadTime(animation);
      if (animation) setActiveAnimation(animation);
      if (event.whistle) playWhistle(event.type === "full-time" || event.type === "half-time" ? "long" : "short");

      schedule(() => {
        revealEvent(event);
        if (animation) schedule(() => setActiveAnimation(null), 650);
        index += 1;
        schedule(tick, liveEventDelay(event));
      }, leadTime);
    };

    safetyTimer = schedule(finish, eventsToPlay.length * 3200 + 5000);
    tick();
  }

  function playTournamentStep(stepIndex: number, steps = tournamentSteps) {
    const step = steps[stepIndex];
    if (!step) return;

    setIsSimulating(true);
    const featuredMatch = findFeaturedMatch(step);

    playLiveMatch(featuredMatch, () => {
      const nextRevealedCount = Math.max(stepIndex + 1, revealedStepCount + 1);
      const managerCountry = managerCountryRef.current;
      const hasFutureUserMatch = steps
        .slice(nextRevealedCount)
        .some((futureStep) => futureStep.matches.some((match) => match.home === managerCountry || match.away === managerCountry));

      setRevealedStepCount(hasFutureUserMatch || nextRevealedCount >= steps.length ? nextRevealedCount : steps.length);
      setFastForwardedAfterElimination(!hasFutureUserMatch && nextRevealedCount < steps.length);
      setLiveMatch(null);
      setIsSimulating(false);
      setStage("tournament");
    });
  }

  function playOnlineTournamentStep(stepIndex: number, step: TournamentStep) {
    setIsSimulating(true);
    setOnlineStepReadyIds([]);
    const featuredMatch = findFeaturedMatch(step);

    playLiveMatch(featuredMatch, () => {
      setRevealedStepCount((current) => Math.max(current, stepIndex + 1));
      setLiveMatch(null);
      setIsSimulating(false);
      setStage("tournament");
    });
  }

  function submitOnlinePlan() {
    if (lineupPlayers.length !== 11) return;

    const plan: Omit<OnlineTeamPlan, "playerId"> = {
      country,
      lineup: lineupPlayers,
      tactic,
      tacticalPlan,
      setPieceTakers: currentSetPieceTakers(),
    };

    setOnlinePlanSubmitted(true);
    setStage("tournament");
    lobbySocket?.send("game:submit-plan", { plan });
  }

  function readyForNextOnlineStep() {
    if (!result || allStepsRevealed || !selfId) return;
    setOnlineStepReadyIds((current) => (current.includes(selfId) ? current : [...current, selfId]));
    lobbySocket?.send("game:step-ready");
  }

  function currentSetPieceTakers(): SetPieceTakers {
    return {
      penaltyTakerId: selectedPenaltyTaker?.id,
      freeKickTakerId: selectedFreeKickTaker?.id,
    };
  }

  function runTournament() {
    if (playMode === "online") {
      submitOnlinePlan();
      return;
    }

    const nextResult = simulateTournament({ country, lineup: startingEleven, tactic, tacticalPlan, setPieceTakers: currentSetPieceTakers() }, players, tournamentGroups);
    const steps = createTournamentSteps(nextResult);

    setResult(nextResult);
    setTournamentSteps(steps);
    setRevealedStepCount(0);
    setFastForwardedAfterElimination(false);
    setStage("tournament");
    playTournamentStep(0, steps);
  }

  function resetGame() {
    liveTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    liveTimersRef.current = [];
    setStage("team");
    setSquad([]);
    setStartingEleven([]);
    setLineupAssignments({});
    setBenchIds([]);
    setSetPieceTakers({});
    setResult(null);
    setTournamentSteps([]);
    setRevealedStepCount(0);
    setFastForwardedAfterElimination(false);
    setIsSimulating(false);
    setLiveMatch(null);
    setLiveEvents([]);
    setLiveScore({ home: 0, away: 0 });
    setGoalSuspense(false);
    setActiveAnimation(null);
    setOnlinePlanSubmitted(false);
    setOnlinePlanCount(0);
    setOnlinePlanTotal(0);
    setOnlineStepReadyIds([]);
    setLobbyConnectingAction(null);
  }

  if (!playMode) {
    return (
      <main className="app-shell">
        <section className="entry-screen">
          <div className="entry-panel">
            <div className="entry-brand">
              <img src={worldCupLogoUrl} alt="Dünya Kupası" />
              <span>2026 Dünya Kupası</span>
            </div>
            <p className="eyebrow">Online Dünya Kupası</p>
            <h1>Dünyanın Oyununa Hoş Geldiniz</h1>
            <label className="entry-field">
              <span>Takma adınız</span>
              <input
                maxLength={24}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="Örn. Anıl"
                value={nickname}
              />
            </label>
            <div className="entry-actions">
              <button className="primary-action" disabled={!canUseOnline || isLobbyConnecting} onClick={startOffline}>
                <Play size={18} />
                Offline oyna
              </button>
              <button className="secondary-action" disabled={!canCreateLobby} onClick={() => connectLobby("create")}>
                <Users size={18} />
                {lobbyConnectingAction === "create" ? "Kuruluyor..." : "Oda kur"}
              </button>
            </div>
            <form className="join-row" onSubmit={(event) => {
              event.preventDefault();
              if (canJoinLobby) connectLobby("join");
            }}>
              <input
                maxLength={6}
                inputMode="text"
                onChange={(event) => setJoinCode(normalizeRoomCode(event.target.value))}
                placeholder="Oda kodu"
                value={joinCode}
              />
              <button disabled={!canJoinLobby} type="submit">
                {lobbyConnectingAction === "join" ? "Katılıyor..." : "Katıl"}
              </button>
            </form>
            {lobbyError && <p className={isLobbyConnecting ? "form-status" : "form-error"}>{lobbyError}</p>}
          </div>
        </section>
      </main>
    );
  }

  if (playMode === "online" && lobbyRoom?.status === "lobby") {
    return (
      <main className="app-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Online lobi</p>
            <h1>Takımını seç ve hazır ol</h1>
          </div>
          <div className="room-code">
            <span>Oda kodu</span>
            <strong>{lobbyRoom.code}</strong>
          </div>
        </header>

        <section className="workspace lobby-layout">
          <section className="panel">
            <div className="panel__intro">
              <Shield size={22} />
              <div>
                <h2>Takım seçimi</h2>
                <p>Her takım yalnızca bir oyuncu tarafından seçilebilir. Herkes takımını seçip hazır olunca oyun başlar.</p>
              </div>
            </div>
            <div className="country-grid">
              {officialWorldCup2026Teams.map((team) => {
                const takenByOther = lobbyRoom.players.some((player) => player.id !== selfId && player.team === team);
                const selectedBySelf = selfLobbyPlayer?.team === team;
                const realPlayers = getPlayersByCountry(team, players);
                const teamPool = getCountryPlayerPool(team, players);
                return (
                  <button
                    className={selectedBySelf ? "country-tile is-selected" : "country-tile"}
                    disabled={takenByOther || selfLobbyPlayer?.ready}
                    key={team}
                    onClick={() => selectOnlineTeam(team)}
                  >
                    <span>{team}</span>
                    <span className="country-tile__meta">
                      <strong>{takenByOther ? "Dolu" : averageOverall(teamPool.slice(0, 23))}</strong>
                      {realPlayers.length < 23 && <small>tamamlandı</small>}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="side-panel lobby-sidebar">
            <h3>Oyuncular</h3>
            <div className="lobby-player-list">
              {lobbyRoom.players.map((player) => (
                <article className={player.id === selfId ? "lobby-player is-self" : "lobby-player"} key={player.id}>
                  <strong>{player.nickname}{player.isHost ? " · Kurucu" : ""}</strong>
                  <span>{player.team ?? "Takım seçmedi"}</span>
                  <em>{player.ready ? "Hazır" : "Bekliyor"}</em>
                </article>
              ))}
            </div>
            <dl>
              <div>
                <dt>Oyuncu</dt>
                <dd>{lobbyRoom.players.length}/{lobbyRoom.maxPlayers}</dd>
              </div>
              <div>
                <dt>Hazır</dt>
                <dd>{lobbyRoom.players.filter((player) => player.ready).length}</dd>
              </div>
            </dl>
            <button
              className="primary-action"
              disabled={!selfLobbyPlayer?.team}
              onClick={() => setOnlineReady(!selfLobbyPlayer?.ready)}
            >
              <Check size={18} />
              {selfLobbyPlayer?.ready ? "Hazırı kaldır" : "Hazırım"}
            </button>
            <button className="secondary-action" onClick={leaveLobby}>
              <ChevronLeft size={18} />
              Lobiden çık
            </button>
            {lobbyError && <p className="form-error">{lobbyError}</p>}
          </aside>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Ücretsiz futbol simülasyonu</p>
          <h1>Hafif Sıklet Dünya Kupası Menajeri</h1>
        </div>
        <div className="topbar__metric">
          <Trophy size={18} />
          <span>{country}</span>
        </div>
      </header>

      <section className="workspace">
        <div className={dataStatus === "ready" ? "data-pill" : "data-pill data-pill--muted"}>
          {dataStatus === "loading" && "FC26_20250921.csv yükleniyor"}
          {dataStatus === "ready" && `${players.length.toLocaleString("tr-TR")} gerçek FC26 oyuncusu yüklendi`}
          {dataStatus === "fallback" && "Dataset okunamadı, örnek veriyle devam ediliyor"}
        </div>

        <nav className="steps" aria-label="Oyun ilerlemesi">
          {["team", "squad", "lineup", "tournament"].map((item) => (
            <span key={item} className={stage === item ? "is-active" : ""} />
          ))}
        </nav>

        {stage === "team" && (
          <section className="two-column two-column--wide">
            <div className="panel">
              <div className="panel__intro">
                <Shield size={22} />
                <div>
                  <h2>Milli takımını seç</h2>
                  <p>
                    Menajeri olacağın takımı seç. Resmi mod açıkken yalnızca 2026 Dünya Kupası'ndaki 48 takım
                    listelenir.
                  </p>
                </div>
              </div>
              <div className="country-grid">
                {managerCountries.map((item) => (
                  <button
                    className={item === country ? "country-tile is-selected" : "country-tile"}
                    key={item}
                    onClick={() => selectManagerCountry(item)}
                  >
                    <span>{item}</span>
                    <strong>{averageOverall(getCountryPlayerPool(item, players).slice(0, 23))}</strong>
                  </button>
                ))}
              </div>
              <button className="primary-action" disabled={!canStartSquad} onClick={() => setStage("squad")}>
                <Users size={18} />
                Kadro havuzuna geç
              </button>
            </div>

            <aside className="side-panel tournament-panel">
              <div className="panel__intro">
                <Settings2 size={22} />
                <div>
                  <h3>Turnuva ayarı</h3>
                  <p>48 takım, 12 grup ve resmi Son 32 ağacı.</p>
                </div>
              </div>
              <label className="switch-row">
                <input
                  checked={useOfficialTournament}
                  onChange={(event) => setUseOfficialTournament(event.target.checked)}
                  type="checkbox"
                />
                <span>Resmi 2026 gruplarını kullan</span>
              </label>
              <dl>
                <div>
                  <dt>Katılımcı</dt>
                  <dd>{tournamentTeams.length}/48</dd>
                </div>
                <div>
                  <dt>Grup</dt>
                  <dd>12 x 4</dd>
                </div>
                <div>
                  <dt>Format</dt>
                  <dd>İlk 2 + en iyi 8 üçüncü</dd>
                </div>
              </dl>

              {!useOfficialTournament && (
                <>
                  <div className="toolbar">
                    <button onClick={() => setCustomTournamentTeams(officialWorldCup2026Teams)}>Resmi 48'i yükle</button>
                    <button onClick={() => setCustomTournamentTeams(availableCountries.slice(0, 48))}>
                      Veri setinden ilk 48
                    </button>
                  </div>
                  <div className="team-picker">
                    {availableCountries.map((item) => {
                      const selected = customTournamentTeams.includes(item);
                      return (
                        <button
                          className={selected ? "team-chip is-selected" : "team-chip"}
                          key={item}
                          onClick={() => toggleTournamentTeam(item)}
                        >
                          {selected && <Check size={14} />}
                          <span>{item}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="group-preview">
                {tournamentGroups.map((group) => (
                  <section key={group.id}>
                    <strong>{group.name}</strong>
                    <span>{group.teams.join(", ")}</span>
                  </section>
                ))}
              </div>
            </aside>
          </section>
        )}

        {stage === "squad" && (
          <section className="two-column">
            <div className="panel">
              <div className="panel__intro">
                <Users size={22} />
                <div>
                  <h2>23 kişilik kadro</h2>
                  <p>{countryPlayers.length} aktif oyuncu içinden turnuva kadrosunu belirle.</p>
                </div>
              </div>
              <div className="toolbar">
                <span>{squad.length}/23 seçildi</span>
                <button onClick={setBestSquad}>En güçlü 23</button>
              </div>
              <div className="player-list">
                {countryPlayers.map((player) => {
                  const selected = squad.some((item) => item.id === player.id);

                  return (
                    <button
                      key={player.id}
                      className={selected ? "player-row is-selected" : "player-row"}
                      onClick={() => toggleSquadPlayer(player)}
                    >
                      <span className="rating">{player.overall}</span>
                      <span>
                        <strong>{player.name}</strong>
                        <small>
                          {player.position} · {player.club}
                        </small>
                      </span>
                      {selected && <Check size={17} />}
                    </button>
                  );
                })}
              </div>
              <AdSlot label="AdSense banner - kadro seçim alt alanı" />
            </div>
            <aside className="side-panel">
              <h3>Kadro dengesi</h3>
              <dl>
                <div>
                  <dt>Ortalama</dt>
                  <dd>{averageOverall(squad)}</dd>
                </div>
                <div>
                  <dt>Kaleci</dt>
                  <dd>{squad.filter((player) => player.position === "GK").length}</dd>
                </div>
                <div>
                  <dt>Defans</dt>
                  <dd>{squad.filter((player) => player.position === "DEF").length}</dd>
                </div>
                <div>
                  <dt>Orta saha</dt>
                  <dd>{squad.filter((player) => player.position === "MID").length}</dd>
                </div>
                <div>
                  <dt>Forvet</dt>
                  <dd>{squad.filter((player) => player.position === "FWD").length}</dd>
                </div>
              </dl>
              <button className="secondary-action" onClick={() => setStage("team")}>
                <ChevronLeft size={18} />
                Geri
              </button>
              <button className="primary-action" disabled={squad.length !== 23} onClick={enterLineup}>
                İlk 11 ve taktik
              </button>
              <AdSlot label="AdSense rail - kadro yanı" variant="rail" />
            </aside>
          </section>
        )}

        {stage === "lineup" && (
          <section className="lineup-layout">
            <div className="panel tactics-workbench">
              <div className="panel__intro">
                <Activity size={22} />
                <div>
                  <h2>İlk 11 ve oyun planı</h2>
                  <p>Mobilde oyuncuya dokunup saha slotuna yerleştir; masaüstünde sürükle-bırak da kullanabilirsin.</p>
                </div>
              </div>

              <div className={selectedMovePlayer ? "mobile-pickbar is-active" : "mobile-pickbar"}>
                {selectedMovePlayer ? (
                  <>
                    <span>Seçili oyuncu</span>
                    <strong>{selectedMovePlayer.name}</strong>
                    <button onClick={() => setSelectedMovePlayerId(null)}>Vazgeç</button>
                  </>
                ) : (
                  <span>Oyuncu havuzundan bir oyuncuya dokun, sonra sahadaki slota dokun.</span>
                )}
              </div>

              <div className="formation-strip">
                {formationList.map((item) => (
                  <button
                    className={formation === item.id ? "is-selected" : ""}
                    key={item.id}
                    onClick={() => changeFormation(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="pitch-and-pool">
                <section className="pitch-board" onDragOver={(event) => event.preventDefault()}>
                  <div className="pitch-lines" aria-hidden="true" />
                  {selectedFormation.slots.map((slot) => {
                    const assigned = squad.find((player) => player.id === lineupAssignments[slot.id]);
                    return (
                      <button
                        className={[
                          assigned ? "pitch-slot is-filled" : "pitch-slot",
                          selectedMovePlayerId && !assigned ? "is-targetable" : "",
                          assigned?.id === selectedMovePlayerId ? "is-selected-player" : "",
                        ].filter(Boolean).join(" ")}
                        draggable={Boolean(assigned)}
                        key={slot.id}
                        onClick={() => {
                          if (selectedMovePlayerId) {
                            placeSelectedPlayer(slot.id);
                            return;
                          }
                          if (assigned) selectPlayerForMove(assigned.id);
                        }}
                        onDragOver={(event) => event.preventDefault()}
                        onDragStart={() => assigned && setDraggedPlayerId(assigned.id)}
                        onDrop={() => {
                          if (draggedPlayerId) assignPlayerToSlot(draggedPlayerId, slot.id);
                          setDraggedPlayerId(null);
                        }}
                        style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                        title={`${slot.label} slotu`}
                      >
                        <span>{slot.label}</span>
                        <strong>{assigned?.name.split(" ").slice(-1)[0] ?? "Boş"}</strong>
                        {assigned && <em>{assigned.overall}</em>}
                      </button>
                    );
                  })}
                </section>

                <section className="selection-dock">
                  <div className="dock-header">
                    <strong>Oyuncu havuzu</strong>
                    <span>{lineupPlayers.length}/11</span>
                  </div>
                  <div className="mini-player-list">
                    {squad.map((player) => {
                      const inLineup = lineupPlayers.some((item) => item.id === player.id);
                      const onBench = benchIds.includes(player.id);
                      return (
                        <button
                          className={[
                            inLineup ? "mini-player is-lineup" : onBench ? "mini-player is-bench" : "mini-player",
                            selectedMovePlayerId === player.id ? "is-selected-player" : "",
                          ].filter(Boolean).join(" ")}
                          draggable
                          key={player.id}
                          onClick={() => selectPlayerForMove(player.id)}
                          onDoubleClick={() => quickPlacePlayer(player)}
                          onDragStart={() => setDraggedPlayerId(player.id)}
                        >
                          <span className="rating">{player.overall}</span>
                          <span>
                            <strong>{player.name}</strong>
                            <small>{player.position} · {player.club}</small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>

              <section
                className="bench-dock"
                onClick={() => selectedMovePlayerId && sendPlayerToBench(selectedMovePlayerId)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (draggedPlayerId) sendPlayerToBench(draggedPlayerId);
                  setDraggedPlayerId(null);
                }}
              >
                <div className="dock-header">
                  <strong>Yedek kulübesi</strong>
                  <span>{benchPlayers.length}/12</span>
                </div>
                <div className="bench-list">
                  {benchPlayers.map((player) => (
                    <button
                      className="bench-chip"
                      draggable
                      key={player.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        selectPlayerForMove(player.id);
                      }}
                      onDoubleClick={() => quickPlacePlayer(player)}
                      onDragStart={() => setDraggedPlayerId(player.id)}
                    >
                      <strong>{player.overall}</strong>
                      <span>{player.name}</span>
                    </button>
                  ))}
                  {benchPlayers.length === 0 && <span className="empty-note">Oyuncuyu buraya sürükle.</span>}
                </div>
              </section>
            </div>

            <aside className="side-panel tactical-panel">
              <h3>Maç planı</h3>
              <dl>
                <div>
                  <dt>İlk 11</dt>
                  <dd>{lineupPlayers.length}/11</dd>
                </div>
                <div>
                  <dt>Yedek</dt>
                  <dd>{benchPlayers.length}/12</dd>
                </div>
                <div>
                  <dt>Overall</dt>
                  <dd>{averageOverall(lineupPlayers)}</dd>
                </div>
                <div>
                  <dt>Diziliş</dt>
                  <dd>{formation}</dd>
                </div>
              </dl>

              <div className="tactic-grid">
                {tacticList.map((item) => (
                  <button
                    className={tactic === item.id ? "tactic-card is-selected" : "tactic-card"}
                    key={item.id}
                    onClick={() => changeTactic(item.id)}
                  >
                    <span>{item.family}</span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </button>
                ))}
              </div>

              <div className="set-piece-panel">
                <strong>Duran top görevleri</strong>
                <label>
                  <span>Penaltıcı</span>
                  <select
                    disabled={lineupPlayers.length === 0}
                    onChange={(event) => setSetPieceTakers((current) => ({ ...current, penaltyTakerId: event.target.value }))}
                    value={selectedPenaltyTaker?.id ?? ""}
                  >
                    {lineupPlayers.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name} · {Math.round(penaltySkill(player))}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Serbest vuruşçu</span>
                  <select
                    disabled={lineupPlayers.length === 0}
                    onChange={(event) => setSetPieceTakers((current) => ({ ...current, freeKickTakerId: event.target.value }))}
                    value={selectedFreeKickTaker?.id ?? ""}
                  >
                    {lineupPlayers.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name} · {Math.round(freeKickSkill(player))}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="plan-sliders">
                {[
                  ["mentality", "Mentalite"],
                  ["defensiveLine", "Defans çizgisi"],
                  ["pressIntensity", "Pres şiddeti"],
                  ["counterPress", "Karşı pres"],
                  ["buildUpSpeed", "Geçiş hızı"],
                  ["passingDirectness", "Pas direktliği"],
                  ["attackingWidth", "Hücum genişliği"],
                  ["tempo", "Tempo"],
                ].map(([key, label]) => (
                  <label key={key}>
                    <span>
                      {label}
                      <em>{planValueLabel(tacticalPlan[key as keyof TacticalPlan])}</em>
                    </span>
                    <input
                      max="100"
                      min="0"
                      onChange={(event) => updateTacticalPlan(key as keyof TacticalPlan, Number(event.target.value))}
                      type="range"
                      value={tacticalPlan[key as keyof TacticalPlan]}
                    />
                  </label>
                ))}
              </div>

              <button className="secondary-action" onClick={() => setStage("squad")}>
                <ChevronLeft size={18} />
                Geri
              </button>
              <button className="primary-action" disabled={lineupPlayers.length !== 11} onClick={runTournament}>
                <Play size={18} />
                {playMode === "online" ? "Kadrom hazır" : "Turnuvayı simüle et"}
              </button>
            </aside>
          </section>
        )}

        {isSimulating && (
          <div className="interstitial" role="status">
            <section className="live-match">
              <div className="live-match__head">
                <Volume2 size={18} />
                <span>Canlı maç anlatımı</span>
              </div>
              <h2>{liveMatch ? `${liveMatch.home} - ${liveMatch.away}` : "Maç hazırlanıyor"}</h2>
              {liveMatch && (
                <div className="live-scoreboard">
                  <span>{liveMatch.home}</span>
                  <strong>{liveScore.home} - {liveScore.away}</strong>
                  <span>{liveMatch.away}</span>
                </div>
              )}
              <MatchEventAnimation type={activeAnimation} />
              <div className={goalSuspense ? "goal-suspense is-active" : "goal-suspense"}>Gol olacak mı?</div>
              <div className="live-feed" ref={liveFeedRef}>
                {liveEvents.map((event, index) => (
                  <article className={`live-event live-event--${event.type}`} key={`${event.minute}-${index}`}>
                    <strong>{event.minute}'</strong>
                    <span>{event.text}</span>
                  </article>
                ))}
              </div>
              <AdSlot label="AdSense interstitial trigger - maç simülasyonu" variant="interstitial" />
            </section>
          </div>
        )}

        {playMode === "online" && stage === "tournament" && !result && (
          <section className="two-column">
            <div className="panel">
              <div className="panel__intro">
                <Users size={22} />
                <div>
                  <h2>Oyuncular bekleniyor</h2>
                  <p>
                    {onlinePlanSubmitted
                      ? "Kadro ve taktik planın gönderildi. Herkes hazır olduğunda ortak turnuva akışı başlayacak."
                      : "Kadro ve taktik planını göndermek için ilk 11 ekranına dön."}
                  </p>
                </div>
              </div>
              <dl>
                <div>
                  <dt>Hazır plan</dt>
                  <dd>{onlinePlanCount}/{onlinePlanTotal || lobbyRoom?.players.length || 0}</dd>
                </div>
                <div>
                  <dt>Oda kodu</dt>
                  <dd>{lobbyRoom?.code ?? "-"}</dd>
                </div>
              </dl>
            </div>
            <aside className="side-panel lobby-sidebar">
              <h3>Oyuncular</h3>
              <div className="lobby-player-list">
                {lobbyRoom?.players.map((player) => (
                  <article className={player.id === selfId ? "lobby-player is-self" : "lobby-player"} key={player.id}>
                    <strong>{player.nickname}{player.isHost ? " · Kurucu" : ""}</strong>
                    <span>{player.team ?? "Takım seçmedi"}</span>
                    <em>{player.setupReady ? "Plan hazır" : "Plan bekleniyor"}</em>
                  </article>
                ))}
              </div>
              <button className="secondary-action" onClick={() => setStage("lineup")}>
                <ChevronLeft size={18} />
                İlk 11'e dön
              </button>
            </aside>
          </section>
        )}

        {stage === "tournament" && result && (
          <section className="results">
            <section className="panel tournament-stepper">
              <div>
                <p className="eyebrow">Turnuva akışı</p>
                <h2>{allStepsRevealed ? "Turnuva tamamlandı" : currentTournamentStep?.title ?? "Sıradaki adım"}</h2>
                <p>
                  {fastForwardedAfterElimination
                    ? `${country} elendi. Kalan maçlar hızlı simülasyonla tamamlandı.`
                    : allStepsRevealed
                      ? `Şampiyon: ${result.champion}`
                      : currentTournamentStep?.subtitle}
                </p>
              </div>
              <div className="step-actions">
                {playMode !== "online" && !allStepsRevealed && currentTournamentStep && (
                  <button className="primary-action" disabled={isSimulating} onClick={() => playTournamentStep(revealedStepCount)}>
                    <Play size={18} />
                    {revealedStepCount < 3 ? `${revealedStepCount + 1}. maçları oynat` : `${currentTournamentStep.title} oynat`}
                  </button>
                )}
                {playMode === "online" && !allStepsRevealed && currentTournamentStep && (
                  <button className="primary-action" disabled={isSimulating || onlineSelfStepReady} onClick={readyForNextOnlineStep}>
                    <Check size={18} />
                    {onlineSelfStepReady
                      ? `Bekleniyor ${onlineStepReadyCount}/${lobbyRoom?.players.length ?? onlinePlanTotal}`
                      : "Sonraki haftaya hazırım"}
                  </button>
                )}
                <button className="secondary-action" onClick={resetGame}>
                  <RotateCcw size={18} />
                  Yeniden başla
                </button>
              </div>
            </section>

            {allStepsRevealed && (
              <div className="panel hero-result">
                <Trophy size={34} />
                <div>
                  <p className="eyebrow">Şampiyon</p>
                  <h2>{result.champion}</h2>
                  {result.thirdPlaceWinner && <small>Üçüncü: {result.thirdPlaceWinner}</small>}
                </div>
              </div>
            )}

            {revealedSteps.length > 0 && (
              <section className="timeline-list">
                {revealedSteps.map((step, index) => (
                  <article className="panel step-results" key={step.id}>
                    <div className="dock-header">
                      <h3>{step.title}</h3>
                      <span>{index + 1}/{tournamentSteps.length}</span>
                    </div>
                    <div className="match-list-grid">
                      {step.matches.map((match) => (
                        <article
                          className={match.home === country || match.away === country ? "match-card is-user-match" : "match-card"}
                          key={match.id}
                        >
                          <strong>
                            {match.home} {match.homeScore} - {match.awayScore} {match.away}
                          </strong>
                          {match.decidedByPenalties && <em>Penaltılarla kazanan: {match.decidedByPenalties}</em>}
                          <small>
                            {match.goals.length
                              ? match.goals.map((goal) => `${goal.minute}' ${goal.scorer}`).join(", ")
                              : "Gol yok"}
                          </small>
                          {(match.home === country || match.away === country) && (
                            <details>
                              <summary>Maç anlatımı</summary>
                              {match.events.slice(0, 10).map((event, eventIndex) => (
                                <p key={`${event.minute}-${eventIndex}`}>
                                  {event.minute}' {event.text}
                                </p>
                              ))}
                            </details>
                          )}
                        </article>
                      ))}
                    </div>
                  </article>
                ))}
              </section>
            )}

            <div className="result-grid result-grid--groups">
              {visibleGroups.map((group) => (
                <section className="panel" key={group.name}>
                  <h3>{group.name}</h3>
                  <div className="table">
                    <div className="table__head">
                      <span>Takım</span>
                      <span>O</span>
                      <span>AV</span>
                      <span>P</span>
                    </div>
                    {group.standings.map((standing, index) => (
                      <div className={index < 2 ? "table__row is-qualified" : "table__row"} key={standing.team}>
                        <span>{standing.team}</span>
                        <span>{standing.played}</span>
                        <span>{standing.goalsFor - standing.goalsAgainst}</span>
                        <span>{standing.points}</span>
                      </div>
                    ))}
                  </div>
                  <AdSlot label="AdSense banner - puan durumu altı" />
                </section>
              ))}
            </div>

            {revealedStepCount >= 3 && (
              <section className="panel">
                <h3>En iyi üçüncüler</h3>
                <div className="table third-table">
                  {result.thirdPlaceTable.map((standing, index) => (
                    <div className={index < 8 ? "table__row is-qualified" : "table__row"} key={standing.team}>
                      <span>
                        {index + 1}. {standing.team} ({standing.groupId})
                      </span>
                      <span>{standing.points} P</span>
                      <span>AV {standing.goalsFor - standing.goalsAgainst}</span>
                      <span>{standing.goalsFor} gol</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </section>
        )}

      </section>
    </main>
  );
}
