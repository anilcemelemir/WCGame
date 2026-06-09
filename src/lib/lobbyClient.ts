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

function lobbySocketUrl() {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const lobbyHost = import.meta.env.VITE_LOBBY_HOST ?? `${window.location.hostname}:8787`;
  return lobbyHost.startsWith("ws://") || lobbyHost.startsWith("wss://") ? lobbyHost : `${protocol}://${lobbyHost}`;
}

export function createLobbySocket(onEvent: (event: LobbyClientEvent) => void) {
  const lobbyUrl = lobbySocketUrl();
  const pendingMessages: string[] = [];
  let socket: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let retryCount = 0;
  let closedByClient = false;

  const flushPending = () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    while (pendingMessages.length > 0) {
      const message = pendingMessages.shift();
      if (message) socket.send(message);
    }
  };

  const scheduleReconnect = () => {
    if (closedByClient) return;
    if (reconnectTimer) return;
    if (retryCount >= 6) {
      onEvent({
        type: "error",
        payload: { message: "Lobi sunucusuna bağlanılamadı. Sunucu uyanıyor olabilir; birkaç saniye sonra tekrar dene." },
      });
      return;
    }

    const delay = Math.min(900 + retryCount * 900, 5200);
    retryCount += 1;
    reconnectTimer = window.setTimeout(connect, delay);
  };

  const connect = () => {
    if (closedByClient) return;
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    socket = new WebSocket(lobbyUrl);
    socket.addEventListener("open", () => {
      retryCount = 0;
      flushPending();
    });
    socket.addEventListener("message", (event) => {
      onEvent(JSON.parse(event.data));
    });
    socket.addEventListener("close", () => {
      if (pendingMessages.length > 0) scheduleReconnect();
    });
    socket.addEventListener("error", () => {
      scheduleReconnect();
    });
  };

  connect();

  return {
    send(type: string, payload: Record<string, unknown> = {}) {
      pendingMessages.push(JSON.stringify({ type, payload }));
      if (socket?.readyState === WebSocket.OPEN) {
        flushPending();
        return;
      }
      if (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) connect();
    },
    close() {
      closedByClient = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      socket?.close();
    },
  };
}
