const express = require("express");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const app = express();
const path = require("path");
const db = require("./db.js");
const https = require("https");
const http = require("http");
const url = require("url");
require("dotenv").config();

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "https://api.console.thethings.industries", "wss://*"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Compression middleware
app.use(compression());

// Rate Limiting - Geral (permissivo para polling contínuo)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // 1000 requests por IP (permite polling a cada 1-2s)
  message: "Muitos pedidos, tente novamente mais tarde",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.ip === '::1' || req.ip === '127.0.0.1' // Skip rate limit para localhost
});
app.use(limiter);

// Rate Limiting - Relay (mais restritivo)
const relayLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 10, // 10 requests por minuto
  skipSuccessfulRequests: false,
  message: "Demasiadas tentativas no relay, aguarde um minuto"
});

// CORS - Restrito apenas aos domínios confiáveis
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.ALLOWED_ORIGINS || ''
].filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Permite requisições sem origin (mobile apps, server requests)
  if (!origin) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  } else if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
  }
  
  res.header("Access-Control-Max-Age", "3600");
  
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Body size limit
app.use(express.json({ limit: '10kb' }));

// Static files com cache
app.use(express.static(path.join(__dirname, "src"), {
  maxAge: '1h',
  etag: false
}));

// Middleware para validar e sanitizar input
function validateNumericInput(value, name, min = -Infinity, max = Infinity) {
  if (value === undefined || value === null) return null;
  const num = parseFloat(value);
  if (isNaN(num) || num < min || num > max) {
    throw new Error(`Parâmetro inválido: ${name}`);
  }
  return num;
}

// Middleware de autenticação para /relay
function validateRelayToken(req, res, next) {
  const token = req.headers['x-api-token'] || req.body?.token;
  const validToken = process.env.RELAY_AUTH_TOKEN;
  
  if (!validToken) {
    console.error("❌ RELAY_AUTH_TOKEN não configurado em .env");
    return res.status(500).json({ error: "Servidor não configurado" });
  }
  
  if (!token || token !== validToken) {
    console.warn(`⚠️ Tentativa de acesso ao relay com token inválido de ${req.ip}`);
    return res.status(401).json({ error: "Não autorizado" });
  }
  
  next();
}


app.get("/config", (req, res) => {
  try {
    const config = {
      chirpstack: {
        apiUrl: process.env.VITE_CHIRPSTACK_API_URL || "http://192.168.5.196:8090",
        deviceId: process.env.VITE_CHIRPSTACK_DEVICE_ID || "fc48c90000000187"
        // ⚠️ NUNCA retornar token/credenciais sensíveis!
      }
    };
    
    res.json(config);
  } catch (error) {
    console.error("❌ Erro ao carregar configuração:", error.message);
    res.status(500).json({ error: "Erro ao carregar configuração" });
  }
});

app.post("/relay", relayLimiter, validateRelayToken, async (req, res) => {
  try {
    const { command } = req.body;
    
    // Validação rigorosa
    if (!command || typeof command !== 'string') {
      return res.status(400).json({ error: "Campo 'command' obrigatório" });
    }
    
    if (!['ON', 'OFF'].includes(command.toUpperCase())) {
      return res.status(400).json({ error: "Comando inválido. Use 'ON' ou 'OFF'" });
    }
    
    const deviceId = process.env.VITE_CHIRPSTACK_DEVICE_ID;
    const apiUrl = process.env.VITE_CHIRPSTACK_API_URL;
    const authToken = process.env.VITE_CHIRPSTACK_AUTH_TOKEN;
    
    // Validações de configuração
    if (!deviceId || !apiUrl || !authToken) {
      console.error("❌ ChirpStack não configurado corretamente em .env");
      return res.status(500).json({ error: "Servidor não configurado" });
    }
    
    const payload = command.toUpperCase() === 'ON' ? 'B0gB' : 'B0gA';
    
    const requestBody = {
      queueItem: {
        confirmed: false,
        data: payload,
        fPort: 50
      }
    };
    
    const fullUrl = `${apiUrl}/api/devices/${deviceId}/queue`;
    
    let parsedUrl;
    try {
      parsedUrl = new url.URL(fullUrl);
    } catch (urlError) {
      console.error("❌ URL inválida:", fullUrl);
      return res.status(500).json({ error: "Configuração de URL inválida" });
    }
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      timeout: 10000, // 10 segundo timeout
      headers: {
        'Content-Type': 'application/json',
        'Grpc-Metadata-Authorization': `Bearer ${authToken}`,
        'Content-Length': Buffer.byteLength(JSON.stringify(requestBody))
      }
    };
    
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const relayRequest = protocol.request(options, (relayResponse) => {
      let data = '';
      
      relayResponse.on('data', (chunk) => {
        data += chunk;
      });
      
      relayResponse.on('end', () => {
        const statusCode = relayResponse.statusCode;
        
        try {
          const responseData = JSON.parse(data);
          
          if (statusCode >= 200 && statusCode < 300) {
            res.json({ 
              success: true, 
              message: `Relay ${command.toUpperCase()} enviado com sucesso`,
              data: responseData
            });
          } else {
            console.warn(`⚠️ ChirpStack retornou status ${statusCode}`);
            res.status(statusCode).json({ 
              error: `Erro ChirpStack: ${statusCode}`,
              details: responseData
            });
          }
        } catch (parseError) {
          res.status(500).json({ 
            error: 'Erro ao processar resposta'
          });
        }
      });
    });
    
    relayRequest.on('error', (error) => {
      console.error(`❌ Erro no relay:`, error.message);
      res.status(500).json({ error: "Erro ao contactar ChirpStack" });
    });
    
    relayRequest.on('timeout', () => {
      relayRequest.destroy();
      res.status(504).json({ error: "Timeout contactando ChirpStack" });
    });
    
    relayRequest.write(JSON.stringify(requestBody));
    relayRequest.end();
    
  } catch (error) {
    console.error(`❌ Erro no relay:`, error.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});


app.post("/uplink", async (req, res) => {
  try {
    const decodedObject = req.body.object;
    const deviceInfo = req.body.deviceInfo;
    
    if (!decodedObject || typeof decodedObject !== 'object') {
      return res.status(400).json({ error: "Payload inválido - sem dados decodificados" });
    }
    
    // Extrai e valida valores do objeto decodificado
    let voltage, currentMA, power, energy;
    
    try {
      voltage = validateNumericInput(decodedObject.voltageL1N?.data, 'voltage', 0, 300);
      currentMA = validateNumericInput(decodedObject.currentL1?.data, 'current', 0, 200000);
      power = validateNumericInput(decodedObject.activePowerL1?.data, 'power', 0, 150000);
      energy = validateNumericInput(decodedObject.activeEnergyImportL1T1?.data, 'energy', 0);
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }
    
    voltage = voltage || 0;
    currentMA = currentMA || 0;
    power = power || 0;
    energy = energy || 0;
    
    const manufacturer = (decodedObject.manufacturer || deviceInfo?.deviceName || "Desconhecido").toString().slice(0, 255);
    
    // Extract gateway information com validação
    let uplinkId = req.body.uplinkId || null;
    let gatewayId = req.body.gatewayId || null;
    let rssi = req.body.rssi || null;
    let snr = req.body.snr || null;
    let frequency = req.body.frequency || null;
    let channel = req.body.channel || null;
    let crcStatus = req.body.crcStatus || null;
    let latitude = req.body.latitude || null;
    let longitude = req.body.longitude || null;
    
    if (req.body.rxInfo && Array.isArray(req.body.rxInfo) && req.body.rxInfo.length > 0) {
      const rx = req.body.rxInfo[0];
      gatewayId = gatewayId || rx.gatewayID || rx.gatewayId || null;
      
      // Validação de RSSI (-200 a 0 dBm typicamente)
      if (rx.rssi !== undefined && !isNaN(rx.rssi)) {
        rssi = parseInt(rx.rssi);
      }
      
      // Validação de SNR (-20 a +10 dBm typicamente)
      if (rx.snr !== undefined && !isNaN(rx.snr)) {
        snr = parseFloat(rx.snr);
      }
      
      if (rx.channel !== undefined && !isNaN(rx.channel)) {
        channel = parseInt(rx.channel);
      }
      
      crcStatus = crcStatus || rx.crcStatus || null;
      uplinkId = uplinkId || rx.uplinkId || null;
      
      if (rx.location) {
        latitude = latitude || rx.location.latitude || null;
        longitude = longitude || rx.location.longitude || null;
      } else {
        latitude = latitude || rx.latitude || null;
        longitude = longitude || rx.longitude || null;
      }
    }
    
    if (req.body.txInfo && !frequency && !isNaN(req.body.txInfo.frequency)) {
      frequency = parseInt(req.body.txInfo.frequency);
    }
    
    if (uplinkId === null && req.body.deviceInfo && req.body.deviceInfo.uplinkId) {
      uplinkId = req.body.deviceInfo.uplinkId;
    }
    
    let spreadingFactor = req.body.spreadingFactor || req.body.spreading_factor || null;
    let bandwidth = req.body.bandwidth || null;
    let fCnt = req.body.fCnt || req.body.f_cnt || null;
    
    if (req.body.txInfo && req.body.txInfo.modulation) {
      const modulation = req.body.txInfo.modulation;
      spreadingFactor = spreadingFactor || modulation.spreadingFactor || modulation.spreading_factor || null;
      
      if (modulation.bandwidth && !isNaN(modulation.bandwidth)) {
        bandwidth = parseInt(modulation.bandwidth);
      }
    }
    
    if (fCnt === null && req.body.deviceInfo && !isNaN(req.body.deviceInfo.fCnt)) {
      fCnt = parseInt(req.body.deviceInfo.fCnt);
    }
    
    const dataToStore = {
      manufacturer: manufacturer,
      voltage: voltage,
      currentMA: currentMA,
      power: power,
      energy: energy,
      timestamp: new Date().toISOString(),
      gatewayId: gatewayId?.toString().slice(0, 255) || null,
      rssi: rssi,
      snr: snr,
      frequency: frequency,
      channel: channel,
      crcStatus: crcStatus?.toString().slice(0, 50) || null,
      uplinkId: uplinkId,
      latitude: latitude,
      longitude: longitude,
      spreadingFactor: spreadingFactor,
      bandwidth: bandwidth,
      f_cnt: fCnt,
      raw: JSON.stringify(decodedObject).slice(0, 2000) // Limita tamanho
    };
    
    db.saveSensorData(dataToStore);
    
    res.status(200).json({ success: true, message: "Dados recebidos" });
  } catch (error) {
    console.error("❌ Erro ao processar uplink:", error.message);
    res.status(500).json({ error: "Erro ao processar dados" });
  }
});


app.get("/latest-data", async (req, res) => {
  try {
    const lastData = db.getLatestData();
    if (!lastData) {
      res.status(204).send(); // Sem conteúdo - ainda a aguardar dados
      return;
    }
    
    // Cache por 30 segundos
    res.set('Cache-Control', 'public, max-age=30');
    res.json(lastData);
  } catch (error) {
    console.error("❌ Erro ao buscar último dado:", error.message);
    res.status(500).json({ error: "Erro ao buscar dados" });
  }
});

app.get("/health", async (req, res) => {
  try {
    const lastData = db.getLatestData();
    const minutesSinceLastUpdate = db.getMinutesSinceLastUpdate();
    
    // Cache por 10 segundos
    res.set('Cache-Control', 'public, max-age=10');
    res.json({
      status: "ok",
      hasData: !!lastData,
      lastUpdate: lastData?.timestamp || null,
      minutesSinceLastUpdate: minutesSinceLastUpdate || "Sem dados"
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: error.message
    });
  }
});

app.get("/history", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500); // Máx 500
    const hours = Math.min(parseInt(req.query.hours) || 24, 720); // Máx 30 dias
    
    // Validação
    if (limit < 1 || hours < 1) {
      return res.status(400).json({ error: "Parâmetros inválidos" });
    }
    
    const history = db.getHistory({ limit, hours });
    
    // Cache por 5 minutos
    res.set('Cache-Control', 'public, max-age=300');
    res.json({
      count: history.length,
      queryTime: `${hours}h`,
      data: history
    });
  } catch (error) {
    console.error("❌ Erro ao buscar histórico:", error.message);
    res.status(500).json({ error: "Erro ao buscar histórico" });
  }
});

app.get("/stats", async (req, res) => {
  try {
    const hours = Math.min(parseInt(req.query.hours) || 24, 720); // Máx 30 dias
    
    if (hours < 1) {
      return res.status(400).json({ error: "Parâmetros inválidos" });
    }
    
    const stats = db.getStats(hours);
    
    // Cache por 10 minutos (stats mudam devagar)
    res.set('Cache-Control', 'public, max-age=600');
    res.json({
      ...stats,
      period: `${hours}h`
    });
  } catch (error) {
    console.error("❌ Erro ao buscar estatísticas:", error.message);
    res.status(500).json({ error: "Erro ao buscar estatísticas" });
  }
});


// Tratamento de rotas não encontradas
app.use((req, res) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error("❌ Erro não tratado:", err.message);
  res.status(500).json({ error: "Erro interno do servidor" });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor iniciado na porta ${PORT}`);
  console.log(`🔐 CORS restrito a: ${allowedOrigins.length > 0 ? allowedOrigins.join(', ') : 'localhost'}`);
  console.log(`⏱️  Rate Limit: 100 req/15min (geral), 10 req/min (relay)`);
  
  if (!process.env.RELAY_AUTH_TOKEN) {
    console.warn("⚠️  AVISO: RELAY_AUTH_TOKEN não configurado em .env - /relay não funcionará");
  }
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("🛑 SIGTERM recebido, encerrando gracefully...");
  server.close(async () => {
    db.close();
    console.log("✓ Servidor encerrado");
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  console.log("🛑 SIGINT recebido, encerrando...");
  server.close(async () => {
    db.close();
    console.log("✓ Servidor encerrado");
    process.exit(0);
  });
});
