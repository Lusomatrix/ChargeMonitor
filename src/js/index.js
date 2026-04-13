/**
 * INDEX — Application Initialization & Main Loop
 * 
 * Entry point for the application.
 * Initializes all modules and sets up polling loop.
 */

import { CONFIG } from './config.js';
import { fetchLatestData } from './api.js';
import { updateDashboard, updateStatus, initializeBatterySlider } from './dashboard.js';

/**
 * Initialize application
 */
function initializeApp() {
  console.log('🚀 ChargeMonitor initializing...');
  
  // Initialize battery slider controls
  initializeBatterySlider();
  
  // Load mock data initially
  updateDashboard(CONFIG.mockData);
  updateStatus(false, 'Aguardando dados do servidor...');
  
  console.log('✓ Battery slider initialized');
  console.log('✓ Dashboard initialized with mock data');
  
  // Start polling loop
  startPolling();
}

/**
 * Start polling for new data from server
 */
function startPolling() {
  console.log(`📡 Starting data polling (interval: ${CONFIG.updateInterval}ms)`);
  
  // Poll server for data
  setInterval(async () => {
    const data = await fetchLatestData();
    
    if (data) {
      console.log('Data fetched from server:', data);
      updateDashboard(data);
      updateStatus(true, 'Conectado e a receber dados');
    } else {
      // Keep showing last successful data, but update status
      updateStatus(false, 'Aguardando dados do servidor...');
    }
  }, CONFIG.updateInterval);
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// Export for potential external use
export { initializeApp };
