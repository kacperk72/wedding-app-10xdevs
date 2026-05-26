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

function mapVendor(vendor) {
  return {
    id: vendor.id,
    weddingId: vendor.wedding_id,
    category: vendor.category,
    companyName: vendor.company_name,
    contactPerson: vendor.contact_person,
    phone: vendor.phone,
    email: vendor.email,
    status: vendor.status,
    contractAmount: vendor.contract_amount == null ? null : Number(vendor.contract_amount),
    notes: vendor.notes,
    hasContract: Boolean(vendor.contracts?.length || vendor.has_contract),
  };
}

function mapPayment(payment, vendor = null) {
  const due = new Date(`${payment.due_date}T00:00:00.000Z`);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return {
    id: payment.id,
    contractId: payment.contract_id,
    kind: payment.kind,
    dueDate: payment.due_date,
    amount: Number(payment.amount),
    status: payment.status,
    paidAt: payment.paid_at,
    method: payment.method || "przelew",
    vendorName: vendor?.company_name || payment.contracts?.vendors?.company_name || null,
    daysUntilDue: Math.ceil((due.getTime() - today.getTime()) / 86400000),
  };
}

function mapContract(contract) {
  const payments = (contract.payments || []).map((payment) => mapPayment(payment));
  return {
    id: contract.id,
    weddingId: contract.wedding_id,
    vendorId: contract.vendor_id,
    vendorName: contract.vendors?.company_name || null,
    category: contract.vendors?.category || null,
    totalAmount: contract.total_amount == null ? null : Number(contract.total_amount),
    signedDate: contract.signed_date,
    status: contract.status,
    payments,
    paidCount: payments.filter((payment) => payment.status === "paid").length,
    totalCount: payments.length,
  };
}

function mapTask(task) {
  return {
    id: task.id,
    weddingId: task.wedding_id,
    title: task.title,
    description: task.description,
    category: task.category,
    dueDate: task.due_date,
    done: task.done,
    doneAt: task.done_at,
    isAuto: task.is_auto,
    templateId: task.template_id,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  };
}

function mapMeeting(meeting, vendor = null) {
  return {
    id: meeting.id,
    weddingId: meeting.wedding_id,
    title: meeting.title,
    meetingDate: meeting.starts_at,
    vendorId: meeting.vendor_id,
    vendorName: vendor?.company_name || meeting.vendors?.company_name || null,
    notes: meeting.notes,
    createdAt: meeting.created_at,
    updatedAt: meeting.updated_at,
  };
}

module.exports = {
  mapContract,
  mapGuest,
  mapMealOption,
  mapMeeting,
  mapPayment,
  mapTable,
  mapTask,
  mapVendor,
  mapWedding,
};
