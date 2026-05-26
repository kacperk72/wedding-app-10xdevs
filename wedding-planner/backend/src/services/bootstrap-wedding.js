const {
  DEFAULT_BUDGET_CATEGORIES,
  DEFAULT_TABLES,
} = require("../seed/defaults");

function buildBootstrapRows({ weddingId, creatorUserId }) {
  return {
    member: {
      wedding_id: weddingId,
      user_id: creatorUserId,
      role: "partner_a",
    },
    budgetCategories: DEFAULT_BUDGET_CATEGORIES.map((category) => ({
      ...category,
      wedding_id: weddingId,
    })),
    tables: DEFAULT_TABLES.map((table) => ({
      ...table,
      wedding_id: weddingId,
    })),
  };
}

async function bootstrapWedding({ weddingId, creatorUserId }) {
  const { supabase } = require("../config/database");
  const { data, error } = await supabase.rpc("bootstrap_wedding", {
    p_wedding_id: weddingId,
    p_creator_user_id: creatorUserId,
  });
  if (error) throw error;
  return data;
}

module.exports = {
  buildBootstrapRows,
  bootstrapWedding,
};
