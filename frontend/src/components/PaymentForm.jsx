import React, { useState } from 'react';
import {
  validatePaymentForm,
  formatCardNumber,
  formatExpiry,
} from '../utils/paymentValidation.js';

function PaymentForm({ amount, onSuccess }) {

  // ── Form field state ──────────────────────────────────────
  const [formData, setFormData] = useState({
    cardHolder : '',
    cardNumber : '',
    expiry     : '',
    cvv        : '',
  });

  // ── Field error state ─────────────────────────────────────
  const [errors, setErrors] = useState({
    cardHolder : '',
    cardNumber : '',
    expiry     : '',
    cvv        : '',
  });

  // ── Processing & submitted state ──────────────────────────
  const [processing, setProcessing] = useState(false);

  // ── Handle input changes ──────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    let formatted = value;

    // Auto-format card number with spaces (1234 5678 1234 5678)
    if (name === 'cardNumber') {
      formatted = formatCardNumber(value);
    }

    // Auto-format expiry as MM/YY
    if (name === 'expiry') {
      formatted = formatExpiry(value);
    }

    // CVV max 4 digits only
    if (name === 'cvv') {
      formatted = value.replace(/\D/g, '').slice(0, 4);
    }

    setFormData((prev) => ({ ...prev, [name]: formatted }));

    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  // ── Handle form submit ────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();

    // Run all validations
    const { errors: validationErrors, isValid } = validatePaymentForm(formData);
    setErrors(validationErrors);

    if (!isValid) return;

    // Start processing
    setProcessing(true);

    // Simulate payment processing delay (2 seconds)
    setTimeout(() => {
      setProcessing(false);
      // Generate dummy transaction ID
      const txnId = 'TXN' + Date.now();
      if (onSuccess) onSuccess(txnId);
    }, 2000);
  };

  // ── Show spinner while processing ─────────────────────────
  if (processing) {
    return (
      <div className="payment-processing">
        <div className="payment-spinner"></div>
        <h3>Processing Payment...</h3>
        <p>Please do not close or refresh this page.</p>
        <p style={{ marginTop: '6px', fontSize: '0.78rem', color: '#bdbdbd' }}>
          Securely connecting to payment gateway...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>

      {/* ── Accepted Card Types ── */}
      <div className="payment-card-types">
        <span className="payment-card-type-badge">VISA</span>
        <span className="payment-card-type-badge">Mastercard</span>
        <span className="payment-card-type-badge">RuPay</span>
        <span className="payment-card-type-badge">Amex</span>
      </div>

      {/* ── Card Holder Name ── */}
      <div className="payment-form-group">
        <label className="payment-form-label">
          Card Holder Name <span>*</span>
        </label>
        <input
          type="text"
          name="cardHolder"
          className={`payment-form-input ${errors.cardHolder ? 'error' : ''}`}
          placeholder="Enter name as on card"
          value={formData.cardHolder}
          onChange={handleChange}
          autoComplete="cc-name"
        />
        {errors.cardHolder && (
          <div className="payment-field-error">
            ⚠️ {errors.cardHolder}
          </div>
        )}
      </div>

      {/* ── Card Number ── */}
      <div className="payment-form-group">
        <label className="payment-form-label">
          Card Number <span>*</span>
        </label>
        <input
          type="text"
          name="cardNumber"
          className={`payment-form-input ${errors.cardNumber ? 'error' : ''}`}
          placeholder="1234 5678 1234 5678"
          value={formData.cardNumber}
          onChange={handleChange}
          maxLength={19}
          autoComplete="cc-number"
          inputMode="numeric"
        />
        {errors.cardNumber && (
          <div className="payment-field-error">
            ⚠️ {errors.cardNumber}
          </div>
        )}
      </div>

      {/* ── Expiry & CVV side by side ── */}
      <div className="payment-form-row">

        {/* Expiry */}
        <div className="payment-form-group">
          <label className="payment-form-label">
            Expiry Date <span>*</span>
          </label>
          <input
            type="text"
            name="expiry"
            className={`payment-form-input ${errors.expiry ? 'error' : ''}`}
            placeholder="MM/YY"
            value={formData.expiry}
            onChange={handleChange}
            maxLength={5}
            autoComplete="cc-exp"
            inputMode="numeric"
          />
          {errors.expiry && (
            <div className="payment-field-error">
              ⚠️ {errors.expiry}
            </div>
          )}
        </div>

        {/* CVV */}
        <div className="payment-form-group">
          <label className="payment-form-label">
            CVV <span>*</span>
          </label>
          <input
            type="password"
            name="cvv"
            className={`payment-form-input ${errors.cvv ? 'error' : ''}`}
            placeholder="• • •"
            value={formData.cvv}
            onChange={handleChange}
            maxLength={4}
            autoComplete="cc-csc"
            inputMode="numeric"
          />
          {errors.cvv && (
            <div className="payment-field-error">
              ⚠️ {errors.cvv}
            </div>
          )}
        </div>

      </div>

      {/* ── Pay Button ── */}
      <button
        type="submit"
        className="payment-submit-btn"
        disabled={processing}
      >
        🔒 Pay {amount}
      </button>

    </form>
  );
}

export default PaymentForm;