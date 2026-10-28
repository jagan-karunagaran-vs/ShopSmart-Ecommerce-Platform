import { asyncHandler } from '../middleware/errorMiddleware.js';
import { searchProductsWithAI } from '../services/aiSearchService.js';

// POST /api/ai/search
// Authentication and rate limiting will be enforced by the route.
export const searchProducts = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');

  // The service validates the query and reads products from MongoDB.
  // Client-provided products, prices and roles are never used.
  const result = await searchProductsWithAI(req.body?.query);

  res.status(200).json({
    success: true,
    data: result,
  });
});

export default searchProducts;