// Initialize Firebase with your config
const firebaseConfig = {
  apiKey: "AIzaSyAK1k03ZF97KyeKuIRcALaGLYk5ZQgYm1o",
  authDomain: "inventory-system-51c3c.firebaseapp.com",
  projectId: "inventory-system-51c3c",
  storageBucket: "inventory-system-51c3c.appspot.com",
  messagingSenderId: "1074026861787",
  appId: "1:1074026861787:web:9ad11d64c8ed1e20ea28fe",
  measurementId: "G-3YRGTX05CB"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

const cloudinaryConfig = {
    cloudName: 'duxuactri',
    uploadPreset: 'product_upload',
    sources: ['local', 'url', 'camera'],
    multiple: false,
    clientAllowedFormats: ['jpg', 'png', 'jpeg', 'gif'],
    maxImageFileSize: 5000000
};

const allCategories = [
    'grains', 'dryfruits', 'fruits', 'dairy', 'meats',
    'spices', 'sauces', 'greens', 'oils', 'eggs'
];

// DOM Elements
const addButton = document.querySelector('.add-button');
const popupOverlay = document.getElementById('popupOverlay');
const closePopup = document.getElementById('closePopup');
const step1Next = document.getElementById('step1Next');
const step2Back = document.getElementById('step2Back');
const step2Next = document.getElementById('step2Next');
const step3Back = document.getElementById('step3Back');
const submitProduct = document.getElementById('submitProduct');
const uploadBtn = document.getElementById('uploadBtn');
const imagePreview = document.getElementById('imagePreview');
const previewImage = document.getElementById('previewImage');
const uploadText = document.getElementById('uploadText');
const productsContainer = document.getElementById('productsContainer');
const searchBar = document.querySelector('.search-bar');
const notificationIcon = document.getElementById('notificationIcon');
const notificationBadge = document.getElementById('notificationBadge');
const notificationDropdown = document.getElementById('notificationDropdown');
const notificationList = document.getElementById('notificationList');
const closeNotifications = document.getElementById('closeNotifications');
const clearNotifications = document.getElementById('clearNotifications');

let formState = {
    category: null,
    imageUrl: null,
    imagePublicId: null,
    productName: '',
    quantity: 0,
    storageDate: '',
    expiryDate: ''
};

let notifications = [];
let unsubscribeExpiryListener = null;
let unsubscribeLowStockListener = null;
let allProducts = [];

function calculateDaysUntilExpiry(storageDate, expiryDate) {
    const storage = new Date(storageDate);
    const expiry = new Date(expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    const timeDiff = expiry.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    return daysDiff;
}

function isProductExpiredOrExpiring(storageDate, expiryDate) {
    const daysUntilExpiry = calculateDaysUntilExpiry(storageDate, expiryDate);
    const today = new Date();
    const expiry = new Date(expiryDate);
    return expiry < today || daysUntilExpiry <= 0;
}

function formatTime(timestamp) {
    if (!timestamp) return 'Just now';
    const now = new Date();
    const date = timestamp.toDate();
    const diffInSeconds = Math.floor((now - date) / 1000);
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

function renderProducts(products) {
    if (!productsContainer) return;
    productsContainer.innerHTML = '';
    if (products.length === 0) {
        productsContainer.innerHTML = '<div class="empty-state">No products found.</div>';
        return;
    }
    products.forEach(product => {
        const div = document.createElement('div');
        div.className = 'product-item';
        div.innerHTML = `
            <img src="${product.imageUrl || 'https://via.placeholder.com/80'}" alt="${product.name}">
            <div><b>${product.name}</b></div>
            <div>Category: ${product.category || product.categoryId}</div>
            <div>Quantity: ${product.quantity}</div>
            <div>Expiry: ${product.expiryDate || '-'}</div>
        `;
        productsContainer.appendChild(div);
    });
}

function filterProductsByPrefix(prefix) {
    if (!prefix) {
        renderProducts(allProducts);
        return;
    }
    const lowerPrefix = prefix.toLowerCase();
    const results = allProducts.filter(p =>
        p.name && p.name.toLowerCase().startsWith(lowerPrefix)
    );
    renderProducts(results);
}

if (searchBar) {
    searchBar.addEventListener('input', function() {
        filterProductsByPrefix(this.value);
    });
}

async function loadAllProducts() {
    allProducts = [];
    for (const categoryId of allCategories) {
        const snapshot = await db.collection('categories').doc(categoryId)
            .collection('products').get();
        snapshot.forEach(doc => {
            const data = doc.data();
            allProducts.push({ ...data, id: doc.id, categoryId });
        });
    }
    renderProducts(allProducts);
}

function updateNotifications() {
    const unreadCount = notifications.filter(n => !n.isRead).length;
    notificationBadge.textContent = unreadCount;
    notificationBadge.style.display = unreadCount > 0 ? 'block' : 'none';
    notificationList.innerHTML = '';
    if (notifications.length === 0) {
        notificationList.innerHTML = '<div class="no-notifications">No notifications available</div>';
        return;
    }
    notifications.forEach(notification => {
        const notificationItem = document.createElement('div');
        notificationItem.className = `notification-item ${notification.isRead ? '' : 'unread'}`;
        if (notification.priority) {
            notificationItem.classList.add(`priority-${notification.priority}`);
        }
        let icon = 'ℹ️';
        if (notification.type === 'warning') icon = '⚠️';
        if (notification.type === 'danger') icon = '❗';
        if (notification.type === 'success') icon = '✅';
        let notificationContent = '';
        if (notification.title === 'Low Stock Alert') {
            notificationContent = `
                <div class="notification-content">
                    <div class="notification-header">
                        <span class="notification-icon">${icon}</span>
                        <span class="notification-title">${notification.title}</span>
                    </div>
                    <div class="notification-body">
                        <div class="notification-message">
                            Message: ${notification.productName} has only ${notification.quantity} pieces left and will reach out of stock soon.
                        </div>
                        <div class="notification-category">
                            Categories: ${notification.category}
                        </div>
                    </div>
                    <div class="notification-time">${formatTime(notification.createdAt || notification.timestamp)}</div>
                </div>
            `;
        } else if (notification.title && notification.title.includes('Expiring Soon')) {
            notificationContent = `
                <div class="notification-content">
                    <div class="notification-header">
                        <span class="notification-icon">${icon}</span>
                        <span class="notification-title">${notification.title}</span>
                    </div>
                    <div class="notification-body">
                        <div class="notification-message">
                            ${notification.message}
                        </div>
                        <div class="notification-category">
                            Categories: ${notification.category}
                        </div>
                    </div>
                    <div class="notification-time">${formatTime(notification.createdAt || notification.timestamp)}</div>
                </div>
            `;
        } else {
            notificationContent = `
                <div class="notification-content">
                    <div class="notification-header">
                        <span class="notification-icon">${icon}</span>
                        <span class="notification-title">${notification.title}</span>
                    </div>
                    <div class="notification-body">
                        <div class="notification-message">
                            ${notification.message}
                        </div>
                        ${notification.category ? `
                        <div class="notification-category">
                            Categories: ${notification.category}
                        </div>
                        ` : ''}
                    </div>
                    <div class="notification-time">${formatTime(notification.createdAt || notification.timestamp)}</div>
                </div>
            `;
        }
        notificationItem.innerHTML = notificationContent;
        notificationItem.addEventListener('click', () => {
            if (!notification.isRead && notification.id) {
                db.collection('notifications').doc(notification.id).update({ 
                    isRead: true 
                });
            }
        });
        notificationList.appendChild(notificationItem);
    });
}

function addNotification(title, message, type = 'info', additionalData = {}) {
    const icons = {
        warning: '⚠️',
        danger: '❗',
        info: 'ℹ️',
        success: '✅'
    };
    // Defensive: do not include productId if undefined
    let payload = {
        title,
        message,
        icon: icons[type] || 'ℹ️',
        isRead: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        type,
        priority: type === 'danger' ? 'high' : 'medium',
        ...additionalData
    };
    if (payload.productId === undefined) {
        delete payload.productId;
    }
    return db.collection('notifications').add(payload);
}

function setupNotificationListeners() {
    // Listen for all active products and filter in memory
    unsubscribeExpiryListener = db.collection('products')
        .where('status', '==', 'active')
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added' || change.type === 'modified') {
                    const product = change.doc.data();
                    // Check for expiring products
                    if (product.daysUntilExpiry !== undefined && product.daysUntilExpiry <= 3) {
                        const title = `Expiring Soon: ${product.name}`;
                        const message = `${product.name} will expire in ${product.daysUntilExpiry} day${product.daysUntilExpiry !== 1 ? 's' : ''}`;
                        const exists = notifications.some(n =>
                            n.title.includes(product.name) && !n.isRead && n.type === 'warning');
                        if (!exists) {
                            addNotification(
                                title,
                                message,
                                'warning',
                                {
                                    category: product.category,
                                    productId: product.id,
                                    productName: product.name,
                                    quantity: product.quantity
                                }
                            );
                        }
                    }
                    // Check for low stock
                    if (product.quantity !== undefined && product.quantity <= 3) {
                        const title = `Low Stock Alert`;
                        const message = `${product.name} has only ${product.quantity} pieces left and will reach out of stock soon.`;
                        const exists = notifications.some(n =>
                            n.title === title && n.productId === product.id && !n.isRead
                        );
                        if (!exists) {
                            addNotification(
                                title,
                                message,
                                'danger',
                                {
                                    category: product.category,
                                    productId: product.id,
                                    productName: product.name,
                                    quantity: product.quantity,
                                    priority: 'high'
                                }
                            );
                        }
                    }
                }
            });
        });

    db.collection('notifications')
        .orderBy('createdAt', 'desc')
        .limit(20)
        .onSnapshot(snapshot => {
            notifications = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            updateNotifications();
        });
}

function clearAllNotifications() {
    const batch = db.batch();
    notifications.forEach(notification => {
        if (!notification.isRead && notification.id) {
            const ref = db.collection('notifications').doc(notification.id);
            batch.update(ref, { isRead: true });
        }
    });
    return batch.commit();
}

notificationIcon.addEventListener('click', (e) => {
    e.stopPropagation();
    notificationDropdown.style.display = notificationDropdown.style.display === 'block' ? 'none' : 'block';
});
closeNotifications.addEventListener('click', () => {
    notificationDropdown.style.display = 'none';
});
clearNotifications.addEventListener('click', async () => {
    try {
        await clearAllNotifications();
    } catch (error) {
        console.error('Error clearing notifications:', error);
        alert('Failed to clear notifications');
    }
});
document.addEventListener('click', (e) => {
    if (!notificationDropdown.contains(e.target) && e.target !== notificationIcon) {
        notificationDropdown.style.display = 'none';
    }
});

addButton.addEventListener('click', () => {
    popupOverlay.style.display = 'flex';
    resetForm();
    showStep('step1');
});
closePopup.addEventListener('click', () => {
    popupOverlay.style.display = 'none';
});
step1Next.addEventListener('click', () => {
    if (!formState.category) {
        alert('Please select a category');
        return;
    }
    showStep('step2');
});
step2Back.addEventListener('click', () => {
    showStep('step1');
});
step2Next.addEventListener('click', () => {
    if (!formState.imageUrl) {
        alert('Please upload an image');
        return;
    }
    showStep('step3');
});
step3Back.addEventListener('click', () => {
    showStep('step2');
});
uploadBtn.addEventListener('click', () => {
    cloudinary.openUploadWidget(cloudinaryConfig, (error, result) => {
        if (!error && result && result.event === "success") {
            formState.imageUrl = result.info.secure_url;
            formState.imagePublicId = result.info.public_id;
            previewImage.src = formState.imageUrl;
            previewImage.style.display = 'block';
            uploadText.style.display = 'none';
        } else if (error) {
            console.error('Cloudinary upload error:', error);
            alert('Image upload failed. Please try again.');
        }
    });
});
submitProduct.addEventListener('click', async () => {
    formState.productName = document.getElementById('productName').value;
    formState.quantity = document.getElementById('productQuantity').value;
    formState.storageDate = document.getElementById('storageDate').value;
    formState.expiryDate = document.getElementById('expiryDate').value;
    if (!formState.productName || !formState.quantity || !formState.storageDate || !formState.expiryDate) {
        alert('Please fill all fields');
        return;
    }
    if (new Date(formState.storageDate) > new Date(formState.expiryDate)) {
        alert('Storage date cannot be after expiry date');
        return;
    }
    try {
        submitProduct.disabled = true;
        submitProduct.textContent = 'Saving...';
        if (!auth.currentUser) {
            await auth.signInAnonymously();
        }
        const categoryId = formState.category.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const isExpired = isProductExpiredOrExpiring(formState.storageDate, formState.expiryDate);
        const daysUntilExpiry = calculateDaysUntilExpiry(formState.storageDate, formState.expiryDate);
        const productData = {
            name: formState.productName,
            quantity: parseInt(formState.quantity),
            storageDate: formState.storageDate,
            expiryDate: formState.expiryDate,
            imageUrl: formState.imageUrl,
            imagePublicId: formState.imagePublicId,
            category: formState.category,
            categoryId: categoryId,
            daysUntilExpiry: daysUntilExpiry,
            isExpired: isExpired,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        const batch = db.batch();
        if (isExpired) {
            const expiryRef = db.collection('expiry').doc();
            batch.set(expiryRef, {
                ...productData,
                expiredAt: firebase.firestore.FieldValue.serverTimestamp(),
                reason: daysUntilExpiry < 0 ? 'Already expired' : 'Expires today or tomorrow'
            });
            const productRef = db.collection('products').doc();
            batch.set(productRef, {
                ...productData,
                status: 'expired',
                expiredAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await addNotification(
                'Expired Product',
                `${formState.productName} was added as expired (${daysUntilExpiry} days left)`,
                'danger',
                {
                    category: formState.category,
                    productName: formState.productName,
                    quantity: formState.quantity
                }
            );
            alert(`Product is expired or expiring (${daysUntilExpiry} days left). It has been moved to the expiry collection.`);
        } else {
            const productRef = db.collection('products').doc();
            batch.set(productRef, {
                ...productData,
                status: 'active'
            });
            const categoryProductRef = db.collection('categories').doc(categoryId)
                .collection('products').doc(productRef.id);
            batch.set(categoryProductRef, productData);
            if (productData.quantity <= 3) {
                await addNotification(
                    'Low Stock Alert',
                    `${formState.productName} has only ${productData.quantity} pieces left and will reach out of stock soon.`,
                    'danger',
                    {
                        category: formState.category,
                        productName: formState.productName,
                        quantity: productData.quantity,
                        priority: 'high'
                    }
                );
            }
            alert(`Product added successfully! Days until expiry: ${daysUntilExpiry}`);
        }
        await batch.commit();
        popupOverlay.style.display = 'none';
        await loadAllProducts();
    } catch (error) {
        console.error('Error adding product:', error);
        alert(`Error adding product: ${error.message}`);
    } finally {
        submitProduct.disabled = false;
        submitProduct.textContent = 'Add Product';
    }
});
document.querySelectorAll('.category-option').forEach(option => {
    option.addEventListener('click', () => {
        document.querySelectorAll('.category-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        option.classList.add('selected');
        formState.category = option.getAttribute('data-category');
    });
});
function showStep(stepId) {
    document.querySelectorAll('.form-step').forEach(step => {
        step.classList.remove('active');
    });
    document.getElementById(stepId).classList.add('active');
}
function resetForm() {
    formState = {
        category: null,
        imageUrl: null,
        imagePublicId: null,
        productName: '',
        quantity: 0,
        storageDate: '',
        expiryDate: ''
    };
    document.querySelectorAll('.category-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    document.getElementById('productName').value = '';
    document.getElementById('productQuantity').value = '';
    document.getElementById('storageDate').value = '';
    document.getElementById('expiryDate').value = '';
    previewImage.src = '';
    previewImage.style.display = 'none';
    uploadText.style.display = 'block';
}
function initApp() {
    auth.signInAnonymously().catch(error => {
        console.error('Anonymous auth failed:', error);
    });
    setupNotificationListeners();
    loadAllProducts();
}
document.addEventListener('DOMContentLoaded', initApp);