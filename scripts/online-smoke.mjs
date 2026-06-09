import WebSocket from "ws";

const url = process.env.LOBBY_URL ?? "ws://127.0.0.1:8787";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function makeClient(name) {
  const events = [];
  const ws = new WebSocket(url);
  ws.on("message", (raw) => {
    try {
      events.push(JSON.parse(raw.toString()));
    } catch {
      events.push({ type: "parse-error", raw: raw.toString() });
    }
  });

  return new Promise((resolve, reject) => {
    ws.once("open", () => resolve({ name, ws, events }));
    ws.once("error", reject);
  });
}

function send(client, type, payload = {}) {
  client.ws.send(JSON.stringify({ type, payload }));
}

async function waitFor(client, type, timeout = 3500) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const found = client.events.find((event) => event.type === type && !event.__seen);
    if (found) {
      found.__seen = true;
      return found;
    }
    await wait(25);
  }
  throw new Error(`${client.name}: ${type} timeout. Events: ${client.events.map((event) => event.type).join(", ")}`);
}

function countEvents(client, type) {
  return client.events.filter((event) => event.type === type).length;
}

function fakePlayer(id, country, position, overall) {
  return { id, name: `${country} ${position} ${id}`, country, club: "Test FC", position, overall, age: 27 };
}

function fakeLineup(country) {
  return [
    fakePlayer(`${country}-gk`, country, "GK", 82),
    ...Array.from({ length: 4 }, (_, index) => fakePlayer(`${country}-def-${index}`, country, "DEF", 78)),
    ...Array.from({ length: 3 }, (_, index) => fakePlayer(`${country}-mid-${index}`, country, "MID", 80)),
    ...Array.from({ length: 3 }, (_, index) => fakePlayer(`${country}-fwd-${index}`, country, "FWD", 83)),
  ];
}

const clients = [];

try {
  const host = await makeClient("host");
  const guest = await makeClient("guest");
  const stranger = await makeClient("stranger");
  clients.push(host, guest, stranger);

  send(host, "room:create", { nickname: "QA-Host" });
  const created = await waitFor(host, "room:joined");
  const code = created.payload.room.code;

  send(stranger, "room:join", { nickname: "QA-Bad", code: "ZZZZZZ" });
  await waitFor(stranger, "error");

  send(guest, "room:join", { nickname: "QA-Guest", code });
  await waitFor(guest, "room:joined");
  await waitFor(host, "room:update");

  send(host, "player:select-team", { team: "France" });
  await waitFor(host, "room:update");
  send(guest, "player:select-team", { team: "France" });
  await waitFor(guest, "error");

  send(guest, "player:ready", { ready: true });
  await waitFor(guest, "error");

  send(guest, "player:select-team", { team: "Brazil" });
  await wait(100);
  send(guest, "player:ready", { ready: true });
  await wait(100);
  send(host, "player:ready", { ready: true });
  await waitFor(host, "game:start");
  await waitFor(guest, "game:start");

  send(guest, "game:submit-plan", { plan: { country: "Brazil", lineup: [], tactic: "balanced" } });
  await waitFor(guest, "error");

  const tacticalPlan = {
    mentality: 50,
    defensiveLine: 52,
    pressIntensity: 50,
    counterPress: 45,
    buildUpSpeed: 50,
    passingDirectness: 45,
    attackingWidth: 55,
    tempo: 50,
  };

  send(host, "game:submit-plan", {
    plan: { country: "France", lineup: fakeLineup("France"), tactic: "balanced", tacticalPlan },
  });
  await waitFor(host, "game:plans-update");
  send(guest, "game:submit-plan", {
    plan: { country: "Brazil", lineup: fakeLineup("Brazil"), tactic: "balanced", tacticalPlan },
  });
  await waitFor(host, "game:plans-ready");
  await waitFor(guest, "game:plans-ready");

  const result = { groups: [], knockouts: [], champion: "France" };
  const steps = [
    {
      id: "qa-step-1",
      title: "QA 1. hafta",
      subtitle: "Protokol testi",
      kind: "group",
      matches: [
        {
          id: "m1",
          home: "France",
          away: "Brazil",
          homeScore: 1,
          awayScore: 0,
          goals: [],
          events: [
            { minute: 0, type: "kickoff", text: "QA start", whistle: true },
            { minute: 90, type: "full-time", text: "QA end", whistle: true },
          ],
        },
      ],
    },
    {
      id: "qa-step-2",
      title: "QA 2. hafta",
      subtitle: "Protokol testi",
      kind: "group",
      matches: [
        {
          id: "m2",
          home: "Brazil",
          away: "France",
          homeScore: 0,
          awayScore: 0,
          goals: [],
          events: [
            { minute: 0, type: "kickoff", text: "QA start", whistle: true },
            { minute: 90, type: "full-time", text: "QA end", whistle: true },
          ],
        },
      ],
    },
  ];

  send(guest, "game:submit-tournament", { result, steps });
  await waitFor(guest, "error");
  send(host, "game:submit-tournament", { result, steps });
  await waitFor(host, "game:tournament");
  await waitFor(guest, "game:tournament");
  await waitFor(host, "game:step");
  await waitFor(guest, "game:step");

  send(host, "game:step-ready");
  await waitFor(guest, "game:step-ready-update");
  if (countEvents(host, "game:step") !== 1) throw new Error("New step started before every player was ready.");

  send(guest, "game:step-ready");
  await wait(250);
  if (countEvents(host, "game:step") !== 2 || countEvents(guest, "game:step") !== 2) {
    throw new Error("Second step did not start after every player was ready.");
  }

  send(host, "game:step-ready");
  send(guest, "game:step-ready");
  await waitFor(host, "game:complete");
  await waitFor(guest, "game:complete");

  console.log(
    JSON.stringify(
      {
        ok: true,
        room: code,
        checks: [
          "bad join rejected",
          "join propagated",
          "team lock enforced",
          "ready requires team",
          "start synchronized",
          "invalid plan rejected",
          "plans synchronized",
          "non-host tournament rejected",
          "host tournament broadcast",
          "step gating works",
          "game complete broadcast",
        ],
      },
      null,
      2,
    ),
  );
} finally {
  clients.forEach((client) => client.ws.close());
}
