// ─── Filter products by search query ───────────────────────
export const filterBySearch = (products, query) => {
  if (!query || query.trim() === '') return products;
  const lower = query.toLowerCase().trim();
  return products.filter(
    (p) =>
      p.name.toLowerCase().includes(lower) ||
      p.category.toLowerCase().includes(lower) ||
      p.description.toLowerCase().includes(lower)
  );
};

// ─── Filter products by category ───────────────────────────
export const filterByCategory = (products, category) => {
  if (!category || category === 'All') return products;
  return products.filter((p) => p.category === category);
};

// ─── Filter products by price range ────────────────────────
export const filterByPrice = (products, min, max) => {
  return products.filter((p) => p.price >= min && p.price <= max);
};

// ─── Sort products ──────────────────────────────────────────
export const sortProducts = (products, sortType) => {
  const sorted = [...products];
  switch (sortType) {
    case 'price_asc':
      return sorted.sort((a, b) => a.price - b.price);
    case 'price_desc':
      return sorted.sort((a, b) => b.price - a.price);
    case 'rating_desc':
      return sorted.sort((a, b) => b.rating - a.rating);
    case 'discount_desc':
      return sorted.sort((a, b) => b.discount - a.discount);
    case 'name_asc':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return sorted;
  }
};

// ─── Get min and max price from product list ────────────────
export const getPriceRange = (products) => {
  if (!products || products.length === 0) return { min: 0, max: 200000 };
  const prices = products.map((p) => p.price);
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
};

// ─── Apply all filters together ─────────────────────────────
export const applyAllFilters = (products, { search, category, minPrice, maxPrice, sort }) => {
  let result = [...products];

  result = filterBySearch(result, search);
  result = filterByCategory(result, category);
  result = filterByPrice(result, minPrice ?? 0, maxPrice ?? 999999);
  result = sortProducts(result, sort);

  return result;
};