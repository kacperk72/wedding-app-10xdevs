const { Sequelize } = require("sequelize");
require("dotenv").config();

const useSsl = process.env.DB_SSL === "true";

const sequelize = new Sequelize(
  process.env.DB_NAME || "wedding_planner",
  process.env.DB_USER || "root",
  process.env.DB_PASSWORD || "",
  {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    dialect: "mysql",
    logging: process.env.NODE_ENV === "development" ? console.log : false,
    define: { timestamps: true, underscored: false },
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
    dialectOptions: useSsl
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : {},
  },
);

async function isReachable() {
  try {
    await sequelize.authenticate();
    return true;
  } catch {
    return false;
  }
}

module.exports = { sequelize, isReachable };
