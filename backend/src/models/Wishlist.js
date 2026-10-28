// ─────────────────────────────────────────────────────────────
// Wishlist model — exactly one wishlist per user.
// Stores only product references; details are populated live.
// ─────────────────────────────────────────────────────────────

import mongoose from 'mongoose';

const wishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    products: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

wishlistSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

const Wishlist = mongoose.model('Wishlist', wishlistSchema);

export default Wishlist;