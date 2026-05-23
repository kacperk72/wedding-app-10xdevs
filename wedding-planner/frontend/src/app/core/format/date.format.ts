export const formatDDMMYYYY = (input: string | Date | null | undefined): string => {
  if (!input) return '';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
};

const MONTHS_PL_SHORT = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
const MONTHS_PL_LONG = [
  'stycznia',
  'lutego',
  'marca',
  'kwietnia',
  'maja',
  'czerwca',
  'lipca',
  'sierpnia',
  'września',
  'października',
  'listopada',
  'grudnia',
];

export const formatMonthShortPL = (input: string | Date): string => {
  const d = typeof input === 'string' ? new Date(input) : input;
  return MONTHS_PL_SHORT[d.getMonth()];
};

export const formatLongDatePL = (input: string | Date | null | undefined): string => {
  if (!input) return '';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS_PL_LONG[d.getMonth()]} ${d.getFullYear()}`;
};
