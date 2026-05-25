const express = require("express");
const { supabase } = require("../config/database");
const { BadRequestError, NotFoundError } = require("../errors/domain-errors");
const { requireWeddingMember } = require("../middleware/wedding-member");
const { mapTask } = require("../utils/mappers");
const {
  enumValue,
  optionalBoolean,
  optionalDateString,
  optionalEnum,
  optionalString,
  requireAtLeastOne,
  requireDateString,
  requireString,
} = require("../utils/request-validation");

const router = express.Router({ mergeParams: true });

const TASK_CATEGORIES = ["stroj", "kontrahent", "goscie", "formalnosci", "inne"];

function parseDoneFilter(value) {
  if (value === undefined) return false;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new BadRequestError("done must be true or false");
}

function addDays(dateOnly, days) {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildTaskPatch(body, currentTask) {
  body = body || {};
  const patch = {};
  const title = optionalString(body, "title");
  const category = optionalEnum(body, "category", TASK_CATEGORIES);
  const dueDate = optionalDateString(body, "dueDate");
  const description = optionalString(body, "description");
  const done = optionalBoolean(body, "done");

  if (title !== undefined) {
    if (title.trim() === "") throw new BadRequestError("title cannot be empty");
    patch.title = title;
  }
  if (category !== undefined) patch.category = category;
  if (dueDate !== undefined) patch.due_date = dueDate;
  if (description !== undefined) patch.description = description;
  if (done !== undefined) {
    patch.done = done;
    if (!currentTask.done && done) patch.done_at = new Date().toISOString();
    if (currentTask.done && !done) patch.done_at = null;
  }

  return requireAtLeastOne(patch);
}

async function loadTaskForWedding(taskId, weddingId) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .eq("wedding_id", weddingId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new NotFoundError("Task not found");
  return data;
}

router.use(requireWeddingMember());

router.get("/", async (req, res, next) => {
  try {
    let query = supabase
      .from("tasks")
      .select("*")
      .eq("wedding_id", req.params.weddingId)
      .eq("done", parseDoneFilter(req.query.done))
      .order("due_date", { ascending: true });

    if (req.query.category) {
      query = query.eq("category", enumValue(req.query.category, TASK_CATEGORIES, "category"));
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data.map(mapTask));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const insert = {
      wedding_id: req.params.weddingId,
      title: requireString(req.body, "title"),
      category: enumValue(requireString(req.body, "category"), TASK_CATEGORIES, "category"),
      due_date: requireDateString(req.body, "dueDate"),
      description: optionalString(req.body, "description") ?? null,
      done: false,
      done_at: null,
      is_auto: false,
      template_id: null,
    };

    const { data, error } = await supabase.from("tasks").insert(insert).select("*").single();
    if (error) throw error;
    res.status(201).json(mapTask(data));
  } catch (err) {
    next(err);
  }
});

router.patch("/:taskId", async (req, res, next) => {
  try {
    const currentTask = await loadTaskForWedding(req.params.taskId, req.params.weddingId);
    const patch = buildTaskPatch(req.body, currentTask);
    const { data, error } = await supabase
      .from("tasks")
      .update(patch)
      .eq("id", req.params.taskId)
      .eq("wedding_id", req.params.weddingId)
      .select("*")
      .single();

    if (error) throw error;
    res.json(mapTask(data));
  } catch (err) {
    next(err);
  }
});

router.delete("/:taskId", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", req.params.taskId)
      .eq("wedding_id", req.params.weddingId)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError("Task not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post("/regenerate-auto", async (req, res, next) => {
  try {
    const { data: wedding, error: weddingError } = await supabase
      .from("weddings")
      .select("wedding_date")
      .eq("id", req.params.weddingId)
      .single();
    if (weddingError) throw weddingError;
    if (!wedding) throw new NotFoundError("Wedding not found");

    const { data: templates, error: templatesError } = await supabase
      .from("task_templates")
      .select("id, title, category, days_before_wedding")
      .order("sort_order", { ascending: true });
    if (templatesError) throw templatesError;

    const { data: existingTasks, error: tasksError } = await supabase
      .from("tasks")
      .select("template_id")
      .eq("wedding_id", req.params.weddingId)
      .neq("template_id", null);
    if (tasksError) throw tasksError;

    const existingTemplateIds = new Set(existingTasks.map((task) => task.template_id));
    let created = 0;

    for (const template of templates) {
      if (existingTemplateIds.has(template.id)) continue;

      const { error } = await supabase.from("tasks").insert({
        wedding_id: req.params.weddingId,
        title: template.title,
        category: template.category,
        due_date: addDays(wedding.wedding_date, -template.days_before_wedding),
        done: false,
        done_at: null,
        is_auto: true,
        template_id: template.id,
      });
      if (error) {
        if (error.code === "23505") continue;
        throw error;
      }
      existingTemplateIds.add(template.id);
      created += 1;
    }

    res.json({ created, skipped: templates.length - created });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
