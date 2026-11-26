// UPI payment links. Commoner never moves money: it opens the payer's own UPI app with the payee, amount and note
// filled in (same format as Chaikadi).
export const UPI_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,48}@[a-zA-Z][a-zA-Z0-9.-]{1,48}$/;
export const normalizeUpi = value => String(value ?? '').trim().toLowerCase();
export const validUpi = value => UPI_PATTERN.test(normalizeUpi(value));

function query({ vpa, name, amount, note }) {
  const parts = [`pa=${normalizeUpi(vpa)}`];
  if (name) parts.push(`pn=${encodeURIComponent(String(name).slice(0, 40))}`);
  parts.push(`am=${(amount / 100).toFixed(2)}`, 'cu=INR');
  if (note) parts.push(`tn=${encodeURIComponent(String(note).slice(0, 50))}`);
  return parts.join('&');
}
// amount is in paise. Generic link: Android shows its app chooser. iOS has no chooser, so each app's own scheme is offered too.
export function upiLinks(args) {
  if (!validUpi(args.vpa) || !Number.isSafeInteger(args.amount) || args.amount <= 0) return null;
  const q = query(args);
  return {
    generic: `upi://pay?${q}`,
    apps: [
      { id: 'gpay', name: 'Google Pay', href: `gpay://upi/pay?${q}` },
      { id: 'phonepe', name: 'PhonePe', href: `phonepe://pay?${q}` },
      { id: 'paytm', name: 'Paytm', href: `paytmmp://pay?${q}` },
    ],
  };
}
