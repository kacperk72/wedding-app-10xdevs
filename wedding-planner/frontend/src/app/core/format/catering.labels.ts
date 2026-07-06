import { PricingUnit } from '../models/catering.model';

const PRICING_UNIT_LABELS: Record<PricingUnit, string> = {
  per_person: 'za osobę',
  per_event: 'za imprezę',
  per_bottle: 'za butelkę',
  per_hour: 'za godzinę',
  per_unit: 'za sztukę',
};

export function pricingUnitLabel(unit: PricingUnit | null | undefined): string {
  if (!unit) return '';
  return PRICING_UNIT_LABELS[unit] ?? unit;
}
