// ===== ELEMENTOS DO DOM =====
const voltageEl = document.getElementById('voltage');
const currentEl = document.getElementById('current');
const powerEl = document.getElementById('power');
const energyEl = document.getElementById('energy');
const manufacturerEl = document.getElementById('manufacturer');
const statusTitle = document.getElementById('cb-title');
const statusMessage = document.getElementById('cb-msg');
const statusBadge = document.getElementById('badge-text');
const statusIndicator = document.getElementById('live-badge');
const lastUpdateEl = document.getElementById('last-update');

// Elementos de barras de progresso
const voltageBar = document.getElementById('voltage-bar');
const currentBar = document.getElementById('current-bar');
const powerBar = document.getElementById('power-bar');
const energyBar = document.getElementById('energy-bar');

// Elementos do carregamento do carro (opcional)
const chargingPercentEl = document.getElementById('charging-percent');
const batteryFillSVG = document.getElementById('battery-fill-main');
const chargingStatusEl = document.getElementById('charging-text');

// Configuração de máximos para as barras
const CONFIG = {
    maxVoltage: 400,
    maxCurrent: 50,
    maxPower: 10000,
    maxEnergy: 500000, // 500 kWh máximo
    allowedManufacturers: ['YOBIIQ B.V.', 'YOBIIQ', 'yobiiq'] // Fabricantes permitidos
};

// Função para atualizar a interface com dados do ChirpStack
function updateDashboard(data) {
    try {
        const manufacturer = data.manufacturer || 'Desconhecido';

        // ✅ VALIDAÇÃO: Verifica se o fabricante é permitido
        const isAllowed = CONFIG.allowedManufacturers.some(allowed => 
            manufacturer.toUpperCase().includes(allowed.toUpperCase())
        );

        if (!isAllowed) {
            // ❌ Dados de sensor inválido - IGNORA e mantém dados anteriores do YOBIIQ
            console.warn(`⚠️ Dados ignorados! Sensor não autorizado: ${manufacturer}`);
            return; // Interrompe aqui, não atualiza nada - mantém display anterior
        }

        // ✅ Fabricante válido - extrai e atualiza dados
        // Suporta dois formatos: array (antigo) e objeto (novo do servidor)
        let voltage, currentMA, power, energy;
        
        if (Array.isArray(data.data)) {
            // Formato antigo - array
            voltage = parseFloat(data.data?.[0] || data.voltage || 0);
            currentMA = parseInt(data.data?.[1] || data.currentMA || 0);
            power = parseInt(data.data?.[2] || data.power || 0);
            energy = parseInt(data.data?.[3] || data.energy || 0);
        } else {
            // Formato novo - objeto com propriedades nomeadas
            voltage = parseFloat(data.voltage || 0);
            currentMA = parseInt(data.currentMA || 0);
            power = parseInt(data.power || 0);
            energy = parseInt(data.energy || 0);
        }
        
        const currentA = currentMA / 1000; // Converte mA para A

        // Atualiza valores
        voltageEl.innerText = voltage.toFixed(1);
        currentEl.innerText = currentA.toFixed(2);
        powerEl.innerText = power.toLocaleString();
        energyEl.innerText = energy;
        manufacturerEl?.setAttribute('title', manufacturer);

        // Atualiza barras de progresso
        voltageBar.style.width = `${Math.min((voltage / CONFIG.maxVoltage) * 100, 100)}%`;
        currentBar.style.width = `${Math.min((currentA / CONFIG.maxCurrent) * 100, 100)}%`;
        powerBar.style.width = `${Math.min((power / CONFIG.maxPower) * 100, 100)}%`;
        energyBar.style.width = `${Math.min((energy / CONFIG.maxEnergy) * 100, 100)}%`;

        // Atualiza status
        updateStatus(true, 'Conectado e a receber dados', voltage, currentA, power);

        // Atualiza hora
        updateTimestamp();

        // Atualiza indicador de carregamento do carro (se existir)
        if (chargingPercentEl) updateCarCharging(power);

        console.log('✓ Dashboard atualizado:', { voltage, currentA, power, energy, manufacturer });
    } catch (error) {
        console.error('✗ Erro ao atualizar dashboard:', error);
        updateStatus(false, 'Erro ao processar dados');
    }
}

// Função para atualizar o status
function updateStatus(connected, message, voltage = 0, current = 0, power = 0) {
    if (connected) {
        if (statusTitle) statusTitle.innerText = '✓ Sistema Online';
        if (statusMessage) statusMessage.innerText = message;
        if (statusBadge) statusBadge.textContent = '● Conectado';
        statusBadge?.classList.add('connected');
        statusBadge?.classList.remove('error');
        statusIndicator?.classList.add('connected');
        statusIndicator?.classList.remove('error');
    } else {
        if (statusTitle) statusTitle.innerText = '✗ Sistema Offline';
        if (statusMessage) statusMessage.innerText = message;
        if (statusBadge) statusBadge.textContent = '● Desconectado';
        statusBadge?.classList.remove('connected');
        statusBadge?.classList.add('error');
        statusIndicator?.classList.remove('connected');
        statusIndicator?.classList.add('error');
    }
}

// Função para atualizar timestamp
function updateTimestamp() {
    const now = new Date();
    const timeString = now.toLocaleString('pt-PT', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    if (lastUpdateEl) lastUpdateEl.innerText = `Última atualização: ${timeString}`;
}

// Função para atualizar o indicador de carregamento do carro
function updateCarCharging(power) {
    // Calcula percentagem de carregamento (0-100%)
    const chargingPercent = Math.min(Math.round((power / CONFIG.maxPower) * 100), 100);
    
    // Atualiza texto (se existir)
    if (chargingPercentEl) chargingPercentEl.innerText = chargingPercent;
    
    // Atualiza barra de bateria SVG (0-54 de width) - se existir
    if (batteryFillSVG) {
        const batteryWidth = (chargingPercent / 100) * 54;
        batteryFillSVG.setAttribute('width', batteryWidth);
    }
}

// SIMULAÇÃO: Dados de teste
const mockData = {
    manufacturer: 'YOBIIQ B.V.',
    data: [229.8, 15585, 3573, 91951],
    unit: ['V', 'mA', 'W', 'Wh']
};

console.log('Aplicação iniciada. À espera de dados do ChirpStack...');
updateDashboard(mockData);

// Polling para receber dados do servidor
setInterval(async () => {
    try {
        const response = await fetch('/latest-data');
        if (response.ok) {
            const data = await response.json();
            updateDashboard(data);
        } else if (response.status === 204) {
            // Sem dados ainda, mantém os dados anteriores
            console.log('À espera de dados do ChirpStack...');
        }
    } catch (error) {
        console.error('Erro ao buscar dados:', error);
        updateStatus(false, 'Erro de conexão com o servidor');
    }
}, 2000); // Atualiza a cada 2 segundos