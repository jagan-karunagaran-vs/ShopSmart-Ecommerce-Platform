// ─────────────────────────────────────────────────────────────
// Product model
// Mirrors the storefront shape:
// { name, category, price, originalPrice, discount, rating,
//   reviews, image, description }
// plus `stock` (for server-side stock validation) and `seedId`
// (the legacy numeric id from the static catalog, used only so the
// seed script can be re-run safely without creating duplicates).
// ─────────────────────────────────────────────────────────────

import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required.'],
      trim: true,
      minlength: [2, 'Product name must be at least 2 characters.'],
      maxlength: [200, 'Product name must be at most 200 characters.'],
    },
    category: {
      type: String,
      required: [true, 'Category is required.'],
      trim: true,
      index: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required.'],
      min: [0, 'Price cannot be negative.'],
    },
    originalPrice: {
      type: Number,
      min: [0, 'Original price cannot be negative.'],
    },
    discount: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    reviews: {
      type: Number,
      min: 0,
      default: 0,
    },
    image: {
      type: String,
      trim: true,
      default: '',
      maxlength: 2000,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 2000,
    },
    stock: {
      type: Number,
      min: [0, 'Stock cannot be negative.'],
      default: 100,
      validate: {
        validator: Number.isInteger,
        message: 'Stock must be a whole number.',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Legacy id from src/data/products.js — used only by the seed script.
    seedId: {
      type: Number,
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

// ── Keep originalPrice / discount consistent with price ─────
productSchema.pre('validate', function normalizePricing() {
  if (this.originalPrice == null || this.originalPrice < this.price) {
    this.originalPrice = this.price;
  }

  this.discount =
    this.originalPrice > 0
      ? Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100)
      : 0;
});

productSchema.index({ name: 1 });
productSchema.index({ category: 1, price: 1 });

productSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.seedId;
    return ret;
  },
});

const Product = mongoose.model('Product', productSchema);

export default Product;