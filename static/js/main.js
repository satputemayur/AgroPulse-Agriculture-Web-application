// FILE: static/js/main.js
// CropWise Enhanced Main JavaScript

console.log('🌾 CropWise Platform Loaded Successfully!');

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Enhanced Toast Notification System
function showToast(message, type = 'info', duration = 5000) {
    // Remove any existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Get icon based on type
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    // Get color based on type
    const colors = {
        success: 'linear-gradient(135deg, #4caf50, #45a049)',
        error: 'linear-gradient(135deg, #f44336, #e53935)',
        warning: 'linear-gradient(135deg, #ff9800, #f57c00)',
        info: 'linear-gradient(135deg, #2196F3, #1976D2)'
    };
    
    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    // Style the toast
    Object.assign(toast.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: colors[type] || colors.info,
        color: 'white',
        padding: '16px 24px',
        borderRadius: '12px',
        zIndex: '9999',
        boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
        minWidth: '300px',
        maxWidth: '450px',
        animation: 'slideInRight 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
    });
    
    // Style toast content
    const toastContent = toast.querySelector('.toast-content');
    Object.assign(toastContent.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
    });
    
    // Style icon
    const toastIcon = toast.querySelector('.toast-icon');
    Object.assign(toastIcon.style, {
        fontSize: '1.5rem',
        flexShrink: '0'
    });
    
    // Style message
    const toastMessage = toast.querySelector('.toast-message');
    Object.assign(toastMessage.style, {
        flex: '1',
        fontSize: '0.95rem',
        fontWeight: '500',
        lineHeight: '1.4'
    });
    
    // Style close button
    const closeBtn = toast.querySelector('.toast-close');
    Object.assign(closeBtn.style, {
        background: 'rgba(255,255,255,0.2)',
        border: 'none',
        color: 'white',
        fontSize: '1.5rem',
        cursor: 'pointer',
        borderRadius: '50%',
        width: '28px',
        height: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: '0',
        transition: 'background 0.3s'
    });
    
    closeBtn.addEventListener('mouseover', () => {
        closeBtn.style.background = 'rgba(255,255,255,0.3)';
    });
    
    closeBtn.addEventListener('mouseout', () => {
        closeBtn.style.background = 'rgba(255,255,255,0.2)';
    });
    
    // Add to page
    document.body.appendChild(toast);
    
    // Progress bar
    const progressBar = document.createElement('div');
    Object.assign(progressBar.style, {
        position: 'absolute',
        bottom: '0',
        left: '0',
        height: '4px',
        background: 'rgba(255,255,255,0.5)',
        borderRadius: '0 0 12px 12px',
        animation: `toastProgress ${duration}ms linear`
    });
    toast.appendChild(progressBar);
    
    // Auto remove after duration
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'slideOutRight 0.4s ease-in';
            setTimeout(() => toast.remove(), 400);
        }
    }, duration);
}

// Add CSS animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(120%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(120%);
            opacity: 0;
        }
    }
    
    @keyframes toastProgress {
        from {
            width: 100%;
        }
        to {
            width: 0%;
        }
    }
`;
document.head.appendChild(styleSheet);

// Fetch API Helper with Loading State
async function fetchAPI(url, options = {}) {
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
        
    } catch (error) {
        console.error('API Error:', error);
        showToast('Network error. Please check your connection.', 'error');
        return { success: false, error: error.message };
    }
}

// Page visibility change handler
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        console.log('🌙 Page is now hidden');
    } else {
        console.log('☀️ Welcome back to CropWise!');
    }
});

// Network status monitoring
window.addEventListener('online', function() {
    showToast('🌐 Connection restored!', 'success', 3000);
});

window.addEventListener('offline', function() {
    showToast('📡 No internet connection', 'error', 5000);
});

// Add loading class to body when page loads
document.addEventListener('DOMContentLoaded', function() {
    document.body.classList.add('loaded');
    
    // Add animation to all cards
    const cards = document.querySelectorAll('.card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        
        setTimeout(() => {
            card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 100);
    });
});

// Scroll to top button
const scrollButton = document.createElement('button');
scrollButton.innerHTML = '↑';
scrollButton.className = 'scroll-to-top';
Object.assign(scrollButton.style, {
    position: 'fixed',
    bottom: '30px',
    right: '30px',
    width: '55px',
    height: '55px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #2e7d32, #4caf50)',
    color: 'white',
    border: 'none',
    fontSize: '1.5rem',
    cursor: 'pointer',
    opacity: '0',
    visibility: 'hidden',
    transition: 'all 0.3s',
    boxShadow: '0 4px 15px rgba(46, 125, 50, 0.4)',
    zIndex: '1000',
    fontWeight: 'bold'
});

document.body.appendChild(scrollButton);

// Show/hide scroll button
window.addEventListener('scroll', function() {
    if (window.pageYOffset > 300) {
        scrollButton.style.opacity = '1';
        scrollButton.style.visibility = 'visible';
    } else {
        scrollButton.style.opacity = '0';
        scrollButton.style.visibility = 'hidden';
    }
});

// Scroll to top on click
scrollButton.addEventListener('click', function() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});

// Hover effect
scrollButton.addEventListener('mouseover', function() {
    this.style.transform = 'scale(1.1) translateY(-5px)';
    this.style.boxShadow = '0 6px 25px rgba(46, 125, 50, 0.6)';
});

scrollButton.addEventListener('mouseout', function() {
    this.style.transform = 'scale(1) translateY(0)';
    this.style.boxShadow = '0 4px 15px rgba(46, 125, 50, 0.4)';
});

// Keyboard accessibility
scrollButton.setAttribute('aria-label', 'Scroll to top');
scrollButton.setAttribute('title', 'Back to top');

// Log load time
window.addEventListener('load', function() {
    const loadTime = (performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart) / 1000;
    console.log(`⚡ Page loaded in ${loadTime.toFixed(2)} seconds`);
});

// Export utility functions
window.CropWise = {
    showToast,
    fetchAPI
};

console.log('✅ CropWise utilities ready!');