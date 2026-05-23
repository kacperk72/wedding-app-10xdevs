const {
  DEFAULT_BUDGET_CATEGORIES,
  DEFAULT_TABLES,
} = require("../seed/defaults");

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildBootstrapRows({ weddingId, creatorUserId, weddingDate, templates }) {
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
    tasks: templates.map((template) => ({
      wedding_id: weddingId,
      title: template.title,
      category: template.category,
      due_date: addDays(weddingDate, -template.days_before_wedding),
      done: false,
      is_auto: true,
      template_id: template.id,
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
  addDays,
  buildBootstrapRows,
  bootstrapWedding,
};
