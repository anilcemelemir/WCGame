import { LobbyRoom, OnlineTeamPlan, TournamentResult } from "../types";

interface OnlineTournamentStep {
  id: string;
  title: string;
  subtitle: string;
  matches: import("../types").MatchResult[];
  kind: "group" | "knockout";
}

export type LobbyClientEvent =
  | { type: "connected"; payload: { maxPlayers: number } }
  | { type: "room:joined"; payload: { selfId: string; room: LobbyRoom } }
  | { type: "room:update"; payload: { room: LobbyRoom } }
  | { type: "game:start"; payload: { room: LobbyRoom } }
  | { type: "game:plans-update"; payload: { room: LobbyRoom; readyCount: number; totalCount: number } }
  | { type: "game:plans-ready"; payload: { room: LobbyRoom; plans: OnlineTeamPlan[] } }
  | { type: "game:tournament"; payload: { room: LobbyRoom; result: TournamentResult; steps: OnlineTournamentStep[] } }
  | {
      type: "game:step-ready-update";
      payload: { readyIds: string[]; nextStepIndex: number; totalSteps: number };
    }
  | {
      type: "game:step";
      payload: { stepIndex: number; step: OnlineTournamentStep; nextStepIndex: number; totalSteps: number };
    }
  | { type: "game:complete"; payload: { room: LobbyRoom } }
  | { type: "error"; payload: { message: string } };

export function createLobbySocket(onEvent: (event: LobbyClientEvent) => void) {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const lobbyHost = import.meta.env.VITE_LOBBY_HOST ?? `${window.location.hostname}:8787`;
  const lobbyUrl = lobbyHost.startsWith("ws://") || lobbyHost.startsWith("wss://") ? lobbyHost : `${protocol}://${lobbyHost}`;
  const socket = new WebSocket(lobbyUrl);

  socket.addEventListener("message", (event) => {
    onEvent(JSON.parse(event.data));
  });
  socket.addEventListener("error", () => {
    onEvent({ type: "error", payload: { message: "Lobi sunucusuna bağlanılamadı." } });
  });

  return {
    send(type: string, payload: Record<string, unknown> = {}) {
      const message = JSON.stringify({ type, payload });
      if (socket.readyState === WebSocket.OPEN) socket.send(message);
      else socket.addEventListener("open", () => socket.send(message), { once: true });
    },
    close() {
      socket.close();
    },
  };
}
