const { BadRequestError } = require("../errors/domain-errors");

function requireString(body, key) {
  if (!body || typeof body[key] !== "string" || body[key].trim() === "") {
    throw new BadRequestError(`${key} is required`);
  }
  return body[key].trim();
}

function optionalString(body, key) {
  if (!body || body[key] === undefined) return undefined;
  if (body[key] === null) return null;
  if (typeof body[key] !== "string") {
    throw new BadRequestError(`${key} must be a string`);
  }
  return body[key].trim();
}

function optionalNonEmptyString(body, key) {
  const value = optionalString(body, key);
  if (value === "") throw new BadRequestError(`${key} cannot be empty`);
  return value;
}

function optionalBoolean(body, key) {
  if (!body || body[key] === undefined) return undefined;
  if (typeof body[key] !== "boolean") {
    throw new BadRequestError(`${key} must be a boolean`);
  }
  return body[key];
}

function optionalInteger(body, key) {
  if (!body || body[key] === undefined) return undefined;
  if (!Number.isInteger(body[key])) {
    throw new BadRequestError(`${key} must be an integer`);
  }
  return body[key];
}

function optionalNullableInteger(body, key) {
  if (!body || body[key] === undefined) return undefined;
  if (body[key] === null) return null;
  if (!Number.isInteger(body[key])) {
    throw new BadRequestError(`${key} must be an integer`);
  }
  return body[key];
}

function enumValue(value, allowed, key) {
  if (!allowed.includes(value)) {
    throw new BadRequestError(`${key} must be one of: ${allowed.join(", ")}`);
  }
  return value;
}

function optionalEnum(body, key, allowed) {
  if (!body || body[key] === undefined) return undefined;
  if (body[key] === null) return null;
  return enumValue(body[key], allowed, key);
}

function dateString(value, key) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestError(`${key} must be a YYYY-MM-DD date`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new BadRequestError(`${key} must be a valid date`);
  }
  return value;
}

function requireDateString(body, key) {
  return dateString(requireString(body, key), key);
}

function optionalDateString(body, key) {
  if (!body || body[key] === undefined) return undefined;
  if (body[key] === null) return null;
  return dateString(body[key], key);
}

// Pora dnia HH:MM (zdarzenia harmonogramu, pola godzinowe). Akceptuje opcjonalne
// sekundy, bo PostgREST serializuje kolumny `time` jako "HH:MM:SS" — bez tego
// round-trip GET → re-PATCH tej samej sekcji odbijałby się o 400. Zwraca "HH:MM".
function timeString(value, key) {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value)) {
    throw new BadRequestError(`${key} must be a HH:MM time`);
  }
  return value.slice(0, 5);
}

function requireTimeString(body, key) {
  return timeString(requireString(body, key), key);
}

function optionalTimeString(body, key) {
  if (!body || body[key] === undefined) return undefined;
  if (body[key] === null) return null;
  return timeString(body[key], key);
}

function requireAtLeastOne(patch, message = "Request body must include at least one field") {
  if (Object.keys(patch).length === 0) {
    throw new BadRequestError(message);
  }
  return patch;
}

module.exports = {
  dateString,
  enumValue,
  optionalBoolean,
  optionalDateString,
  optionalEnum,
  optionalInteger,
  optionalNonEmptyString,
  optionalNullableInteger,
  optionalString,
  optionalTimeString,
  requireAtLeastOne,
  requireDateString,
  requireString,
  requireTimeString,
  timeString,
};
