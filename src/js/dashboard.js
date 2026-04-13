/**
 * DASHBOARD — UI Update Functions
 * 
 * Handles all DOM updates and visual state changes
 * based on sensor data and connection status.
 */

import { CONFIG, DOM_ELEMENTS, CHART_ELEMENTS } from './config.js';
import { isManufacturerAllowed, parseSensorData } from './api.js';

/**
 * Update entire dashboard with new sensor data
 * 
 * @param {Object} data - Sensor data from API or mock
 * @returns {boolean} True if update was successful
 */
export function updateDashboard(data) {
  try {
    const manufacturer = data.manufacturer || 'Desconhecido';
    
    // Validate manufacturer
    if (!isManufacturerAllowed(manufacturer)) {
      console.warn(`⚠️ Unauthorized manufacturer: ${manufacturer}`);
      return false;
    }
    
    // Parse sensor data
    const { voltage, currentA, power, energy } = parseSensorData(data);
    
    // Update all displays
    updateMetrics(voltage, currentA, power, energy);
    updateGauge(power);
    updateCarCharging(power);
    updateStatus(true, `Dados de ${manufacturer}`);
    updateTimestamp();
    updateSessionInfo(data);
    
    return true;
  } catch (error) {
    console.error('✗ Dashboard update error:', error);
    updateStatus(false, 'Erro ao processar dados');
    return false;
  }
}

/**
 * Update metric values and progress bars
 * 
 * @param {number} voltage - Voltage in volts
 * @param {number} currentA - Current in amperes
 * @param {number} power - Power in watts
 * @param {number} energy - Energy in watt-hours
 */
function updateMetrics(voltage, currentA, power, energy) {
  // Update values
  DOM_ELEMENTS.voltage.textContent = voltage.toFixed(1);
  DOM_ELEMENTS.current.textContent = currentA;
  DOM_ELEMENTS.power.textContent = power.toLocaleString();
  if (DOM_ELEMENTS.energy) DOM_ELEMENTS.energy.textContent = energy;
  
  // Update progress bars
  const voltagePercent = Math.min((voltage / CONFIG.maxVoltage) * 100, 100);
  const currentPercent = Math.min((currentA / CONFIG.maxCurrent) * 100, 100);
  const powerPercent = Math.min((power / CONFIG.maxPower) * 100, 100);
  const energyPercent = Math.min((energy / CONFIG.maxEnergy) * 100, 100);
  
  DOM_ELEMENTS.voltageBar.style.width = `${voltagePercent}%`;
  DOM_ELEMENTS.currentBar.style.width = `${currentPercent}%`;
  DOM_ELEMENTS.powerBar.style.width = `${powerPercent}%`;
  if (DOM_ELEMENTS.energyBar) DOM_ELEMENTS.energyBar.style.width = `${energyPercent}%`;
}

/**
 * Update gauge SVG visualization
 * 
 * @param {number} power - Power value in watts
 */
function updateGauge(power) {
  updateGaugeWithBatteryLock(power);
}

/**
 * Update car charging animation and percentage
 * 
 * @param {number} power - Power value in watts
 */
function updateCarCharging(power) {
  const chargingPercent = Math.min(Math.round((power / CONFIG.maxPower) * 100), 100);
  
  // Add charging animation class if power > 0
  if (chargingPercent > 5) {
    DOM_ELEMENTS.carImage.classList.add('charging');
  } else {
    DOM_ELEMENTS.carImage.classList.remove('charging');
  }
}

/**
 * Update connection status and indicators
 * 
 * @param {boolean} connected - Connection state
 * @param {string} message - Status message to display
 */
export function updateStatus(connected, message) {
  if (connected) {
    DOM_ELEMENTS.liveBadge.classList.add('on');
    DOM_ELEMENTS.liveBadge.classList.remove('err');
    DOM_ELEMENTS.badgeText.textContent = 'Conectado';
    
    DOM_ELEMENTS.connectionDot.classList.add('ok');
    DOM_ELEMENTS.connectionDot.classList.remove('err');
    DOM_ELEMENTS.connectionTitle.textContent = '✓ Sistema Online';
    DOM_ELEMENTS.connectionMessage.textContent = message;
  } else {
    DOM_ELEMENTS.liveBadge.classList.remove('on');
    DOM_ELEMENTS.liveBadge.classList.add('err');
    DOM_ELEMENTS.badgeText.textContent = 'Desconectado';
    
    DOM_ELEMENTS.connectionDot.classList.remove('ok');
    DOM_ELEMENTS.connectionDot.classList.add('err');
    DOM_ELEMENTS.connectionTitle.textContent = '✗ Sistema Offline';
    DOM_ELEMENTS.connectionMessage.textContent = message;
  }
}

/**
 * Update timestamp display
 */
export function updateTimestamp() {
  const now = new Date();
  const timeString = now.toLocaleString('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  DOM_ELEMENTS.headerTime.textContent = timeString;
  DOM_ELEMENTS.lastUpdateTime.textContent = timeString;
}

/* ════════════════════════════════════════════════════════════════
   BATTERY SLIDER — Initial Battery Level Management
   ════════════════════════════════════════════════════════════════ */

let batteryState = {
  isLocked: false,
  initialPercent: 0,
  startTime: null,
  accumulatedEnergy: 0
};

/**
 * Initialize battery slider event listeners
 */
export function initializeBatterySlider() {
  const slider = DOM_ELEMENTS.batterySlider;
  const lockBtn = DOM_ELEMENTS.batteryLockBtn;
  const percentDisplay = DOM_ELEMENTS.batteryPercent;
  
  // Update percentage display when slider moves
  slider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    percentDisplay.textContent = `${value}%`;
    
    // Only update gauge if not locked
    if (!batteryState.isLocked) {
      updateGaugeFromSlider(value);
    }
  });
  
  // Toggle lock/unlock
  lockBtn.addEventListener('click', () => {
    batteryState.isLocked = !batteryState.isLocked;
    
    if (batteryState.isLocked) {
      // Lock: Save initial battery percentage
      batteryState.initialPercent = parseInt(slider.value);
      batteryState.startTime = Date.now();
      batteryState.accumulatedEnergy = 0;
      
      slider.disabled = true;
      lockBtn.classList.add('locked');
      console.log(`🔒 Bateria bloqueada em ${batteryState.initialPercent}%`);
    } else {
      // Unlock: Reset and allow manual control
      slider.disabled = false;
      lockBtn.classList.remove('locked');
      batteryState.startTime = null;
      console.log('🔓 Bateria desbloqueada');
    }
  });
}

/**
 * Update gauge from slider value (when unlocked)
 * 
 * @param {number} percentage - Battery percentage (0-100)
 */
function updateGaugeFromSlider(percentage) {
  const clampedPercent = Math.min(Math.max(percentage, 0), 100);
  
  DOM_ELEMENTS.gaugeNum.textContent = clampedPercent;
  
  const strokeOffset = 320 - (clampedPercent / 100) * 320;
  CHART_ELEMENTS.gaugeFill.style.strokeDashoffset = strokeOffset;
  CHART_ELEMENTS.gaugeGlow.style.strokeDashoffset = strokeOffset;
}

/**
 * Update gauge from battery lock + incoming power
 * 
 * @param {number} power - Power in watts
 */
export function updateGaugeWithBatteryLock(power) {
  if (!batteryState.isLocked) {
    // Not locked: use standard gauge update
    const chargingPercent = Math.min(Math.round((power / CONFIG.maxPower) * 100), 100);
    updateGaugeFromSlider(chargingPercent);
    return;
  }
  
  // Locked: calculate progress from initial battery
  const currentTime = Date.now();
  const elapsedSeconds = (currentTime - batteryState.startTime) / 1000;
  
  // Energy accumulated = power (W) * time (s) / 3600 (convert to Wh)
  // Assuming ~5kWh total battery and max 10000W
  const energyPerSecond = power / 3600 * 1000;
  batteryState.accumulatedEnergy += energyPerSecond * (CONFIG.updateInterval / 1000);
  
  // Estimate charge percentage increase
  // 5kWh = 5000 Wh, so: (accumulatedEnergy / 5000) * 100
  const chargeIncrease = (batteryState.accumulatedEnergy / 5000) * 100;
  const currentPercent = Math.min(batteryState.initialPercent + chargeIncrease, 100);
  
  updateGaugeFromSlider(Math.round(currentPercent));
}

/**
 * Update session progress with gateway information
 * 
 * @param {Object} data - Sensor data with gateway info
 */
export function updateSessionInfo(data) {
  // Ensure DOM elements exist
  if (!DOM_ELEMENTS.sessionGatewayId) return;
  
  console.log('Session info received:', { gatewayId: data?.gatewayId, rssi: data?.rssi, snr: data?.snr, frequency: data?.frequency, channel: data?.channel, uplinkId: data?.uplinkId });
  
  // Gateway information
  if (data && data.gatewayId) {
    DOM_ELEMENTS.sessionGatewayId.textContent = data.gatewayId.substring(0, 8) + '...';
  } else {
    DOM_ELEMENTS.sessionGatewayId.textContent = '--';
  }
  
  // RSSI (signal strength)
  if (DOM_ELEMENTS.sessionRssi) {
    DOM_ELEMENTS.sessionRssi.textContent = (data && data.rssi !== null) ? data.rssi + ' dBm' : '--';
  }
  
  // SNR (signal-to-noise ratio)
  if (DOM_ELEMENTS.sessionSnr) {
    DOM_ELEMENTS.sessionSnr.textContent = (data && data.snr !== null) ? data.snr + ' dB' : '--';
  }
  
  // Frequency
  if (DOM_ELEMENTS.sessionFreq) {
    if (data && data.frequency) {
      const freqMHz = (data.frequency / 1000000).toFixed(2);
      DOM_ELEMENTS.sessionFreq.textContent = freqMHz + ' MHz';
    } else {
      DOM_ELEMENTS.sessionFreq.textContent = '--';
    }
  }
  
  // Channel
  if (DOM_ELEMENTS.sessionChannel) {
    DOM_ELEMENTS.sessionChannel.textContent = (data && data.channel !== null) ? data.channel : '--';
  }
  
  // CRC Status
  if (DOM_ELEMENTS.sessionCrc) {
    DOM_ELEMENTS.sessionCrc.textContent = (data && data.crcStatus) ? data.crcStatus : '--';
  }
  
  // Uplink ID
  if (DOM_ELEMENTS.sessionUplinkId) {
    DOM_ELEMENTS.sessionUplinkId.textContent = (data && data.uplinkId) ? data.uplinkId : '--';
  }
  
  // Location (latitude/longitude)
  if (DOM_ELEMENTS.sessionLocation) {
    if (data && data.latitude && data.longitude) {
      const lat = data.latitude.toFixed(4);
      const lon = data.longitude.toFixed(4);
      DOM_ELEMENTS.sessionLocation.textContent = `${lat}, ${lon}`;
    } else {
      DOM_ELEMENTS.sessionLocation.textContent = '--';
    }
  }
}
