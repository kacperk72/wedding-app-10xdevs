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
    budgetTotal: wedding.budget_total == null ? null : Number(wedding.budget_total),
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

function mapBudgetCategory(category) {
  return {
    id: category.id,
    weddingId: category.wedding_id,
    name: category.name,
    sortOrder: category.sort_order,
  };
}

function mapExpense(expense, vendor = null) {
  return {
    id: expense.id,
    weddingId: expense.wedding_id,
    categoryId: expense.category_id,
    vendorId: expense.vendor_id,
    vendorName: vendor?.company_name || expense.vendors?.company_name || null,
    description: expense.description,
    amount: Number(expense.amount),
    spentOn: expense.spent_on,
    createdAt: expense.created_at,
    updatedAt: expense.updated_at,
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
    seatsCount: Number(table.seats_count),
    sortOrder: Number(table.sort_order),
    positionX: table.position_x == null ? null : Number(table.position_x),
    positionY: table.position_y == null ? null : Number(table.position_y),
  };
}

function mapSeatingConflict(conflict, guestA = null, guestB = null) {
  return {
    id: conflict.id,
    weddingId: conflict.wedding_id,
    guestAId: conflict.guest_a_id,
    guestBId: conflict.guest_b_id,
    guestAName: guestA ? `${guestA.first_name} ${guestA.last_name}` : null,
    guestBName: guestB ? `${guestB.first_name} ${guestB.last_name}` : null,
    reason: conflict.reason,
    createdAt: conflict.created_at,
  };
}

function mapCateringOffer(offer, vendor = null, counts = {}) {
  return {
    id: offer.id,
    weddingId: offer.wedding_id,
    vendorId: offer.vendor_id,
    vendorName: vendor?.company_name || offer.vendors?.company_name || null,
    name: offer.name,
    validThrough: offer.valid_through,
    notes: offer.notes,
    packagesCount: Number(counts.packagesCount || 0),
    dishesCount: Number(counts.dishesCount || 0),
    addonsCount: Number(counts.addonsCount || 0),
    createdAt: offer.created_at,
    updatedAt: offer.updated_at,
  };
}

function mapCateringDish(dish, link = null) {
  return {
    id: link?.id || `${link?.catering_course_id || ""}:${dish.id}`,
    dishId: dish.id,
    offerId: dish.catering_offer_id,
    name: dish.name,
    description: dish.description,
    isVegetarian: Boolean(dish.is_vegetarian),
    isVegan: Boolean(dish.is_vegan),
    isGlutenFree: Boolean(dish.is_gluten_free),
    allergens: dish.allergens || [],
    sortOrder: link ? Number(link.sort_order) : 0,
    createdAt: dish.created_at,
    updatedAt: dish.updated_at,
  };
}

function mapCateringCourse(course, dishes = []) {
  return {
    id: course.id,
    packageId: course.catering_package_id,
    courseType: course.course_type,
    title: course.title,
    selectionMode: course.selection_mode,
    choiceLimit: course.choice_limit == null ? null : Number(course.choice_limit),
    sortOrder: Number(course.sort_order),
    dishes,
    createdAt: course.created_at,
    updatedAt: course.updated_at,
  };
}

function mapCateringPackage(pkg, courses = [], courseDishCounts = {}) {
  return {
    id: pkg.id,
    offerId: pkg.catering_offer_id,
    name: pkg.name,
    pricePerPerson: Number(pkg.price_per_person),
    isModifiable: Boolean(pkg.is_modifiable),
    description: pkg.description,
    sortOrder: Number(pkg.sort_order),
    courses,
    dishesCount: Number(courseDishCounts[pkg.id] || 0),
    createdAt: pkg.created_at,
    updatedAt: pkg.updated_at,
  };
}

function mapCateringAddon(addon) {
  return {
    id: addon.id,
    offerId: addon.catering_offer_id,
    name: addon.name,
    price: Number(addon.price),
    pricingUnit: addon.pricing_unit,
    description: addon.description,
    sortOrder: Number(addon.sort_order),
    createdAt: addon.created_at,
    updatedAt: addon.updated_at,
  };
}

function mapCateringOfferFull(offer, packages, courses, dishes, courseDishLinks, addons, vendor = null) {
  const dishesById = new Map(dishes.map((dish) => [dish.id, dish]));
  const linksByCourse = new Map();
  for (const link of courseDishLinks) {
    const list = linksByCourse.get(link.catering_course_id) || [];
    list.push(link);
    linksByCourse.set(link.catering_course_id, list);
  }

  const coursesByPackage = new Map();
  for (const course of courses) {
    const courseDishes = (linksByCourse.get(course.id) || [])
      .map((link) => {
        const dish = dishesById.get(link.catering_dish_id);
        return dish ? mapCateringDish(dish, link) : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const list = coursesByPackage.get(course.catering_package_id) || [];
    list.push(mapCateringCourse(course, courseDishes));
    coursesByPackage.set(course.catering_package_id, list);
  }

  const packagesMapped = packages
    .map((pkg) =>
      mapCateringPackage(
        pkg,
        (coursesByPackage.get(pkg.id) || []).sort((a, b) => a.sortOrder - b.sortOrder),
      ),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    ...mapCateringOffer(offer, vendor, {
      packagesCount: packages.length,
      dishesCount: dishes.length,
      addonsCount: addons.length,
    }),
    packages: packagesMapped,
    dishes: dishes.map((dish) => mapCateringDish(dish)).sort((a, b) => a.name.localeCompare(b.name)),
    addons: addons.map(mapCateringAddon).sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

function mapCateringSelection(selection, dishPicks = [], addonPicks = [], pkg = null) {
  return {
    id: selection.id,
    weddingId: selection.wedding_id,
    packageId: selection.catering_package_id,
    packageName: pkg?.name || selection.catering_packages?.name || null,
    guestCountEstimate: Number(selection.guest_count_estimate),
    notes: selection.notes,
    dishPicks: dishPicks.map((pick) => ({
      courseId: pick.catering_course_id,
      dishId: pick.catering_dish_id,
      dishName: pick.dish?.name || pick.catering_dishes?.name || null,
    })),
    addonPicks: addonPicks.map((pick) => ({
      addonId: pick.catering_addon_id,
      addonName: pick.addon?.name || pick.catering_addons?.name || null,
      quantity: Number(pick.quantity),
      pricingUnit: pick.addon?.pricing_unit || pick.catering_addons?.pricing_unit || null,
      unitPrice:
        pick.addon?.price == null && pick.catering_addons?.price == null
          ? null
          : Number(pick.addon?.price ?? pick.catering_addons?.price),
    })),
    createdAt: selection.created_at,
    updatedAt: selection.updated_at,
  };
}

function mapPriceBreakdown(packagePrice, guestCount, addonsResolved) {
  const packageSubtotal = Number(packagePrice) * Number(guestCount);
  const addons = addonsResolved.map((line) => {
    const quantity = Number(line.quantity || 1);
    const multiplier = line.pricingUnit === "per_person" ? Number(guestCount) : line.pricingUnit === "per_event" ? 1 : quantity;
    const subtotal = Number(line.price) * multiplier;
    return {
      id: line.id,
      name: line.name,
      unitPrice: Number(line.price),
      pricingUnit: line.pricingUnit,
      multiplier,
      quantity,
      subtotal,
    };
  });
  const addonsSubtotal = addons.reduce((sum, addon) => sum + addon.subtotal, 0);
  return {
    packagePrice: Number(packagePrice),
    guestCount: Number(guestCount),
    packageSubtotal,
    addons,
    addonsSubtotal,
    total: packageSubtotal + addonsSubtotal,
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
  mapBudgetCategory,
  mapCateringAddon,
  mapCateringCourse,
  mapCateringDish,
  mapCateringOffer,
  mapCateringOfferFull,
  mapCateringPackage,
  mapCateringSelection,
  mapContract,
  mapExpense,
  mapGuest,
  mapMealOption,
  mapMeeting,
  mapPayment,
  mapPriceBreakdown,
  mapSeatingConflict,
  mapTable,
  mapTask,
  mapVendor,
  mapWedding,
};
