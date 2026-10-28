// ─────────────────────────────────────────────────────────────
// Seed script — imports the existing storefront catalog
// (frontend/src/data/categories.js + products.js) into MongoDB.
//
// Usage (from backend/):
//   node src/scripts/seedProducts.js            # insert missing only
//   node src/scripts/seedProducts.js --update   # also refresh catalog
//                                               # fields of seeded items
//
// Repeatable & non-destructive:
//   - Nothing is ever deleted; unrelated data is untouched.
//   - Products are matched by their legacy catalog id (`seedId`),
//     categories by name (case-insensitive).
//   - Without --update, existing documents are left exactly as they
//     are (admin edits and live stock levels are preserved).
//   - With --update, only catalog fields are refreshed; `stock`,
//     `isActive` and anything else are never overwritten.
// ─────────────────────────────────────────────────────────────

import 'dotenv/config';
import connectDB, { disconnectDB } from '../config/db.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import catalogCategories from '../../../frontend/src/data/categories.js';
import catalogProducts from '../../../frontend/src/data/products.js';

const DEFAULT_STOCK = 100;
const shouldUpdate = process.argv.includes('--update');

const seedCategories = async () => {
  const operations = catalogCategories.map((c) => {
    const fields = {
      icon: c.icon || '🛍️',
      image: c.image || '',
      description: c.description || '',
    };

    return {
      updateOne: {
        filter: { name: c.name },
        update: shouldUpdate
          ? { $set: fields, $setOnInsert: { name: c.name } }
          : { $setOnInsert: { name: c.name, ...fields } },
        upsert: true,
        collation: { locale: 'en', strength: 2 },
      },
    };
  });

  const result = await Category.bulkWrite(operations, { ordered: true });

  return {
    inserted: result.upsertedCount,
    updated: shouldUpdate ? result.modifiedCount : 0,
    total: catalogCategories.length,
  };
};

const seedProducts = async () => {
  const operations = catalogProducts.map((p) => {
    const originalPrice = Math.max(p.originalPrice ?? p.price, p.price);
    const discount =
      originalPrice > 0 ? Math.round(((originalPrice - p.price) / originalPrice) * 100) : 0;

    const catalogFields = {
      name: p.name,
      category: p.category,
      price: p.price,
      originalPrice,
      discount,
      rating: p.rating ?? 0,
      reviews: p.reviews ?? 0,
      image: p.image || '',
      description: p.description || '',
    };

    const insertOnly = { seedId: p.id, stock: DEFAULT_STOCK, isActive: true };

    return {
      updateOne: {
        filter: { seedId: p.id },
        update: shouldUpdate
          ? { $set: catalogFields, $setOnInsert: insertOnly }
          : { $setOnInsert: { ...catalogFields, ...insertOnly } },
        upsert: true,
      },
    };
  });

  const result = await Product.bulkWrite(operations, { ordered: true });

  return {
    inserted: result.upsertedCount,
    updated: shouldUpdate ? result.modifiedCount : 0,
    total: catalogProducts.length,
  };
};

const run = async () => {
  try {
    await connectDB();

    console.log(
      shouldUpdate
        ? 'Seeding catalog (insert missing + refresh catalog fields)...'
        : 'Seeding catalog (insert missing only)...'
    );

    const categories = await seedCategories();
    console.log(
      `Categories: ${categories.inserted} inserted, ${categories.updated} updated (catalog size ${categories.total}).`
    );

    const products = await seedProducts();
    console.log(
      `Products:   ${products.inserted} inserted, ${products.updated} updated (catalog size ${products.total}).`
    );

    console.log('Seed complete.');
    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    try {
      await disconnectDB();
    } catch {
      // ignore
    }
    process.exit(1);
  }
};

run();