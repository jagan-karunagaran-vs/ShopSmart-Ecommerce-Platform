// ─────────────────────────────────────────────────────────────
// AI Search Helper — Improved Smart Keyword Matching
// No OpenAI. No external API. Pure JavaScript logic only.
// Uses multi-signal scoring: intent + category + price + rating
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// INTENT DEFINITIONS
// Each intent has: patterns, type, and action parameters
// ─────────────────────────────────────────────────────────────
const intentRules = [

  // ── Price threshold intents ───────────────────────────────
  {
    patterns : ['under 100', 'below 100', 'less than 100'],
    type     : 'price_max',
    max      : 100,
    label    : 'Products Under ₹100',
  },
  {
    patterns : ['under 200', 'below 200', 'less than 200'],
    type     : 'price_max',
    max      : 200,
    label    : 'Products Under ₹200',
  },
  {
    patterns : ['under 500', 'below 500', 'less than 500', 'within 500'],
    type     : 'price_max',
    max      : 500,
    label    : 'Products Under ₹500',
  },
  {
    patterns : ['under 1000', 'below 1000', 'less than 1000', 'within 1000', 'upto 1000'],
    type     : 'price_max',
    max      : 1000,
    label    : 'Products Under ₹1,000',
  },
  {
    patterns : ['under 2000', 'below 2000', 'less than 2000', 'within 2000'],
    type     : 'price_max',
    max      : 2000,
    label    : 'Products Under ₹2,000',
  },
  {
    patterns : ['under 5000', 'below 5000', 'less than 5000'],
    type     : 'price_max',
    max      : 5000,
    label    : 'Products Under ₹5,000',
  },
  {
    patterns : ['under 10000', 'below 10000', 'less than 10000'],
    type     : 'price_max',
    max      : 10000,
    label    : 'Products Under ₹10,000',
  },
  {
    patterns : ['under 20000', 'below 20000', 'less than 20000'],
    type     : 'price_max',
    max      : 20000,
    label    : 'Products Under ₹20,000',
  },
  {
    patterns : ['under 50000', 'below 50000', 'less than 50000'],
    type     : 'price_max',
    max      : 50000,
    label    : 'Products Under ₹50,000',
  },

  // ── Budget / cheap intent → sort by lowest price ──────────
  {
    patterns : [
      'cheap', 'cheapest', 'affordable', 'budget', 'budget friendly',
      'low price', 'low cost', 'inexpensive', 'value for money',
      'economical', 'least expensive', 'lowest price',
    ],
    type     : 'sort',
    sortKey  : 'price_asc',
    label    : 'Budget Friendly Products',
  },

  // ── Premium / expensive intent → sort by highest price ────
  {
    patterns : [
      'expensive', 'premium', 'luxury', 'high end', 'high-end',
      'top quality', 'costliest', 'most expensive', 'exclusive',
      'elite', 'pricey',
    ],
    type     : 'sort',
    sortKey  : 'price_desc',
    label    : 'Premium Products',
  },

  // ── Best / top rated intent → sort by highest rating ──────
  {
    patterns : [
      'best', 'top rated', 'top-rated', 'highest rated', 'highly rated',
      'best rated', 'most popular', 'popular', 'trending', 'recommended',
      'good', 'excellent', 'awesome', '5 star', 'five star',
    ],
    type     : 'sort',
    sortKey  : 'rating_desc',
    label    : 'Top Rated Products',
  },

  // ── Discount / offer intent → sort by highest discount ────
  {
    patterns : [
      'discount', 'offer', 'sale', 'deals', 'best deal', 'best deals',
      'highest discount', 'max discount', 'most off', 'on sale',
      'clearance', 'saving', 'savings', 'reduced', 'top discount',
    ],
    type     : 'sort',
    sortKey  : 'discount_desc',
    label    : 'Best Deals & Offers',
  },

  // ── Category intents ──────────────────────────────────────

  {
    patterns : [
      'mobile', 'mobiles', 'phone', 'phones', 'smartphone', 'smartphones',
      'iphone', 'android', 'cellphone', 'cell phone', 'handset',
      'samsung', 'oneplus', 'redmi', 'vivo', 'oppo', 'realme', 'pixel',
    ],
    type     : 'category',
    category : 'Mobiles',
    label    : 'Mobiles & Smartphones',
  },
  {
    patterns : [
      'electronic', 'electronics', 'gadget', 'gadgets', 'tech', 'technology',
      'laptop', 'laptops', 'computer', 'pc', 'monitor', 'keyboard', 'mouse',
      'headphone', 'headphones', 'earphone', 'speaker', 'tv', 'television',
      'camera', 'gaming', 'game', 'gamer', 'console', 'charger', 'kindle',
    ],
    type     : 'category',
    category : 'Electronics',
    label    : 'Electronics & Gadgets',
  },
  {
    patterns : [
      'fashion', 'clothing', 'clothes', 'outfit', 'wear', 'dress',
      'shirt', 'tshirt', 't-shirt', 'kurta', 'jeans', 'trouser',
      'pant', 'skirt', 'top', 'ethnic', 'western', 'casual',
      'formal wear', 'apparel', 'garment', 'costume',
    ],
    type     : 'category',
    category : 'Fashion',
    label    : 'Fashion & Clothing',
  },
  {
    patterns : [
      'women', 'female', 'ladies', 'girl', 'girls', 'woman',
      'her', 'feminine', 'womens',
    ],
    type     : 'category',
    category : 'Fashion',
    label    : 'Fashion for Women',
  },
  {
    patterns : [
      'men', 'male', 'guys', 'man', 'boys', 'his',
      'masculine', 'mens', "men's",
    ],
    type     : 'category',
    category : 'Fashion',
    label    : 'Fashion for Men',
  },
  {
    patterns : [
      'shoe', 'shoes', 'sneaker', 'sneakers', 'footwear', 'boot', 'boots',
      'heel', 'heels', 'sandal', 'sandals', 'chappal', 'loafer', 'slipper',
      'nike', 'adidas', 'puma', 'vans', 'crocs', 'woodland',
    ],
    type     : 'category',
    category : 'Shoes',
    label    : 'Shoes & Footwear',
  },
  {
    patterns : [
      'watch', 'watches', 'smartwatch', 'smart watch', 'timepiece',
      'wristwatch', 'wrist watch', 'clock', 'titan', 'casio', 'fossil',
    ],
    type     : 'category',
    category : 'Watches',
    label    : 'Watches',
  },
  {
    patterns : [
      'beauty', 'makeup', 'skincare', 'skin care', 'cosmetic', 'cosmetics',
      'lipstick', 'lip', 'serum', 'face wash', 'moisturiser', 'moisturizer',
      'foundation', 'hair', 'haircare', 'hair care', 'shampoo', 'conditioner',
      'perfume', 'fragrance', 'lotion', 'cream', 'face pack', 'face',
    ],
    type     : 'category',
    category : 'Beauty',
    label    : 'Beauty & Skincare',
  },
  {
    patterns : [
      'book', 'books', 'novel', 'novels', 'read', 'reading', 'author',
      'fiction', 'nonfiction', 'self help', 'self-help', 'biography',
      'motivation', 'motivational', 'habit', 'psychology', 'finance',
    ],
    type     : 'category',
    category : 'Books',
    label    : 'Books',
  },
  {
    patterns : [
      'sport', 'sports', 'fitness', 'gym', 'exercise', 'workout',
      'cricket', 'football', 'badminton', 'cycling', 'swimming',
      'yoga', 'running', 'jogging', 'dumbbell', 'resistance',
    ],
    type     : 'category',
    category : 'Sports',
    label    : 'Sports & Fitness',
  },
  {
    patterns : [
      'appliance', 'appliances', 'home appliance', 'kitchen',
      'mixer', 'grinder', 'cooker', 'pressure cooker', 'fan',
      'vacuum', 'induction', 'air fryer', 'toaster', 'microwave',
      'refrigerator', 'washing machine', 'water purifier', 'bulb',
    ],
    type     : 'category',
    category : 'Home Appliances',
    label    : 'Home Appliances',
  },
  {
    patterns : [
      'lifestyle', 'decor', 'decoration', 'home decor', 'candle',
      'lamp', 'bottle', 'organiser', 'organizer', 'diffuser',
      'photo frame', 'wall art', 'macrame', 'salt lamp',
    ],
    type     : 'category',
    category : 'Lifestyle',
    label    : 'Lifestyle & Decor',
  },
  {
    patterns : [
      'accessory', 'accessories', 'bag', 'bags', 'wallet', 'wallets',
      'sunglasses', 'sunglass', 'belt', 'belts', 'backpack', 'tote',
      'scarf', 'bracelet', 'earbuds', 'earbud', 'airpods', 'tws',
    ],
    type     : 'category',
    category : 'Accessories',
    label    : 'Accessories',
  },
  {
    patterns : [
      'grocery', 'groceries', 'food', 'foods', 'tea', 'coffee',
      'butter', 'oil', 'atta', 'flour', 'oats', 'jam', 'biscuit',
      'snack', 'drink', 'beverage', 'dairy', 'spice',
    ],
    type     : 'category',
    category : 'Groceries',
    label    : 'Groceries & Food',
  },
];

// ─────────────────────────────────────────────────────────────
// KEYWORD SCORING MAP
// If query contains these keywords, score products higher
// ─────────────────────────────────────────────────────────────
const scoringKeywords = [
  // Cheap / budget → boost low priced items
  { words: ['cheap', 'budget', 'affordable', 'low cost'], field: 'price', boost: 'low' },
  // Premium / expensive → boost high priced items
  { words: ['premium', 'luxury', 'expensive', 'high end'], field: 'price', boost: 'high' },
  // Best / top → boost high rated items
  { words: ['best', 'top', 'good', 'great', 'excellent'], field: 'rating', boost: 'high' },
  // Discount / offer → boost high discount items
  { words: ['discount', 'offer', 'deal', 'sale', 'off'], field: 'discount', boost: 'high' },
];

// ─────────────────────────────────────────────────────────────
// DYNAMIC PRICE EXTRACTION
// Extracts price from queries like "under 3000", "below 1500"
// ─────────────────────────────────────────────────────────────
const extractPriceLimit = (query) => {
  const patterns = [
    /(?:under|below|less than|within|upto|up to|max|maximum)\s*₹?\s*(\d+)/i,
    /₹?\s*(\d+)\s*(?:se kam|se neeche|tak)/i,
  ];
  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match) return parseInt(match[1], 10);
  }
  return null;
};

// ─────────────────────────────────────────────────────────────
// MAIN AI SEARCH FUNCTION
// ─────────────────────────────────────────────────────────────
export const aiSearch = (query, products) => {

  // ── Empty query → return all products ────────────────────
  if (!query || query.trim() === '') {
    return { products, label: '', matched: false };
  }

  const lower = query.toLowerCase().trim();

  // ── Step 1: Try dynamic price extraction first ────────────
  // e.g. "under 3500", "below 750", "products under 12000"
  const dynamicPrice = extractPriceLimit(lower);
  if (dynamicPrice !== null) {
    const result = products.filter((p) => p.price <= dynamicPrice);
    return {
      products : result,
      label    : `Products Under ₹${dynamicPrice.toLocaleString('en-IN')}`,
      matched  : result.length > 0,
    };
  }

  // ── Step 2: Check intentRules for keyword match ───────────
  for (const rule of intentRules) {
    const matched = rule.patterns.some((pattern) =>
      lower.includes(pattern.toLowerCase())
    );

    if (matched) {

      // ── Category intent ───────────────────────────────────
      if (rule.type === 'category') {
        const result = products.filter(
          (p) => p.category.toLowerCase() === rule.category.toLowerCase()
        );
        return {
          products : result,
          label    : rule.label,
          matched  : result.length > 0,
        };
      }

      // ── Price max intent ──────────────────────────────────
      if (rule.type === 'price_max') {
        const result = products.filter((p) => p.price <= rule.max);
        return {
          products : result,
          label    : rule.label,
          matched  : result.length > 0,
        };
      }

      // ── Sort intent ───────────────────────────────────────
      if (rule.type === 'sort') {
        const sorted = [...products].sort((a, b) => {
          if (rule.sortKey === 'price_asc')     return a.price - b.price;
          if (rule.sortKey === 'price_desc')    return b.price - a.price;
          if (rule.sortKey === 'discount_desc') return b.discount - a.discount;
          if (rule.sortKey === 'rating_desc')   return b.rating - a.rating;
          return 0;
        });
        return {
          products : sorted,
          label    : rule.label,
          matched  : true,
        };
      }
    }
  }

  // ── Step 3: Multi-field text search with scoring ──────────
  // Search across name + category + description
  // Score higher if query matches name > category > description
  const words = lower.split(/\s+/).filter((w) => w.length > 1);

  const scored = products
    .map((p) => {
      let score = 0;
      const pName  = p.name.toLowerCase();
      const pCat   = p.category.toLowerCase();
      const pDesc  = p.description.toLowerCase();

      // Score for each word in the query
      words.forEach((word) => {
        if (pName.includes(word))  score += 10; // name match = highest
        if (pCat.includes(word))   score += 6;  // category match = medium
        if (pDesc.includes(word))  score += 3;  // description match = lower
      });

      // Full query match bonus
      if (pName.includes(lower))  score += 20;
      if (pCat.includes(lower))   score += 10;
      if (pDesc.includes(lower))  score += 5;

      // Scoring keyword boosts
      scoringKeywords.forEach((sk) => {
        const hasKeyword = sk.words.some((w) => lower.includes(w));
        if (hasKeyword) {
          if (sk.field === 'rating'   && sk.boost === 'high') score += p.rating * 2;
          if (sk.field === 'discount' && sk.boost === 'high') score += p.discount * 0.5;
          if (sk.field === 'price'    && sk.boost === 'low')  score += (100000 - p.price) * 0.0001;
          if (sk.field === 'price'    && sk.boost === 'high') score += p.price * 0.0001;
        }
      });

      return { product: p, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.product);

  // ── Step 4: Category-only fallback ───────────────────────
  // If text search also fails, check category names directly
  if (scored.length === 0) {
    const catMatch = products.filter((p) =>
      p.category.toLowerCase().includes(lower)
    );
    if (catMatch.length > 0) {
      return {
        products : catMatch,
        label    : `Results in "${lower}" category`,
        matched  : true,
      };
    }
  }

  return {
    products : scored,
    label    : scored.length > 0 ? `Smart results for "${query}"` : '',
    matched  : scored.length > 0,
  };
};

// ─────────────────────────────────────────────────────────────
// SUGGESTION CHIPS
// ─────────────────────────────────────────────────────────────
export const aiSuggestions = [
  'cheap phones',
  'under 1000',
  'best electronics',
  'top rated books',
  'fashion for women',
  'premium watches',
  'beauty products',
  'sports fitness',
  'kitchen appliances',
  'top discount',
];