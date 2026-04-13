/**
 * Database Module - better-sqlite3 (Synchronous)
 * 
 * Manages persistent storage of sensor data with history
 * Allows displaying cached data when sensor is inactive
 * Uses better-sqlite3 for Linux compatibility (compiles native module for target OS)
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'chargeMonitor.db');

class DatabaseManager {
  constructor() {
    try {
      this.db = new Database(DB_PATH);
      console.log('✅ Base de dados better-sqlite3 conectada');
      this.initialize();
    } catch (err) {
      console.error('❌ Erro ao abrir base de dados:', err.message);
      throw err;
    }
  }

  /**
   * Initialize database schema
   */
  initialize() {
    try {
      // Tabela para guardar todos os dados (histórico)
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS sensor_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          manufacturer TEXT,
          voltage REAL,
          currentMA INTEGER,
          power INTEGER,
          energy INTEGER,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          gatewayId TEXT,
          rssi INTEGER,
          snr REAL,
          frequency INTEGER,
          channel INTEGER,
          crcStatus TEXT,
          uplinkId INTEGER,
          latitude REAL,
          longitude REAL,
          spreadingFactor INTEGER,
          bandwidth INTEGER,
          f_cnt INTEGER,
          raw TEXT
        )
      `);
      console.log('✓ Tabela sensor_data pronta');

      // Tabela para guardar o último dado (cache rápido)
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS last_data (
          id INTEGER PRIMARY KEY,
          manufacturer TEXT,
          voltage REAL,
          currentMA INTEGER,
          power INTEGER,
          energy INTEGER,
          timestamp DATETIME,
          gatewayId TEXT,
          rssi INTEGER,
          snr REAL,
          frequency INTEGER,
          channel INTEGER,
          crcStatus TEXT,
          uplinkId INTEGER,
          latitude REAL,
          longitude REAL,
          spreadingFactor INTEGER,
          bandwidth INTEGER,
          f_cnt INTEGER,
          raw TEXT
        )
      `);
      console.log('✓ Tabela last_data pronta');
    } catch (err) {
      console.error('❌ Erro ao inicializar tabelas:', err.message);
      throw err;
    }
  }

  /**
   * Save sensor data to database
   * @param {Object} data - Sensor data object
   * @returns {number} ID do record inserido
   */
  saveSensorData(data) {
    try {
      const { manufacturer, voltage, currentMA, power, energy, timestamp, gatewayId, rssi, snr, frequency, channel, crcStatus, uplinkId, latitude, longitude, spreadingFactor, bandwidth, f_cnt, raw } = data;

      // Insert into historical data
      const insertStmt = this.db.prepare(
        `INSERT INTO sensor_data (manufacturer, voltage, currentMA, power, energy, timestamp, gatewayId, rssi, snr, frequency, channel, crcStatus, uplinkId, latitude, longitude, spreadingFactor, bandwidth, f_cnt, raw)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const result = insertStmt.run(manufacturer, voltage, currentMA, power, energy, timestamp, gatewayId, rssi, snr, frequency, channel, crcStatus, uplinkId, latitude, longitude, spreadingFactor, bandwidth, f_cnt, JSON.stringify(raw));
      
      console.log('💾 Dados guardados na BD (ID: ' + result.lastInsertRowid + ')');

      // Update last_data (cache table - apenas 1 linha)
      const deleteStmt = this.db.prepare(`DELETE FROM last_data`);
      deleteStmt.run();

      const updateStmt = this.db.prepare(
        `INSERT INTO last_data (manufacturer, voltage, currentMA, power, energy, timestamp, gatewayId, rssi, snr, frequency, channel, crcStatus, uplinkId, latitude, longitude, spreadingFactor, bandwidth, f_cnt, raw)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      updateStmt.run(manufacturer, voltage, currentMA, power, energy, timestamp, gatewayId, rssi, snr, frequency, channel, crcStatus, uplinkId, latitude, longitude, spreadingFactor, bandwidth, f_cnt, JSON.stringify(raw));
      console.log('⚡ Cache rápido atualizado');

      return result.lastInsertRowid;
    } catch (err) {
      console.error('❌ Erro ao inserir dados:', err.message);
      throw err;
    }
  }

  /**
   * Get latest data from cache
   * @returns {Object|null}
   */
  getLatestData() {
    try {
      const stmt = this.db.prepare(
        `SELECT * FROM last_data ORDER BY timestamp DESC LIMIT 1`
      );
      const row = stmt.get();
      
      if (row) {
        row.raw = JSON.parse(row.raw || '{}');
      }
      return row || null;
    } catch (err) {
      console.error('❌ Erro ao buscar último dado:', err.message);
      throw err;
    }
  }

  /**
   * Get historical data with optional filtering
   * @param {Object} options - Filter options
   * @param {number} options.limit - Número máximo de resultados (default: 100)
   * @param {number} options.offset - Para pagination (default: 0)
   * @param {number} options.hours - Últimas N horas (default: 24)
   * @returns {Array}
   */
  getHistory(options = {}) {
    try {
      const limit = options.limit || 100;
      const offset = options.offset || 0;
      const hours = options.hours || 24;

      const stmt = this.db.prepare(
        `SELECT id, manufacturer, voltage, currentMA, power, energy, timestamp
         FROM sensor_data
         WHERE timestamp > datetime('now', '-' || ? || ' hours')
         ORDER BY timestamp DESC
         LIMIT ? OFFSET ?`
      );
      return stmt.all(hours, limit, offset) || [];
    } catch (err) {
      console.error('❌ Erro ao buscar histórico:', err.message);
      throw err;
    }
  }

  /**
   * Get data statistics for a time period
   * @param {number} hours - Last N hours
   * @returns {Object}
   */
  getStats(hours = 24) {
    try {
      const stmt = this.db.prepare(
        `SELECT 
          COUNT(*) as count,
          AVG(voltage) as avgVoltage,
          AVG(currentMA) as avgCurrentMA,
          AVG(power) as avgPower,
          MAX(power) as maxPower,
          MIN(power) as minPower,
          MAX(energy) as maxEnergy
         FROM sensor_data
         WHERE timestamp > datetime('now', '-' || ? || ' hours')`
      );
      return stmt.get(hours) || null;
    } catch (err) {
      console.error('❌ Erro ao buscar estatísticas:', err.message);
      throw err;
    }
  }

  /**
   * Get time since last sensor update
   * @returns {number|null} Minutes since last update (null if no data)
   */
  getMinutesSinceLastUpdate() {
    try {
      const stmt = this.db.prepare(
        `SELECT 
          ROUND((julianday('now') - julianday(MAX(timestamp))) * 24 * 60) as minutes
         FROM sensor_data`
      );
      const row = stmt.get();
      return row?.minutes || null;
    } catch (err) {
      console.error('❌ Erro ao buscar tempo:', err.message);
      throw err;
    }
  }

  /**
   * Clear old data (older than specified days)
   * @param {number} days - Delete records older than N days
   * @returns {number} Number of deleted rows
   */
  clearOldData(days = 30) {
    try {
      const stmt = this.db.prepare(
        `DELETE FROM sensor_data WHERE timestamp < datetime('now', '-' || ? || ' days')`
      );
      const result = stmt.run(days);
      console.log(`🗑️  Apagados ${result.changes} registos antigos (>${days} dias)`);
      return result.changes;
    } catch (err) {
      console.error('❌ Erro ao limpar dados antigos:', err.message);
      throw err;
    }
  }

  /**
   * Close database connection
   */
  close() {
    try {
      this.db.close();
      console.log('✓ Base de dados desconectada');
    } catch (err) {
      console.error('❌ Erro ao fechar DB:', err.message);
      throw err;
    }
  }
}

// Export singleton instance
module.exports = new DatabaseManager();
