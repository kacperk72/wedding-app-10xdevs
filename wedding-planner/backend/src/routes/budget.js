const express = require("express");
const { supabase } = require("../config/database");
const { requireWeddingMember } = require("../middleware/wedding-member");
const { mapBudgetCategory } = require("../utils/mappers");

const router = express.Router({ mergeParams: true });

router.use(requireWeddingMember());

router.get("/summary", async (req, res, next) => {
  try {
    const [weddingResult, expensesResult] = await Promise.all([
      supabase
        .from("weddings")
        .select("budget_total")
        .eq("id", req.params.weddingId)
        .single(),
      supabase
        .from("expenses")
        .select("amount")
        .eq("wedding_id", req.params.weddingId),
    ]);

    if (weddingResult.error) throw weddingResult.error;
    if (expensesResult.error) throw expensesResult.error;

    const budgetTotal =
      weddingResult.data?.budget_total == null ? null : Number(weddingResult.data.budget_total);
    const spent = (expensesResult.data || []).reduce(
      (total, expense) => total + Number(expense.amount || 0),
      0,
    );

    res.json({
      budgetTotal,
      spent,
      remaining: budgetTotal == null ? null : budgetTotal - spent,
      expensesCount: expensesResult.data?.length || 0,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/categories", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("budget_categories")
      .select("*")
      .eq("wedding_id", req.params.weddingId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;
    res.json(data.map(mapBudgetCategory));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
