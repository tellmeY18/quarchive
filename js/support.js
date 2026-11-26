// Donation links. Quarchive never moves money: it opens the payer's own UPI app.
import { validUpi, upiLinks } from './upi.js';

export const SUPPORT = Object.freeze({ upi: 'vysakh.6294-4@waaxis', name: 'Quarchive', note: 'Support Quarchive' });
export const PRESETS = Object.freeze([2000, 5000, 10000, 50000]);
export const MIN_AMOUNT = 100, MAX_AMOUNT = 10000000;

export const supportEnabled = (cfg = SUPPORT) => validUpi(cfg.upi);

export function parseAmount(text) {
  const cleaned = String(text ?? '').replace(/₹|rs\.?|inr|,|\s/gi, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const paise = Math.round(Number(cleaned) * 100);
  return paise >= MIN_AMOUNT && paise <= MAX_AMOUNT ? paise : null;
}

export const formatRupees = paise => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

export const supportLinks = (paise, cfg = SUPPORT) => (supportEnabled(cfg) && Number.isSafeInteger(paise) ? upiLinks({ vpa: cfg.upi, name: cfg.name, amount: paise, note: cfg.note }) : null);
