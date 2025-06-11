import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, query, where, onSnapshot, orderBy } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase configuration - REPLACE WITH YOUR ACTUAL CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyAK1k03ZF97KyeKuIRcALaGLYk5ZQgYm1o",
    authDomain: "inventory-system-51c3c.firebaseapp.com",
    projectId: "inventory-system-51c3c",
    storageBucket: "inventory-system-51c3c.firebasestorage.app",
    messagingSenderId: "1074026861787",
    appId: "1:1074026861787:web:9ad11d64c8ed1e20ea28fe",
    measurementId: "G-3YRGTX05CB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

class GrainsManager {
    constructor() {
        this.productsContainer = document.querySelector('.products-grid');
        this.isInitialized = false;
        this.expiryCheckInterval = null;
        this.categoryId = 'grains'; // The category document ID
        this.init();
    }

    async init() {
        try {
            this.startClock();
            await this.loadGrainsProducts();
            this.setupRealTimeUpdates();
            this.startExpiryTracker();
            this.isInitialized = true;
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to initialize. Please check your internet connection and Firebase configuration.');
        }
    }

    // Load all products from the grains category subcollection
    async loadGrainsProducts() {
        try {
            console.log("Loading grains products..."); // Debug log
            
            // Access the products subcollection under the grains category
            const productsRef = collection(db, 'categories', this.categoryId, 'products');
            const q = query(productsRef, orderBy('storageDate', 'desc')); // Changed from 'storeDate' to 'storageDate'
            
            const querySnapshot = await getDocs(q);
            console.log("Found documents:", querySnapshot.size); // Debug log
            
            if (querySnapshot.empty) {
                console.log("No grains products found"); // Debug log
            } else {
                querySnapshot.forEach((doc) => {
                    console.log("Product:", doc.id, doc.data()); // Debug each product
                });
            }

            this.displayProducts(querySnapshot);
        } catch (error) {
            console.error('Error loading grains products:', error);
            this.showError('Failed to load products. Please check your Firebase configuration.');
        }
    }

    // Display products in the HTML
    displayProducts(querySnapshot) {
        this.productsContainer.innerHTML = '';

        if (querySnapshot.empty) {
            this.productsContainer.innerHTML = `
                        <div class="no-products">
                            <div class="no-products-icon">🌾</div>
                            <h3>No grains products found</h3>
                            <p>Add some grains to your inventory to see them here.</p>
                        </div>
                    `;
            return;
        }

        const productsArray = [];
        querySnapshot.forEach((doc) => {
            const product = doc.data();
            productsArray.push({ ...product, id: doc.id });
        });

        // Sort by expiry (most urgent first)
        productsArray.sort((a, b) => {
            const daysLeftA = this.calculateDaysLeft(a); // Pass whole product object
            const daysLeftB = this.calculateDaysLeft(b); // Pass whole product object
            return daysLeftA - daysLeftB;
        });

        productsArray.forEach(product => {
            const productElement = this.createProductCard(product, product.id);
            this.productsContainer.appendChild(productElement);
        });
    }

    // Create individual product card HTML
    createProductCard(product, productId) {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.dataset.productId = productId;

        // Calculate expiry based on actual expiry date or storage date + expiry period
        const daysLeft = this.calculateDaysLeft(product); // Pass whole product object
        const isExpiringSoon = daysLeft <= 3 && daysLeft > 0;
        const isExpired = daysLeft <= 0;

        // Add warning styles for expiring products
        if (isExpiringSoon) {
            productCard.classList.add('expiring-soon');
        }
        if (isExpired) {
            productCard.classList.add('expired');
        }

        // Status badge
        let statusBadge = '';
        if (isExpired) {
            statusBadge = '<span class="status-badge expired-badge">EXPIRED</span>';
        } else if (isExpiringSoon) {
            statusBadge = '<span class="status-badge warning-badge">EXPIRING SOON</span>';
        } else if (daysLeft <= 7) {
            statusBadge = '<span class="status-badge caution-badge">WATCH</span>';
        }

        productCard.innerHTML = `
                    <img src="${product.imageUrl || 'images/placeholder.jpg'}" 
                         alt="${product.name}" 
                         onerror="this.src='images/placeholder.jpg'" />
                    <div class="product-info">
                        <div class="product-header">
                            <h3 class="product-name">${product.name}</h3>
                            ${statusBadge}
                        </div>
                        <div class="product-details">
                            <p class="product-quantity">
                                <span class="label">Quantity:</span> 
                                <span class="value">${product.quantity}</span>
                            </p>
                            <p class="product-storedate">
                                <span class="label">Storage Date:</span> 
                                <span class="value">${this.formatDate(product.storageDate)}</span>
                            </p>
                            <p class="product-expiry ${isExpiringSoon ? 'warning' : ''} ${isExpired ? 'expired-text' : ''}">
                                <span class="label">Status:</span> 
                                <span class="value">
                                    ${daysLeft > 0 ? `${daysLeft} days left` : 'Expired'}
                                </span>
                            </p>
                        </div>
                    </div>
                `;

        return productCard;
    }

    // Calculate days left until expiry
    calculateDaysLeft(product) { // Changed to accept the whole product object
        // First try to use the actual expiryDate field from Firestore
        if (product.expiryDate) {
            const expiry = new Date(product.expiryDate);
            const now = new Date();
            const diffTime = expiry - now;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays;
        }
        
        // Fallback to calculated expiry if no expiryDate field
        if (!product.storageDate) {
            console.warn('Storage date is missing or invalid');
            return 0;
        }
        
        const stored = new Date(product.storageDate);
        const expiryDays = product.expiryDays || 30;
        const expiry = new Date(stored.getTime() + (expiryDays * 24 * 60 * 60 * 1000));
        const now = new Date();
        const diffTime = expiry - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }

    // Format date for display
    formatDate(dateString) {
        if (!dateString) {
            return 'Invalid Date';
        }
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    // Start real-time expiry tracking
    startExpiryTracker() {
        // Clear any existing interval
        if (this.expiryCheckInterval) {
            clearInterval(this.expiryCheckInterval);
        }

        // Check every 30 minutes for expiring products
        this.expiryCheckInterval = setInterval(() => {
            this.checkAndMoveExpiringProducts();
        }, 30 * 60 * 1000); // 30 minutes

        // Initial check after 5 seconds
        setTimeout(() => {
            this.checkAndMoveExpiringProducts();
        }, 5000);
    }

    // Check for products that are expiring soon and move them
    async checkAndMoveExpiringProducts() {
        if (!this.isInitialized) return;

        try {
            // Access products from the grains category subcollection
            const productsRef = collection(db, 'categories', this.categoryId, 'products');
            const querySnapshot = await getDocs(productsRef);

            const productsToMove = [];

            querySnapshot.forEach((docSnapshot) => {
                const product = docSnapshot.data();
                const productId = docSnapshot.id;
                const daysLeft = this.calculateDaysLeft(product); // Pass whole product object

                // If product has reached 0 days (expired), queue for moving to expiry collection
                if (daysLeft <= 0) {
                    productsToMove.push({ product, productId, daysLeft });
                }
            });

            // Move products one by one
            for (const item of productsToMove) {
                await this.moveToExpiry(item.product, item.productId, item.daysLeft);
            }

        } catch (error) {
            console.error('Error checking expiring products:', error);
        }
    }

    // Move product to expiry collection and remove from grains
    async moveToExpiry(product, productId, daysLeft) {
        try {
            // Reference to the product in the grains subcollection
            const productRef = doc(db, 'categories', this.categoryId, 'products', productId);

            // Add to expiry collection (assuming expiry is a top-level collection)
            const expiryData = {
                ...product,
                movedToExpiryDate: new Date().toISOString(),
                originalCategory: this.categoryId,
                daysLeft: daysLeft,
                expiryReason: 'approaching_expiry'
            };

            await addDoc(collection(db, 'expiry'), expiryData);
            console.log('Product moved to expiry collection:', product.name);

            // Remove from grains subcollection
            await deleteDoc(productRef);
            console.log('Product removed from grains:', product.name);

            // Show notification
            this.showNotification(
                `${product.name} moved to expiry`,
                `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`,
                'warning'
            );

        } catch (error) {
            console.error('Error moving product to expiry:', error);
            this.showNotification(
                'Error moving product',
                'Please try again later',
                'error'
            );
        }
    }

    // Setup real-time updates for the products subcollection
    setupRealTimeUpdates() {
        const productsRef = collection(db, 'categories', this.categoryId, 'products');

        onSnapshot(productsRef, (querySnapshot) => {
            this.displayProducts(querySnapshot);
        }, (error) => {
            console.error('Error in real-time updates:', error);
            this.showNotification(
                'Connection lost',
                'Trying to reconnect...',
                'error'
            );
        });
    }

    // Show error message
    showError(message) {
        this.productsContainer.innerHTML = `
                    <div class="error-message">
                        <div class="error-icon">⚠️</div>
                        <h3>Oops! Something went wrong</h3>
                        <p>${message}</p>
                        <button onclick="location.reload()" class="retry-button">Retry</button>
                    </div>
                `;
    }

    // Enhanced notification system
    showNotification(title, message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;

        const icons = {
            info: 'ℹ️',
            warning: '⚠️',
            error: '❌',
            success: '✅'
        };

        notification.innerHTML = `
                    <div class="notification-icon">${icons[type] || icons.info}</div>
                    <div class="notification-content">
                        <div class="notification-title">${title}</div>
                        <div class="notification-message">${message}</div>
                    </div>
                    <button class="notification-close" onclick="this.parentElement.remove()">×</button>
                `;

        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    // Real-time clock display
    startClock() {
        const updateClock = () => {
            const now = new Date();
            const timeString = now.toLocaleString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });

            const clockElement = document.getElementById('current-time');
            if (clockElement) {
                clockElement.textContent = timeString;
            }
        };

        updateClock();
        setInterval(updateClock, 1000);
    }

    // Cleanup method
    destroy() {
        if (this.expiryCheckInterval) {
            clearInterval(this.expiryCheckInterval);
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.grainsManager = new GrainsManager();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.grainsManager) {
        window.grainsManager.destroy();
    }
});