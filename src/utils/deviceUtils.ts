// Enhanced device detection utilities with better mobile detection
export const isMobile = (): boolean => {
    if (typeof window === 'undefined') return false;
    
    // Check user agent first
    const userAgent = navigator.userAgent || navigator.vendor;
    const isMobileUserAgent = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(userAgent);
    
    // Check viewport and touch capabilities
    const hasTouch = 'ontouchstart' in window || 
                    navigator.maxTouchPoints > 0 || 
                    (navigator as any).msMaxTouchPoints > 0;
    
    const isSmallScreen = window.innerWidth <= 768;
    
    // Consider it mobile if either user agent or small screen with touch
    return isMobileUserAgent || (hasTouch && isSmallScreen);
};

export const isTablet = (): boolean => {
    if (typeof window === 'undefined') return false;
    
    const userAgent = navigator.userAgent || navigator.vendor;
    const isTabletUserAgent = /(ipad|tablet|playbook|silk)|(android(?!.*mobile))/i.test(userAgent);
    
    const hasTouch = 'ontouchstart' in window || 
                    navigator.maxTouchPoints > 0 || 
                    (navigator as any).msMaxTouchPoints > 0;
    
    const isTabletSize = window.innerWidth > 768 && window.innerWidth <= 1024;
    
    return isTabletUserAgent || (hasTouch && isTabletSize);
};

export const isTouchDevice = (): boolean => {
    if (typeof window === 'undefined') return false;
    
    return 'ontouchstart' in window || 
           navigator.maxTouchPoints > 0 || 
           ((navigator as any).msMaxTouchPoints > 0);
};

// Viewport dimensions utilities
export const getViewportSize = () => ({
    width: Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0),
    height: Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)
});

// Initialize mobile styles and apply device classes
export const initMobileStyles = (): (() => void) => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return () => {};
    
    const body = document.body;
    
    // Remove any existing device classes
    body.classList.remove('is-mobile', 'is-tablet', 'is-touch-device');
    
    // Set CSS custom properties for device type
    const mobile = isMobile();
    const tablet = isTablet();
    const touch = isTouchDevice();
    
    // Add appropriate classes
    if (mobile) body.classList.add('is-mobile');
    if (tablet) body.classList.add('is-tablet');
    if (touch) body.classList.add('is-touch-device');
    
    // Set viewport meta tag for mobile devices
    if (mobile || tablet) {
        let viewportMeta = document.querySelector('meta[name="viewport"]');
        if (!viewportMeta) {
            viewportMeta = document.createElement('meta');
            viewportMeta.setAttribute('name', 'viewport');
            document.head.appendChild(viewportMeta);
        }
        viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
    }
    
    // Add a class for iOS devices
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                 (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS) {
        body.classList.add('is-ios');
    }
    
    // Add a class for Android devices
    if (/android/i.test(navigator.userAgent)) {
        body.classList.add('is-android');
    }
    
    // Handle orientation changes
    const updateOrientation = () => {
        const isPortrait = window.innerHeight > window.innerWidth;
        body.classList.toggle('is-portrait', isPortrait);
        body.classList.toggle('is-landscape', !isPortrait);
    };
    
    // Initial orientation check
    updateOrientation();
    
    // Listen for orientation changes
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);
    
    // Cleanup function
    return () => {
        window.removeEventListener('resize', updateOrientation);
        window.removeEventListener('orientationchange', updateOrientation);
    };
    
    // Initial orientation setup
    updateOrientation();
    
    // Update on orientation change
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);
};

// Check if the device is in portrait mode
export const isPortrait = (): boolean => {
    return typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
};

// Check if the device is in landscape mode
export const isLandscape = (): boolean => {
    return typeof window !== 'undefined' && window.innerWidth >= window.innerHeight;
};
