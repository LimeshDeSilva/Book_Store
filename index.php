<?php
/**
 * BookStore - Storefront Entry Point
 * Minimalist, Modern & Fully Responsive
 */

require_once __DIR__ . '/config/db.php';
startSecureSession();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BookStore - Curated Books & Timeless Literature</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/style.css">
</head>
<body>

    <!-- ======================== SIMPLE NAVIGATION BAR ======================== -->
        <header class="site-header">
            <div class="container header-inner">
                <!-- Brand Logo -->
                <a href="index.php" class="brand-logo">
                    <span class="brand-icon">📚</span>
                    <span class="brand-name">BookStore<span class="brand-dot">.</span></span>
                </a>

                <!-- Search Bar -->
                <div class="search-wrapper">
                    <div class="search-input-group">
                        <span class="search-icon">🔍</span>
                        <input type="text" id="siteSearchInput" class="search-input" placeholder="Search by title, author, or ISBN..." autocomplete="off">
                        <button id="searchClearBtn" class="search-clear-btn" title="Clear search">&times;</button>
                    </div>
                </div>

                    <!-- Right Actions -->
                <div class="header-actions">
                    <!-- Wishlist Trigger -->
                    <button class="action-icon-btn" id="wishlistTrigger" title="View Wishlist">
                        <span>🤍</span>
                        <span class="action-badge" id="wishlistBadge" style="display:none;">0</span>
                    </button>

                    <!-- Cart Trigger -->
                    <button class="action-icon-btn" id="cartTrigger" title="View Cart">
                        <span>🛍️</span>
                        <span class="action-badge" id="cartBadge" style="display:none;">0</span>
                        <span class="cart-total-badge" id="cartTotalBadge"></span>
                    </button>

                    <!-- User Profile / Auth Area -->
                    <div id="authActionArea">
                        <button class="btn btn-secondary btn-sm" id="openAuthModalBtn">Sign In</button>
                    </div>
                </div>
            </div>
        </header>

            <!-- ======================== MINIMALIST HERO ======================== -->
        <section class="hero-minimal">
            <div class="container hero-content">
                <span class="hero-subtitle">Curated Collection</span>
                <h1 class="hero-title serif-heading">Stories, crafted thoughts &amp; timeless literature.</h1>
                <p class="hero-description">
                    Explore handpicked engineering classics, philosophical masterworks, and thought-provoking fiction.
                </p>
            </div>
        </section>

            <!-- ======================== GENRE FILTER TRACK ======================== -->
        <nav class="genre-filter-nav">
            <div class="container">
                <div class="genre-filter-track" id="genreFilterTrack">
                    <button class="genre-pill active" data-id="0">All Books</button>
                </div>
            </div>
        </nav>

            <!-- ======================== CATALOG SECTION ======================== -->
        <main class="container catalog-section">
            <div class="catalog-toolbar">
                <div class="results-count" id="resultsCount">
                    Loading catalog...
                </div>
                <div class="toolbar-controls">
                    <label style="font-size:13px; color:var(--text-muted);">Sort by:</label>
                    <select id="sortSelect" class="sort-select">
                        <option value="featured">Featured</option>
                        <option value="price_asc">Price: Low to High</option>
                        <option value="price_desc">Price: High to Low</option>
                        <option value="rating">Top Rated</option>
                        <option value="title">Title: A to Z</option>
                    </select>
                </div>
            </div>

            <!-- Books Grid Container -->
            <div class="book-grid" id="bookGrid">
                <!-- Books dynamically injected by assets/js/app.js -->
            </div>
        </main>

            <!-- ======================== CART DRAWER ======================== -->
        <div class="drawer-overlay" id="cartDrawerOverlay">
            <div class="drawer">
                <div class="drawer-header">
                    <div class="drawer-title">Shopping Cart</div>
                    <button class="drawer-close-btn">&times;</button>
                </div>
                <div class="drawer-content" id="cartDrawerItems">
                    <!-- Cart items injected via JS -->
                </div>
                <div class="drawer-footer">
                    <div class="drawer-subtotal">
                        <span>Subtotal:</span>
                        <span id="cartDrawerSubtotal">$0.00</span>
                    </div>
                    <button class="btn btn-primary btn-block" id="proceedToCheckoutBtn">Proceed to Checkout</button>
                </div>
            </div>
        </div>

            <!-- ======================== WISHLIST DRAWER ======================== -->
        <div class="drawer-overlay" id="wishlistDrawerOverlay">
            <div class="drawer">
                <div class="drawer-header">
                    <div class="drawer-title">Your Wishlist</div>
                    <button class="drawer-close-btn">&times;</button>
                </div>
                <div class="drawer-content" id="wishlistDrawerItems">
                    <!-- Wishlist items injected via JS -->
                </div>
            </div>
        </div>

            <!-- ======================== AUTH MODAL ======================== -->
        <div class="modal-overlay hidden" id="authModal">
            <div class="modal-dialog">
                <div class="modal-header">
                    <h3 class="modal-title">Welcome to BookStore</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <!-- Checkout Notice Prompt -->
                    <div id="authNotice" class="alert-box alert-success" style="display:none; margin-bottom:16px;"></div>

                    <div class="modal-tabs">
                        <button class="modal-tab-btn active" id="loginTabBtn">Sign In</button>
                        <button class="modal-tab-btn" id="registerTabBtn">Create Account</button>
                    </div>

                    <!-- Sign In Form -->
                    <form id="loginForm">
                        <div class="form-group">
                            <label class="form-label">Email Address</label>
                            <input type="email" id="loginEmail" class="form-control" required placeholder="you@example.com">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Password</label>
                            <input type="password" id="loginPassword" class="form-control" required placeholder="••••••••">
                        </div>
                        <button type="submit" class="btn btn-primary btn-block" style="margin-top:12px;">Sign In</button>
                    </form>

                    <!-- Register Form -->
                    <form id="registerForm" style="display:none;">
                        <div class="form-group-row">
                            <div class="form-group">
                                <label class="form-label">First Name</label>
                                <input type="text" id="regFirstName" class="form-control" required placeholder="Jane">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Last Name</label>
                                <input type="text" id="regLastName" class="form-control" required placeholder="Doe">
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Email Address</label>
                            <input type="email" id="regEmail" class="form-control" required placeholder="you@example.com">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Password (Min 6 characters)</label>
                            <input type="password" id="regPassword" class="form-control" required placeholder="••••••••">
                        </div>
                        <button type="submit" class="btn btn-primary btn-block" style="margin-top:12px;">Create Account</button>
                    </form>
                </div>
            </div>
        </div>

            <!-- ======================== CHECKOUT MODAL ======================== -->
        <div class="modal-overlay hidden" id="checkoutModal">
            <div class="modal-dialog" style="max-width:540px;">
                <div class="modal-header">
                    <h3 class="modal-title">Complete Your Order</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body" id="checkoutModalBody">
                    <!-- Step 1: Delivery Address -->
                    <div style="margin-bottom:20px;">
                        <h4 style="font-size:14px; font-weight:700; margin-bottom:10px;">1. Delivery Address</h4>
                        <div id="checkoutAddressList">
                            <!-- Addresses injected via JS -->
                        </div>
                        <div id="newAddressFields" style="display:none; margin-top:10px; padding:12px; background:var(--bg-subtle); border-radius:var(--radius-sm);">
                            <div class="form-group-row">
                                <div class="form-group">
                                    <label class="form-label">Unit / No</label>
                                    <input type="text" id="addrNo" class="form-control" placeholder="Apt 4B">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Postal Code</label>
                                    <input type="text" id="addrZip" class="form-control" placeholder="10001">
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Street Address</label>
                                <input type="text" id="addrStreet" class="form-control" placeholder="123 Main Street">
                            </div>
                        </div>
                    </div>

                        <!-- Step 2: Promo Code -->
                    <div style="margin-bottom:20px;">
                        <h4 style="font-size:14px; font-weight:700; margin-bottom:10px;">2. Promo Code</h4>
                        <div style="display:flex; gap:8px;">
                            <input type="text" id="checkoutPromoInput" class="form-control" placeholder="Enter coupon code" style="text-transform:uppercase;">
                            <button type="button" class="btn btn-secondary btn-sm" id="applyPromoBtn">Apply</button>
                        </div>
                    </div>

                    <!-- Step 3: Payment Method -->
                    <div style="margin-bottom:20px;">
                        <h4 style="font-size:14px; font-weight:700; margin-bottom:10px;">3. Payment Method</h4>
                        <div style="display:flex; gap:16px;">
                            <label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer;">
                                <input type="radio" name="paymentMethod" value="COD" checked>
                                <span>Cash on Delivery</span>
                            </label>
                            <label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer;">
                                <input type="radio" name="paymentMethod" value="CARD">
                                <span>Credit / Debit Card</span>
                            </label>
                        </div>
                    </div>

                    <!-- Step 4: Order Summary -->
                    <div style="border-top:1px solid var(--border-color); padding-top:16px; margin-bottom:20px;">
                        <h4 style="font-size:14px; font-weight:700; margin-bottom:10px;">Order Summary</h4>
                        <div id="checkoutItemsReview" style="max-height:120px; overflow-y:auto; margin-bottom:10px;"></div>
                        <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;">
                            <span style="color:var(--text-muted);">Subtotal:</span>
                            <span id="checkoutSubtotal">$0.00</span>
                        </div>
                        <div id="checkoutDiscountRow" style="display:none; justify-content:space-between; font-size:13px; margin-bottom:4px; color:var(--success);">
                            <span>Discount Applied:</span>
                            <span id="checkoutDiscount">−$0.00</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:16px; font-weight:700; border-top:1px solid var(--border-color); padding-top:8px; margin-top:8px;">
                            <span>Total Due:</span>
                            <span id="checkoutFinalTotal">$0.00</span>
                        </div>
                    </div>

                    <button type="button" class="btn btn-primary btn-block" id="placeOrderBtn">Confirm &amp; Place Order</button>
                </div>
            </div>
        </div>

            <!-- ======================== BOOK DETAILS MODAL ======================== -->
        <div class="modal-overlay hidden" id="bookDetailsModal">
            <div class="modal-dialog" style="max-width:640px;">
                <div class="modal-header">
                    <h3 class="modal-title">Book Details</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body" id="bookDetailsContent">
                    <!-- Loaded via JS -->
                </div>
            </div>
        </div>

        <!-- Mobile Bottom Navigation -->
        <nav class="mobile-bottom-nav">
            <a href="index.php" class="mobile-nav-btn active">
                <span class="mobile-nav-icon">🏠</span>
                <span>Home</span>
            </a>
            <button class="mobile-nav-btn" id="mobSearchBtn">
                <span class="mobile-nav-icon">🔍</span>
                <span>Search</span>
            </button>
            <button class="mobile-nav-btn" onclick="document.getElementById('wishlistTrigger')?.click()">
                <span class="mobile-nav-icon">🤍</span>
                <span>Wishlist</span>
            </button>
            <button class="mobile-nav-btn" onclick="document.getElementById('cartTrigger')?.click()">
                <span class="mobile-nav-icon">🛍️</span>
                <span>Cart</span>
            </button>
        </nav>

        <!-- Toast Notifications Container -->
        <div class="toast-container" id="toastContainer"></div>

        <!-- Clean Minimal Footer -->
        <footer class="site-footer">
            <div class="container footer-inner">
                <div class="footer-brand">
                    <span>📚 BookStore.</span>
                </div>
                <div class="footer-copy">
                    &copy; <?= date('Y'); ?> BookStore. All rights reserved.
                </div>
            </div>
        </footer>

        <script src="assets/js/app.js"></script>
    </body>
    </html>