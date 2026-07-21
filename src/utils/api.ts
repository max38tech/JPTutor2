/**
 * Detects if the app is running inside a Capacitor native mobile container.
 */
export function isMobileApp(): boolean {
  if (typeof window === 'undefined') return false;

  // Check if we are running under the Capacitor scheme directly
  const isCapacitorScheme = window.location.protocol === 'capacitor:';
  
  // Check if we are served from localhost but in a webview context (Capacitor default)
  const isLocalHostWebView = window.location.hostname === 'localhost' && !window.location.port;
  
  const isAndroidAsset = window.location.pathname.includes('android_asset');

  // If served over standard HTTP/HTTPS on a non-localhost hostname, we are DEFINITELY in a normal mobile browser.
  const isServedFromWeb = 
    window.location.protocol.startsWith('http') && 
    window.location.hostname !== 'localhost' && 
    window.location.hostname !== '127.0.0.1';

  if (isServedFromWeb) {
    return false;
  }

  return (
    isCapacitorScheme ||
    isLocalHostWebView ||
    isAndroidAsset ||
    (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.location.port)
  );
}

/**
 * Returns the custom server URL configured in Settings, or empty string if none set.
 */
function getCustomServerUrl(): string {
  if (typeof window !== 'undefined') {
    try {
      const storedSettings = localStorage.getItem('nihongo_tutor_settings');
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        if (parsed.customServerUrl && parsed.customServerUrl.trim()) {
          const url = parsed.customServerUrl.trim();
          return url.endsWith('/') ? url.slice(0, -1) : url;
        }
      }
    } catch (e) {
      console.error('Error reading customServerUrl from localStorage:', e);
    }
  }
  return '';
}

const HARDCODED_BACKEND_URL = 'https://jp-tutor-backend-638340504989.asia-east1.run.app';

/**
 * Returns the correct base URL for making HTTP requests to the Express server.
 */
export function getServerBaseUrl(): string {
  // Check for custom server URL configured in Settings first
  const customUrl = getCustomServerUrl();
  if (customUrl) return customUrl;

  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http') && window.location.hostname !== 'localhost') {
    return window.location.origin;
  }

  return HARDCODED_BACKEND_URL;
}

/**
 * Returns true if the app is in a state where it needs a server URL configured.
 */
export function isServerConfigured(): boolean {
  return getServerBaseUrl() !== '';
}

/**
 * Returns the correct WebSocket URL for live tutor interaction.
 */
export function getWebSocketBaseUrl(): string {
  const base = getServerBaseUrl();
  if (!base) return '';
  const wsProtocol = base.startsWith('https') ? 'wss:' : 'ws:';
  const host = base.replace(/^https?:\/\//i, '');
  return `${wsProtocol}//${host}`;
}

