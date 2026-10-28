// ShopSmart API client.
// Authentication uses httpOnly cookies.
// CSRF tokens are kept in memory and sent with unsafe methods.

const API_BASE = (
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
).replace(/\/$/, '');

let csrfToken = '';

export const setCsrfToken = (token) => {
  csrfToken = token || '';
};

export const getCsrfToken = () => csrfToken;

export class ApiError extends Error {
  constructor(message, status = 0, details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export const AUTH_EXPIRED_EVENT = 'shopsmart-auth-expired';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const buildQuery = (query) => {
  if (!query) return '';

  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value));
    }
  });

  const str = params.toString();
  return str ? `?${str}` : '';
};

const request = async (
  method,
  path,
  { body, query, skipAuthExpiry, signal } = {}
) => {
  const headers = { Accept: 'application/json' };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (!SAFE_METHODS.has(method) && csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  let response;

  try {
    response = await fetch(
      `${API_BASE}${path}${buildQuery(query)}`,
      {
        method,
        headers,
        credentials: 'include',
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal,
      }
    );
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') {
      throw error;
    }

    throw new ApiError(
      'Unable to reach the server. Please check your connection and try again.'
    );
  }

  let payload = null;

  try {
    payload = await response.json();
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') {
      throw error;
    }

    payload = null;
  }

  if (!response.ok || !payload || payload.success === false) {
    const message =
      payload?.message ||
      `Request failed (${response.status}). Please try again.`;

    if (response.status === 401 && !skipAuthExpiry) {
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }

    throw new ApiError(message, response.status, payload?.details);
  }

  return payload;
};

const get = (path, query, options) =>
  request('GET', path, { query, ...options });

const post = (path, body, options) =>
  request('POST', path, { body: body ?? {}, ...options });

const put = (path, body, options) =>
  request('PUT', path, { body: body ?? {}, ...options });

const del = (path, options) =>
  request('DELETE', path, options);

// AUTH
export const authApi = {
  signup: ({ name, email, password }) =>
    post(
      '/auth/signup',
      { name, email, password },
      { skipAuthExpiry: true }
    ),

  login: async ({ email, password }) => {
    const res = await post(
      '/auth/login',
      { email, password },
      { skipAuthExpiry: true }
    );

    setCsrfToken(res.data.csrfToken);
    return res;
  },

  logout: async () => {
    try {
      return await post(
        '/auth/logout',
        {},
        { skipAuthExpiry: true }
      );
    } finally {
      setCsrfToken('');
    }
  },

  me: async () => {
    const res = await get(
      '/auth/me',
      undefined,
      { skipAuthExpiry: true }
    );

    setCsrfToken(res.data.csrfToken);
    return res;
  },
};

// PROFILE
export const userApi = {
  getProfile: () => get('/users/profile'),

  updateProfile: ({ name }) =>
    put('/users/profile', { name }),

  changePassword: async ({ currentPassword, newPassword }) => {
    const res = await put('/users/password', {
      currentPassword,
      newPassword,
    });

    if (res.data?.csrfToken) {
      setCsrfToken(res.data.csrfToken);
    }

    return res;
  },
};

// PRODUCTS
export const productApi = {
  list: (params) => get('/products', params),
  getById: (id) => get(`/products/${id}`),
  create: (product) => post('/products', product),
  update: (id, updates) => put(`/products/${id}`, updates),
  remove: (id) => del(`/products/${id}`),
};

// CATEGORIES
export const categoryApi = {
  list: () => get('/categories'),
  getById: (id) => get(`/categories/${id}`),
  create: (category) => post('/categories', category),
  update: (id, updates) => put(`/categories/${id}`, updates),
  remove: (id) => del(`/categories/${id}`),
};

// REAL AI SEARCH
// Only the query is sent. The backend loads the MongoDB catalog
// and calls Gemini using its server-side API key.
export const aiSearchApi = {
  search: (query, { signal } = {}) =>
    post('/ai/search', { query }, { signal }),
};

// CART
export const cartApi = {
  get: () => get('/cart'),

  add: (productId, quantity = 1) =>
    post('/cart/items', { productId, quantity }),

  setQuantity: (productId, quantity) =>
    put(`/cart/items/${productId}`, { quantity }),

  remove: (productId) => del(`/cart/items/${productId}`),
  clear: () => del('/cart'),
};

// WISHLIST
export const wishlistApi = {
  get: () => get('/wishlist'),
  add: (productId) => post('/wishlist/items', { productId }),
  remove: (productId) => del(`/wishlist/items/${productId}`),
  clear: () => del('/wishlist'),
};

// ORDERS
export const orderApi = {
  create: (shippingAddress) =>
    post('/orders', { shippingAddress }),

  list: (params) => get('/orders', params),
  getById: (id) => get(`/orders/${id}`),

  cancel: (id, reason) =>
    put(`/orders/${id}/cancel`, { reason }),
};

// PAYMENTS
export const paymentApi = {
  createOrder: (orderId) =>
    post('/payments/create-order', { orderId }),

  verify: ({
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  }) =>
    post('/payments/verify', {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    }),

  status: (orderId) => get(`/payments/status/${orderId}`),
};

// ADMIN
export const adminApi = {
  stats: () => get('/admin/stats'),
  listOrders: (params) => get('/admin/orders', params),
  getOrder: (id) => get(`/admin/orders/${id}`),

  updateOrderStatus: (id, status, note) =>
    put(`/admin/orders/${id}/status`, { status, note }),

  listUsers: (params) => get('/admin/users', params),

  setUserActive: (id, isActive) =>
    put(`/admin/users/${id}/status`, { isActive }),
};

export default {
  authApi,
  userApi,
  productApi,
  categoryApi,
  aiSearchApi,
  cartApi,
  wishlistApi,
  orderApi,
  paymentApi,
  adminApi,
};