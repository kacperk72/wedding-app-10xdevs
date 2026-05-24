const http = require("node:http");
const path = require("node:path");
const { createMockSupabase, makeAuthMock } = require("./mock-supabase");

const PROJECT_ROOT = path.join(__dirname, "..", "..");
const SERVER_PATH = require.resolve("../../src/server");
const DATABASE_PATH = require.resolve("../../src/config/database");
const AUTH_PATH = require.resolve("../../src/middleware/jwks-auth");

function clearAppCache() {
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(PROJECT_ROOT) && !key.includes(`${path.sep}test${path.sep}`)) {
      delete require.cache[key];
    }
  }
}

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

async function createTestServer(seed) {
  process.env.NODE_ENV = "test";
  const mock = createMockSupabase(seed);

  clearAppCache();
  require.cache[DATABASE_PATH] = {
    id: DATABASE_PATH,
    filename: DATABASE_PATH,
    loaded: true,
    exports: { supabase: mock.supabase, isReachable: async () => true },
  };
  require.cache[AUTH_PATH] = {
    id: AUTH_PATH,
    filename: AUTH_PATH,
    loaded: true,
    exports: makeAuthMock,
  };

  const app = require(SERVER_PATH);
  const server = await listen(app);
  return { db: mock.db, server };
}

function request(server, method, requestPath, body, token = "sso-a") {
  const payload = body === undefined ? null : JSON.stringify(body);
  const { port } = server.address();

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        method,
        path: requestPath,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(payload
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
              }
            : {}),
        },
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          let body = null;
          if (raw) {
            try {
              body = JSON.parse(raw);
            } catch {
              body = raw;
            }
          }
          resolve({
            status: res.statusCode,
            body,
          });
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

module.exports = {
  clearAppCache,
  close,
  createTestServer,
  request,
};
