// Firebase Configuration
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

// DOM Elements
const loadingSpinner = document.getElementById('loadingSpinner');
const errorMessage = document.getElementById('errorMessage');
const productsContainer = document.getElementById('productsContainer');
const emptyState = document.getElementById('emptyState');

// Load expired products when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadExpiredProducts();
});

// Function to load expired products from Firestore
async function loadExpiredProducts() {
    try {
        showLoading();
        
        // Get today's date in YYYY-MM-DD format for comparison
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        // Query the expiry collection for expired products
        const snapshot = await db.collection('expiry')
            .where('expiryDate', '<=', todayStr)
            .orderBy('expiryDate', 'desc')
            .get();
        
        hideLoading();
        
        if (snapshot.empty) {
            showEmptyState();
            return;
        }
        
        const products = [];
        snapshot.forEach(doc => {
            products.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        displayProducts(products);
        
    } catch (error) {
        console.error('Error loading expired products:', error);
        hideLoading();
        showError();
    }
}

// Function to display products
function displayProducts(products) {
    productsContainer.innerHTML = '';
    
    products.forEach(product => {
        const productElement = createProductElement(product);
        productsContainer.appendChild(productElement);
    });
    
    // Add staggered animation
    const productItems = document.querySelectorAll('.product-item');
    productItems.forEach((item, index) => {
        item.style.animationDelay = `${index * 0.1}s`;
    });
}

// Function to create product element
function createProductElement(product) {
    const productDiv = document.createElement('div');
    productDiv.className = 'product-item';
    productDiv.setAttribute('data-id', product.id);
    
    // Calculate days expired
    const today = new Date();
    const expiryDate = new Date(product.expiryDate);
    const daysExpired = Math.floor((today - expiryDate) / (1000 * 60 * 60 * 24));
    
    // Create image element
    const imageElement = createImageElement(product);
    
    // Create product info
    const productInfo = document.createElement('div');
    productInfo.className = 'product-info';
    
    const productName = document.createElement('div');
    productName.className = 'product-name';
    productName.textContent = product.name || product.productName || 'Unknown Product';
    
    const productDetails = document.createElement('div');
    productDetails.className = 'product-details';
    
    // Add product details
    if (product.category) {
        const categoryDetail = createDetailElement('fas fa-tag', 'Category', product.category);
        productDetails.appendChild(categoryDetail);
    }
    
    if (product.quantity) {
        const quantityDetail = createDetailElement('fas fa-boxes', 'Quantity', product.quantity);
        productDetails.appendChild(quantityDetail);
    }
    
    const expiryDetail = createDetailElement('fas fa-calendar-times', 'Expired', formatDate(expiryDate));
    expiryDetail.querySelector('.expired-date').classList.add('expired-date');
    productDetails.appendChild(expiryDetail);
    
    productInfo.appendChild(productName);
    productInfo.appendChild(productDetails);
    
    // Create actions
    const productActions = document.createElement('div');
    productActions.className = 'product-actions';
    
    const daysExpiredElement = document.createElement('div');
    daysExpiredElement.className = 'days-expired';
    daysExpiredElement.textContent = `${daysExpired}d`;
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.title = 'Delete expired product';
    deleteBtn.onclick = () => deleteProduct(product.id, productDiv);
    
    productActions.appendChild(daysExpiredElement);
    productActions.appendChild(deleteBtn);
    
    // Assemble product element
    productDiv.appendChild(imageElement);
    productDiv.appendChild(productInfo);
    productDiv.appendChild(productActions);
    
    return productDiv;
}

// Function to create image element
function createImageElement(product) {
    if (product.imageUrl || product.cloudinaryUrl) {
        const img = document.createElement('img');
        img.className = 'product-image';
        img.src = product.imageUrl || product.cloudinaryUrl;
        img.alt = product.name || 'Product image';
        img.onerror = function() {
            this.style.display = 'none';
            const placeholder = createImagePlaceholder();
            this.parentNode.insertBefore(placeholder, this);
        };
        return img;
    } else {
        return createImagePlaceholder();
    }
}

// Function to create image placeholder
function createImagePlaceholder() {
    const placeholder = document.createElement('div');
    placeholder.className = 'image-placeholder';
    placeholder.innerHTML = '<i class="fas fa-image"></i>';
    return placeholder;
}

// Function to create detail element
function createDetailElement(iconClass, label, value) {
    const detail = document.createElement('div');
    detail.className = 'product-detail';
    
    const icon = document.createElement('i');
    icon.className = iconClass;
    
    const text = document.createElement('span');
    text.className = label.toLowerCase() === 'expired' ? 'expired-date' : '';
    text.textContent = `${label}: ${value}`;
    
    detail.appendChild(icon);
    detail.appendChild(text);
    
    return detail;
}

// Function to format date
function formatDate(date) {
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Function to delete product
async function deleteProduct(productId, productElement) {
    if (!confirm('Are you sure you want to delete this expired product?')) {
        return;
    }
    
    try {
        // Add loading state to delete button
        const deleteBtn = productElement.querySelector('.delete-btn');
        const originalContent = deleteBtn.innerHTML;
        deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        deleteBtn.disabled = true;
        
        // Delete from Firestore
        await db.collection('expiry').doc(productId).delete();
        
        // Remove from DOM with animation
        productElement.style.transform = 'translateX(-100%)';
        productElement.style.opacity = '0';
        
        setTimeout(() => {
            productElement.remove();
            
            // Check if no products left
            if (productsContainer.children.length === 0) {
                showEmptyState();
            }
        }, 300);
        
    } catch (error) {
        console.error('Error deleting product:', error);
        
        // Restore delete button
        const deleteBtn = productElement.querySelector('.delete-btn');
        deleteBtn.innerHTML = originalContent;
        deleteBtn.disabled = false;
        
        alert('Failed to delete product. Please try again.');
    }
}

// UI State Management Functions
function showLoading() {
    loadingSpinner.style.display = 'block';
    errorMessage.style.display = 'none';
    productsContainer.style.display = 'none';
    emptyState.style.display = 'none';
}

function hideLoading() {
    loadingSpinner.style.display = 'none';
}

function showError() {
    errorMessage.style.display = 'block';
    productsContainer.style.display = 'none';
    emptyState.style.display = 'none';
}

function showEmptyState() {
    emptyState.style.display = 'block';
    productsContainer.style.display = 'none';
    errorMessage.style.display = 'none';
}

// Real-time updates listener
function setupRealtimeListener() {
    const todayStr = new Date().toISOString().split('T')[0];
    
    db.collection('expiry')
        .where('expiryDate', '<=', todayStr)
        .onSnapshot((snapshot) => {
            if (!snapshot.empty) {
                const products = [];
                snapshot.forEach(doc => {
                    products.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                
                // Sort by expiry date (most recently expired first)
                products.sort((a, b) => {
                    return new Date(b.expiryDate) - new Date(a.expiryDate);
                });
                
                displayProducts(products);
                productsContainer.style.display = 'grid';
                emptyState.style.display = 'none';
            } else {
                showEmptyState();
            }
        }, (error) => {
            console.error('Error in real-time listener:', error);
        });
}

// Initialize real-time listener after initial load
setTimeout(() => {
    setupRealtimeListener();
}, 2000);

// Utility function to refresh the page data
function refreshData() {
    loadExpiredProducts();
}

// Add refresh functionality (optional)
document.addEventListener('keydown', function(e) {
    if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
        e.preventDefault();
        refreshData();
    }
});