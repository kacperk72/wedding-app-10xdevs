#!/usr/bin/env node
// Local development launcher: `npm run dev:local`.
//
// Runs the backend against the LOCAL Supabase stack (Docker, `npm run db:start`)
// with the hermetic auth seam on, so nothing touches production:
//   - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are read from `supabase status`
//     at launch, so they always match the running local stack.
//   - AUTH_TEST_MODE=1 accepts HS256 tokens signed with LOCAL_DEV_SECRET — the
//     same secret the dev SSO stub in frontend/src/index.local.html signs with.
//     Production SSO refuses to redirect back to localhost, so the real login
//     flow cannot work locally by design.
//   - LOCAL_DEV=1 makes config/database.js refuse to boot if the Supabase URL
//     is not local.
//
// Values set here win over backend/.env: dotenv never overrides variables that
// are already present in process.env.

const { execFileSync, spawn } = require("node:child_process");
const path = require("node:path");

// Must match LOCAL_DEV_SECRET in frontend/src/index.local.html. Not a real
// credential: it only works when AUTH_TEST_MODE=1 and NODE_ENV != production.
const LOCAL_DEV_SECRET = "wedding-planner-local-dev";

const backendRoot = path.resolve(__dirname, "..");
const supabaseBin = path.join(
  backendRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "supabase.cmd" : "supabase",
);

function readLocalSupabase() {
  let raw;
  try {
    raw = execFileSync(supabaseBin, ["status", "-o", "json"], {
      cwd: backendRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });
  } catch {
    console.error(
      "\nLocal Supabase is not running. Start Docker Desktop, then run:\n\n" +
        "  npm run db:start\n",
    );
    process.exit(1);
  }

  // The CLI may print notices before the JSON object.
  const status = JSON.parse(raw.slice(raw.indexOf("{")));
  const url = status.API_URL;
  const key = status.SERVICE_ROLE_KEY || status.SECRET_KEY;
  if (!url || !key) {
    console.error("Could not read API_URL / SERVICE_ROLE_KEY from `supabase status`.");
    process.exit(1);
  }
  return { url, key };
}

const { url, key } = readLocalSupabase();

const env = {
  ...process.env,
  NODE_ENV: "development",
  LOCAL_DEV: "1",
  PORT: "3000",
  // 4200: `npm run start:local`; 4240: the `wedding-planner` preview entry in the
  // workspace .claude/launch.json (4200 is taken there by another app). The dev
  // proxy forwards the browser's Origin, so POSTs are rejected by CORS otherwise.
  FRONTEND_ORIGIN: "http://localhost:4200,http://localhost:4240",
  SUPABASE_URL: url,
  SUPABASE_SERVICE_ROLE_KEY: key,
  AUTH_TEST_MODE: "1",
  AUTH_TEST_SECRET: LOCAL_DEV_SECRET,
};

console.log(`[dev:local] Supabase: ${url} (local)  |  auth: dev SSO stub`);

const child = spawn(process.execPath, ["--watch", "src/server.js"], {
  cwd: backendRoot,
  env,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code) => process.exit(code ?? 0));
