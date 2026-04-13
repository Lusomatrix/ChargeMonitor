/**
 * Script para inserir dados de teste na base de dados
 * Útil para testar o dashboard quando ChirpStack ainda não tem dados
 * 
 * Uso: node test-data.js
 */

const db = require('./db.js');

async function insertTestData() {
  console.log('🧪 Inserindo dados de teste...');
  
  const testData = {
    manufacturer: 'Test Device',
    voltage: 230.5,
    currentMA: 5500,
    power: 1265,
    energy: 2500,
    timestamp: new Date().toISOString(),
    gatewayId: 'gateway-test-001',
    rssi: -85,
    snr: 8.5,
    frequency: 868100000,
    channel: 0,
    crcStatus: 'CRC_OK',
    uplinkId: 12345,
    latitude: 38.7223,
    longitude: -9.1393,
    spreadingFactor: 7,
    bandwidth: 125000,
    f_cnt: 42,
    raw: {
      voltageL1N: { data: 230.5 },
      currentL1: { data: 5.5 },
      activePowerL1: { data: 1265 },
      activeEnergyImportL1T1: { data: 2500 },
      manufacturer: 'Test Device'
    }
  };

  try {
    await db.saveSensorData(testData);
    console.log('✅ Dados de teste inseridos com sucesso!');
    console.log('📊 Dados inseridos:', testData);
    
    // Query and display back
    const lastData = await db.getLatestData();
    console.log('✅ Verificação - último dado na BD:', lastData);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao inserir dados:', error);
    process.exit(1);
  }
}

// Run
insertTestData();
