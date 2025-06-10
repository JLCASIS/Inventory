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

// Cloudinary configuration
const cloudinaryConfig = {
    cloudName: 'duxuactri',
    uploadPreset: 'product_upload',
    sources: ['local', 'url', 'camera'],
    multiple: false,
    clientAllowedFormats: ['jpg', 'png', 'jpeg', 'gif'],
    maxImageFileSize: 5000000 // 5MB
};

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

// Form state
let formState = {
    category: null,
    imageUrl: null,
    imagePublicId: null,
    productName: '',
    quantity: 0,
    storageDate: '',
    expiryDate: ''
};

// Event Listeners
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
    // Get form values
    formState.productName = document.getElementById('productName').value;
    formState.quantity = document.getElementById('productQuantity').value;
    formState.storageDate = document.getElementById('storageDate').value;
    formState.expiryDate = document.getElementById('expiryDate').value;
    
    // Validate
    if (!formState.productName || !formState.quantity || !formState.storageDate || !formState.expiryDate) {
        alert('Please fill all fields');
        return;
    }
    
    try {
        // Show loading state
        submitProduct.disabled = true;
        submitProduct.textContent = 'Saving...';
        
        // Wait for anonymous authentication if needed
        if (!auth.currentUser) {
            await auth.signInAnonymously();
        }
        
        // Create a sanitized category ID (replace spaces and special characters)
        const categoryId = formState.category.toLowerCase().replace(/[^a-z0-9]/g, '_');
        
        // Save to Firestore with category-based subcollection
        const productData = {
            name: formState.productName,
            quantity: parseInt(formState.quantity),
            storageDate: formState.storageDate,
            expiryDate: formState.expiryDate,
            imageUrl: formState.imageUrl,
            imagePublicId: formState.imagePublicId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Add to both the main products collection and the category subcollection
        const batch = db.batch();
        
        // Add to main products collection
        const productRef = db.collection('products').doc();
        batch.set(productRef, {
            ...productData,
            category: formState.category,
            categoryId: categoryId
        });
        
        // Add to category subcollection
        const categoryProductRef = db.collection('categories').doc(categoryId)
            .collection('products').doc(productRef.id);
        batch.set(categoryProductRef, productData);
        
        // Commit the batch write
        await batch.commit();
        
        alert('Product added successfully!');
        popupOverlay.style.display = 'none';
    } catch (error) {
        console.error('Error adding product:', error);
        alert(`Error adding product: ${error.message}`);
    } finally {
        submitProduct.disabled = false;
        submitProduct.textContent = 'Add Product';
    }
});

// Category selection
document.querySelectorAll('.category-option').forEach(option => {
    option.addEventListener('click', () => {
        document.querySelectorAll('.category-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        option.classList.add('selected');
        formState.category = option.getAttribute('data-category');
    });
});

// Helper functions
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