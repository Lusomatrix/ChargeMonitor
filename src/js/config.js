/**
 * CONFIG — Application Configuration & Constants
 * 
 * Centralized configuration for:
 * - API limits
 * - Manufacturer whitelist
 * - Update intervals
 * - DOM selectors
 */

export const CONFIG = {
  /* ── Data Limits ──────────────────────────────────────── */
  maxVoltage: 400,
  maxCurrent: 50,
  maxPower: 10000,
  maxEnergy: 500000,  /* 500 kWh */
  
  /* ── Allowed Manufacturers (whitelist) ──────────────── */
  allowedManufacturers: [
    'YOBIIQ B.V.',
    'YOBIIQ',
    'yobiiq'
  ],
  
  /* ── API Configuration ────────────────────────────────– */
  apiEndpoint: '/latest-data',
  updateInterval: 2000,  /* ms between fetch calls */
  
  /* ── Mock / Test Data ─────────────────────────────────– */
  mockData: {
    manufacturer: 'YOBIIQ B.V.',
    data: [235.6, 36, 3, 91951],
    unit: ['V', 'mA', 'W', 'Wh']
  }
};

/**
 * DOM_ELEMENTS — All DOM element selectors
 * 
 * Organized by section for easy reference
 */
export const DOM_ELEMENTS = {
  /* ── Metrics Display ──────────────────────────────────– */
  voltage: document.getElementById('voltage'),
  current: document.getElementById('current'),
  power: document.getElementById('power'),
  energy: document.getElementById('energy'),
  
  /* ── Progress Bars ────────────────────────────────────– */
  voltageBar: document.getElementById('voltage-bar'),
  currentBar: document.getElementById('current-bar'),
  powerBar: document.getElementById('power-bar'),
  energyBar: document.getElementById('energy-bar'),
  
  /* ── Gauge Display ────────────────────────────────────– */
  gaugeNum: document.getElementById('pct-num'),
  
  /* ── Status Elements ──────────────────────────────────– */
  statusPill: document.getElementById('s-pill'),
  statusText: document.getElementById('s-text'),
  etaElement: document.getElementById('s-eta'),
  etaValue: document.getElementById('eta-val'),
  deviceElement: document.getElementById('s-device'),
  manufacturerValue: document.getElementById('mfr-val'),
  
  /* ── Battery Slider ───────────────────────────────────– */
  batterySlider: document.getElementById('battery-slider'),
  batteryLockBtn: document.getElementById('battery-lock-btn'),
  batteryPercent: document.getElementById('battery-percent'),
  
  /* ── Connection Bar ───────────────────────────────────– */
  connectionBar: document.getElementById('conn-bar'),
  connectionDot: document.getElementById('cb-dot'),
  connectionTitle: document.getElementById('cb-title'),
  connectionMessage: document.getElementById('cb-msg'),
  lastUpdateTime: document.getElementById('last-update'),
  
  /* ── Header ───────────────────────────────────────────– */
  liveBadge: document.getElementById('live-badge'),
  badgeText: document.getElementById('badge-text'),
  headerTime: document.getElementById('header-time'),
  
  /* ── Car Image (for charging animation) ────────────– */
  carImage: document.querySelector('.car-img'),
  
  /* ── Session Progress ─────────────────────────────────– */
  sessionGatewayId: document.getElementById('s-gw'),
  sessionRssi: document.getElementById('s-rssi'),
  sessionSnr: document.getElementById('s-snr'),
  sessionFreq: document.getElementById('s-freq'),
  sessionChannel: document.getElementById('s-ch'),
  sessionCrc: document.getElementById('s-crc'),
  sessionUplinkId: document.getElementById('s-uid'),
  sessionLocation: document.getElementById('s-loc'),
  sessionSf: document.getElementById('s-sf'),
  sessionBw: document.getElementById('s-bw'),
  sessionFc: document.getElementById('s-fc')
};

/**
 * CHART_ELEMENTS — SVG visualization elements
 */
export const CHART_ELEMENTS = {
  gaugeFill: document.getElementById('g-fill'),
  gaugeGlow: document.getElementById('g-glow')
};
