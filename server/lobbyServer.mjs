import { WebSocketServer } from "ws";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? process.env.LOBBY_PORT ?? 8787);
const MAX_PLAYERS = 48;
const rooms = new Map();

function createCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return rooms.has(code) ? createCode() : code;
}

function createPlayer(nickname, socket) {
  return {
    id: randomUUID(),
    nickname: String(nickname || "Oyuncu").slice(0, 24),
    team: null,
    ready: false,
    socket,
  };
}

function publicRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    maxPlayers: MAX_PLAYERS,
    players: room.players.map((player) => ({
      id: player.id,
      nickname: player.nickname,
      team: player.team,
      ready: player.ready,
      isHost: player.id === room.hostId,
      setupReady: Boolean(player.plan),
    })),
  };
}

function send(socket, type, payload = {}) {
  if (socket.readyState !== socket.OPEN) return;
  socket.send(JSON.stringify({ type, payload }));
}

function broadcast(room, type, payload = {}) {
  room.players.forEach((player) => send(player.socket, type, payload));
}

function broadcastRoom(room) {
  broadcast(room, "room:update", { room: publicRoom(room) });
}

function roomOf(socket) {
  for (const room of rooms.values()) {
    const player = room.players.find((item) => item.socket === socket);
    if (player) return { room, player };
  }
  return null;
}

function maybeStart(room) {
  if (room.status !== "lobby") return;
  if (room.players.length === 0) return;
  const allReady = room.players.every((player) => player.ready && player.team);
  if (!allReady) return;

  room.status = "started";
  room.game = {
    plans: new Map(),
    stepReadyIds: new Set(),
    currentStepIndex: 0,
    result: null,
    steps: [],
  };
  room.players.forEach((player) => {
    player.ready = false;
    player.plan = null;
  });
  broadcast(room, "game:start", { room: publicRoom(room) });
  broadcastRoom(room);
}

function publicPlans(room) {
  return Array.from(room.game?.plans.entries() ?? []).map(([playerId, plan]) => ({ playerId, ...plan }));
}

function broadcastPlansUpdate(room) {
  broadcast(room, "game:plans-update", {
    room: publicRoom(room),
    readyCount: room.game?.plans.size ?? 0,
    totalCount: room.players.length,
  });
}

function maybePlansReady(room) {
  if (room.status !== "started" || !room.game) return;
  if (room.game.result) return;
  if (room.players.length === 0) return;
  if (!room.players.every((player) => room.game.plans.has(player.id))) return;

  broadcast(room, "game:plans-ready", {
    room: publicRoom(room),
    plans: publicPlans(room),
  });
}

function broadcastStepReady(room) {
  broadcast(room, "game:step-ready-update", {
    readyIds: Array.from(room.game?.stepReadyIds ?? []),
    nextStepIndex: room.game?.currentStepIndex ?? 0,
    totalSteps: room.game?.steps.length ?? 0,
  });
}

function broadcastNextStep(room) {
  if (!room.game) return;
  const stepIndex = room.game.currentStepIndex;
  const step = room.game.steps[stepIndex];

  if (!step) {
    broadcast(room, "game:complete", { room: publicRoom(room) });
    return;
  }

  room.game.stepReadyIds.clear();
  room.game.currentStepIndex += 1;
  broadcast(room, "game:step", {
    stepIndex,
    step,
    nextStepIndex: room.game.currentStepIndex,
    totalSteps: room.game.steps.length,
  });
  broadcastStepReady(room);
}

function maybeAdvanceStep(room) {
  if (room.status !== "started" || !room.game?.result) return;
  if (!room.players.every((player) => room.game.stepReadyIds.has(player.id))) return;
  broadcastNextStep(room);
}

function removeSocket(socket) {
  const found = roomOf(socket);
  if (!found) return;

  const { room, player } = found;
  room.players = room.players.filter((item) => item.id !== player.id);

  if (room.players.length === 0) {
    rooms.delete(room.code);
    return;
  }

  if (room.hostId === player.id) {
    room.hostId = room.players[0].id;
  }

  room.game?.plans.delete(player.id);
  room.game?.stepReadyIds.delete(player.id);
  broadcastRoom(room);
  if (room.status === "started") {
    broadcastPlansUpdate(room);
    broadcastStepReady(room);
    maybePlansReady(room);
    maybeAdvanceStep(room);
  }
}

function handleMessage(socket, rawMessage) {
  let message;
  try {
    message = JSON.parse(rawMessage);
  } catch {
    send(socket, "error", { message: "Geçersiz mesaj." });
    return;
  }

  const { type, payload = {} } = message;

  if (type === "room:create") {
    const code = createCode();
    const player = createPlayer(payload.nickname, socket);
    const room = {
      code,
      hostId: player.id,
      status: "lobby",
      players: [player],
    };
    rooms.set(code, room);
    send(socket, "room:joined", { selfId: player.id, room: publicRoom(room) });
    broadcastRoom(room);
    return;
  }

  if (type === "room:join") {
    const code = String(payload.code || "").trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      send(socket, "error", { message: "Oda bulunamadı." });
      return;
    }
    if (room.status !== "lobby") {
      send(socket, "error", { message: "Bu oda oyuna başlamış." });
      return;
    }
    if (room.players.length >= MAX_PLAYERS) {
      send(socket, "error", { message: "Oda dolu." });
      return;
    }

    removeSocket(socket);
    const player = createPlayer(payload.nickname, socket);
    room.players.push(player);
    send(socket, "room:joined", { selfId: player.id, room: publicRoom(room) });
    broadcastRoom(room);
    return;
  }

  const found = roomOf(socket);
  if (!found) {
    send(socket, "error", { message: "Önce bir odaya katılmalısın." });
    return;
  }

  const { room, player } = found;

  if (type === "player:select-team") {
    if (room.status !== "lobby") return;
    const team = String(payload.team || "");
    const taken = room.players.some((item) => item.id !== player.id && item.team === team);
    if (taken) {
      send(socket, "error", { message: "Bu takım seçilmiş." });
      return;
    }
    player.team = team || null;
    player.ready = false;
    broadcastRoom(room);
    return;
  }

  if (type === "player:ready") {
    if (room.status !== "lobby") return;
    if (!player.team) {
      send(socket, "error", { message: "Hazır olmadan önce takım seçmelisin." });
      return;
    }
    player.ready = Boolean(payload.ready);
    broadcastRoom(room);
    maybeStart(room);
    return;
  }

  if (type === "room:leave") {
    removeSocket(socket);
    return;
  }

  if (type === "game:submit-plan") {
    if (room.status !== "started" || !room.game) return;
    if (room.game.result) {
      send(socket, "error", { message: "Turnuva başladıktan sonra plan değiştirilemez." });
      return;
    }
    if (!player.team) {
      send(socket, "error", { message: "Plan göndermeden önce takım seçmelisin." });
      return;
    }

    const plan = payload.plan ?? {};
    if (plan.country !== player.team || !Array.isArray(plan.lineup) || plan.lineup.length !== 11) {
      send(socket, "error", { message: "İlk 11 planı eksik veya takımınla eşleşmiyor." });
      return;
    }

    player.plan = plan;
    room.game.plans.set(player.id, plan);
    broadcastPlansUpdate(room);
    maybePlansReady(room);
    return;
  }

  if (type === "game:submit-tournament") {
    if (room.status !== "started" || !room.game) return;
    if (room.game.result) return;
    if (player.id !== room.hostId) {
      send(socket, "error", { message: "Turnuva sonucunu yalnızca oda kurucusu başlatabilir." });
      return;
    }

    if (!payload.result || !Array.isArray(payload.steps)) {
      send(socket, "error", { message: "Turnuva paketi eksik." });
      return;
    }

    room.game.result = payload.result;
    room.game.steps = payload.steps;
    room.game.currentStepIndex = 0;
    room.game.stepReadyIds.clear();
    broadcast(room, "game:tournament", {
      room: publicRoom(room),
      result: room.game.result,
      steps: room.game.steps,
    });
    broadcastNextStep(room);
    return;
  }

  if (type === "game:step-ready") {
    if (room.status !== "started" || !room.game?.result) return;
    room.game.stepReadyIds.add(player.id);
    broadcastStepReady(room);
    maybeAdvanceStep(room);
  }
}

const server = createServer((request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.url === "/healthz") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: true, rooms: rooms.size, maxPlayers: MAX_PLAYERS }));
    return;
  }

  response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("WCGame lobby server is running. Connect with WebSocket for multiplayer.");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (socket) => {
  send(socket, "connected", { maxPlayers: MAX_PLAYERS });
  socket.on("message", (rawMessage) => handleMessage(socket, rawMessage));
  socket.on("close", () => removeSocket(socket));
});

server.listen(PORT, () => {
  console.log(`Lobby server listening on port ${PORT}`);
});
