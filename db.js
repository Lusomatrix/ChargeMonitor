/**
 * Database Module - SQLite3
 * 
 * Manages persistent storage of sensor data with history
 * Allows displaying cached data when sensor is inactive
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'chargeMonitor.db');

class Database {
  constructor() {
    this.db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('❌ Erro ao abrir base de dados:', err.message);
      } else {
        console.log('✅ Base de dados SQLite3 conectada');
        this.initialize();
      }
    });
  }

  /**
   * Initialize database schema
   */
  initialize() {
    this.db.serialize(() => {
      // Tabela para guardar todos os dados (histórico)
      this.db.run(`
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
      `, (err) => {
        if (err) {
          console.error('❌ Erro ao criar tabela sensor_data:', err.message);
        } else {
          console.log('✓ Tabela sensor_data pronta');
        }
      });

      // Tabela para guardar o último dado (cache rápido)
      this.db.run(`
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
      `, (err) => {
        if (err) {
          console.error('❌ Erro ao criar tabela last_data:', err.message);
        } else {
          console.log('✓ Tabela last_data pronta');
        }
      });
    });
  }

  /**
   * Save sensor data to database
   * @param {Object} data - Sensor data object
   * @returns {Promise<void>}
   */
  async saveSensorData(data) {
    return new Promise((resolve, reject) => {
      const { manufacturer, voltage, currentMA, power, energy, timestamp, gatewayId, rssi, snr, frequency, channel, crcStatus, uplinkId, latitude, longitude, spreadingFactor, bandwidth, f_cnt, raw } = data;

      // Insert into historical data
      this.db.run(
        `INSERT INTO sensor_data (manufacturer, voltage, currentMA, power, energy, timestamp, gatewayId, rssi, snr, frequency, channel, crcStatus, uplinkId, latitude, longitude, spreadingFactor, bandwidth, f_cnt, raw)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [manufacturer, voltage, currentMA, power, energy, timestamp, gatewayId, rssi, snr, frequency, channel, crcStatus, uplinkId, latitude, longitude, spreadingFactor, bandwidth, f_cnt, JSON.stringify(raw)],
        function(err) {
          if (err) {
            console.error('❌ Erro ao inserir dados:', err.message);
            reject(err);
          } else {
            console.log('💾 Dados guardados na BD (ID: ' + this.lastID + ')');
            resolve(this.lastID);
          }
        }
      );

      // Update last_data (cache table - apenas 1 linha)
      this.db.run(
        `DELETE FROM last_data`,
        (err) => {
          if (err) console.error('Erro ao limpar last_data:', err.message);
          
          this.db.run(
            `INSERT INTO last_data (manufacturer, voltage, currentMA, power, energy, timestamp, gatewayId, rssi, snr, frequency, channel, crcStatus, uplinkId, latitude, longitude, spreadingFactor, bandwidth, f_cnt, raw)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [manufacturer, voltage, currentMA, power, energy, timestamp, gatewayId, rssi, snr, frequency, channel, crcStatus, uplinkId, latitude, longitude, spreadingFactor, bandwidth, f_cnt, JSON.stringify(raw)],
            (err) => {
              if (err) {
                console.error('❌ Erro ao atualizar last_data:', err.message);
              } else {
                console.log('⚡ Cache rápido atualizado');
              }
            }
          );
        }
      );
    });
  }

  /**
   * Get latest data from cache
   * @returns {Promise<Object|null>}
   */
  async getLatestData() {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM last_data ORDER BY timestamp DESC LIMIT 1`,
        (err, row) => {
          if (err) {
            console.error('❌ Erro ao buscar último dado:', err.message);
            reject(err);
          } else {
            if (row) {
              row.raw = JSON.parse(row.raw || '{}');
            }
            resolve(row || null);
          }
        }
      );
    });
  }

  /**
   * Get historical data with optional filtering
   * @param {Object} options - Filter options
   * @param {number} options.limit - Número máximo de resultados (default: 100)
   * @param {number} options.offset - Para pagination (default: 0)
   * @param {string} options.hours - Últimas N horas (default: 24)
   * @returns {Promise<Array>}
   */
  async getHistory(options = {}) {
    const limit = options.limit || 100;
    const offset = options.offset || 0;
    const hours = options.hours || 24;

    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT id, manufacturer, voltage, currentMA, power, energy, timestamp
         FROM sensor_data
         WHERE timestamp > datetime('now', '-' || ? || ' hours')
         ORDER BY timestamp DESC
         LIMIT ? OFFSET ?`,
        [hours, limit, offset],
        (err, rows) => {
          if (err) {
            console.error('❌ Erro ao buscar histórico:', err.message);
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  /**
   * Get data statistics for a time period
   * @param {number} hours - Last N hours
   * @returns {Promise<Object>}
   */
  async getStats(hours = 24) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT 
          COUNT(*) as count,
          AVG(voltage) as avgVoltage,
          AVG(currentMA) as avgCurrentMA,
          AVG(power) as avgPower,
          MAX(power) as maxPower,
          MIN(power) as minPower,
          MAX(energy) as maxEnergy
         FROM sensor_data
         WHERE timestamp > datetime('now', '-' || ? || ' hours')`,
        [hours],
        (err, row) => {
          if (err) {
            console.error('❌ Erro ao buscar estatísticas:', err.message);
            reject(err);
          } else {
            resolve(row || null);
          }
        }
      );
    });
  }

  /**
   * Get time since last sensor update
   * @returns {Promise<number>} Minutes since last update (null if no data)
   */
  async getMinutesSinceLastUpdate() {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT 
          ROUND((julianday('now') - julianday(MAX(timestamp))) * 24 * 60) as minutes
         FROM sensor_data`,
        (err, row) => {
          if (err) {
            console.error('❌ Erro ao buscar tempo:', err.message);
            reject(err);
          } else {
            resolve(row?.minutes || null);
          }
        }
      );
    });
  }

  /**
   * Clear old data (older than specified days)
   * @param {number} days - Delete records older than N days
   * @returns {Promise<void>}
   */
  async clearOldData(days = 30) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `DELETE FROM sensor_data WHERE timestamp < datetime('now', '-' || ? || ' days')`,
        [days],
        function(err) {
          if (err) {
            console.error('❌ Erro ao limpar dados antigos:', err.message);
            reject(err);
          } else {
            console.log(`🗑️  Apagados ${this.changes} registos antigos (>` + days + ' dias)');
            resolve();
          }
        }
      );
    });
  }

  /**
   * Close database connection
   * @returns {Promise<void>}
   */
  async close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          console.error('❌ Erro ao fechar DB:', err.message);
          reject(err);
        } else {
          console.log('✓ Base de dados desconectada');
          resolve();
        }
      });
    });
  }
}

// Export singleton instance
module.exports = new Database();
