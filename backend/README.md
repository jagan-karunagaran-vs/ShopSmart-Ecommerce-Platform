# ShopSmart Backend

REST API for the ShopSmart storefront.

- **Stack:** Node.js (ES modules) · Express 5 · MongoDB Atlas (Mongoose) · Razorpay (test mode)
- **Auth:** JWT in an `httpOnly` cookie, with signed double-submit CSRF protection
- **Validation:** Zod · **Security middleware:** helmet, CORS allow-list, rate limiting

> **Status:** This code has not been run or tested yet. There are no automated tests (`tests/` is empty). Use the manual checklist below to verify your setup.

---

## 1. Prerequisites

- Node.js 20 or newer (the project targets v24).
- A MongoDB Atlas cluster. Order creation and payment confirmation use **transactions**, which need a replica set. Atlas clusters, including the free tier, are replica sets.
- In Atlas, allow your IP under Network Access and create a database user.
- A Razorpay account with **Test Mode** enabled.

## 2. Setup

```bash
cd backend
npm install
cp .env.example .env      # Windows: copy .env.example .env
```

`npm install` also installs the Razorpay SDK, which is listed in `package.json`.

Edit `.env`. Every value that starts with `replace_` or `your_` is a placeholder.

| Variable | Notes |
|---|---|
| `MONGODB_URI` | Atlas connection string. Include the database name (e.g. `/shopsmart`) and URL-encode special characters in the password. |
| `JWT_SECRET` | Long random string. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `CLIENT_URL` | Frontend origin(s), comma-separated, no trailing slash. Default `http://localhost:5173`. |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay Dashboard → Test Mode → Settings → API Keys. |
| `RAZORPAY_WEBHOOK_SECRET` | The secret you set when creating the webhook (see section 7). |
| `COOKIE_SECURE`, `COOKIE_SAME_SITE`, `COOKIE_DOMAIN` | Local dev: `false` / `lax` / empty. Production over HTTPS: `true`. |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Used only by `npm run create-admin`. |
| `FREE_DELIVERY_THRESHOLD`, `DELIVERY_CHARGE` | Pricing rules (default free above ₹499, otherwise ₹49). They match the existing storefront. |

Never commit `.env`.

## 3. Run

```bash
npm run dev      # node --watch src/server.js
npm start        # node src/server.js
```

Health check: `GET http://localhost:5000/api/health`

The frontend reads the API address from `VITE_API_URL` (default `http://localhost:5000/api`). To change it, create `frontend/.env` containing:

```
VITE_API_URL=http://localhost:5000/api
```

## 4. Seed the catalog

```bash
npm run seed           # insert missing categories/products only
npm run seed:update    # also refresh catalog fields of already-seeded items
```

- The script reads `../frontend/src/data/categories.js` and `products.js`, so it must be run from a checkout where `frontend/` sits next to `backend/`. Keep those two data files in the frontend as the seed source.
- It is repeatable and never deletes anything.
- Products are matched by their legacy catalog id and categories by name.
- `stock` (default 100) and `isActive` are set only on first insert and are never overwritten, even with `--update`.

## 5. Create an admin

Public signup **always** creates role `user`. Admins can only be created with the script:

```bash
# set ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD in .env first
npm run create-admin
npm run create-admin -- --promote   # promote an existing user (password untouched)
```

## 6. Authentication and CSRF contract

Cookie authentication is the only mechanism. There is no bearer token and nothing is stored in `localStorage`. The frontend client in `frontend/src/services/api.js` implements all of the following.

1. Every request must use `credentials: 'include'` (fetch) or `withCredentials: true` (axios).
2. `POST /api/auth/login` sets the `httpOnly` auth cookie and returns `{ user, csrfToken }`.
3. On app start call `GET /api/auth/me`. It returns the current user and a fresh `csrfToken`, and refreshes the session cookies. A `401` means logged out.
4. Send `X-CSRF-Token: <csrfToken>` on every `POST`, `PUT`, `PATCH` and `DELETE` to protected routes. Keep the token in memory, or read the `shopsmart_csrf` cookie if the API and the frontend share a site.
5. `POST /api/auth/logout` is public, so a stale session can always be cleared.
6. For a frontend and API on different sites in production, use `COOKIE_SECURE=true` and `COOKIE_SAME_SITE=none`, and keep `CLIENT_URL` exact. With a cross-site setup, read the CSRF token from the JSON response, not from the cookie.

## 7. Razorpay payments (test mode)

**Flow**

1. `POST /api/orders` creates an order from the server-side cart. It takes a delivery address only. Totals are calculated and stock is reserved on the server.
2. `POST /api/payments/create-order` with `{ orderId }` returns `checkout` details (`keyId`, `razorpayOrderId`, `amount` in paise, `currency`, `prefill`).
3. The frontend opens Razorpay Checkout, so card data never touches this server.
4. `POST /api/payments/verify` with `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }`. The server checks the signature, fetches the payment from Razorpay, and verifies ownership, order id, amount, currency and status before marking the order paid.
5. The webhook is a backup. It confirms payments even if the browser closes before step 4.

Unpaid orders hold stock for 30 minutes and are then cancelled automatically. This runs the next time any order is created.

**Webhook setup**

Razorpay must reach your server over HTTPS, so locally use a tunnel (ngrok, cloudflared…):

1. Start a tunnel to port 5000.
2. Razorpay Dashboard → Test Mode → Settings → Webhooks → Add:
   - URL: `https://<your-tunnel>/api/payments/webhook`
   - Secret: any strong string. Put the same value in `RAZORPAY_WEBHOOK_SECRET`.
   - Events: `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`
3. Webhook handling is idempotent. Duplicate event ids are acknowledged and ignored.

**Test payments**

Use Razorpay's published test credentials (see their "Test Card Details" docs). For UPI, use `success@razorpay` to succeed and `failure@razorpay` to fail.

**Refunds**

Refunds are done manually in the Razorpay Dashboard. A `refund.processed` webhook then updates the order. An order cancelled after payment is flagged "refund required" in its status history.

## 8. API overview

All responses use this contract:

```json
{ "success": true,  "message": "optional", "data": { } }
{ "success": false, "message": "reason",   "details": [ ] }
```

IDs are MongoDB ObjectId strings, exposed as `id`.

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/signup` · `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` |
| Profile | `GET/PUT /api/users/profile` · `PUT /api/users/password` |
| Products | `GET /api/products` (filters: `category`, `q`, `minPrice`, `maxPrice`, `sort`, `page`, `limit`) · `GET /api/products/:id` · admin: `POST`, `PUT /:id`, `DELETE /:id` |
| Categories | `GET /api/categories` · `GET /:id` · admin: `POST`, `PUT /:id`, `DELETE /:id` |
| Cart | `GET /api/cart` · `POST /api/cart/items` · `PUT /api/cart/items/:productId` · `DELETE /api/cart/items/:productId` · `DELETE /api/cart` |
| Wishlist | `GET /api/wishlist` · `POST /api/wishlist/items` · `DELETE /api/wishlist/items/:productId` · `DELETE /api/wishlist` |
| Orders | `POST /api/orders` · `GET /api/orders` · `GET /api/orders/:id` · `PUT /api/orders/:id/cancel` |
| Payments | `POST /api/payments/create-order` · `POST /api/payments/verify` · `GET /api/payments/status/:orderId` · `POST /api/payments/webhook` |
| Admin | `GET /api/admin/stats` · `GET /api/admin/orders` · `GET /api/admin/orders/:id` · `PUT /api/admin/orders/:id/status` · `GET /api/admin/users` · `PUT /api/admin/users/:id/status` |

Notes:

- The product list returns **all** active products unless `limit` is given, because the storefront filters and searches client-side.
- Cart and wishlist items are returned as product objects (`id`, `name`, `price`, …, plus `quantity` for the cart). The cart also returns server-calculated `totals`.
- The old shared `localStorage` cart and wishlist are **not** imported into accounts.

## 9. Manual test checklist

```bash
BASE=http://localhost:5000/api

# health
curl $BASE/health

# signup (a "role" field is ignored)
curl -X POST $BASE/auth/signup -H 'Content-Type: application/json' \
  -d '{"name":"Test User","email":"test@example.com","password":"secret123","role":"admin"}'

# login (stores the cookie) and capture the CSRF token
CSRF=$(curl -s -c jar.txt -X POST $BASE/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"secret123"}' | jq -r '.data.csrfToken')

# authenticated read
curl -b jar.txt $BASE/cart

# write WITHOUT the CSRF header -> expect 403
curl -b jar.txt -X DELETE $BASE/cart

# write WITH the CSRF header -> expect 200
curl -b jar.txt -X DELETE $BASE/cart -H "X-CSRF-Token: $CSRF"
```

Also verify:

- A normal user gets `403` on `/api/admin/*`.
- Adding more than the available stock to the cart returns `409`.
- Creating an order, paying with a test card, then reading `/api/payments/status/:orderId` shows `paid`.
- A failed test payment leaves the order pending and retryable.
- Replaying the same webhook event returns `duplicate: true` and changes nothing.

## 10. Troubleshooting

| Symptom | Likely cause |
|---|---|
| `Transaction numbers are only allowed on a replica set member` | Not using Atlas, or a standalone MongoDB. Use an Atlas cluster. |
| Browser blocks requests (CORS) | `CLIENT_URL` doesn't exactly match the frontend origin (scheme, host and port). |
| Logged in, but the next request is `401` | Missing `credentials: 'include'`, or a cross-site setup without `COOKIE_SAME_SITE=none` + `COOKIE_SECURE=true`. |
| `403 Invalid or missing CSRF token` | The `X-CSRF-Token` header is missing, stale, or from a different user. Call `/auth/me` to refresh it. |
| `503 Online payments are not configured` | Razorpay keys are still placeholders. |
| Webhook returns `400 Invalid webhook signature` | `RAZORPAY_WEBHOOK_SECRET` differs from the dashboard secret, or a proxy altered the body. |

## 11. Project structure

```
backend/
├── src/
│   ├── app.js            Express app, middleware, route mounting
│   ├── server.js         DB connection + HTTP server
│   ├── config/db.js
│   ├── models/           User, Product, Category, Cart, Wishlist, Order, Payment
│   ├── controllers/
│   ├── routes/           Zod schemas live next to their routes
│   ├── middleware/       auth (+CSRF), admin, validation, rate limits, errors
│   ├── services/         orderService, paymentService
│   ├── utils/            AppError, token/cookie helpers, order totals
│   └── scripts/          seedProducts, createAdmin
└── tests/                (empty)
```