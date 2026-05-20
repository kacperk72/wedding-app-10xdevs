// 4-arg signature is required — Express identifies error handlers by arity.
function errorHandler(err, req, res, _next) {
  console.error("Error:", err);

  if (err.name === "SequelizeValidationError") {
    return res.status(400).json({
      error: "Validation failed",
      details: err.errors.map((e) => e.message),
    });
  }

  if (err.name === "SequelizeUniqueConstraintError") {
    const field = err.errors[0]?.path || "field";
    return res.status(400).json({
      error: `${field} already exists`,
      details: err.errors.map((e) => e.message),
    });
  }

  if (err.name === "SequelizeForeignKeyConstraintError") {
    return res.status(400).json({
      error: "Referenced resource not found",
      details: ["A related record does not exist"],
    });
  }

  if (err.name === "SequelizeDatabaseError") {
    return res.status(400).json({
      error: "Database error",
      details:
        process.env.NODE_ENV === "development"
          ? [err.message]
          : ["Invalid request"],
    });
  }

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      error: "CORS error",
      details: ["This origin is not allowed"],
    });
  }

  if (err.status || err.statusCode) {
    return res.status(err.status || err.statusCode).json({
      error: err.message || "An error occurred",
      details: err.details || [],
    });
  }

  res.status(500).json({
    error: "Internal server error",
    details:
      process.env.NODE_ENV === "development"
        ? [err.message]
        : ["Something went wrong on our end"],
  });
}

module.exports = errorHandler;
