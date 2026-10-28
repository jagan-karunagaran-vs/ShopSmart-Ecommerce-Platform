// ─────────────────────────────────────────────────────────────
// Server-side order totals — the single source of truth.
// Mirrors the storefront rules:
//   subtotal       = Σ originalPrice × qty
//   discount       = Σ (originalPrice − price) × qty
//   deliveryCharge = FREE when (subtotal − discount) > threshold
//                    otherwise DELIVERY_CHARGE
//   total          = subtotal − discount + deliveryCharge
//
// Items must come from the database (never from the client).
// ─────────────────────────────────────────────────────────────

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const getNumberEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

/**
 * @param {Array<{ price:number, originalPrice?:number, quantity:number }>} items
 * @returns {{ subtotal:number, discount:number, deliveryCharge:number, total:number, totalItems:number }}
 */
export const calculateOrderTotals = (items) => {
  const freeDeliveryThreshold = getNumberEnv('FREE_DELIVERY_THRESHOLD', 499);
  const deliveryFee = getNumberEnv('DELIVERY_CHARGE', 49);

  let subtotal = 0;
  let payable = 0;
  let totalItems = 0;

  for (const item of items) {
    const quantity = Number(item.quantity);
    const price = Number(item.price);
    const originalPrice = Math.max(Number(item.originalPrice ?? item.price), price);

    subtotal += originalPrice * quantity;
    payable += price * quantity;
    totalItems += quantity;
  }

  subtotal = round2(subtotal);
  payable = round2(payable);

  const discount = round2(subtotal - payable);
  const deliveryCharge = payable > freeDeliveryThreshold ? 0 : deliveryFee;
  const total = round2(payable + deliveryCharge);

  return { subtotal, discount, deliveryCharge, total, totalItems };
};

/** Converts a rupee amount to integer paise (Razorpay's unit). */
export const toPaise = (rupees) => Math.round(Number(rupees) * 100);

/** Converts integer paise back to rupees. */
export const fromPaise = (paise) => round2(Number(paise) / 100);

export default calculateOrderTotals;