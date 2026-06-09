import { spawn } from "node:child_process";

const commands = [
  ["server", "node", ["server/lobbyServer.mjs"]],
  ["client", "npx", ["vite", "--host", "127.0.0.1"]],
];

const children = commands.map(([name, command, args]) => {
  const child = spawn(command, args, {
    shell: true,
    stdio: "pipe",
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  child.on("exit", (code) => {
    if (code) process.exitCode = code;
    children.forEach((other) => {
      if (other !== child && !other.killed) other.kill();
    });
  });

  return child;
});

process.on("SIGINT", () => {
  children.forEach((child) => child.kill());
  process.exit();
});
