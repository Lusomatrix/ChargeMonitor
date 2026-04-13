import { CONFIG } from './config.js';

let chirpStackConfig = {
  apiUrl: 'http://192.168.5.196:8090',
  deviceId: 'fc48c90000000187',
  authToken: null
};

export async function loadChirpStackConfig() {
  try {
    const response = await fetch('/config');
    if (response.ok) {
      const data = await response.json();
      chirpStackConfig = {
        apiUrl: data.chirpstack.apiUrl,
        deviceId: data.chirpstack.deviceId,
        authToken: data.chirpstack.authToken
      };
      return chirpStackConfig;
    }
  } catch (error) {
    // Fallback to localStorage if server config not available
  }
  
  chirpStackConfig.apiUrl = localStorage.getItem('chirpstack_api_url') || chirpStackConfig.apiUrl;
  chirpStackConfig.deviceId = localStorage.getItem('chirpstack_device_id') || chirpStackConfig.deviceId;
  chirpStackConfig.authToken = localStorage.getItem('chirpstack_auth_token') || chirpStackConfig.authToken;
  
  return chirpStackConfig;
}

export function getChirpStackConfig() {
  return { ...chirpStackConfig };
}

let authToken = localStorage.getItem('chirpstack_token') || '';

/**
 * Set ChirpStack authentication token
 */
export function setAuthToken(token) {
  authToken = token;
  chirpStackConfig.authToken = token;
}

/**
 * Get current authentication token
 */
export function getAuthToken() {
  return authToken || chirpStackConfig.authToken;
}

/**
 * Fetch latest data from server
 */
export async function fetchLatestData() {
  try {
    const response = await fetch(CONFIG.apiEndpoint);
    
    if (response.ok) {
      const data = await response.json();
      return data;
    } else if (response.status === 204) {
      // No data available yet
      return null;
    } else {
      return null;
    }
  } catch (error) {
    return null;
  }
}

/**
 * Fetch historical data from server
 */
export async function fetchHistoryData(hours = 24, limit = 100) {
  try {
    const response = await fetch(`/history?hours=${hours}&limit=${limit}`);
    
    if (response.ok) {
      const data = await response.json();
      return data.data || [];
    } else {
      return null;
    }
  } catch (error) {
    return null;
  }
}

/**
 * Fetch statistics for a time period
 */
export async function fetchStatsData(hours = 24) {
  try {
    const response = await fetch(`/stats?hours=${hours}`);
    
    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      return null;
    }
  } catch (error) {
    return null;
  }
}

/**
 * Validate manufacturer against whitelist
 */
export function isManufacturerAllowed(manufacturer) {
  return CONFIG.allowedManufacturers.some(allowed =>
    manufacturer.toUpperCase().includes(allowed.toUpperCase())
  );
}

/**
 * Parse sensor data from ChirpStack format
 */
export function parseSensorData(data) {
  const voltage = parseFloat(data.data?.[0] || data.voltage || 0);
  const currentMA = parseInt(data.data?.[1] || data.currentMA || 0);
  const currentA = currentMA / 1000;  // Convert mA to A
  const power = parseInt(data.data?.[2] || data.power || 0);
  const energy = parseInt(data.data?.[3] || data.energy || data.totalEnergy || 0);
  
  return { voltage, currentA, power, energy };
}

/**
 * Send relay downlink command via ChirpStack API
 */
export async function sendRelayDownlink(command) {
  try {
    // Use backend proxy endpoint to avoid CORS issues
    const proxyUrl = '/relay';
    
    const requestBody = {
      command: command  // 'ON' or 'OFF'
    };
    
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    const responseData = await response.json().catch(() => ({}));
    
    if (response.ok) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }
}
