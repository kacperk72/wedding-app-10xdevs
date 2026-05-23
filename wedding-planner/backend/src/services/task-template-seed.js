const { supabase } = require("../config/database");
const { TASK_TEMPLATES } = require("../seed/defaults");

async function seedTaskTemplates() {
  const { data, error } = await supabase
    .from("task_templates")
    .upsert(TASK_TEMPLATES, { onConflict: "title" })
    .select("id");

  if (error) throw error;

  return {
    upserted: data?.length || TASK_TEMPLATES.length,
    total: TASK_TEMPLATES.length,
  };
}

module.exports = { seedTaskTemplates };
