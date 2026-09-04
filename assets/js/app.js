/**
 * BookStore - Minimalist Frontend Application Engine
 * Vanilla JavaScript (ES6+) - Zero Frameworks
 */

// Application Global State
const state = {
    user: null,               // null if guest, or user object
    guestCart: [],            // [{bookid, quantity}] in localStorage
    guestWishlist: [],        // [bookid] in localStorage
    activeCart: [],           // Hydrated cart items
    activeWishlist: [],       // Hydrated wishlist items
    genres: [],
    books: [],
    currentGenre: 0,
    searchQuery: '',
    currentSort: 'featured',
    appliedPromo: null,       // {code, type, price, discountAmount}
    selectedAddressId: null,
    isCheckingOut: false      // flag to resume checkout after auth
};

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    loadLocalGuestData();
    setupEventListeners();
    await checkAuthStatus();
    await Promise.all([
        loadGenres(),
        loadBooks()
    ]);
    await refreshCart();
    await refreshWishlist();
}

// ======================== LOCAL STORAGE (GUEST) ========================
function loadLocalGuestData() {
    try {
        state.guestCart = JSON.parse(localStorage.getItem('guest_cart')) || [];
    } catch (e) {
        state.guestCart = [];
    }
    try {
        state.guestWishlist = JSON.parse(localStorage.getItem('guest_wishlist')) || [];
    } catch (e) {
        state.guestWishlist = [];
    }
}

function saveLocalGuestCart() {
    localStorage.setItem('guest_cart', JSON.stringify(state.guestCart));
}

function saveLocalGuestWishlist() {
    localStorage.setItem('guest_wishlist', JSON.stringify(state.guestWishlist));
}

// ======================== AUTHENTICATION & SYNC ========================
async function checkAuthStatus() {
    try {
        const res = await fetch('auth.php?action=status');
        const data = await res.json();
        if (data.success && data.loggedIn) {
            state.user = data.user;
        } else {
            state.user = null;
        }
        renderHeaderUserUI();
    } catch (e) {
        console.error('Failed to check auth status', e);
    }
}

function renderHeaderUserUI() {
    const authActionArea = document.getElementById('authActionArea');
    if (!authActionArea) return;

    if (state.user) {
        const initials = (state.user.firstName.charAt(0) + state.user.lastName.charAt(0)).toUpperCase();
        authActionArea.innerHTML = `
            <div class="user-menu-container">
                <button class="user-profile-btn" id="userMenuTrigger">
                    <span class="user-avatar">${initials}</span>
                    <span>${escapeHtml(state.user.firstName)}</span>
                    <span style="font-size:10px;">▼</span>
                </button>
                <div class="user-dropdown" id="userDropdown">
                    <div class="dropdown-header">
                        <div class="dropdown-user-name">${escapeHtml(state.user.firstName + ' ' + state.user.lastName)}</div>
                        <div class="dropdown-user-email">${escapeHtml(state.user.email)}</div>
                    </div>
                    ${state.user.isAdmin ? `<a href="admin/dashboard.php" class="dropdown-item">⚙️ Admin Control</a>` : ''}
                    <button class="dropdown-item" id="navLogoutBtn">🚪 Sign Out</button>
                </div>
            </div>
        `;

        const trigger = document.getElementById('userMenuTrigger');
        const dropdown = document.getElementById('userDropdown');
        if (trigger && dropdown) {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('show');
            });
            document.addEventListener('click', () => dropdown.classList.remove('show'));
        }

        const logoutBtn = document.getElementById('navLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }
    } else {
        authActionArea.innerHTML = `
            <button class="btn btn-secondary btn-sm" id="openAuthModalBtn">Sign In</button>
        `;
        document.getElementById('openAuthModalBtn').addEventListener('click', () => openAuthModal('login'));
    }
}

async function handleLogout() {
    try {
        await fetch('auth.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'logout' })
        });
        state.user = null;
        renderHeaderUserUI();
        showToast('Signed out successfully.');
        await refreshCart();
        await refreshWishlist();
    } catch (e) {
        console.error('Logout error', e);
    }
}

// "The Merge" - Sync local storage to database after authentication
async function performGuestSync() {
    loadLocalGuestData();
    if (state.guestCart.length === 0 && state.guestWishlist.length === 0) {
        return;
    }

    try {
        const res = await fetch('api/sync_local.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                guest_cart: state.guestCart,
                guest_wishlist: state.guestWishlist
            })
        });
        const data = await res.json();
        if (data.success) {
            localStorage.removeItem('guest_cart');
            localStorage.removeItem('guest_wishlist');
            state.guestCart = [];
            state.guestWishlist = [];
            showToast('Your saved items have been synchronized.');
        }
    } catch (e) {
        console.error('Sync failed', e);
    }
}

// ======================== CATALOG & SEARCH ========================
async function loadGenres() {
    try {
        const res = await fetch('api/books.php?action=genres');
        const data = await res.json();
        if (data.success && data.genres) {
            state.genres = data.genres;
            renderGenrePills();
        }
    } catch (e) {
        console.error('Error loading genres', e);
    }
}

function renderGenrePills() {
    const track = document.getElementById('genreFilterTrack');
    if (!track) return;

    let html = `<button class="genre-pill ${state.currentGenre === 0 ? 'active' : ''}" data-id="0">All Books</button>`;
    state.genres.forEach(g => {
        html += `<button class="genre-pill ${state.currentGenre === g.genreid ? 'active' : ''}" data-id="${g.genreid}">${escapeHtml(g.genreName)}</button>`;
    });
    track.innerHTML = html;

    track.querySelectorAll('.genre-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            state.currentGenre = parseInt(btn.dataset.id);
            track.querySelectorAll('.genre-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadBooks();
        });
    });
}

async function loadBooks() {
    const grid = document.getElementById('bookGrid');
    if (!grid) return;

    grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 40px 0; color:var(--text-muted);">Loading books...</div>';

    let url = `api/books.php?sort=${encodeURIComponent(state.currentSort)}`;
    if (state.currentGenre > 0) {
        url += `&genre=${state.currentGenre}`;
    }
    if (state.searchQuery.trim()) {
        url += `&search=${encodeURIComponent(state.searchQuery.trim())}`;
    }

    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.success) {
            state.books = data.books || [];
            renderBooks();
        }
    } catch (e) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 40px 0; color:var(--danger);">Failed to load books.</div>';
    }
}

function renderBooks() {
    const grid = document.getElementById('bookGrid');
    const countEl = document.getElementById('resultsCount');
    if (!grid) return;

    if (countEl) {
        countEl.innerHTML = `Showing <strong>${state.books.length}</strong> title${state.books.length === 1 ? '' : 's'}`;
    }

    if (state.books.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align:center; padding: 60px 20px;">
                <div style="font-size:32px; margin-bottom:12px;">📖</div>
                <h3 style="font-size:18px; font-weight:700; margin-bottom:6px;">No books found</h3>
                <p style="color:var(--text-muted); font-size:14px;">Try refining your search terms or genre filter.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = state.books.map(b => {
        const isWishlisted = isBookInWishlist(b.bookid);
        const isOutOfStock = b.stockQuantity <= 0;

        return `
            <div class="book-card" data-id="${b.bookid}">
                <div class="book-card-media" onclick="openBookDetailsModal(${b.bookid})">
                    <img src="${b.coverImageUrl || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80'}" alt="${escapeHtml(b.title)}" class="book-card-cover" loading="lazy">
                    <button class="book-wishlist-btn ${isWishlisted ? 'active' : ''}" onclick="event.stopPropagation(); toggleWishlist(${b.bookid})" title="Wishlist">
                        ${isWishlisted ? '❤️' : '🤍'}
                    </button>
                    ${isOutOfStock ? `<span class="stock-tag out-of-stock">Out of Stock</span>` : ''}
                </div>
                <div class="book-card-body">
                    <div class="book-genres">${escapeHtml(b.genres || 'Literature')}</div>
                    <h3 class="book-title" onclick="openBookDetailsModal(${b.bookid})">${escapeHtml(b.title)}</h3>
                    <div class="book-authors">${escapeHtml(b.authors || 'Unknown Author')}</div>
                    <div class="book-rating">
                        <span class="star-icon">★</span>
                        <strong style="color:var(--text-main);">${b.avgRating > 0 ? b.avgRating : 'New'}</strong>
                        ${b.reviewCount > 0 ? `<span>(${b.reviewCount})</span>` : ''}
                    </div>
                    <div class="book-card-footer">
                        <div class="book-price">$${Number(b.price).toFixed(2)}</div>
                        <button class="btn btn-secondary btn-sm" ${isOutOfStock ? 'disabled' : ''} onclick="addToCart(${b.bookid})">
                            ${isOutOfStock ? 'Sold Out' : '+ Add'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ======================== CART LOGIC ========================
async function addToCart(bookId) {
    if (state.user) {
        try {
            const res = await fetch('api/cart.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'add', bookid: bookId, quantity: 1 })
            });
            const data = await res.json();
            if (data.success) {
                showToast('Added to cart.');
                await refreshCart();
            } else {
                showToast(data.message || 'Could not add to cart.', 'error');
            }
        } catch (e) {
            showToast('Error adding to cart.', 'error');
        }
    } else {
        // Guest cart
        loadLocalGuestData();
        const existing = state.guestCart.find(i => i.bookid == bookId);
        if (existing) {
            existing.quantity += 1;
        } else {
            state.guestCart.push({ bookid: bookId, quantity: 1 });
        }
        saveLocalGuestCart();
        showToast('Added to cart.');
        await refreshCart();
    }
}

async function updateCartQty(bookId, delta) {
    if (state.user) {
        const item = state.activeCart.find(i => i.bookid == bookId);
        if (!item) return;
        const newQty = item.quantity + delta;
        try {
            const res = await fetch('api/cart.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update', bookid: bookId, quantity: newQty })
            });
            const data = await res.json();
            if (data.success) {
                await refreshCart();
            } else {
                showToast(data.message || 'Update failed', 'error');
            }
        } catch (e) {
            showToast('Error updating cart', 'error');
        }
    } else {
        loadLocalGuestData();
        const item = state.guestCart.find(i => i.bookid == bookId);
        if (!item) return;
        item.quantity += delta;
        if (item.quantity <= 0) {
            state.guestCart = state.guestCart.filter(i => i.bookid != bookId);
        }
        saveLocalGuestCart();
        await refreshCart();
    }
}

async function removeFromCart(bookId) {
    if (state.user) {
        try {
            const res = await fetch('api/cart.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'remove', bookid: bookId })
            });
            await refreshCart();
        } catch (e) {
            showToast('Failed to remove item', 'error');
        }
    } else {
        loadLocalGuestData();
        state.guestCart = state.guestCart.filter(i => i.bookid != bookId);
        saveLocalGuestCart();
        await refreshCart();
    }
}

async function refreshCart() {
    if (state.user) {
        try {
            const res = await fetch('api/cart.php?action=get');
            const data = await res.json();
            if (data.success) {
                state.activeCart = data.items || [];
                renderCartUI(data.subTotal || 0, data.count || 0);
            }
        } catch (e) {
            console.error('Error fetching auth cart', e);
        }
    } else {
        loadLocalGuestData();
        if (state.guestCart.length === 0) {
            state.activeCart = [];
            renderCartUI(0, 0);
            return;
        }
        try {
            const res = await fetch('api/cart.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'hydrate', items: state.guestCart })
            });
            const data = await res.json();
            if (data.success) {
                state.activeCart = data.items || [];
                renderCartUI(data.subTotal || 0, data.count || 0);
            }
        } catch (e) {
            console.error('Error hydrating guest cart', e);
        }
    }
}

function renderCartUI(subTotal, count) {
    // Badges
    const badge = document.getElementById('cartBadge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }

    const priceBadge = document.getElementById('cartTotalBadge');
    if (priceBadge) {
        priceBadge.textContent = count > 0 ? `$${Number(subTotal).toFixed(2)}` : '';
    }

    // Drawer content
    const container = document.getElementById('cartDrawerItems');
    const subtotalEl = document.getElementById('cartDrawerSubtotal');
    if (!container) return;

    if (subtotalEl) {
        subtotalEl.textContent = `$${Number(subTotal).toFixed(2)}`;
    }

    if (state.activeCart.length === 0) {
        container.innerHTML = `
            <div class="drawer-empty">
                <div class="drawer-empty-icon">🛍️</div>
                <div style="font-weight:600; font-size:15px; margin-bottom:4px;">Your cart is empty</div>
                <div style="font-size:13px;">Find something inspiring to read.</div>
            </div>
        `;
        return;
    }

    container.innerHTML = state.activeCart.map(item => `
        <div class="drawer-item">
            <img src="${item.coverImageUrl || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80'}" alt="${escapeHtml(item.title)}" class="drawer-item-thumb">
            <div class="drawer-item-info">
                <div>
                    <div class="drawer-item-title">${escapeHtml(item.title)}</div>
                    <div class="drawer-item-price">$${Number(item.price).toFixed(2)}</div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div class="qty-control">
                        <button class="qty-btn" onclick="updateCartQty(${item.bookid}, -1)">−</button>
                        <span class="qty-val">${item.quantity}</span>
                        <button class="qty-btn" onclick="updateCartQty(${item.bookid}, 1)">+</button>
                    </div>
                    <button class="drawer-item-remove" onclick="removeFromCart(${item.bookid})">Remove</button>
                </div>
            </div>
        </div>
    `).join('');
}

// ======================== WISHLIST LOGIC ========================
function isBookInWishlist(bookId) {
    if (state.user) {
        return state.activeWishlist.some(i => i.bookid == bookId);
    } else {
        return state.guestWishlist.includes(bookId);
    }
}

async function toggleWishlist(bookId) {
    if (state.user) {
        try {
            const res = await fetch('api/wishlist.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'toggle', bookid: bookId })
            });
            const data = await res.json();
            if (data.success) {
                showToast(data.message);
                await refreshWishlist();
                renderBooks();
            }
        } catch (e) {
            showToast('Error updating wishlist.', 'error');
        }
    } else {
        loadLocalGuestData();
        const index = state.guestWishlist.indexOf(bookId);
        if (index > -1) {
            state.guestWishlist.splice(index, 1);
            showToast('Removed from wishlist.');
        } else {
            state.guestWishlist.push(bookId);
            showToast('Added to wishlist.');
        }
        saveLocalGuestWishlist();
        await refreshWishlist();
        renderBooks();
    }
}

async function refreshWishlist() {
    if (state.user) {
        try {
            const res = await fetch('api/wishlist.php?action=get');
            const data = await res.json();
            if (data.success) {
                state.activeWishlist = data.items || [];
                renderWishlistUI(data.count || 0);
            }
        } catch (e) {
            console.error('Error fetching auth wishlist', e);
        }
    } else {
        loadLocalGuestData();
        if (state.guestWishlist.length === 0) {
            state.activeWishlist = [];
            renderWishlistUI(0);
            return;
        }
        try {
            const res = await fetch('api/wishlist.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'hydrate', items: state.guestWishlist })
            });
            const data = await res.json();
            if (data.success) {
                state.activeWishlist = data.items || [];
                renderWishlistUI(data.count || 0);
            }
        } catch (e) {
            console.error('Error hydrating guest wishlist', e);
        }
    }
}

function renderWishlistUI(count) {
    const badge = document.getElementById('wishlistBadge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }

    const container = document.getElementById('wishlistDrawerItems');
    if (!container) return;

    if (state.activeWishlist.length === 0) {
        container.innerHTML = `
            <div class="drawer-empty">
                <div class="drawer-empty-icon">🤍</div>
                <div style="font-weight:600; font-size:15px; margin-bottom:4px;">Your wishlist is empty</div>
                <div style="font-size:13px;">Save books to read later.</div>
            </div>
        `;
        return;
    }

    container.innerHTML = state.activeWishlist.map(item => `
        <div class="drawer-item">
            <img src="${item.coverImageUrl || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80'}" alt="${escapeHtml(item.title)}" class="drawer-item-thumb">
            <div class="drawer-item-info">
                <div>
                    <div class="drawer-item-title">${escapeHtml(item.title)}</div>
                    <div class="drawer-item-price">$${Number(item.price).toFixed(2)}</div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <button class="btn btn-secondary btn-sm" onclick="moveToCart(${item.bookid})">+ Add to Cart</button>
                    <button class="drawer-item-remove" onclick="toggleWishlist(${item.bookid})">Remove</button>
                </div>
            </div>
        </div>
    `).join('');
}

async function moveToCart(bookId) {
    await addToCart(bookId);
    await toggleWishlist(bookId);
}

// ======================== GUEST CHECKOUT INTERCEPTION ========================
function handleProceedToCheckout() {
    if (!state.user) {
        // Intercept Guest: close drawer and open auth modal with message
        closeDrawers();
        state.isCheckingOut = true;
        openAuthModal('login', 'Please sign in or create an account to complete your checkout.');
        return;
    }

    if (state.activeCart.length === 0) {
        showToast('Your cart is empty.', 'error');
        return;
    }

    closeDrawers();
    openCheckoutModal();
}

// ======================== CHECKOUT MODAL FLOW ========================
async function openCheckoutModal() {
    const modal = document.getElementById('checkoutModal');
    if (!modal) return;

    state.appliedPromo = null;
    modal.classList.remove('hidden');

    await loadAddresses();
    renderCheckoutSummary();
}

async function loadAddresses() {
    const container = document.getElementById('checkoutAddressList');
    if (!container) return;

    try {
        const res = await fetch('api/addresses.php');
        const data = await res.json();
        if (data.success && data.addresses && data.addresses.length > 0) {
            state.selectedAddressId = data.addresses[0].addressid;
            container.innerHTML = data.addresses.map((a, idx) => `
                <label style="display:flex; align-items:flex-start; gap:10px; padding:10px; border:1px solid var(--border-color); border-radius:var(--radius-sm); margin-bottom:8px; cursor:pointer;">
                    <input type="radio" name="selectedAddress" value="${a.addressid}" ${idx === 0 ? 'checked' : ''} onchange="state.selectedAddressId = ${a.addressid}">
                    <div style="font-size:13px; line-height:1.4;">
                        <strong>${escapeHtml(a.no)}, ${escapeHtml(a.street)}</strong>
                        <div style="color:var(--text-muted);">Postal Code: ${escapeHtml(a.zipCode)}</div>
                    </div>
                </label>
            `).join('') + `
                <button type="button" class="btn btn-secondary btn-sm" onclick="toggleNewAddressForm()" style="margin-top:6px;">+ Add Different Address</button>
            `;
        } else {
            state.selectedAddressId = null;
            container.innerHTML = `
                <div style="font-size:13px; color:var(--text-muted); margin-bottom:12px;">No addresses saved yet. Please enter your delivery address:</div>
            `;
            document.getElementById('newAddressFields').style.display = 'block';
        }
    } catch (e) {
        console.error('Failed to load addresses', e);
    }
}

window.toggleNewAddressForm = function() {
    const fields = document.getElementById('newAddressFields');
    if (fields) {
        fields.style.display = fields.style.display === 'none' ? 'block' : 'none';
        if (fields.style.display === 'block') {
            state.selectedAddressId = null;
            document.querySelectorAll('input[name="selectedAddress"]').forEach(r => r.checked = false);
        }
    }
};

function renderCheckoutSummary() {
    const itemsEl = document.getElementById('checkoutItemsReview');
    const subtotalEl = document.getElementById('checkoutSubtotal');
    const discountRow = document.getElementById('checkoutDiscountRow');
    const discountEl = document.getElementById('checkoutDiscount');
    const totalEl = document.getElementById('checkoutFinalTotal');

    let subTotal = 0;
    state.activeCart.forEach(item => {
        subTotal += item.price * item.quantity;
    });

    if (itemsEl) {
        itemsEl.innerHTML = state.activeCart.map(item => `
            <div style="display:flex; justify-content:space-between; font-size:13px; padding:6px 0; border-bottom:1px solid var(--border-color);">
                <div>
                    <strong>${escapeHtml(item.title)}</strong> &times; ${item.quantity}
                </div>
                <div>$${(item.price * item.quantity).toFixed(2)}</div>
            </div>
        `).join('');
    }

    if (subtotalEl) subtotalEl.textContent = `$${subTotal.toFixed(2)}`;

    let discount = 0;
    if (state.appliedPromo) {
        if (state.appliedPromo.type.toLowerCase() === 'percentage') {
            discount = subTotal * (state.appliedPromo.price / 100);
        } else {
            discount = Math.min(subTotal, state.appliedPromo.price);
        }
        discount = Math.round(discount * 100) / 100;
        if (discountRow) discountRow.style.display = 'flex';
        if (discountEl) discountEl.textContent = `−$${discount.toFixed(2)} (${state.appliedPromo.code})`;
    } else {
        if (discountRow) discountRow.style.display = 'none';
    }

    const finalTotal = Math.max(0, subTotal - discount);
    if (totalEl) totalEl.textContent = `$${finalTotal.toFixed(2)}`;
}

// Validate Promo Code in Checkout
async function applyPromoCode() {
    const input = document.getElementById('checkoutPromoInput');
    const code = input ? input.value.trim().toUpperCase() : '';
    if (!code) return;

    try {
        const res = await fetch('api/checkout.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'validate_promo', code: code })
        });
        const data = await res.json();
        if (data.success && data.promo) {
            state.appliedPromo = data.promo;
            showToast('Promo code applied!');
            renderCheckoutSummary();
        } else {
            showToast(data.message || 'Invalid promo code.', 'error');
        }
    } catch (e) {
        showToast('Error validating promo code.', 'error');
    }
}

// Execute Place Order
async function placeOrder() {
    const btn = document.getElementById('placeOrderBtn');
    if (btn) btn.disabled = true;

    let payload = {
        action: 'place_order',
        promoCode: state.appliedPromo ? state.appliedPromo.code : '',
        paymentMethod: document.querySelector('input[name="paymentMethod"]:checked')?.value || 'COD'
    };

    if (state.selectedAddressId) {
        payload.addressid = state.selectedAddressId;
    } else {
        const no = document.getElementById('addrNo')?.value.trim();
        const street = document.getElementById('addrStreet')?.value.trim();
        const zipCode = document.getElementById('addrZip')?.value.trim();

        if (!no || !street || !zipCode) {
            showToast('Please provide your delivery address.', 'error');
            if (btn) btn.disabled = false;
            return;
        }
        payload.newAddress = { no, street, zipCode };
    }

    try {
        const res = await fetch('api/checkout.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
            // Order Placed successfully
            showOrderSuccessReceipt(data);
            await refreshCart();
            await loadBooks(); // Stock updated
        } else {
            showToast(data.message || 'Checkout failed.', 'error');
            if (btn) btn.disabled = false;
        }
    } catch (e) {
        showToast('An error occurred during checkout.', 'error');
        if (btn) btn.disabled = false;
    }
}

function showOrderSuccessReceipt(orderData) {
    const modalBody = document.getElementById('checkoutModalBody');
    if (!modalBody) return;

    modalBody.innerHTML = `
        <div style="text-align:center; padding:20px 0;">
            <div style="font-size:48px; margin-bottom:12px;">🎉</div>
            <h2 style="font-size:22px; font-weight:700; margin-bottom:6px;">Thank You for Your Order!</h2>
            <p style="color:var(--text-muted); font-size:14px; margin-bottom:20px;">
                Your order <strong>#${orderData.orderId}</strong> has been successfully placed.
            </p>
            <div style="background:var(--bg-canvas); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:16px; text-align:left; margin-bottom:20px;">
                <div style="font-size:12px; font-weight:700; text-transform:uppercase; color:var(--text-muted); margin-bottom:10px;">Order Summary</div>
                ${(orderData.items || []).map(it => `
                    <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
                        <span>${escapeHtml(it.title)} &times; ${it.quantity} <span style="color:var(--text-muted); font-size:11px;">(locked @ $${Number(it.unitPrice).toFixed(2)})</span></span>
                        <strong>$${Number(it.itemTotal).toFixed(2)}</strong>
                    </div>
                `).join('')}
                <div style="height:1px; background:var(--border-color); margin:10px 0;"></div>
                <div style="display:flex; justify-content:space-between; font-size:15px; font-weight:700;">
                    <span>Total Paid (${orderData.paymentMethod}):</span>
                    <span>$${Number(orderData.finalTotal).toFixed(2)}</span>
                </div>
            </div>
            <button class="btn btn-primary" onclick="closeCheckoutModal()">Continue Browsing</button>
        </div>
    `;
}

function closeCheckoutModal() {
    const modal = document.getElementById('checkoutModal');
    if (modal) {
        modal.classList.add('hidden');
        window.location.reload();
    }
}

// ======================== BOOK DETAILS & REVIEWS ========================
async function openBookDetailsModal(bookId) {
    const modal = document.getElementById('bookDetailsModal');
    if (!modal) return;

    modal.classList.remove('hidden');
    const container = document.getElementById('bookDetailsContent');
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">Loading book details...</div>';

    try {
        const res = await fetch(`api/books.php?action=detail&id=${bookId}`);
        const data = await res.json();
        if (data.success && data.book) {
            const b = data.book;
            const isOutOfStock = b.stockQuantity <= 0;
            const isWishlisted = isBookInWishlist(b.bookid);

            container.innerHTML = `
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:24px; margin-bottom:24px;">
                    <div>
                        <img src="${b.coverImageUrl || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80'}" alt="${escapeHtml(b.title)}" style="width:100%; border-radius:var(--radius-md); box-shadow:var(--shadow-md); object-fit:cover; aspect-ratio:3/4;">
                    </div>
                    <div>
                        <div style="font-size:12px; font-weight:600; text-transform:uppercase; color:var(--text-muted); margin-bottom:4px;">${escapeHtml(b.genres || 'Literature')}</div>
                        <h2 style="font-size:20px; font-weight:700; margin-bottom:8px;">${escapeHtml(b.title)}</h2>
                        <div style="font-size:14px; color:var(--text-muted); margin-bottom:12px;">By <strong>${escapeHtml(b.authors || 'Unknown')}</strong></div>
                        <div style="font-size:12px; color:var(--text-muted); margin-bottom:12px;">ISBN: <strong>${escapeHtml(b.ISBN)}</strong></div>
                        <div style="font-size:24px; font-weight:700; color:var(--text-main); margin-bottom:16px;">$${Number(b.price).toFixed(2)}</div>
                        <div style="margin-bottom:20px;">
                            ${isOutOfStock ? `<span class="badge badge-warning">Currently Out of Stock</span>` : `<span class="badge badge-success">${b.stockQuantity} in stock</span>`}
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button class="btn btn-primary" ${isOutOfStock ? 'disabled' : ''} onclick="addToCart(${b.bookid})">Add to Cart</button>
                            <button class="btn btn-secondary" onclick="toggleWishlist(${b.bookid})">${isWishlisted ? '❤️ In Wishlist' : '🤍 Wishlist'}</button>
                        </div>
                    </div>
                </div>

                <!-- Reviews Section -->
                <div style="border-top:1px solid var(--border-color); padding-top:20px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                        <h3 style="font-size:16px; font-weight:700;">Customer Reviews (${b.reviews.length})</h3>
                        <div style="font-size:14px;">Rating: <strong style="color:var(--star);">★ ${b.avgRating > 0 ? b.avgRating : 'New'}</strong> / 5</div>
                    </div>

                    ${state.user ? `
                        <form id="submitReviewForm" style="background:var(--bg-canvas); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:16px; margin-bottom:20px;" onsubmit="handleReviewSubmit(event, ${b.bookid})">
                            <div style="font-weight:600; font-size:13px; margin-bottom:8px;">Write a Review</div>
                            <div style="display:flex; gap:8px; align-items:center; margin-bottom:10px;">
                                <label style="font-size:12px; font-weight:600;">Rating:</label>
                                <select id="reviewRatingSelect" class="form-control" style="width:auto; padding:4px 8px;" required>
                                    <option value="5">★★★★★ (5 Stars)</option>
                                    <option value="4">★★★★☆ (4 Stars)</option>
                                    <option value="3">★★★☆☆ (3 Stars)</option>
                                    <option value="2">★★☆☆☆ (2 Stars)</option>
                                    <option value="1">★☆☆☆☆ (1 Star)</option>
                                </select>
                            </div>
                            <textarea id="reviewTextarea" class="form-control" placeholder="Share your honest thoughts about this book..." required style="margin-bottom:10px;"></textarea>
                            <button type="submit" class="btn btn-primary btn-sm">Submit Review</button>
                        </form>
                    ` : `
                        <div style="padding:12px; background:var(--bg-canvas); border-radius:var(--radius-sm); font-size:13px; color:var(--text-muted); margin-bottom:16px;">
                            Please <button onclick="openAuthModal('login')" style="background:none; border:none; color:var(--accent); font-weight:600; cursor:pointer; text-decoration:underline;">sign in</button> to share your review.
                        </div>
                    `}

                    <div style="display:flex; flex-direction:column; gap:12px;">
                        ${b.reviews.length === 0 ? `<div style="font-size:13px; color:var(--text-muted);">No reviews submitted yet. Be the first to review!</div>` : ''}
                        ${b.reviews.map(r => `
                            <div style="border-bottom:1px solid var(--border-color); padding-bottom:12px;">
                                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                                    <strong style="font-size:13px;">${escapeHtml(r.firstName + ' ' + r.lastName)}</strong>
                                    <span style="color:var(--star); font-size:12px;">${'★'.repeat(r.rate)}${'☆'.repeat(5 - r.rate)}</span>
                                </div>
                                <p style="font-size:13px; color:var(--text-muted); line-height:1.4;">${escapeHtml(r.description)}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    } catch (e) {
        container.innerHTML = '<div style="color:var(--danger); text-align:center; padding:20px;">Failed to load details.</div>';
    }
}

async function handleReviewSubmit(e, bookId) {
    e.preventDefault();
    const rate = parseInt(document.getElementById('reviewRatingSelect').value);
    const description = document.getElementById('reviewTextarea').value.trim();

    if (!description) return;

    try {
        const res = await fetch('api/reviews.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookid: bookId, rate: rate, description: description })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Review submitted!');
            openBookDetailsModal(bookId);
            loadBooks(); // Update card average
        } else {
            showToast(data.message || 'Failed to submit review.', 'error');
        }
    } catch (err) {
        showToast('Error submitting review.', 'error');
    }
}

// ======================== AUTH MODAL & LOGIC ========================
function openAuthModal(tab = 'login', notice = '') {
    const modal = document.getElementById('authModal');
    if (!modal) return;

    const noticeEl = document.getElementById('authNotice');
    if (noticeEl) {
        if (notice) {
            noticeEl.textContent = notice;
            noticeEl.style.display = 'block';
        } else {
            noticeEl.style.display = 'none';
        }
    }

    switchAuthTab(tab);
    modal.classList.remove('hidden');
}

function switchAuthTab(tab) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginTabBtn = document.getElementById('loginTabBtn');
    const registerTabBtn = document.getElementById('registerTabBtn');

    if (tab === 'login') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        loginTabBtn.classList.add('active');
        registerTabBtn.classList.remove('active');
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        loginTabBtn.classList.remove('active');
        registerTabBtn.classList.add('active');
    }
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
        const res = await fetch('auth.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login', email, password })
        });
        const data = await res.json();
        if (data.success) {
            state.user = data.user;
            renderHeaderUserUI();
            showToast(data.message);
            document.getElementById('authModal').classList.add('hidden');

            // Perform synchronization of guest localStorage data
            await performGuestSync();
            await refreshCart();
            await refreshWishlist();

            // Resume checkout if user was checking out
            if (state.isCheckingOut) {
                state.isCheckingOut = false;
                openCheckoutModal();
            }
        } else {
            showToast(data.message || 'Login failed.', 'error');
        }
    } catch (e) {
        showToast('Login request error.', 'error');
    }
}

async function handleRegisterSubmit(e) {
    e.preventDefault();
    const firstName = document.getElementById('regFirstName').value.trim();
    const lastName = document.getElementById('regLastName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;

    try {
        const res = await fetch('auth.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'register', firstName, lastName, email, password })
        });
        const data = await res.json();
        if (data.success) {
            state.user = data.user;
            renderHeaderUserUI();
            showToast(data.message);
            document.getElementById('authModal').classList.add('hidden');

            // Perform synchronization of guest localStorage data
            await performGuestSync();
            await refreshCart();
            await refreshWishlist();

            // Resume checkout if user was checking out
            if (state.isCheckingOut) {
                state.isCheckingOut = false;
                openCheckoutModal();
            }
        } else {
            showToast(data.message || 'Registration failed.', 'error');
        }
    } catch (e) {
        showToast('Registration request error.', 'error');
    }
}

// ======================== DRAWERS & UTILITIES ========================
function setupEventListeners() {
    // Search with debounce
    const searchInput = document.getElementById('siteSearchInput');
    const searchClear = document.getElementById('searchClearBtn');
    let debounceTimer = null;

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (searchClear) {
                searchClear.style.display = searchInput.value ? 'block' : 'none';
            }
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                state.searchQuery = searchInput.value;
                loadBooks();
            }, 300);
        });
    }

    if (searchClear) {
        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            searchClear.style.display = 'none';
            state.searchQuery = '';
            loadBooks();
        });
    }

    // Sort select
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            state.currentSort = sortSelect.value;
            loadBooks();
        });
    }

    // Drawer triggers
    const cartTrigger = document.getElementById('cartTrigger');
    const wishlistTrigger = document.getElementById('wishlistTrigger');
    const cartDrawerOverlay = document.getElementById('cartDrawerOverlay');
    const wishlistDrawerOverlay = document.getElementById('wishlistDrawerOverlay');

    if (cartTrigger) {
        cartTrigger.addEventListener('click', () => {
            cartDrawerOverlay.classList.add('open');
        });
    }
    if (wishlistTrigger) {
        wishlistTrigger.addEventListener('click', () => {
            wishlistDrawerOverlay.classList.add('open');
        });
    }

    document.querySelectorAll('.drawer-close-btn').forEach(btn => {
        btn.addEventListener('click', closeDrawers);
    });

    document.querySelectorAll('.drawer-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeDrawers();
        });
    });

    // Proceed to checkout button in cart drawer
    const checkoutBtn = document.getElementById('proceedToCheckoutBtn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', handleProceedToCheckout);
    }

    // Auth Modal tab switching & submissions
    const loginTabBtn = document.getElementById('loginTabBtn');
    const registerTabBtn = document.getElementById('registerTabBtn');
    if (loginTabBtn) loginTabBtn.addEventListener('click', () => switchAuthTab('login'));
    if (registerTabBtn) registerTabBtn.addEventListener('click', () => switchAuthTab('register'));

    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);
    if (registerForm) registerForm.addEventListener('submit', handleRegisterSubmit);

     // Modal close triggers
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
        });
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.add('hidden');
            }
        });
    });

    // Checkout Modal buttons
    const applyPromoBtn = document.getElementById('applyPromoBtn');
    if (applyPromoBtn) applyPromoBtn.addEventListener('click', applyPromoCode);

    const placeOrderBtn = document.getElementById('placeOrderBtn');
    if (placeOrderBtn) placeOrderBtn.addEventListener('click', placeOrder);

    // Mobile bottom nav buttons
    const mobSearchBtn = document.getElementById('mobSearchBtn');
    if (mobSearchBtn) {
        mobSearchBtn.addEventListener('click', () => {
            const wrapper = document.querySelector('.search-wrapper');
            if (wrapper) {
                wrapper.style.display = wrapper.style.display === 'block' ? 'none' : 'block';
                if (wrapper.style.display === 'block') {
                    searchInput?.focus();
                }
            }
        });
    }
}

function closeDrawers() {
    document.querySelectorAll('.drawer-overlay').forEach(d => d.classList.remove('open'));
}

// Toast Notifications
function showToast(message, type = 'normal') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : ''}`;
    toast.textContent = message;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
