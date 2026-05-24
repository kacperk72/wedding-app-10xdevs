function mapWedding(wedding, { now = new Date() } = {}) {
  const today = now instanceof Date ? now : new Date(now);
  const weddingDate = new Date(`${wedding.wedding_date}T00:00:00.000Z`);
  const daysUntilWedding = Math.ceil((weddingDate - today) / 86400000);

  return {
    id: wedding.id,
    partnerAName: wedding.partner_a_name,
    partnerBName: wedding.partner_b_name,
    weddingDate: wedding.wedding_date,
    ceremonyLocation: wedding.ceremony_location,
    createdByUserId: wedding.created_by_user_id,
    daysUntilWedding,
    members: (wedding.wedding_members || []).map((weddingMember) => ({
      userId: weddingMember.user_id,
      email: weddingMember.users?.email || null,
      firstName: weddingMember.users?.first_name || null,
      lastName: weddingMember.users?.last_name || null,
      role: weddingMember.role,
      linkedAt: weddingMember.linked_at,
    })),
  };
}

function mapGuest(guest) {
  return {
    id: guest.id,
    weddingId: guest.wedding_id,
    firstName: guest.first_name,
    lastName: guest.last_name,
    relation: guest.relation,
    rsvpStatus: guest.rsvp_status,
    diet: guest.diet,
    hasPlusOne: guest.has_plus_one,
    isChild: guest.is_child,
    mealOptionId: guest.meal_option_id,
    tableId: guest.table_id,
    contactPhone: guest.contact_phone,
    contactEmail: guest.contact_email,
    mealOptionLabel: guest.meal_options?.label || null,
    tableName: guest.tables?.name || null,
  };
}

function mapMealOption(mealOption) {
  return {
    id: mealOption.id,
    weddingId: mealOption.wedding_id,
    label: mealOption.label,
    sortOrder: mealOption.sort_order,
  };
}

function mapTable(table) {
  return {
    id: table.id,
    weddingId: table.wedding_id,
    name: table.name,
    seatsCount: table.seats_count,
    sortOrder: table.sort_order,
    positionX: table.position_x,
    positionY: table.position_y,
  };
}

module.exports = {
  mapGuest,
  mapMealOption,
  mapTable,
  mapWedding,
};
