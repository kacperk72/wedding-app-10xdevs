require("dotenv").config();

const defaultOrigins = ["http://localhost:4200", "https://wedding-planner-kubitk.pl"];

const allowedOrigins = (process.env.FRONTEND_ORIGIN || defaultOrigins.join(","))
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

module.exports = corsOptions;
