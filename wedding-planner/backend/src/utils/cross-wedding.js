const { supabase } = require("../config/database");
const { BadRequestError } = require("../errors/domain-errors");

async function assertWeddingRecordExists(tableName, id, weddingId, label) {
  if (id === null || id === undefined) return;
  if (typeof id !== "string" || id.trim() === "") {
    throw new BadRequestError(`${label} must be a valid id`);
  }

  const { data, error } = await supabase
    .from(tableName)
    .select("id")
    .eq("id", id)
    .eq("wedding_id", weddingId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new BadRequestError(`${label} does not belong to this wedding`);
}

module.exports = {
  assertWeddingRecordExists,
};
