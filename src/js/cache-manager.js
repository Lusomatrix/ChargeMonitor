/**
 * Cache & Fallback Manager
 * 
 * Gerencia o display de dados com fallback para cache
 * quando o sensor está inativo.
 * 
 * Uso: import { CacheManager } from './cache-manager.js'
 *      const cache = new CacheManager();
 *      cache.init();
 */

export class CacheManager {
  constructor(config = {}) {
    this.enableDebug = config.debug || false;
    this.inactivityThresholdMinutes = config.inactivityThreshold || 5; // minutos
    this.updateIntervalSeconds = config.updateInterval || 30; // segundos
    this.retryAttempts = config.retryAttempts || 3;
    
    // URL base - detectar automaticamente
    this.baseUrl = this.getBaseUrl();
    
    this.currentData = null;
    this.lastHealthCheck = null;
    this.isInactive = false;
    this.updateTimer = null;
  }

  /**
   * Get base URL dynamically
   */
  getBaseUrl() {
    const protocol = window.location.protocol; // http: ou https:
    const host = window.location.host;         // localhost:3000 ou 192.168.5.171:3000
    return `${protocol}//${host}`;
  }

  /**
   * Build full URL with base
   */
  makeUrl(endpoint) {
    return `${this.baseUrl}${endpoint}`;
  }

  /**
   * Initialize the cache manager
   */
  async init() {
    this.log('🚀 Cache Manager inicializado');
    await this.fetchAndUpdate();
    
    // Poll for updates
    this.updateTimer = setInterval(() => {
      this.fetchAndUpdate();
    }, this.updateIntervalSeconds * 1000);
  }

  /**
   * Fetch latest data and check health
   */
  async fetchAndUpdate() {
    try {
      // Fetch latest data
      const response = await fetch(this.makeUrl('/latest-data'));
      if (!response.ok && response.status !== 204) {
        throw new Error(`HTTP ${response.status}`);
      }

      if (response.status === 204) {
        this.currentData = null;
        this.log('⏳ Aguardando primeiro dado do sensor...');
        return;
      }

      const data = await response.json();
      this.currentData = data;
      this.log('✓ Dados atualizados:', data);

      // Check health status
      await this.checkHealth();

      // Trigger custom event
      window.dispatchEvent(new CustomEvent('dataUpdated', {
        detail: {
          data: this.currentData,
          isFromCache: this.isInactive,
          minutesSinceUpdate: this.lastHealthCheck?.minutesSinceLastUpdate
        }
      }));

    } catch (error) {
      this.log('❌ Erro ao buscar dados:', error.message);
      // Continues with last cached data
    }
  }

  /**
   * Check sensor health status
   */
  async checkHealth() {
    try {
      const response = await fetch(this.makeUrl('/health'));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      this.lastHealthCheck = await response.json();

      // Check if sensor is inactive
      const minutesSince = this.lastHealthCheck.minutesSinceLastUpdate;
      const wasInactive = this.isInactive;

      if (minutesSince !== null && minutesSince > this.inactivityThresholdMinutes) {
        this.isInactive = true;
        
        if (!wasInactive) {
          // Just became inactive
          this.log(`⚠️ Sensor inativo há ${minutesSince} minutos!`);
          window.dispatchEvent(new CustomEvent('sensorInactive', {
            detail: { minutesSince, lastUpdate: this.lastHealthCheck.lastUpdate }
          }));
        }
      } else {
        if (wasInactive) {
          // Just became active
          this.log('✓ Sensor voltou a estar ativo!');
          window.dispatchEvent(new CustomEvent('sensorActive'));
        }
        this.isInactive = false;
      }

      this.log(`Status: ${this.isInactive ? '❌ Inativo' : '✅ Ativo'} - ${minutesSince || 0} min`);

    } catch (error) {
      this.log('❌ Erro ao verificar saúde:', error.message);
    }
  }

  /**
   * Get current data (with cache)
   */
  getData() {
    if (!this.currentData) {
      this.log('⚠️ Sem dados disponíveis');
      return null;
    }
    return { ...this.currentData };
  }

  /**
   * Get formatted data for display
   */
  getFormattedData() {
    if (!this.currentData) return null;

    return {
      time: new Date(this.currentData.timestamp).toLocaleTimeString('pt-PT'),
      date: new Date(this.currentData.timestamp).toLocaleDateString('pt-PT'),
      voltage: `${this.currentData.voltage.toFixed(1)} V`,
      current: `${(this.currentData.currentMA / 1000)} A`,
      power: `${this.currentData.power} W`,
      energy: `${this.currentData.energy} Wh`,
      manufacturer: this.currentData.manufacturer,
      isStale: this.isInactive,
      minutesSinceUpdate: this.lastHealthCheck?.minutesSinceLastUpdate || null
    };
  }

  /**
   * Get historical data
   */
  async getHistory(hours = 24, limit = 100) {
    try {
      const response = await fetch(this.makeUrl(`/history?hours=${hours}&limit=${limit}`));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const result = await response.json();
      this.log(`📊 Histórico: ${result.count} registos das últimas ${hours}h`);
      return result.data;
    } catch (error) {
      this.log('❌ Erro ao buscar histórico:', error.message);
      return [];
    }
  }

  /**
   * Get statistics for a period
   */
  async getStats(hours = 24) {
    try {
      const response = await fetch(this.makeUrl(`/stats?hours=${hours}`));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const result = await response.json();
      this.log(`📈 Stats das últimas ${hours}h:`, result);
      return result;
    } catch (error) {
      this.log('❌ Erro ao buscar estatísticas:', error.message);
      return null;
    }
  }

  /**
   * Check if data is stale (from cache)
   */
  isDataStale() {
    return this.isInactive;
  }

  /**
   * Get time since last update
   */
  getMinutesSinceUpdate() {
    return this.lastHealthCheck?.minutesSinceLastUpdate || null;
  }

  /**
   * Manual refresh
   */
  async refresh() {
    this.log('🔄 Atualizar manualmente...');
    await this.fetchAndUpdate();
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.log('🛑 Cache Manager destruído');
    }
  }

  /**
   * Debug logging
   */
  log(...args) {
    if (this.enableDebug) {
      console.log('[CacheManager]', ...args);
    }
  }
}

// Example usage in HTML/JS
export function initializeCacheUI() {
  const cache = new CacheManager({ debug: true, inactivityThreshold: 5 });

  // Listen for data updates
  window.addEventListener('dataUpdated', (e) => {
    const { data, isFromCache, minutesSinceUpdate } = e.detail;
    console.log('Data updated:', data);
    console.log('Is from cache:', isFromCache);
    
    // Update UI
    updateDisplay(data, isFromCache, minutesSinceUpdate);
  });

  // Listen for sensor status
  window.addEventListener('sensorInactive', (e) => {
    const { minutesSince, lastUpdate } = e.detail;
    console.warn(`⚠️ Sensor inativo há ${minutesSince} minutos!`);
    showWarningBanner(`Sensor inativo - Mostrando dados de ${lastUpdate}`);
  });

  window.addEventListener('sensorActive', () => {
    console.log('✅ Sensor voltou a estar ativo!');
    hideWarningBanner();
  });

  // Initialize
  cache.init();

  return cache;
}

function updateDisplay(data, isStale, minutesSince) {
  // Your UI update logic here
  console.log('Displaying:', data);
  
  if (isStale) {
    document.body.classList.add('data-stale');
    const staleBadge = document.querySelector('[data-stale-badge]');
    if (staleBadge) {
      staleBadge.textContent = `(${minutesSince} min desatualizado)`;
    }
  } else {
    document.body.classList.remove('data-stale');
    const staleBadge = document.querySelector('[data-stale-badge]');
    if (staleBadge) {
      staleBadge.textContent = '';
    }
  }
}

function showWarningBanner(message) {
  const banner = document.querySelector('[data-warning-banner]');
  if (banner) {
    banner.textContent = message;
    banner.style.display = 'block';
  }
}

function hideWarningBanner() {
  const banner = document.querySelector('[data-warning-banner]');
  if (banner) {
    banner.style.display = 'none';
  }
}
