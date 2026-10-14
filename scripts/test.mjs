// Runs the API test suite against the production build, isolated from real data.
//   npm test        → next build + this script
//   npm run test:api → this script only (requires an existing build)
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const PORT = Number(process.env.TEST_PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;
const dataDir = mkdtempSync(path.join(tmpdir(), "stockvault-test-"));

const env = {
  ...process.env,
  NODE_ENV: "production",
  INVENTORY_DATA_DIR: dataDir,
  AUTH_SECRET: randomBytes(32).toString("hex"),
  // Never inherit real Supabase credentials into tests.
  SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
};

const nextBin = path.join("node_modules", "next", "dist", "bin", "next");
const server = spawn(process.execPath, [nextBin, "start", "-p", String(PORT)], { env, stdio: ["ignore", "pipe", "pipe"] });
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));

function stopServer() {
  if (server.exitCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  else server.kill("SIGTERM");
}

async function waitForServer(timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (server.exitCode !== null) throw new Error(`Server exited early:\n${serverLog}`);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/status`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server did not start within ${timeoutMs / 1000}s:\n${serverLog}`);
}

let code = 1;
try {
  console.log(`▶ Starting production server on ${BASE_URL} (data: ${dataDir})`);
  await waitForServer();
  const run = spawnSync(process.execPath, ["--test", "--test-concurrency=1", "--test-reporter=spec", "tests/api.test.mjs"], {
    env: { ...process.env, BASE_URL, TEST_DATA_DIR: dataDir },
    stdio: "inherit",
  });
  code = run.status ?? 1;
} catch (err) {
  console.error(err);
} finally {
  stopServer();
  try {
    rmSync(dataDir, { recursive: true, force: true });
  } catch {
    /* Windows may hold the dir briefly */
  }
  if (code !== 0) console.log("\n── server log (tail) ──\n" + serverLog.split("\n").slice(-40).join("\n"));
}
process.exit(code);
