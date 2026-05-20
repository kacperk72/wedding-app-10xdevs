const express = require("express");
const { isReachable } = require("../config/database");

const router = express.Router();

router.get("/", async (_req, res) => {
  const dbOk = await isReachable();
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? "ok" : "degraded",
    db: dbOk ? "reachable" : "unreachable",
    uptime: process.uptime(),
    time: new Date().toISOString(),
  });
});

module.exports = router;
