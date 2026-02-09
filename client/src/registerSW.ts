// Helper function to get current version
async function getCurrentVersion(): Promise<string> {
  try {
    const response = await fetch('/version.json');
    const data = await response.json();
    return data.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

// Helper function to wait for controller change
function waitForControllerChange(timeout: number): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;
    
    const handler = () => {
      if (!resolved) {
        resolved = true;
        resolve(true);
      }
    };
    
    navigator.serviceWorker.addEventListener('controllerchange', handler, { once: true });
    
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        navigator.serviceWorker.removeEventListener('controllerchange', handler);
        resolve(false);
      }
    }, timeout);
  });
}

// Show error message to user
function showUpdateError(errorMessage: string) {
  const errorContainer = document.createElement('div');
  errorContainer.style.cssText = `
    position: fixed;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%);
    background: #ef4444;
    color: white;
    padding: 12px 16px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 9999;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 13px;
    max-width: calc(100vw - 40px);
    animation: slideUp 0.3s ease-out;
  `;
  
  errorContainer.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 4px;">Update fehlgeschlagen</div>
    <div style="opacity: 0.9; font-size: 12px;">${errorMessage}</div>
    <div style="margin-top: 8px; font-size: 11px; opacity: 0.8;">Bitte Browser-Console (F12) für Details prüfen</div>
  `;
  
  document.body.appendChild(errorContainer);
  
  setTimeout(() => {
    errorContainer.remove();
  }, 8000);
}

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
      left: 50%;
      transform: translateX(-50%);
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
      max-width: calc(100vw - 40px);
      width: 400px;
      animation: slideUp 0.3s ease-out;
    `;
    
    // Responsive adjustments for mobile
    if (window.innerWidth < 640) {
      container.style.flexDirection = 'column';
      container.style.alignItems = 'stretch';
      container.style.padding = '12px 16px';
      container.style.fontSize = '13px';
      container.style.width = 'calc(100vw - 40px)';
    }
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideUp {
        from {
          transform: translateX(-50%) translateY(100px);
          opacity: 0;
        }
        to {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }
      }
      
      @media (max-width: 640px) {
        #sw-update-notification {
          flex-direction: column !important;
          align-items: stretch !important;
          padding: 12px 16px !important;
          font-size: 13px !important;
          width: calc(100vw - 40px) !important;
        }
        
        #sw-update-notification button {
          width: 100%;
          margin-top: 8px;
        }
        
        #sw-update-notification .close-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          margin-top: 0 !important;
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
      padding: 10px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      transition: background 0.2s;
      min-height: 44px;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    `;
    updateBtn.onmouseover = () => {
      updateBtn.style.background = '#2563eb';
    };
    updateBtn.onmouseout = () => {
      updateBtn.style.background = '#3b82f6';
    };
    updateBtn.onclick = async () => {
      console.log('[SW] Update button clicked');
      updateBtn.disabled = true;
      updateBtn.textContent = 'Wird aktualisiert...';
      updateBtn.style.background = '#6b7280';
      
      try {
        // Get current version before update
        const currentVersion = await getCurrentVersion();
        console.log('[SW] Current version:', currentVersion);
        
        // Tell the service worker to skip waiting
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
          console.log('[SW] SKIP_WAITING message sent');
        } else {
          throw new Error('No service worker controller available');
        }
        
        // Wait for controller change (max 10 seconds)
        const updateSuccess = await waitForControllerChange(10000);
        
        if (updateSuccess) {
          console.log('[SW] Update successful, reloading...');
          // Reload will happen automatically via controllerchange event
        } else {
          throw new Error('Update timeout - controller did not change');
        }
      } catch (error) {
        console.error('[SW] Update failed:', error);
        updateBtn.textContent = 'Fehler - Erneut versuchen';
        updateBtn.style.background = '#ef4444';
        updateBtn.disabled = false;
        
        // Show error message
        showUpdateError(error instanceof Error ? error.message : 'Unknown error');
      }
    };
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      background: transparent;
      color: white;
      border: none;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      width: 44px;
      height: 44px;
      line-height: 24px;
      opacity: 0.7;
      transition: opacity 0.2s;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
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
