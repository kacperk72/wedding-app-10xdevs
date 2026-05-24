class DomainError extends Error {
  constructor(message, status = 500, details = []) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.details = details;
    this.isDomainError = true;
  }
}

class BadRequestError extends DomainError {
  constructor(message, details = []) {
    super(message, 400, details);
  }
}

class NotMemberError extends DomainError {
  constructor(message = "You are not a member of this wedding") {
    super(message, 403);
  }
}

class NotFoundError extends DomainError {
  constructor(message = "Resource not found") {
    super(message, 404);
  }
}

class ConflictError extends DomainError {
  constructor(message, details = []) {
    super(message, 409, details);
  }
}

module.exports = {
  BadRequestError,
  ConflictError,
  DomainError,
  NotFoundError,
  NotMemberError,
};
