const express = require("express");
const { supabase } = require("../config/database");
const { requireWeddingMember } = require("../middleware/wedding-member");

const router = express.Router({ mergeParams: true });

router.use(requireWeddingMember());

router.get("/stats", async (req, res, next) => {
  try {
    const weddingId = req.params.weddingId;
    const [{ data: guests, error: guestsError }, { data: tables, error: tablesError }, { data: conflicts, error: conflictsError }] =
      await Promise.all([
        supabase.from("guests").select("id,table_id").eq("wedding_id", weddingId),
        supabase.from("tables").select("id,seats_count").eq("wedding_id", weddingId),
        supabase.from("seating_conflicts").select("id").eq("wedding_id", weddingId),
      ]);

    if (guestsError) throw guestsError;
    if (tablesError) throw tablesError;
    if (conflictsError) throw conflictsError;

    const tableCounts = new Map();
    for (const guest of guests) {
      if (guest.table_id) tableCounts.set(guest.table_id, (tableCounts.get(guest.table_id) || 0) + 1);
    }

    res.json({
      seatedCount: guests.filter((guest) => guest.table_id !== null).length,
      unseatedCount: guests.filter((guest) => guest.table_id === null).length,
      tablesUsed: tableCounts.size,
      totalSeats: tables.reduce((sum, table) => sum + Number(table.seats_count), 0),
      conflictsCount: conflicts.length,
      fullTablesCount: tables.filter(
        (table) => (tableCounts.get(table.id) || 0) === Number(table.seats_count),
      ).length,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
