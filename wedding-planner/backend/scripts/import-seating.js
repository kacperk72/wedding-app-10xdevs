#!/usr/bin/env node
/**
 * Importuje sto3y + go6ci z eksportu JSON (format `wedding-tables`) do bie���cego
 * wesela w Supabase.
 *
 * Uruchom z katalogu wedding-planner/backend/:
 *   node scripts/import-seating.js --file "C:\path\to\wedding-tables.json" --wedding-id <uuid>
 *
 * Opcje:
 *   --file <path>          %cie�ka do JSON-a (wymagane)
 *   --wedding-id <uuid>    ID wesela docelowego (wymagane je6li nie podasz --list)
 *   --clear                Wyczy6� istniej�ce go6ci/sto3y/konflikty przed importem
 *   --list                 Wypisz dost�pne wesela i zako�cz
 *   --dry-run              Poka� co by si� sta3o bez insertu
 *
 * Decyzje:
 *   - groom → rodzina_pana_mlodego, bride → rodzina_panny_mlodej, mutual → wspolni_znajomi
 *   - table_id = null dla wszystkich go6ci (rozsadzasz r�cznie w /app/rozsadzenie)
 *   - rsvp_status: 'confirmed' je6li confirmed:true, 'declined' je6li declined:true, w pp 'pending'
 *   - diet/has_plus_one/is_child = defaulty (pending/false/false), do r�cznej korekty w UI
 */

const fs = require("fs");
const path = require("path");

process.chdir(path.resolve(__dirname, ".."));
const { supabase } = require("../src/config/database");

const GROUP_TO_RELATION = {
  groom: "rodzina_pana_mlodego",
  bride: "rodzina_panny_mlodej",
  mutual: "wspolni_znajomi",
};

function getArg(name, { required = false } = {}) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) {
    if (required) {
      console.error(`Missing required arg: ${name}`);
      process.exit(1);
    }
    return undefined;
  }
  return process.argv[idx + 1];
}

function hasFlag(name) {
  return process.argv.includes(name);
}

async function listWeddings() {
  const { data, error } = await supabase
    .from("weddings")
    .select("id, partner_a_name, partner_b_name, wedding_date");
  if (error) throw error;
  console.log("Dostepne wesela:");
  for (const w of data) {
    console.log(`  ${w.id}  |  ${w.partner_a_name} & ${w.partner_b_name}  |  ${w.wedding_date}`);
  }
}

function parseGuest(g, weddingId) {
  const firstName = (g.firstName || "").trim();
  const lastName = (g.lastName || "").trim();
  if (!firstName) throw new Error(`Guest ${g.id} has no firstName`);
  return {
    wedding_id: weddingId,
    first_name: firstName,
    last_name: lastName || "-",
    relation: GROUP_TO_RELATION[g.group] || "wspolni_znajomi",
    rsvp_status: g.confirmed ? "confirmed" : g.declined ? "declined" : "pending",
    diet: "pending",
    has_plus_one: false,
    is_child: false,
    table_id: null,
  };
}

async function main() {
  if (hasFlag("--list")) {
    await listWeddings();
    return;
  }

  const filePath = getArg("--file", { required: true });
  const weddingId = getArg("--wedding-id", { required: true });
  const shouldClear = hasFlag("--clear");
  const dryRun = hasFlag("--dry-run");

  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);

  const { data: wedding, error: weddingErr } = await supabase
    .from("weddings")
    .select("id, partner_a_name, partner_b_name")
    .eq("id", weddingId)
    .maybeSingle();
  if (weddingErr) throw weddingErr;
  if (!wedding) throw new Error(`Wedding ${weddingId} not found`);
  console.log(`Target wesele: ${wedding.partner_a_name} & ${wedding.partner_b_name} (${wedding.id})`);

  const jsonTables = data.hallConfiguration?.tables || [];
  const allGuests = Object.values(data.seating || {}).flatMap((entry) => entry.guests || []);

  const tableInserts = jsonTables.map((t, i) => ({
    wedding_id: weddingId,
    name: t.name,
    seats_count: Math.min(24, Math.max(1, Number(t.capacity) || 8)),
    sort_order: i + 1,
    position_x: t.positionX != null ? Math.round(Number(t.positionX)) : null,
    position_y: t.positionY != null ? Math.round(Number(t.positionY)) : null,
  }));

  const guestInserts = allGuests.map((g) => parseGuest(g, weddingId));

  const groupCounts = {};
  for (const g of allGuests) groupCounts[g.group] = (groupCounts[g.group] || 0) + 1;

  console.log(`Plan importu:`);
  console.log(`  stoly: ${tableInserts.length} (suma miejsc: ${tableInserts.reduce((s, t) => s + t.seats_count, 0)})`);
  console.log(`  goscie: ${guestInserts.length}  |  groups: ${JSON.stringify(groupCounts)}`);
  console.log(`  table_id wszystkich gosci: null (rozsadzasz recznie)`);

  if (dryRun) {
    console.log("Dry run - bez insertu. Pierwszych 3 gosci:");
    console.log(guestInserts.slice(0, 3));
    return;
  }

  if (shouldClear) {
    console.log("Czyszczenie istniejacych gosci/konfliktow/stolow...");
    const { error: conflictsErr } = await supabase.from("seating_conflicts").delete().eq("wedding_id", weddingId);
    if (conflictsErr) throw conflictsErr;
    const { error: guestsErr } = await supabase.from("guests").delete().eq("wedding_id", weddingId);
    if (guestsErr) throw guestsErr;
    const { error: tablesErr } = await supabase.from("tables").delete().eq("wedding_id", weddingId);
    if (tablesErr) throw tablesErr;
  }

  if (tableInserts.length > 0) {
    const { data: insertedTables, error } = await supabase.from("tables").insert(tableInserts).select("id, name");
    if (error) throw error;
    console.log(`Wstawiono stolow: ${insertedTables.length}`);
  }

  let totalInserted = 0;
  for (let i = 0; i < guestInserts.length; i += 50) {
    const batch = guestInserts.slice(i, i + 50);
    const { data: inserted, error } = await supabase.from("guests").insert(batch).select("id");
    if (error) throw error;
    totalInserted += inserted.length;
  }
  console.log(`Wstawiono gosci: ${totalInserted}`);
  console.log("Gotowe. Wejdz w /app/goscie aby zobaczyc, /app/rozsadzenie aby rozsadzic.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Import failed:", err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  });
