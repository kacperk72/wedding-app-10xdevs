export const formatPLN = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '- zl';
  const rounded = Math.round(amount);
  const withSpaces = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${withSpaces} zl`;
};
