const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

const corsOptions = require("./config/cors");
const errorHandler = require("./middleware/error-handler");
const requireSsoAuth = require("./middleware/jwks-auth");
const { assertTestAuthConfigSafe } = require("./middleware/test-auth");
const healthRouter = require("./routes/health");
const meRouter = require("./routes/me");
const weddingsRouter = require("./routes/weddings");
const guestsRouter = require("./routes/guests");
const mealOptionsRouter = require("./routes/meal-options");
const tablesRouter = require("./routes/tables");
const vendorsRouter = require("./routes/vendors");
const contractsRouter = require("./routes/contracts");
const paymentsRouter = require("./routes/payments");
const tasksRouter = require("./routes/tasks");
const meetingsRouter = require("./routes/meetings");
const timelineRouter = require("./routes/timeline");
const budgetRouter = require("./routes/budget");
const expensesRouter = require("./routes/expenses");
const seatingConflictsRouter = require("./routes/seating-conflicts");
const seatingRouter = require("./routes/seating");
const cateringOffersRouter = require("./routes/catering-offers");
const cateringPackagesRouter = require("./routes/catering-packages");
const cateringDishesRouter = require("./routes/catering-dishes");
const cateringAddonsRouter = require("./routes/catering-addons");
const cateringSelectionRouter = require("./routes/catering-selection");

// Fail-closed: refuse to boot if the hermetic test-auth seam is ever enabled
// in production. Runs on both import and `node src/server.js`.
assertTestAuthConfigSafe();

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;

// Hostinger sits behind a reverse proxy; req.ip and req.protocol need
// the real client + scheme. Without this, rate-limit keys collapse to
// the proxy and req.protocol stays "http" on HTTPS requests.
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors(corsOptions));
if (process.env.NODE_ENV !== "test") app.use(morgan("combined"));

app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  res.vary("Authorization");
  next();
});

app.use(express.json({ limit: "1mb" }));

app.use("/api/health", healthRouter);
app.use("/api/me", requireSsoAuth, meRouter);
app.use("/api/weddings/:weddingId/guests", requireSsoAuth, guestsRouter);
app.use("/api/weddings/:weddingId/meal-options", requireSsoAuth, mealOptionsRouter);
app.use("/api/weddings/:weddingId/tables", requireSsoAuth, tablesRouter);
app.use("/api/weddings/:weddingId/vendors", requireSsoAuth, vendorsRouter);
app.use("/api/weddings/:weddingId/contracts/:contractId/payments", requireSsoAuth, paymentsRouter);
app.use("/api/weddings/:weddingId/contracts", requireSsoAuth, contractsRouter);
app.use("/api/weddings/:weddingId/tasks", requireSsoAuth, tasksRouter);
app.use("/api/weddings/:weddingId/meetings", requireSsoAuth, meetingsRouter);
app.use("/api/weddings/:weddingId/timeline", requireSsoAuth, timelineRouter);
app.use("/api/weddings/:weddingId/budget", requireSsoAuth, budgetRouter);
app.use("/api/weddings/:weddingId/expenses", requireSsoAuth, expensesRouter);
app.use("/api/weddings/:weddingId/seating-conflicts", requireSsoAuth, seatingConflictsRouter);
app.use("/api/weddings/:weddingId/seating", requireSsoAuth, seatingRouter);
app.use("/api/weddings/:weddingId/catering/offers", requireSsoAuth, cateringOffersRouter);
app.use("/api/weddings/:weddingId/catering/packages", requireSsoAuth, cateringPackagesRouter);
app.use("/api/weddings/:weddingId/catering/courses", requireSsoAuth, cateringPackagesRouter);
app.use("/api/weddings/:weddingId/catering/dishes", requireSsoAuth, cateringDishesRouter);
app.use("/api/weddings/:weddingId/catering/addons", requireSsoAuth, cateringAddonsRouter);
app.use("/api/weddings/:weddingId/catering/selection", requireSsoAuth, cateringSelectionRouter);
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
