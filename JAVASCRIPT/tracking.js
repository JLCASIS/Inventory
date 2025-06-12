// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAK1k03ZF97KyeKuIRcALaGLYk5ZQgYm1o",
    authDomain: "inventory-system-51c3c.firebaseapp.com",
    projectId: "inventory-system-51c3c",
    storageBucket: "inventory-system-51c3c.appspot.com",
    messagingSenderId: "1074026861787",
    appId: "1:1074026861787:web:9ad11d64c8ed1e20ea28fe",
    measurementId: "G-3YRGTX05CB"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Global variables
let currentCategory = 'all';
let allProducts = [];
let pendingChanges = {}; // Track pending changes for each product
let currentSearchTerm = '';

// Category mapping for display
const categoryMapping = {
    'grains': 'Grain',
    'dryfruits': 'Dry Fruit',
    'fruits': 'Fruit',
    'dairy': 'Dairy',
    'meats': 'Meat',
    'spices': 'Spice',
    'sauces': 'Sauce',
    'greens': 'Green',
    'oils': 'Oil',
    'eggs': 'Egg'
};

// All categories for loading products
const allCategories = ['grains', 'dryfruits', 'fruits', 'dairy', 'meats', 'spices', 'sauces', 'greens', 'oils', 'eggs'];

// Initialize the application
document.addEventListener('DOMContentLoaded', function () {
    initializeAuth();
    setupCategoryButtons();
    loadProducts();
    requestNotificationPermission();
    setupSearch();
});

// Authentication
function initializeAuth() {
    auth.signInAnonymously().catch((error) => {
        console.error('Authentication error:', error);
    });
}

// Setup category button handlers
function setupCategoryButtons() {
    const categoryButtons = document.querySelectorAll('.category-btn');
    categoryButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            // Remove active class from all buttons
            categoryButtons.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');

            // Update current category and filter products
            currentCategory = this.dataset.category;
            displayProducts();
        });
    });
}

// Setup search functionality with prefix matching
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const clearSearch = document.getElementById('clearSearch');
    
    // Search input event
    searchInput.addEventListener('input', function(e) {
        currentSearchTerm = e.target.value.trim().toLowerCase();
        
        // Show/hide clear button
        if (currentSearchTerm.length > 0) {
            clearSearch.style.display = 'block';
        } else {
            clearSearch.style.display = 'none';
        }
        
        // Real-time search without debounce for better responsiveness
        displayProducts();
    });
    
    // Clear search button
    clearSearch.addEventListener('click', function() {
        searchInput.value = '';
        currentSearchTerm = '';
        clearSearch.style.display = 'none';
        displayProducts();
    });
}

// Load products from nested Firestore collections
async function loadProducts() {
    try {
        allProducts = [];

        // Load products from each category collection
        for (const category of allCategories) {
            const snapshot = await db.collection('categories').doc(category).collection('products').get();

            snapshot.forEach((doc) => {
                const data = doc.data();
                allProducts.push({
                    id: doc.id,
                    categoryId: category, // Store the category ID for updates
                    ...data
                });
            });
        }

        displayProducts();
        setupRealtimeListener(); // Set up real-time listeners after initial load
    } catch (error) {
        console.error('Error loading products:', error);
        showError('Failed to load products. Please try again.');
    }
}

// Event delegation for buttons
document.addEventListener('click', function(e) {
    // Handle decrease button
    if (e.target.closest('.decrease-btn')) {
        const btn = e.target.closest('.decrease-btn');
        const productId = btn.dataset.productId;
        const categoryId = btn.dataset.categoryId;
        changeQuantityLocal(productId, categoryId, -1, e);
        e.preventDefault();
    }
    
    // Handle increase button
    if (e.target.closest('.increase-btn')) {
        const btn = e.target.closest('.increase-btn');
        const productId = btn.dataset.productId;
        const categoryId = btn.dataset.categoryId;
        changeQuantityLocal(productId, categoryId, 1, e);
        e.preventDefault();
    }
    
    // Handle save button
    if (e.target.closest('.save-btn')) {
        const btn = e.target.closest('.save-btn');
        const productId = btn.dataset.productId;
        const categoryId = btn.dataset.categoryId;
        saveQuantityChanges(productId, categoryId);
        e.preventDefault();
    }
    
    // Handle delete button
    if (e.target.closest('.delete-btn')) {
        const btn = e.target.closest('.delete-btn');
        const productId = btn.dataset.productId;
        const categoryId = btn.dataset.categoryId;
        deleteProduct(productId, categoryId);
        e.preventDefault();
    }
});

// Display products based on current category and search term with prefix matching
function displayProducts() {
    const container = document.getElementById('productsContainer');

    // Filter products based on category
    let filteredProducts = allProducts;
    if (currentCategory !== 'all') {
        filteredProducts = allProducts.filter(product =>
            product.categoryId === currentCategory
        );
    }

    // Apply prefix search filter if there's a search term
    if (currentSearchTerm) {
        filteredProducts = filteredProducts.filter(product => {
            // Check if product name starts with the search term (prefix matching)
            return product.name.toLowerCase().startsWith(currentSearchTerm);
        });
    }

    // Clear container
    container.innerHTML = '';

    // Show empty state if no products
    if (filteredProducts.length === 0) {
        showEmptyState(container);
        return;
    }

    // Sort products alphabetically for better user experience
    filteredProducts.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

    // Create product items
    filteredProducts.forEach(product => {
        const productElement = createProductElement(product);
        container.appendChild(productElement);
    });
}

// Create product element
function createProductElement(product) {
    const productDiv = document.createElement('div');
    productDiv.className = 'product-item';
    productDiv.dataset.productId = product.id;
    productDiv.dataset.categoryId = product.categoryId;

    const quantity = product.quantity || 0;
    const status = getStockStatus(quantity);
    const categoryDisplay = categoryMapping[product.categoryId] || product.categoryId || 'Unknown';
    const productKey = `${product.id}_${product.categoryId}`;
    const hasPendingChanges = pendingChanges[productKey] !== undefined;

    productDiv.innerHTML = `
        <div class="product-image">
            <img src="${product.imageUrl || 'https://via.placeholder.com/80'}" alt="${product.name}" onerror="this.src='https://via.placeholder.com/80'">
        </div>
        <div class="product-info">
            <div class="product-name">${product.name}</div>
            <div class="product-details">
                <div class="product-detail">
                    <i class="fas fa-tag"></i> Category: ${categoryDisplay}
                </div>
                <div class="product-detail quantity-control">
                    <i class="fas fa-box"></i> 
                    Quantity: 
                    <button class="decrease-btn" data-product-id="${product.id}" data-category-id="${product.categoryId}">
                        <i class="fas fa-minus"></i>
                    </button>
                    <input type="number" class="quantity-input" value="${hasPendingChanges ? pendingChanges[productKey] : quantity}" 
                        onchange="updateQuantityLocal('${product.id}', '${product.categoryId}', this.value)"
                        oninput="updateQuantityLocal('${product.id}', '${product.categoryId}', this.value)"
                        min="0">
                    <button class="increase-btn" data-product-id="${product.id}" data-category-id="${product.categoryId}">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
                <div class="status-row">
                    <div class="product-detail status ${status.class}">
                        <i class="${status.icon}"></i> ${status.text}
                    </div>
                    <div class="product-actions">
                        <button class="save-btn" data-product-id="${product.id}" data-category-id="${product.categoryId}">
                            <i class="fas fa-save"></i> Save
                        </button>
                        <button class="delete-btn" data-product-id="${product.id}" data-category-id="${product.categoryId}" title="Delete">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    return productDiv;
}

// Get stock status
function getStockStatus(quantity) {
    if (quantity === 0) {
        return {
            class: 'out-stock',
            icon: 'fas fa-times-circle',
            text: 'Out of Stock'
        };
    } else if (quantity <= 3) { // Changed from 10 to 3 for low stock threshold
        return {
            class: 'low-stock',
            icon: 'fas fa-exclamation-circle',
            text: 'Low Stock'
        };
    } else {
        return {
            class: 'in-stock',
            icon: 'fas fa-check-circle',
            text: 'In Stock'
        };
    }
}

// Create low stock notification
async function createLowStockNotification(product, newQuantity) {
    try {
        // Check if notification already exists for this product
        const existingNotification = await db.collection('notifications')
            .where('productId', '==', product.id)
            .where('categoryId', '==', product.categoryId)
            .where('type', '==', 'low_stock')
            .where('isRead', '==', false)
            .get();

        // If notification already exists, don't create duplicate
        if (!existingNotification.empty) {
            return;
        }

        const notification = {
            productId: product.id,
            categoryId: product.categoryId,
            productName: product.name,
            category: product.category || categoryMapping[product.categoryId] || product.categoryId,
            quantity: newQuantity,
            type: 'low_stock',
            message: `${product.name} has only ${newQuantity} ${newQuantity === 1 ? 'piece' : 'pieces'} left and will reach out of stock soon.`,
            title: 'Low Stock Alert',
            isRead: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            priority: 'high'
        };

        await db.collection('notifications').add(notification);
        console.log(`Low stock notification created for ${product.name}`);

        // Show browser notification if permission granted
        showBrowserNotification(notification);

    } catch (error) {
        console.error('Error creating notification:', error);
    }
}

// Show browser notification
function showBrowserNotification(notification) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, {
            body: notification.message,
            icon: '/favicon.ico'
        });
    }
}

// Request notification permission
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                console.log('Notification permission granted');
            }
        });
    }
}

// Check and handle low stock notifications
async function checkLowStockNotification(product, newQuantity, oldQuantity) {
    // Only create notification if quantity is between 1-3 and it's decreasing
    if (newQuantity >= 1 && newQuantity <= 3 && newQuantity < oldQuantity) {
        await createLowStockNotification(product, newQuantity);
    }

    // If quantity increases above 3, mark existing low stock notifications as resolved
    if (newQuantity > 3 && oldQuantity <= 3) {
        await markLowStockNotificationsResolved(product.id, product.categoryId);
    }
}

// Mark low stock notifications as resolved
async function markLowStockNotificationsResolved(productId, categoryId) {
    try {
        const notifications = await db.collection('notifications')
            .where('productId', '==', productId)
            .where('categoryId', '==', categoryId)
            .where('type', '==', 'low_stock')
            .where('isRead', '==', false)
            .get();

        const batch = db.batch();
        notifications.forEach(doc => {
            batch.update(doc.ref, {
                isRead: true,
                resolvedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        if (!notifications.empty) {
            await batch.commit();
            console.log(`Resolved low stock notifications for product ${productId}`);
        }
    } catch (error) {
        console.error('Error marking notifications as resolved:', error);
    }
}

// Change quantity locally
function changeQuantityLocal(productId, categoryId, change, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    const product = allProducts.find(p => p.id === productId && p.categoryId === categoryId);
    if (!product) return;

    const productKey = `${productId}_${categoryId}`;
    const currentQuantity = pendingChanges[productKey] !== undefined ? 
        pendingChanges[productKey] : 
        (product.quantity || 0);
    
    let newQuantity = currentQuantity + change;
    if (newQuantity < 0) newQuantity = 0;

    // Store pending change
    pendingChanges[productKey] = newQuantity;

    // Update UI immediately
    updateProductDisplayLocal(productId, categoryId, newQuantity);
}

// Update quantity locally
function updateQuantityLocal(productId, categoryId, value) {
    // Parse the input value, default to 0 if invalid
    let newQuantity = parseInt(value);
    if (isNaN(newQuantity)) newQuantity = 0;
    
    // Ensure quantity doesn't go below 0
    newQuantity = Math.max(0, newQuantity);
    
    const productKey = `${productId}_${categoryId}`;
    const product = allProducts.find(p => p.id === productId && p.categoryId === categoryId);
    
    // Only update if there's an actual change from the original quantity
    if (product) {
        const originalQuantity = product.quantity || 0;
        
        if (newQuantity !== originalQuantity) {
            // Store pending change
            pendingChanges[productKey] = newQuantity;
        } else {
            // If no change, remove any pending change for this product
            delete pendingChanges[productKey];
        }
        
        // Update UI immediately
        updateProductDisplayLocal(productId, categoryId, newQuantity);
    }
}

// Update product display locally
function updateProductDisplayLocal(productId, categoryId, quantity) {
    const productElement = document.querySelector(`[data-product-id="${productId}"][data-category-id="${categoryId}"]`);
    if (!productElement) return;

    const quantityInput = productElement.querySelector('.quantity-input');
    const statusElement = productElement.querySelector('.status');
    const product = allProducts.find(p => p.id === productId && p.categoryId === categoryId);

    if (!product) return;

    // Update quantity input
    quantityInput.value = quantity;

    // Update status (show status based on new quantity)
    const status = getStockStatus(quantity);
    statusElement.className = `product-detail status ${status.class}`;
    statusElement.innerHTML = `<i class="${status.icon}"></i> ${status.text}`;
}

// Save quantity changes to Firestore
async function saveQuantityChanges(productId, categoryId) {
    try {
        const productKey = `${productId}_${categoryId}`;
        const newQuantity = pendingChanges[productKey];

        if (newQuantity === undefined) return;

        const product = allProducts.find(p => p.id === productId && p.categoryId === categoryId);
        if (!product) return;

        const oldQuantity = product.quantity || 0;

        // Update in nested Firestore collection
        await db.collection('categories').doc(categoryId).collection('products').doc(productId).update({
            quantity: newQuantity
        });

        // Update local data
        product.quantity = newQuantity;

        // Check for low stock notification
        await checkLowStockNotification(product, newQuantity, oldQuantity);

        // Remove from pending changes
        delete pendingChanges[productKey];

        console.log(`Quantity saved for product ${productId}: ${newQuantity}`);

    } catch (error) {
        console.error('Error saving quantity:', error);
        showError('Failed to save quantity. Please try again.');
    }
}

// Delete product
async function deleteProduct(productId, categoryId) {
    if (!confirm('Are you sure you want to delete this product?')) {
        return;
    }

    try {
        // Delete from nested Firestore collection
        await db.collection('categories').doc(categoryId).collection('products').doc(productId).delete();

        // Delete related notifications
        const notifications = await db.collection('notifications')
            .where('productId', '==', productId)
            .where('categoryId', '==', categoryId)
            .get();

        const batch = db.batch();
        notifications.forEach(doc => {
            batch.delete(doc.ref);
        });

        if (!notifications.empty) {
            await batch.commit();
        }

        // Remove from local data
        allProducts = allProducts.filter(p => !(p.id === productId && p.categoryId === categoryId));

        // Remove from pending changes
        const productKey = `${productId}_${categoryId}`;
        delete pendingChanges[productKey];

        // Remove from UI
        const productElement = document.querySelector(`[data-product-id="${productId}"][data-category-id="${categoryId}"]`);
        if (productElement) {
            productElement.remove();
        }

        // Check if we need to show empty state
        const filteredProducts = currentCategory === 'all' ? allProducts :
            allProducts.filter(product => product.categoryId === currentCategory);

        if (filteredProducts.length === 0) {
            const container = document.getElementById('productsContainer');
            showEmptyState(container);
        }
    } catch (error) {
        console.error('Error deleting product:', error);
        showError('Failed to delete product. Please try again.');
    }
}

// Enhanced show empty state with better messaging for prefix search
function showEmptyState(container) {
    let message = '';
    if (currentSearchTerm) {
        message = `No products found starting with "${currentSearchTerm}"`;
        if (currentCategory !== 'all') {
            message += ` in ${categoryMapping[currentCategory] || currentCategory} category`;
        }
    } else {
        message = currentCategory === 'all' ? 'No products available' : 
            `No products in ${categoryMapping[currentCategory] || currentCategory} category`;
    }

    container.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-box-open"></i>
            <h3>No Products Found</h3>
            <p>${message}</p>
            ${currentSearchTerm ? `<p><small>Try typing fewer letters or check the spelling</small></p>` : ''}
        </div>
    `;
}

// Show error message
function showError(message) {
    const container = document.getElementById('productsContainer');
    container.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-exclamation-triangle" style="color: #ff6b35;"></i>
            <h3>Error</h3>
            <p>${message}</p>
        </div>
    `;
}

// Setup real-time listeners for nested collections
function setupRealtimeListener() {
    allCategories.forEach(category => {
        db.collection('categories').doc(category).collection('products').onSnapshot((snapshot) => {
            // Remove old products from this category
            allProducts = allProducts.filter(p => p.categoryId !== category);

            // Add updated products from this category
            snapshot.forEach((doc) => {
                const data = doc.data();
                allProducts.push({
                    id: doc.id,
                    categoryId: category,
                    ...data
                });
            });

            displayProducts();
        }, (error) => {
            console.error(`Error in real-time listener for ${category}:`, error);
        });
    });
}

// Initialize real-time listener after initial load
setTimeout(() => {
    setupRealtimeListener();
    requestNotificationPermission();
}, 2000);