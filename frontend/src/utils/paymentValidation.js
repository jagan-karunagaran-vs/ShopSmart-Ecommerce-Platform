// ─────────────────────────────────────────────────────────────
// Payment Validation Utilities
// Used by PaymentForm component
// ─────────────────────────────────────────────────────────────

// ── Validate Card Holder Name ─────────────────────────────
export const validateCardHolder = (name) => {
  if (!name || name.trim() === '') {
    return 'Card holder name is required.';
  }
  if (name.trim().length < 3) {
    return 'Card holder name must be at least 3 characters.';
  }
  if (!/^[a-zA-Z\s]+$/.test(name.trim())) {
    return 'Card holder name must contain only letters.';
  }
  return '';
};

// ── Validate Card Number ──────────────────────────────────
export const validateCardNumber = (number) => {
  // Remove spaces before validating
  const cleaned = number.replace(/\s+/g, '');

  if (!cleaned) {
    return 'Card number is required.';
  }
  if (!/^\d+$/.test(cleaned)) {
    return 'Card number must contain only digits.';
  }
  if (cleaned.length !== 16) {
    return 'Card number must be exactly 16 digits.';
  }
  return '';
};

// ── Validate Expiry Date ──────────────────────────────────
export const validateExpiry = (expiry) => {
  if (!expiry || expiry.trim() === '') {
    return 'Expiry date is required.';
  }

  // Must match MM/YY format
  if (!/^\d{2}\/\d{2}$/.test(expiry.trim())) {
    return 'Expiry date must be in MM/YY format.';
  }

  const [monthStr, yearStr] = expiry.split('/');
  const month = parseInt(monthStr, 10);
  const year  = parseInt('20' + yearStr, 10);

  if (month < 1 || month > 12) {
    return 'Expiry month must be between 01 and 12.';
  }

  // Check if card is expired
  const now          = new Date();
  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return 'Card has expired. Please use a valid card.';
  }

  return '';
};

// ── Validate CVV ──────────────────────────────────────────
export const validateCVV = (cvv) => {
  if (!cvv || cvv.trim() === '') {
    return 'CVV is required.';
  }
  if (!/^\d+$/.test(cvv.trim())) {
    return 'CVV must contain only digits.';
  }
  if (cvv.trim().length < 3 || cvv.trim().length > 4) {
    return 'CVV must be 3 or 4 digits.';
  }
  return '';
};

// ── Validate All Fields Together ─────────────────────────
export const validatePaymentForm = ({ cardHolder, cardNumber, expiry, cvv }) => {
  const errors = {
    cardHolder : validateCardHolder(cardHolder),
    cardNumber : validateCardNumber(cardNumber),
    expiry     : validateExpiry(expiry),
    cvv        : validateCVV(cvv),
  };

  // Returns errors object + boolean isValid
  const isValid = Object.values(errors).every((e) => e === '');
  return { errors, isValid };
};

// ── Format Card Number with spaces every 4 digits ────────
// e.g. 1234567812345678 → 1234 5678 1234 5678
export const formatCardNumber = (value) => {
  const cleaned = value.replace(/\D/g, '').slice(0, 16);
  const groups  = cleaned.match(/.{1,4}/g);
  return groups ? groups.join(' ') : cleaned;
};

// ── Format Expiry as MM/YY ────────────────────────────────
export const formatExpiry = (value) => {
  const cleaned = value.replace(/\D/g, '').slice(0, 4);
  if (cleaned.length >= 3) {
    return cleaned.slice(0, 2) + '/' + cleaned.slice(2);
  }
  return cleaned;
};