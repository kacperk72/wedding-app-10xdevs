// 4-arg signature is required: Express identifies error handlers by arity.
function errorHandler(err, req, res, _next) {
  if (err.isDomainError) {
    return res.status(err.status).json({
      error: err.message,
      details: err.details || [],
    });
  }

  console.error("Error:", err);

  if (err.code && (err.details || err.hint || err.message)) {
    const statusByCode = {
      "23503": 400,
      "23505": 409,
      PGRST116: 404,
    };
    return res.status(err.status || statusByCode[err.code] || 400).json({
      error: err.message || "Database error",
      details: [err.details, err.hint].filter(Boolean),
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
