import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/AdminDashboard.css';
import { formatPrice } from '../utils/helpers.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useStore } from '../context/StoreContext.jsx';
import { productApi, categoryApi, adminApi } from '../services/api.js';

const DEFAULT_IMAGE =
  'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=400&q=80';

const EMPTY_PRODUCT_FORM = {
  name: '',
  category: '',
  price: '',
  originalPrice: '',
  stock: '',
  rating: '',
  reviews: '',
  image: '',
  description: '',
};

const ORDER_STATUS_LABELS = {
  pending: 'Awaiting payment',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const PAYMENT_STATUS_LABELS = {
  pending: 'Pending',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
};

const NEXT_STATUSES = {
  pending: ['cancelled'],
  confirmed: ['processing', 'shipped', 'delivered', 'cancelled'],
  processing: ['shipped', 'delivered', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

const formatDate = (iso) => {
  if (!iso) return '—';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

function AdminDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { refreshCatalog } = useStore();

  const adminName = user?.name || 'Admin';

  // ── Active tab ────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('products');

  // ── Catalog state ─────────────────────────────────────────
  const [productList, setProductList] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // ── Product table search and filter ───────────────────────
  const [tableSearch, setTableSearch] = useState('');
  const [tableCategory, setTableCategory] = useState('All');

  // ── Product form ──────────────────────────────────────────
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT_FORM);
  const [productFormSuccess, setProductFormSuccess] = useState('');
  const [productFormError, setProductFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Category form ─────────────────────────────────────────
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('');
  const [catFormSuccess, setCatFormSuccess] = useState('');
  const [catFormError, setCatFormError] = useState('');

  // ── Category edit ─────────────────────────────────────────
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatIcon, setEditCatIcon] = useState('');
  const [categorySaving, setCategorySaving] = useState(false);

  // ── Users state ───────────────────────────────────────────
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [usersSearch, setUsersSearch] = useState('');
  const [userBusyId, setUserBusyId] = useState(null);
  const [userPagination, setUserPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
  });

  // ── Orders state ──────────────────────────────────────────
  const [orders, setOrders] = useState([]);
  const [orderPagination, setOrderPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
  });
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [orderPaymentFilter, setOrderPaymentFilter] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [statusDraft, setStatusDraft] = useState({});
  const [orderBusyId, setOrderBusyId] = useState(null);
  const [orderError, setOrderError] = useState('');
  const [orderSuccess, setOrderSuccess] = useState('');

  // ── Load products and categories ──────────────────────────
  const loadCatalog = useCallback(async () => {
    setLoadError('');

    try {
      const [productRes, categoryRes] = await Promise.all([
        productApi.list({ includeInactive: 'true', sort: 'newest' }),
        categoryApi.list(),
      ]);

      setProductList(productRes.data.products || []);
      setCategoryList(categoryRes.data.categories || []);
    } catch (err) {
      setLoadError(err.message || 'Could not load the catalog.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // ── Load users ────────────────────────────────────────────
  const loadUsers = useCallback(async (page = 1) => {
    setUsersLoading(true);
    setUsersError('');

    try {
      const res = await adminApi.listUsers({
        page,
        limit: 10,
        search: usersSearch,
        role: 'user',
      });

      const receivedUsers = res.data.users || [];
      const pagination = res.data.pagination || {
        page,
        pages: 1,
        total: receivedUsers.length,
      };

      setUsers((prev) =>
        page > 1 ? [...prev, ...receivedUsers] : receivedUsers
      );
      setUserPagination(pagination);
    } catch (err) {
      setUsersError(err.message || 'Could not load users.');
    } finally {
      setUsersLoading(false);
    }
  }, [usersSearch]);

  useEffect(() => {
    if (activeTab !== 'users') return undefined;

    const timer = setTimeout(() => {
      loadUsers(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [activeTab, loadUsers]);

  // ── Activate / deactivate user ────────────────────────────
  const handleToggleUserStatus = async (selectedUser) => {
    const selectedUserId = selectedUser.id || selectedUser._id;

    if (!selectedUserId || userBusyId) return;

    const nextStatus = !selectedUser.isActive;
    const action = nextStatus ? 'activate' : 'deactivate';

    if (
      !window.confirm(
        `Are you sure you want to ${action} ${selectedUser.name}?`
      )
    ) {
      return;
    }

    setUserBusyId(selectedUserId);
    setUsersError('');

    try {
      await adminApi.setUserActive(selectedUserId, nextStatus);

      setUsers((prev) =>
        prev.map((item) => {
          const itemId = item.id || item._id;

          return itemId === selectedUserId
            ? { ...item, isActive: nextStatus }
            : item;
        })
      );
    } catch (err) {
      setUsersError(err.message || `Could not ${action} user.`);
    } finally {
      setUserBusyId(null);
    }
  };

  // ── Load orders ───────────────────────────────────────────
  const loadOrders = useCallback(
    async (page = 1, append = false) => {
      setOrdersLoading(true);
      setOrderError('');

      try {
        const res = await adminApi.listOrders({
          page,
          limit: 10,
          status: orderStatusFilter,
          paymentStatus: orderPaymentFilter,
          search: orderSearch,
        });

        const receivedOrders = res.data.orders || [];

        setOrders((prev) =>
          append ? [...prev, ...receivedOrders] : receivedOrders
        );

        setOrderPagination(
          res.data.pagination || { page, pages: 1, total: receivedOrders.length }
        );
      } catch (err) {
        setOrderError(err.message || 'Could not load orders.');
      } finally {
        setOrdersLoading(false);
      }
    },
    [orderStatusFilter, orderPaymentFilter, orderSearch]
  );

  useEffect(() => {
    if (activeTab !== 'orders') return undefined;

    const timer = setTimeout(() => loadOrders(1, false), 300);
    return () => clearTimeout(timer);
  }, [activeTab, loadOrders]);

  // ── Logout ────────────────────────────────────────────────
  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // ─────────────────────────────────────────────────────────
  // PRODUCT HANDLERS
  // ─────────────────────────────────────────────────────────

  const handleProductFormChange = (e) => {
    const { name, value } = e.target;
    setProductForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleResetProductForm = () => {
    setProductForm(EMPTY_PRODUCT_FORM);
    setProductFormSuccess('');
    setProductFormError('');
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    setProductFormSuccess('');
    setProductFormError('');

    if (
      !productForm.name.trim() ||
      !productForm.category ||
      !productForm.price ||
      !productForm.originalPrice ||
      !productForm.description.trim()
    ) {
      setProductFormError(
        '⚠️ Please fill all required fields: Name, Category, Price, Original Price, Description.'
      );
      return;
    }

    if (isNaN(productForm.price) || Number(productForm.price) <= 0) {
      setProductFormError('⚠️ Price must be a valid positive number.');
      return;
    }

    if (
      productForm.stock !== '' &&
      (!Number.isInteger(Number(productForm.stock)) ||
        Number(productForm.stock) < 0)
    ) {
      setProductFormError('⚠️ Stock must be a whole number (0 or more).');
      return;
    }

    const payload = {
      name: productForm.name.trim(),
      category: productForm.category,
      price: Number(productForm.price),
      originalPrice:
        Number(productForm.originalPrice) || Number(productForm.price),
      rating: Number(productForm.rating) || 4.0,
      reviews: Number(productForm.reviews) || 0,
      image: productForm.image.trim() || DEFAULT_IMAGE,
      description: productForm.description.trim(),
    };

    if (productForm.stock !== '') {
      payload.stock = Number(productForm.stock);
    }

    setSaving(true);

    try {
      const res = await productApi.create(payload);
      const created = res.data.product;

      setProductList((prev) => [created, ...prev]);
      refreshCatalog();

      handleResetProductForm();
      setProductFormSuccess(`✅ "${created.name}" added successfully!`);
      setTimeout(() => setProductFormSuccess(''), 3000);
    } catch (err) {
      setProductFormError(`⚠️ ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    setProductFormError('');

    try {
      await productApi.remove(id);
      setProductList((prev) => prev.filter((p) => p.id !== id));
      refreshCatalog();
    } catch (err) {
      setProductFormError(`⚠️ ${err.message}`);
    }
  };

  const handleEditProduct = async (product) => {
    const name = window.prompt('Product name:', product.name ?? '');
    if (name === null) return;

    const category = window.prompt(
      'Category (must match an existing category):',
      product.category ?? ''
    );
    if (category === null) return;

    const priceInput = window.prompt(
      'Selling price (₹):',
      String(product.price ?? 0)
    );
    if (priceInput === null) return;

    const originalPriceInput = window.prompt(
      'Original price / MRP (₹):',
      String(product.originalPrice ?? product.price ?? 0)
    );
    if (originalPriceInput === null) return;

    const stockInput = window.prompt(
      'Stock quantity (whole number, 0 or more):',
      String(product.stock ?? 0)
    );
    if (stockInput === null) return;

    const image = window.prompt('Product image URL:', product.image ?? '');
    if (image === null) return;

    const description = window.prompt(
      'Product description:',
      product.description ?? ''
    );
    if (description === null) return;

    const ratingInput = window.prompt(
      'Rating (0 to 5):',
      String(product.rating ?? 0)
    );
    if (ratingInput === null) return;

    const reviewsInput = window.prompt(
      'Number of reviews:',
      String(product.reviews ?? 0)
    );
    if (reviewsInput === null) return;

    const price = Number(priceInput);
    const originalPrice = Number(originalPriceInput);
    const stock = Number(stockInput);
    const rating = Number(ratingInput);
    const reviews = Number(reviewsInput);

    if (!name.trim() || name.trim().length < 2) {
      setProductFormError(
        '⚠️ Product name must contain at least 2 characters.'
      );
      return;
    }

    if (!category.trim()) {
      setProductFormError('⚠️ Category is required.');
      return;
    }

    if (
      priceInput.trim() === '' ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      setProductFormError(
        '⚠️ Selling price must be a valid number greater than 0.'
      );
      return;
    }

    if (
      originalPriceInput.trim() === '' ||
      !Number.isFinite(originalPrice) ||
      originalPrice < price
    ) {
      setProductFormError(
        '⚠️ Original price must be greater than or equal to selling price.'
      );
      return;
    }

    if (
      stockInput.trim() === '' ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      setProductFormError(
        '⚠️ Stock must be a whole number (0 or more).'
      );
      return;
    }

    if (
      ratingInput.trim() === '' ||
      !Number.isFinite(rating) ||
      rating < 0 ||
      rating > 5
    ) {
      setProductFormError('⚠️ Rating must be between 0 and 5.');
      return;
    }

    if (
      reviewsInput.trim() === '' ||
      !Number.isInteger(reviews) ||
      reviews < 0
    ) {
      setProductFormError(
        '⚠️ Reviews must be a whole number (0 or more).'
      );
      return;
    }

    setProductFormError('');

    try {
      const payload = {
        name: name.trim(),
        category: category.trim(),
        price,
        originalPrice,
        stock,
        image: image.trim(),
        description: description.trim(),
        rating,
        reviews,
      };

      const res = await productApi.update(product.id, payload);

      setProductList((prev) =>
        prev.map((p) => (p.id === product.id ? res.data.product : p))
      );

      refreshCatalog();
      setProductFormSuccess(
        `✅ "${res.data.product.name}" updated successfully.`
      );
      setTimeout(() => setProductFormSuccess(''), 3000);
    } catch (err) {
      setProductFormError(`⚠️ ${err.message}`);
    }
  };

  const handleEditStock = (product) => handleEditProduct(product);

  // ─────────────────────────────────────────────────────────
  // CATEGORY HANDLERS
  // ─────────────────────────────────────────────────────────

  const handleAddCategory = async (e) => {
    e.preventDefault();
    setCatFormSuccess('');
    setCatFormError('');

    if (!catName.trim()) {
      setCatFormError('⚠️ Category name is required.');
      return;
    }

    if (!catIcon.trim()) {
      setCatFormError('⚠️ Category icon (emoji) is required.');
      return;
    }

    const exists = categoryList.find(
      (c) => c.name.toLowerCase() === catName.trim().toLowerCase()
    );

    if (exists) {
      setCatFormError('⚠️ A category with this name already exists.');
      return;
    }

    try {
      const res = await categoryApi.create({
        name: catName.trim(),
        icon: catIcon.trim(),
        image: DEFAULT_IMAGE,
        description: catName.trim(),
      });

      const created = res.data.category;

      setCategoryList((prev) => [...prev, created]);
      refreshCatalog();

      setCatFormSuccess(
        `✅ Category "${created.name}" added successfully!`
      );
      setCatName('');
      setCatIcon('');
      setTimeout(() => setCatFormSuccess(''), 3000);
    } catch (err) {
      setCatFormError(`⚠️ ${err.message}`);
    }
  };

  const handleStartEditCategory = (category) => {
    setEditingCategoryId(category.id);
    setEditCatName(category.name || '');
    setEditCatIcon(category.icon || '');
    setCatFormError('');
    setCatFormSuccess('');
  };

  const handleCancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditCatName('');
    setEditCatIcon('');
  };

  const handleUpdateCategory = async (e, category) => {
    e.preventDefault();

    setCatFormError('');
    setCatFormSuccess('');

    const nextName = editCatName.trim();
    const nextIcon = editCatIcon.trim();

    if (!nextName || !nextIcon) {
      setCatFormError('⚠️ Category name and icon are required.');
      return;
    }

    const duplicate = categoryList.find(
      (item) =>
        item.id !== category.id &&
        item.name.toLowerCase() === nextName.toLowerCase()
    );

    if (duplicate) {
      setCatFormError('⚠️ A category with this name already exists.');
      return;
    }

    setCategorySaving(true);

    try {
      const res = await categoryApi.update(category.id, {
        name: nextName,
        icon: nextIcon,
      });

      const updatedCategory = res.data.category;

      if (!updatedCategory) {
        throw new Error('Updated category was not returned by the server.');
      }

      setCategoryList((prev) =>
        prev.map((item) =>
          item.id === category.id ? updatedCategory : item
        )
      );

      // Keep the dashboard's local product list in sync with the category rename.
      if (category.name !== updatedCategory.name) {
        setProductList((prev) =>
          prev.map((product) =>
            product.category === category.name
              ? { ...product, category: updatedCategory.name }
              : product
          )
        );
      }

      handleCancelEditCategory();
      setCatFormSuccess(
        `✅ Category "${updatedCategory.name}" updated successfully!`
      );

      refreshCatalog();
      setTimeout(() => setCatFormSuccess(''), 3000);
    } catch (err) {
      setCatFormError(`⚠️ ${err.message}`);
    } finally {
      setCategorySaving(false);
    }
  };

  const handleDeleteCategory = async (id, name) => {
    if (
      !window.confirm(
        `Delete category "${name}"? A category that still has products cannot be deleted.`
      )
    ) {
      return;
    }

    setCatFormError('');
    setCatFormSuccess('');

    try {
      await categoryApi.remove(id);
      setCategoryList((prev) => prev.filter((c) => c.id !== id));
      refreshCatalog();
    } catch (err) {
      setCatFormError(`⚠️ ${err.message}`);
    }
  };

  // ─────────────────────────────────────────────────────────
  // ORDER HANDLERS
  // ─────────────────────────────────────────────────────────

  const handleUpdateOrderStatus = async (order) => {
    const status = statusDraft[order.id];

    if (!status || orderBusyId) return;

    if (
      status === 'cancelled' &&
      !window.confirm(
        `Cancel order ${order.orderNumber}? Stock will be restored.`
      )
    ) {
      return;
    }

    setOrderBusyId(order.id);
    setOrderError('');
    setOrderSuccess('');

    try {
      const res = await adminApi.updateOrderStatus(order.id, status);

      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id ? { ...res.data.order, user: o.user } : o
        )
      );

      setStatusDraft((prev) => ({ ...prev, [order.id]: '' }));

      setOrderSuccess(
        `✅ ${order.orderNumber} updated to "${ORDER_STATUS_LABELS[status]}".`
      );

      setTimeout(() => setOrderSuccess(''), 3000);
    } catch (err) {
      setOrderError(`⚠️ ${err.message}`);
    } finally {
      setOrderBusyId(null);
    }
  };

  // ─────────────────────────────────────────────────────────
  // FILTERED PRODUCTS
  // ─────────────────────────────────────────────────────────

  const tableProducts = productList.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(tableSearch.toLowerCase()) ||
      p.category.toLowerCase().includes(tableSearch.toLowerCase());

    const matchCategory =
      tableCategory === 'All' || p.category === tableCategory;

    return matchSearch && matchCategory;
  });

  // ─────────────────────────────────────────────────────────
  // STATS
  // ─────────────────────────────────────────────────────────

  const totalProducts = productList.length;
  const totalCategories = categoryList.length;

  const avgRating = productList.length
    ? (
        productList.reduce((sum, product) => sum + product.rating, 0) /
        productList.length
      ).toFixed(1)
    : '0.0';

  const highestDiscount = productList.length
    ? Math.max(...productList.map((product) => product.discount || 0))
    : 0;

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────

  return (
    <div className="admin-dashboard-page">
      {/* Admin Navbar */}
      <nav className="admin-navbar">
        <div className="admin-navbar-left">
          <span className="admin-navbar-logo">ShopSmart</span>
          <span className="admin-navbar-tag">Admin Panel</span>
        </div>

        <div className="admin-navbar-right">
          <span className="admin-navbar-welcome">
            Welcome, <strong>{adminName}</strong>
          </span>

          <button
            className="admin-store-btn"
            onClick={() => navigate('/home')}
          >
            🛍️ <span>View Store</span>
          </button>

          <button className="admin-logout-btn" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </nav>

      <div className="admin-dashboard-content">
        {loadError && (
          <div className="admin-form-error">⚠️ {loadError}</div>
        )}

        {/* Stats */}
        <div className="admin-stats-row">
          <div className="admin-stat-card">
            <span className="admin-stat-icon">📦</span>
            <div className="admin-stat-info">
              <span className="admin-stat-number">{totalProducts}</span>
              <span className="admin-stat-label">Total Products</span>
            </div>
          </div>

          <div className="admin-stat-card">
            <span className="admin-stat-icon">🗂️</span>
            <div className="admin-stat-info">
              <span className="admin-stat-number">{totalCategories}</span>
              <span className="admin-stat-label">Categories</span>
            </div>
          </div>

          <div className="admin-stat-card">
            <span className="admin-stat-icon">⭐</span>
            <div className="admin-stat-info">
              <span className="admin-stat-number">{avgRating}</span>
              <span className="admin-stat-label">Avg Rating</span>
            </div>
          </div>

          <div className="admin-stat-card">
            <span className="admin-stat-icon">🏷️</span>
            <div className="admin-stat-info">
              <span className="admin-stat-number">{highestDiscount}%</span>
              <span className="admin-stat-label">Max Discount</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="admin-tabs">
          <button
            className={`admin-tab-btn ${
              activeTab === 'products' ? 'active' : ''
            }`}
            onClick={() => setActiveTab('products')}
          >
            📦 Products
          </button>

          <button
            className={`admin-tab-btn ${
              activeTab === 'categories' ? 'active' : ''
            }`}
            onClick={() => setActiveTab('categories')}
          >
            🗂️ Categories
          </button>

          <button
            className={`admin-tab-btn ${
              activeTab === 'orders' ? 'active' : ''
            }`}
            onClick={() => setActiveTab('orders')}
          >
            🧾 Orders
          </button>

          <button
            className={`admin-tab-btn ${
              activeTab === 'users' ? 'active' : ''
            }`}
            onClick={() => setActiveTab('users')}
          >
            👥 Users
          </button>
        </div>

        {/* ══════════════════════════════════════════════════ */}
        {/* PRODUCTS TAB                                       */}
        {/* ══════════════════════════════════════════════════ */}
        {activeTab === 'products' && (
          <>
            <div className="admin-add-form-card">
              <h3>➕ Add New Product</h3>

              {productFormError && (
                <div className="admin-form-error">{productFormError}</div>
              )}

              {productFormSuccess && (
                <div className="admin-form-success">
                  {productFormSuccess}
                </div>
              )}

              <form onSubmit={handleAddProduct}>
                <div className="admin-form-grid">
                  <div className="admin-form-group">
                    <label>Product Name *</label>
                    <input
                      type="text"
                      name="name"
                      className="admin-form-input"
                      placeholder="e.g. Sony WH-1000XM5"
                      value={productForm.name}
                      onChange={handleProductFormChange}
                    />
                  </div>

                  <div className="admin-form-group">
                    <label>Category *</label>
                    <select
                      name="category"
                      className="admin-form-select"
                      value={productForm.category}
                      onChange={handleProductFormChange}
                    >
                      <option value="">Select Category</option>
                      {categoryList.map((cat) => (
                        <option key={cat.id} value={cat.name}>
                          {cat.icon} {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="admin-form-group">
                    <label>Sale Price (₹) *</label>
                    <input
                      type="number"
                      name="price"
                      className="admin-form-input"
                      placeholder="e.g. 24999"
                      value={productForm.price}
                      onChange={handleProductFormChange}
                      min="1"
                    />
                  </div>

                  <div className="admin-form-group">
                    <label>Original Price (₹) *</label>
                    <input
                      type="number"
                      name="originalPrice"
                      className="admin-form-input"
                      placeholder="e.g. 34999"
                      value={productForm.originalPrice}
                      onChange={handleProductFormChange}
                      min="1"
                    />
                  </div>

                  <div className="admin-form-group">
                    <label>Stock Quantity</label>
                    <input
                      type="number"
                      name="stock"
                      className="admin-form-input"
                      placeholder="e.g. 100 (discount is auto-calculated)"
                      value={productForm.stock}
                      onChange={handleProductFormChange}
                      min="0"
                      step="1"
                    />
                  </div>

                  <div className="admin-form-group">
                    <label>Rating (0–5)</label>
                    <input
                      type="number"
                      name="rating"
                      className="admin-form-input"
                      placeholder="e.g. 4.5"
                      value={productForm.rating}
                      onChange={handleProductFormChange}
                      min="0"
                      max="5"
                      step="0.1"
                    />
                  </div>

                  <div className="admin-form-group">
                    <label>Review Count</label>
                    <input
                      type="number"
                      name="reviews"
                      className="admin-form-input"
                      placeholder="e.g. 1200"
                      value={productForm.reviews}
                      onChange={handleProductFormChange}
                      min="0"
                    />
                  </div>

                  <div className="admin-form-group">
                    <label>Image URL</label>
                    <input
                      type="text"
                      name="image"
                      className="admin-form-input"
                      placeholder="https://... (optional)"
                      value={productForm.image}
                      onChange={handleProductFormChange}
                    />
                  </div>

                  <div className="admin-form-group admin-form-full">
                    <label>Description *</label>
                    <input
                      type="text"
                      name="description"
                      className="admin-form-input"
                      placeholder="Short product description..."
                      value={productForm.description}
                      onChange={handleProductFormChange}
                    />
                  </div>
                </div>

                <div className="admin-form-actions">
                  <button
                    type="submit"
                    className="admin-add-btn"
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : '➕ Add Product'}
                  </button>

                  <button
                    type="button"
                    className="admin-reset-btn"
                    onClick={handleResetProductForm}
                  >
                    ✕ Reset
                  </button>
                </div>
              </form>
            </div>

            <div className="admin-section-header">
              <h2 className="admin-section-title">📋 All Products</h2>
              <span className="admin-section-count">
                {tableProducts.length} of {totalProducts} products
              </span>
            </div>

            <div className="admin-table-controls">
              <input
                type="text"
                className="admin-table-search"
                placeholder="🔍 Search by name or category..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
              />

              <select
                className="admin-table-filter"
                value={tableCategory}
                onChange={(e) => setTableCategory(e.target.value)}
              >
                <option value="All">All Categories</option>
                {categoryList.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="admin-table-card">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Discount</th>
                    <th>Stock</th>
                    <th>Rating</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8">
                        <div className="admin-table-empty">
                          <div className="admin-table-empty-icon">⏳</div>
                          <p>Loading products...</p>
                        </div>
                      </td>
                    </tr>
                  ) : tableProducts.length > 0 ? (
                    tableProducts.map((product) => (
                      <tr key={product.id}>
                        <td>
                          <img
                            src={product.image}
                            alt={product.name}
                            className="admin-product-img"
                            onError={(e) => {
                              e.target.src = DEFAULT_IMAGE;
                            }}
                          />
                        </td>

                        <td>
                          <div className="admin-product-name">
                            {product.name}
                          </div>
                        </td>

                        <td>
                          <span className="admin-category-badge">
                            {product.category}
                          </span>
                        </td>

                        <td>
                          <span className="admin-price">
                            {formatPrice(product.price)}
                          </span>
                        </td>

                        <td>
                          <span className="admin-discount-badge">
                            {product.discount}% off
                          </span>
                        </td>

                        <td>
                          <span
                            style={{
                              fontWeight: 600,
                              color:
                                product.stock <= 5 ? '#e53935' : '#212121',
                            }}
                          >
                            {product.stock}
                          </span>{' '}
                          <button
                            type="button"
                            className="admin-reset-btn admin-small-btn"
                            onClick={() => handleEditStock(product)}
                          >
                            ✏️
                          </button>
                        </td>

                        <td>{product.rating} ★</td>

                        <td>
                          <div className="admin-action-buttons">
                            <button
                              type="button"
                              className="admin-reset-btn"
                              onClick={() => handleEditProduct(product)}
                            >
                              ✏️ Edit
                            </button>

                            <button
                              type="button"
                              className="admin-delete-btn"
                              onClick={() =>
                                handleDeleteProduct(product.id, product.name)
                              }
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8">
                        <div className="admin-table-empty">
                          <div className="admin-table-empty-icon">📭</div>
                          <p>No products found.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="admin-table-footer">
                Showing {tableProducts.length} of {totalProducts} products
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* CATEGORIES TAB                                     */}
        {/* ══════════════════════════════════════════════════ */}
        {activeTab === 'categories' && (
          <>
            <div className="admin-add-form-card">
              <h3>➕ Add New Category</h3>

              {catFormError && (
                <div className="admin-form-error">{catFormError}</div>
              )}

              {catFormSuccess && (
                <div className="admin-form-success">{catFormSuccess}</div>
              )}

              <form onSubmit={handleAddCategory}>
                <div className="admin-cat-form-row">
                  <div className="admin-cat-form-group">
                    <label>Category Name *</label>
                    <input
                      type="text"
                      className="admin-form-input"
                      placeholder="e.g. Gaming"
                      value={catName}
                      onChange={(e) => setCatName(e.target.value)}
                    />
                  </div>

                  <div className="admin-cat-form-group">
                    <label>Icon (Emoji) *</label>
                    <input
                      type="text"
                      className="admin-form-input"
                      placeholder="e.g. 🎮"
                      value={catIcon}
                      onChange={(e) => setCatIcon(e.target.value)}
                    />
                  </div>

                  <div className="admin-form-actions admin-category-form-actions">
                    <button type="submit" className="admin-add-btn">
                      ➕ Add Category
                    </button>

                    <button
                      type="button"
                      className="admin-reset-btn"
                      onClick={() => {
                        setCatName('');
                        setCatIcon('');
                        setCatFormError('');
                        setCatFormSuccess('');
                      }}
                    >
                      ✕ Reset
                    </button>
                  </div>
                </div>
              </form>
            </div>

            <div className="admin-section-header">
              <h2 className="admin-section-title">🗂️ All Categories</h2>
              <span className="admin-section-count">
                {categoryList.length} categories
              </span>
            </div>

            <div className="admin-category-grid">
              {categoryList.map((cat) => {
                const productCount = productList.filter(
                  (product) => product.category === cat.name
                ).length;

                const isEditing = editingCategoryId === cat.id;

                return (
                  <div
                    key={cat.id}
                    className={`admin-category-card ${
                      isEditing ? 'admin-category-card-editing' : ''
                    }`}
                  >
                    {isEditing ? (
                      <form
                        className="admin-category-edit-form"
                        onSubmit={(e) => handleUpdateCategory(e, cat)}
                      >
                        <div className="admin-category-edit-heading">
                          <span className="admin-category-card-icon">
                            ✏️
                          </span>
                          <strong>Edit Category</strong>
                        </div>

                        <label className="admin-edit-label">
                          Category Name
                        </label>
                        <input
                          type="text"
                          className="admin-form-input"
                          value={editCatName}
                          onChange={(e) => setEditCatName(e.target.value)}
                          placeholder="Category name"
                          required
                        />

                        <label className="admin-edit-label">
                          Category Emoji
                        </label>
                        <input
                          type="text"
                          className="admin-form-input"
                          value={editCatIcon}
                          onChange={(e) => setEditCatIcon(e.target.value)}
                          placeholder="e.g. 🎮"
                          required
                        />

                        <div className="admin-category-edit-actions">
                          <button
                            type="submit"
                            className="admin-add-btn"
                            disabled={categorySaving}
                          >
                            {categorySaving ? 'Saving...' : 'Save Changes'}
                          </button>

                          <button
                            type="button"
                            className="admin-reset-btn"
                            onClick={handleCancelEditCategory}
                            disabled={categorySaving}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="admin-category-card-left">
                          <span className="admin-category-card-icon">
                            {cat.icon}
                          </span>

                          <div>
                            <div className="admin-category-card-name">
                              {cat.name}
                            </div>

                            <div className="admin-category-card-count">
                              {productCount} product
                              {productCount !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>

                        <div className="admin-category-actions">
                          <button
                            type="button"
                            className="admin-reset-btn"
                            onClick={() => handleStartEditCategory(cat)}
                          >
                            ✏️ Edit
                          </button>

                          <button
                            type="button"
                            className="admin-delete-btn"
                            onClick={() =>
                              handleDeleteCategory(cat.id, cat.name)
                            }
                          >
                            🗑️
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* ORDERS TAB                                         */}
        {/* ══════════════════════════════════════════════════ */}
        {activeTab === 'orders' && (
          <>
            <div className="admin-section-header">
              <h2 className="admin-section-title">🧾 All Orders</h2>
              <span className="admin-section-count">
                {orderPagination.total} order
                {orderPagination.total !== 1 ? 's' : ''}
              </span>
            </div>

            {orderError && (
              <div className="admin-form-error">{orderError}</div>
            )}

            {orderSuccess && (
              <div className="admin-form-success">{orderSuccess}</div>
            )}

            <div className="admin-table-controls">
              <input
                type="text"
                className="admin-table-search"
                placeholder="🔍 Search by order ID..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
              />

              <select
                className="admin-table-filter"
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                {Object.entries(ORDER_STATUS_LABELS).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  )
                )}
              </select>

              <select
                className="admin-table-filter"
                value={orderPaymentFilter}
                onChange={(e) => setOrderPaymentFilter(e.target.value)}
              >
                <option value="">All Payments</option>
                {Object.entries(PAYMENT_STATUS_LABELS).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="admin-table-card">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Update Status</th>
                  </tr>
                </thead>

                <tbody>
                  {ordersLoading && orders.length === 0 ? (
                    <tr>
                      <td colSpan="7">
                        <div className="admin-table-empty">
                          <div className="admin-table-empty-icon">⏳</div>
                          <p>Loading orders...</p>
                        </div>
                      </td>
                    </tr>
                  ) : orders.length > 0 ? (
                    orders.map((order) => {
                      const nextOptions =
                        NEXT_STATUSES[order.orderStatus] || [];

                      const needsRefund =
                        order.orderStatus === 'cancelled' &&
                        order.paymentStatus === 'paid';

                      return (
                        <tr key={order.id}>
                          <td>
                            <div className="admin-product-name">
                              {order.orderNumber}
                            </div>
                            <div className="admin-table-subtext">
                              {formatDate(order.createdAt)}
                            </div>
                          </td>

                          <td>
                            <div className="admin-product-name">
                              {order.user?.name ||
                                order.shippingAddress?.fullName}
                            </div>
                            <div className="admin-table-subtext">
                              {order.user?.email || ''}
                            </div>
                            <div className="admin-table-subtext">
                              {order.shippingAddress?.city},{' '}
                              {order.shippingAddress?.state} -{' '}
                              {order.shippingAddress?.postalCode}
                            </div>
                          </td>

                          <td
                            title={order.items
                              .map((item) => `${item.name} × ${item.quantity}`)
                              .join('\n')}
                          >
                            {order.totals?.totalItems ?? '—'}
                          </td>

                          <td>
                            <span className="admin-price">
                              {formatPrice(order.totals?.total || 0)}
                            </span>
                          </td>

                          <td>
                            <span className="admin-category-badge">
                              {PAYMENT_STATUS_LABELS[order.paymentStatus] ||
                                order.paymentStatus}
                            </span>

                            {needsRefund && (
                              <div className="admin-refund-note">
                                Refund required
                              </div>
                            )}
                          </td>

                          <td>
                            <span className="admin-discount-badge">
                              {ORDER_STATUS_LABELS[order.orderStatus] ||
                                order.orderStatus}
                            </span>
                          </td>

                          <td>
                            {nextOptions.length > 0 ? (
                              <div className="admin-order-update">
                                <select
                                  className="admin-table-filter"
                                  value={statusDraft[order.id] || ''}
                                  onChange={(e) =>
                                    setStatusDraft((prev) => ({
                                      ...prev,
                                      [order.id]: e.target.value,
                                    }))
                                  }
                                >
                                  <option value="">Select...</option>
                                  {nextOptions.map((status) => (
                                    <option key={status} value={status}>
                                      {ORDER_STATUS_LABELS[status]}
                                    </option>
                                  ))}
                                </select>

                                <button
                                  type="button"
                                  className="admin-add-btn admin-update-btn"
                                  onClick={() =>
                                    handleUpdateOrderStatus(order)
                                  }
                                  disabled={
                                    !statusDraft[order.id] ||
                                    orderBusyId === order.id
                                  }
                                >
                                  {orderBusyId === order.id
                                    ? '...'
                                    : 'Update'}
                                </button>
                              </div>
                            ) : (
                              <span className="admin-muted">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="7">
                        <div className="admin-table-empty">
                          <div className="admin-table-empty-icon">📭</div>
                          <p>No orders found.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="admin-table-footer">
                Showing {orders.length} of {orderPagination.total} orders

                {orderPagination.page < orderPagination.pages && (
                  <button
                    type="button"
                    className="admin-reset-btn admin-load-more"
                    onClick={() =>
                      loadOrders(orderPagination.page + 1, true)
                    }
                    disabled={ordersLoading}
                  >
                    {ordersLoading ? 'Loading...' : 'Load more'}
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* USERS TAB                                          */}
        {/* ══════════════════════════════════════════════════ */}
        {activeTab === 'users' && (
          <>
            <div className="admin-section-header">
              <h2 className="admin-section-title">👥 Customer Management</h2>
              <span className="admin-section-count">
                {userPagination.total} registered users
              </span>
            </div>

            {usersError && (
              <div className="admin-form-error">{usersError}</div>
            )}

            <div className="admin-table-controls">
              <input
                type="text"
                className="admin-table-search"
                placeholder="🔍 Search by customer name or email..."
                value={usersSearch}
                onChange={(e) => setUsersSearch(e.target.value)}
              />
            </div>

            <div className="admin-table-card admin-users-table-card">
              <div className="admin-users-table-wrap">
                <table className="admin-table admin-users-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Email</th>
                      <th>Registered Date</th>
                      <th>Account Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {usersLoading && users.length === 0 ? (
                      <tr>
                        <td colSpan="5">
                          <div className="admin-table-empty">
                            <div className="admin-table-empty-icon">⏳</div>
                            <p>Loading users...</p>
                          </div>
                        </td>
                      </tr>
                    ) : users.length > 0 ? (
                      users.map((customer) => {
                        const customerId = customer.id || customer._id;

                        return (
                          <tr key={customerId}>
                            <td>
                              <div className="admin-product-name">
                                {customer.name || '—'}
                              </div>
                            </td>

                            <td>{customer.email || '—'}</td>

                            <td>{formatDate(customer.createdAt)}</td>

                            <td>
                              <span
                                className={`admin-user-status ${
                                  customer.isActive ? 'active' : 'inactive'
                                }`}
                              >
                                {customer.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>

                            <td>
                              <button
                                type="button"
                                className={
                                  customer.isActive
                                    ? 'admin-delete-btn'
                                    : 'admin-add-btn admin-activate-btn'
                                }
                                disabled={userBusyId === customerId}
                                onClick={() =>
                                  handleToggleUserStatus(customer)
                                }
                              >
                                {userBusyId === customerId
                                  ? 'Updating...'
                                  : customer.isActive
                                    ? 'Deactivate'
                                    : 'Activate'}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="5">
                          <div className="admin-table-empty">
                            <div className="admin-table-empty-icon">📭</div>
                            <p>No users found.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="admin-table-footer">
                Showing {users.length} of {userPagination.total} users

                {userPagination.page < userPagination.pages && (
                  <button
                    type="button"
                    className="admin-reset-btn admin-load-more"
                    onClick={() => loadUsers(userPagination.page + 1)}
                    disabled={usersLoading}
                  >
                    {usersLoading ? 'Loading...' : 'Load more'}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;