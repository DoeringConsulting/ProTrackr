// Register Service Worker for offline functionality with auto-update
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[SW] Registered successfully:', registration.scope);
          
          // Check for updates every 60 seconds
          setInterval(() => {
            registration.update();
          }, 60000);
          
          // Listen for messages from Service Worker
          navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'SW_UPDATED') {
              console.log('[SW] New version available:', event.data.version);
              showUpdateNotification(event.data.version);
            }
          });
          
          // Check for updates on registration
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New service worker available
                  console.log('[SW] New version installed, waiting for activation');
                }
              });
            }
          });
          
          // Check for controller change (new SW activated)
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('[SW] Controller changed, reloading page');
            window.location.reload();
          });
        })
        .catch((error) => {
          console.error('[SW] Registration failed:', error);
        });
    });
  }
}

// Show update notification to user
function showUpdateNotification(version: string) {
  // Create notification container if it doesn't exist
  let container = document.getElementById('sw-update-notification');
  if (!container) {
    container = document.createElement('div');
    container.id = 'sw-update-notification';
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #1a1a1a;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 12px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      max-width: 400px;
      animation: slideIn 0.3s ease-out;
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(120%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
    
    // Message
    const message = document.createElement('span');
    message.textContent = `Neue Version verfügbar (${version.substring(0, 8)})`;
    message.style.flex = '1';
    
    // Update button
    const updateBtn = document.createElement('button');
    updateBtn.textContent = 'Jetzt aktualisieren';
    updateBtn.style.cssText = `
      background: #3b82f6;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      transition: background 0.2s;
    `;
    updateBtn.onmouseover = () => {
      updateBtn.style.background = '#2563eb';
    };
    updateBtn.onmouseout = () => {
      updateBtn.style.background = '#3b82f6';
    };
    updateBtn.onclick = () => {
      // Tell the service worker to skip waiting
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      }
      // Reload will happen automatically via controllerchange event
    };
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      background: transparent;
      color: white;
      border: none;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      line-height: 24px;
      opacity: 0.7;
      transition: opacity 0.2s;
    `;
    closeBtn.onmouseover = () => {
      closeBtn.style.opacity = '1';
    };
    closeBtn.onmouseout = () => {
      closeBtn.style.opacity = '0.7';
    };
    closeBtn.onclick = () => {
      container?.remove();
    };
    
    container.appendChild(message);
    container.appendChild(updateBtn);
    container.appendChild(closeBtn);
    document.body.appendChild(container);
  }
}
