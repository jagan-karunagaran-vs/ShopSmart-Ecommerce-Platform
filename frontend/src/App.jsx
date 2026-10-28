import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// ── Context providers (session + server-backed cart/wishlist/catalog) ──
import { AuthProvider } from './context/AuthContext.jsx';
import { StoreProvider } from './context/StoreContext.jsx';

// ── User Pages ────────────────────────────────────────────
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Home from './pages/Home.jsx';
import Cart from './pages/Cart.jsx';
import Wishlist from './pages/Wishlist.jsx';
import ProductDetails from './pages/ProductDetails.jsx';
import Payment from './pages/Payment.jsx';
import Orders from './pages/Orders.jsx';

// ── Admin Pages ───────────────────────────────────────────
import AdminDashboard from './pages/AdminDashboard.jsx';

// ── Protected Route ───────────────────────────────────────
import ProtectedRoute from './components/ProtectedRoute.jsx';

function App() {
  return (
    <Router>
      {/* AuthProvider must wrap StoreProvider (the store reads the logged-in user) */}
      <AuthProvider>
        <StoreProvider>
          <div>
            <Routes>

              {/* ── Public Routes ── */}
              <Route path="/"       element={<Login />} />
              <Route path="/signup" element={<Signup />} />

              {/* ── Logged-in User Routes ── */}
              <Route
                path="/home"
                element={
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/cart"
                element={
                  <ProtectedRoute>
                    <Cart />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/wishlist"
                element={
                  <ProtectedRoute>
                    <Wishlist />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/product/:id"
                element={
                  <ProtectedRoute>
                    <ProductDetails />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/payment"
                element={
                  <ProtectedRoute>
                    <Payment />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orders"
                element={
                  <ProtectedRoute>
                    <Orders />
                  </ProtectedRoute>
                }
              />

              {/* ── Admin Routes ── */}
              {/* Admins log in on the normal login page; the role is   */}
              {/* checked by the server on every API call as well.      */}
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute adminOnly>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />

              {/* ── Unknown URL → login ── */}
              <Route path="*" element={<Navigate to="/" replace />} />

            </Routes>
          </div>
        </StoreProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;