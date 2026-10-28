// ─────────────────────────────────────────────────────────────
// Category model
// Mirrors the storefront shape: { name, icon, image, description }
// Products reference categories by NAME (the existing UI filters
// and routes on category names such as "Electronics").
// ─────────────────────────────────────────────────────────────

import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required.'],
      trim: true,
      minlength: [2, 'Category name must be at least 2 characters.'],
      maxlength: [60, 'Category name must be at most 60 characters.'],
    },
    icon: {
      type: String,
      trim: true,
      default: '🛍️',
      maxlength: 16,
    },
    image: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 300,
    },
  },
  {
    timestamps: true,
  }
);

// Case-insensitive uniqueness on name ("electronics" == "Electronics")
categorySchema.index(
  { name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

categorySchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

const Category = mongoose.model('Category', categorySchema);

export default Category;