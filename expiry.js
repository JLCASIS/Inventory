// Initialize Firebase with your config
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
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// DOM Elements
const loadingContainer = document.getElementById('loadingContainer');
const expiredContainer = document.getElementById('expiredContainer');
const emptyState = document.getElementById('emptyState');
const totalExpiredEl = document.getElementById('totalExpired');
const expiredTodayEl = document.getElementById('expiredToday');
const totalValueEl = document.getElementById('totalValue');

// Calculate days since expiry
function calculateDaysSinceExpiry(expiryDate) {
    const expiry = new Date(expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    
    const timeDiff = today.getTime() - expiry.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    return daysDiff;
}

// Format days expired text
function formatDaysExpired(days) {
    if (days === 0) {
        return 'Expires Today';
    } else if (days === 1) {
        return '1 Day Expired';
    } else if (days > 1) {
        return `${days} Days Expired`;
    } else {
        return 'Expires Soon';
    }
}

// Create expired product HTML
function createExpiredProductHTML(product, id) {
    const daysExpired = calculateDaysSinceExpiry(product.expiryDate);
    const imageUrl = product.imageUrl || 'https://via.placeholder.com/80x80?text=No+Image';
    
    return `
        <div class="expired-item" data-id="${id}">
            <img src="${imageUrl}" alt="${product.name}" class="product-image" 
                 onerror="this.src='https://via.placeholder.com/80x80?text=No+Image'">
            
            <div class="product-info">
                <div class="product-name">${product.name}</div>
                <div class="product-details">
                    <div class="detail-item">
                        <span class="detail-label">Category:</span>
                        <span class="category-badge">${product.category || 'Unknown'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Quantity:</span>
                        <span>${product.quantity || 0}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Storage Date:</span>
                        <span>${new Date(product.storageDate).toLocaleDateString()}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Expiry Date:</span>
                        <span>${new Date(product.expiryDate).toLocaleDateString()}</span>
                    </div>
                    ${product.reason ? `
                    <div class="detail-item">
                        <span class="detail-label">Reason:</span>
                        <span>${product.reason}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="expiry-info">
                <div class="days-expired">${formatDaysExpired(daysExpired)}</div>
                <button class="delete-btn" onclick="deleteExpiredProduct('${id}')">
                    🗑️ Remove
                </button>
            </div>
        </div>
    `;
}

// Delete expired product
async function deleteExpiredProduct(productId) {
    if (!confirm('Are you sure you want to permanently delete this expired product?')) {
        return;
    }

    try {
        await db.collection('expiry').doc(productId).delete();
        
        // Remove from DOM
        const productElement = document.querySelector(`[data-id="${productId}"]`);
        if (productElement) {
            productElement.style.transform = 'translateX(-100%)';
            productElement.style.opacity = '0';
            setTimeout(() => {
                productElement.remove();
                updateStats();
                
                // Check if no products left
                if (expiredContainer.children.length === 0) {
                    showEmptyState();
                }
            }, 300);
        }
        
        console.log('Expired product deleted successfully');
    } catch (error) {
        console.error('Error deleting expired product:', error);
        alert('Error deleting product. Please try again.');
    }
}

// Update statistics
function updateStats() {
    const expiredItems = document.querySelectorAll('.expired-item');
    const today = new Date().toDateString();
    
    let expiredToday = 0;
    let estimatedLoss = 0;
    
    expiredItems.forEach(item => {
        const productData = item.dataset;
        // Simple estimation - $5 per item (you can make this more sophisticated)
        estimatedLoss += 5;
        
        // Check if expired today (this is a simplified check)
        expiredToday += Math.random() < 0.3 ? 1 : 0; // Random for demo
    });
    
    totalExpiredEl.textContent = expiredItems.length;
    expiredTodayEl.textContent = Math.floor(expiredItems.length * 0.3); // Estimated
    totalValueEl.textContent = `$${estimatedLoss}`;
}

// Show empty state
function showEmptyState() {
    loadingContainer.style.display = 'none';
    expiredContainer.style.display = 'none';
    emptyState.style.display = 'block';
    
    // Update stats to zero
    totalExpiredEl.textContent = '0';
    expiredTodayEl.textContent = '0';
    totalValueEl.textContent = '$0';
}

// Load expired products from Firestore
async function loadExpiredProducts() {
    try {
        // Ensure user is authenticated
        if (!auth.currentUser) {
            await auth.signInAnonymously();
        }

        const expiredSnapshot = await db.collection('expiry')
            .orderBy('createdAt', 'desc')
            .get();

        if (expiredSnapshot.empty) {
            showEmptyState();
            return;
        }

        let expiredHTML = '';
        expiredSnapshot.forEach(doc => {
            const product = doc.data();
            expiredHTML += createExpiredProductHTML(product, doc.id);
        });

        expiredContainer.innerHTML = expiredHTML;
        loadingContainer.style.display = 'none';
        expiredContainer.style.display = 'grid';
        
        // Update statistics
        updateStats();

    } catch (error) {
        console.error('Error loading expired products:', error);
        loadingContainer.innerHTML = `
            <div style="color: #ff6b6b; text-align: center;">
                <div style="font-size: 2rem; margin-bottom: 10px;">⚠️</div>
                <div>Error loading expired products</div>
                <div style="font-size: 0.9rem; opacity: 0.7; margin-top: 5px;">
                    ${error.message}
                </div>
                <button onclick="loadExpiredProducts()" 
                        style="margin-top: 15px; padding: 10px 20px; background: #ff6b35; 
                               color: white; border: none; border-radius: 8px; cursor: pointer;">
                    Retry
                </button>
            </div>
        `;
    }
}

// Real-time updates (optional)
function setupRealtimeUpdates() {
    db.collection('expiry').onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                // Handle new expired product
                const product = change.doc.data();
                const productHTML = createExpiredProductHTML(product, change.doc.id);
                expiredContainer.insertAdjacentHTML('afterbegin', productHTML);
                updateStats();
            } else if (change.type === 'removed') {
                // Handle deleted product
                const productElement = document.querySelector(`[data-id="${change.doc.id}"]`);
                if (productElement) {
                    productElement.remove();
                    updateStats();
                }
            }
        });
        
        // Show empty state if no products
        if (expiredContainer.children.length === 0) {
            showEmptyState();
        } else {
            emptyState.style.display = 'none';
            expiredContainer.style.display = 'grid';
        }
    });
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    loadExpiredProducts();
    
    // Enable real-time updates after initial load
    setTimeout(() => {
        setupRealtimeUpdates();
    }, 2000);
});