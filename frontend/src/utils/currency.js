const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

export function formatINR(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? inrFormatter.format(amount) : '-';
}
