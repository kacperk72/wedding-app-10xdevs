const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

const corsOptions = require("./config/cors");
const errorHandler = require("./middleware/error-handler");
const requireSsoAuth = require("./middleware/jwks-auth");
const healthRouter = require("./routes/health");
const meRouter = require("./routes/me");
const weddingsRouter = require("./routes/weddings");
const guestsRouter = require("./routes/guests");
const mealOptionsRouter = require("./routes/meal-options");
const tablesRouter = require("./routes/tables");

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;

// Hostinger sits behind a reverse proxy; req.ip and req.protocol need
// the real client + scheme. Without this, rate-limit keys collapse to
// the proxy and req.protocol stays "http" on HTTPS requests.
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors(corsOptions));
if (process.env.NODE_ENV !== "test") app.use(morgan("combined"));
app.use(express.json({ limit: "1mb" }));

app.use("/api/health", healthRouter);
app.use("/api/me", requireSsoAuth, meRouter);
app.use("/api/weddings/:weddingId/guests", requireSsoAuth, guestsRouter);
app.use("/api/weddings/:weddingId/meal-options", requireSsoAuth, mealOptionsRouter);
app.use("/api/weddings/:weddingId/tables", requireSsoAuth, tablesRouter);
app.use("/api/weddings", requireSsoAuth, weddingsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(
      `Wedding-planner backend listening on port ${PORT} (${process.env.NODE_ENV || "development"})`,
    );
  });
}

module.exports = app;
