const reportEscape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR9q-T-U_fT_tP9_ZKet4ai-BG11a6eCnwyG_BrJWIG7rQ7gFbKkrjDnj_r3ptMs-BbCl-7nm5kkHcI/pub?output=csv';

let allRawData = [];
let validData = [];

// Instâncias de Gráficos
let chartBlocoInst = null;
let chartEquipInst = null;
let chartMesInst = null;
let chartBlocoSemanaInst = null;
let chartOperadorInst = null;
let chartPeriodoMesInst = null;
let chartPeriodoSemInst = null;
let chartRocBlocoInst = null;
let chartRocRendimentoInst = null;

Chart.register(ChartDataLabels);

window.addEventListener('DOMContentLoaded', loadSpreadsheetData, {once:true});

function loadSpreadsheetData() {
    updateStatusBadge('syncing');
    const fetchUrl = `${CSV_URL}&t=${new Date().getTime()}`;

    Papa.parse(fetchUrl, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            if (results.data && results.data.length > 0) {
                processRawData(results.data);
                populateFilterDropdowns();
                applyFilters();
                updateStatusBadge('online');
            } else {
                updateStatusBadge('error', 'Planilha Vazia');
            }
        },
        error: function(err) {
            updateStatusBadge('error', 'Erro de Conexão');
        }
    });
}

function processRawData(data) {
    allRawData = [];

    data.forEach(item => {
        const getVal = (keys) => {
            for (let k of keys) {
                for (let a in item) {
                    if (a.trim().toLowerCase() === k.toLowerCase()) return String(item[a] ?? '').trim();
                }
            }
            return '';
        };

        const dataVal = getVal(['Data', 'data', 'DATE']);
        const operadorVal = getVal(['Operador', 'operador', 'Funcionario']);
        const periodoVal = getVal(['Periodo', 'período', 'Turno']);
        const localVal = getVal(['Local', 'local', 'Bloco', 'bloco', 'Setor']);
        const equipVal = getVal(['Equipamento', 'equipamento', 'Roçadeira', 'rocadeira']);
        const inicioVal = getVal(['Inicio', 'Início', 'inicio']);
        const fimVal = getVal(['Fim', 'fim', 'Término']);

        if (!localVal && !equipVal && !inicioVal && !fimVal) return;

        const durationMinutes = calcDuration(inicioVal, fimVal);

        let mesStr = 'Sem Data', semStr = 'Sem Data';
        let mesCode = 0, semCode = 0;
        let dateIso = '';
        
        if (dataVal) {
            const parts = dataVal.split('/');
            if (parts.length >= 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10);
                let yearStr = parts[2].split(' ')[0];
                const year = yearStr.length <= 2 ? 2000 + parseInt(yearStr) : parseInt(yearStr, 10);
                
                if(!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                    dateIso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    mesStr = `${String(month).padStart(2, '0')}/${year}`;
                    mesCode = (year * 100) + month;

                    const d = new Date(year, month - 1, day);
                    const tdt = new Date(d.valueOf());
                    const dayn = (d.getDay() + 6) % 7;
                    tdt.setDate(tdt.getDate() - dayn + 3);
                    const firstThursday = tdt.valueOf();
                    tdt.setMonth(0, 1);
                    if (tdt.getDay() !== 4) {
                        tdt.setMonth(0, 1 + ((4 - tdt.getDay()) + 7) % 7);
                    }
                    const weekNum = 1 + Math.ceil((firstThursday - tdt) / 604800000);
                    
                    semStr = `Sem ${String(weekNum).padStart(2, '0')}/${year}`;
                    semCode = (year * 100) + weekNum;
                }
            }
        }

        let periodCat = 'Outro';
        const pLower = periodoVal.toLowerCase();
        if (pLower.includes('manh') || pLower === 'm') periodCat = 'Manhã';
        else if (pLower.includes('tard') || pLower === 't') periodCat = 'Tarde';

        allRawData.push({
            Data: dataVal || '-',
            DateIso: dateIso,
            Operador: operadorVal || 'Não Informado',
            Periodo: periodoVal || '-',
            PeriodoCat: periodCat,
            Mes: mesStr, MesCode: mesCode,
            Semana: semStr, SemanaCode: semCode,
            Local: localVal || 'Não Informado',
            Equipamento: equipVal || 'Não Informado',
            Inicio: inicioVal || '-',
            Fim: fimVal || '-',
            DurationMinutes: durationMinutes
        });
    });
}

function populateFilterDropdowns() {
    const blocos = new Set();
    const semanas = new Set();
    const equipamentos = new Set();

    allRawData.forEach(r => {
        if (r.Local && r.Local !== 'Não Informado') blocos.add(r.Local);
        if (r.Semana && r.Semana !== 'Sem Data') semanas.add(r.Semana);
        if (r.Equipamento && r.Equipamento !== 'Não Informado') equipamentos.add(r.Equipamento);
    });

    const fillSelect = (id, items) => {
        const s = document.getElementById(id);
        if (!s) return;
        const currentVal = s.value;
        s.innerHTML = s.options[0].outerHTML; 
        Array.from(items).sort().forEach(val => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            s.appendChild(opt);
        });
        s.value = currentVal;
    };

    fillSelect('filterBloco', blocos);
    fillSelect('filterSemana', semanas);
    fillSelect('filterEquipamento', equipamentos);
}

function applyFilters() {
    const first = document.getElementById('filterDataInicio');
    const last = document.getElementById('filterDataFim');
    last.setCustomValidity(first.value && last.value && first.value > last.value ? 'A data final deve ser igual ou posterior à inicial.' : '');
    if (!last.checkValidity()) { last.reportValidity(); return; }

    const dInicio = document.getElementById('filterDataInicio')?.value;
    const dFim = document.getElementById('filterDataFim')?.value;
    const bloco = document.getElementById('filterBloco')?.value;
    const semana = document.getElementById('filterSemana')?.value;
    const equip = document.getElementById('filterEquipamento')?.value;

    validData = allRawData.filter(r => {
        if (dInicio && (!r.DateIso || r.DateIso < dInicio)) return false;
        if (dFim && (!r.DateIso || r.DateIso > dFim)) return false;
        if (bloco && r.Local !== bloco) return false;
        if (semana && r.Semana !== semana) return false;
        if (equip && r.Equipamento !== equip) return false;
        return true;
    });

    updateDashboard();
}

function clearFilters() {
    if (document.getElementById('filterDataInicio')) document.getElementById('filterDataInicio').value = '';
    if (document.getElementById('filterDataFim')) document.getElementById('filterDataFim').value = '';
    if (document.getElementById('filterBloco')) document.getElementById('filterBloco').value = '';
    if (document.getElementById('filterSemana')) document.getElementById('filterSemana').value = '';
    if (document.getElementById('filterEquipamento')) document.getElementById('filterEquipamento').value = '';
    applyFilters();
}

function calcDuration(inicio, fim) {
    if (!inicio || !fim || inicio === '-' || fim === '-') return 0;
    try {
        const parseToMinutes = (timeStr) => {
            let [h, m] = timeStr.replace(/[^\d:]/g, '').split(':');
            return (parseInt(h || 0) * 60) + parseInt(m || 0);
        };
        const startMins = parseToMinutes(inicio);
        let endMins = parseToMinutes(fim);
        if (endMins < startMins) endMins += (24 * 60); 
        const diff = endMins - startMins;
        return diff > 0 && diff < (24*60) ? diff : 0;
    } catch (e) { return 0; }
}

function formatDuration(totalMinutes) {
    totalMinutes = Math.max(0, Math.round(Number(totalMinutes) || 0));
    if (!totalMinutes || totalMinutes === 0) return '0 h 0 min';
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    return `${h} h ${m} min`;
}

function formatHMM(totalMinutes) {
    if (!totalMinutes || totalMinutes === 0) return '';
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    return `${h} h ${m} min`;
}

function updateStatusBadge(type, customText = '') {
    const b = document.getElementById('syncStatusBadge');
    if (!b) return;
    if (type === 'syncing') b.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Carregando...';
    else if (type === 'online') b.innerHTML = '<i class="fa-solid fa-circle-check mr-1"></i> Conectado';
    else if (type === 'error') b.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1"></i> ${customText}`;
}

function updateDashboard() {
    updateKPIs();
    renderCharts();
    renderTable();
}

function updateKPIs() {
    let totalMins = 0;
    let totalManhaMins = 0;
    let totalTardeMins = 0;
    const blocosMap = {}, equipMap = {}, mesMap = {}, opMap = {};
    const equipCountMap = {}; // Quantidade de usos por roçadeira
    const rocBlocoMap = {}; // Roçadeira por Bloco

    validData.forEach(row => {
        const m = row.DurationMinutes;
        totalMins += m;
        if (m > 0) {
            blocosMap[row.Local] = (blocosMap[row.Local] || 0) + m;
            equipMap[row.Equipamento] = (equipMap[row.Equipamento] || 0) + m;
            equipCountMap[row.Equipamento] = (equipCountMap[row.Equipamento] || 0) + 1;

            if (!rocBlocoMap[row.Local]) rocBlocoMap[row.Local] = {};
            rocBlocoMap[row.Local][row.Equipamento] = (rocBlocoMap[row.Local][row.Equipamento] || 0) + m;

            if (row.MesCode) mesMap[row.Mes] = (mesMap[row.Mes] || 0) + m;
            if (row.Operador !== 'Não Informado') opMap[row.Operador] = (opMap[row.Operador] || 0) + m;

            if (row.PeriodoCat === 'Manhã') totalManhaMins += m;
            else if (row.PeriodoCat === 'Tarde') totalTardeMins += m;
        }
    });

    // --- TAB 1 KPIs (Gerais) ---
    document.getElementById('kpiTotalTempo').innerText = formatDuration(totalMins);
    document.getElementById('kpiTempoManha').innerText = formatDuration(totalManhaMins);
    if(document.getElementById('kpiTempoTarde')) document.getElementById('kpiTempoTarde').innerText = formatDuration(totalTardeMins);

    let topB = 'Nenhum', maxB = 0;
    for (let b in blocosMap) if (blocosMap[b] > maxB) { maxB = blocosMap[b]; topB = b; }
    document.getElementById('kpiTopBloco').innerText = topB;
    document.getElementById('kpiTopBlocoTempo').innerText = formatDuration(maxB);

    let topE = 'Nenhuma', maxE = 0;
    for (let e in equipMap) if (equipMap[e] > maxE) { maxE = equipMap[e]; topE = e; }
    document.getElementById('kpiTopEquip').innerText = topE;
    document.getElementById('kpiTopEquipTempo').innerText = formatDuration(maxE);

    // --- TAB 2 KPIs (Comparativo) ---
    let topMes = 'Nenhum', maxMes = 0;
    let countMeses = Object.keys(mesMap).length;
    for (let m in mesMap) if (mesMap[m] > maxMes) { maxMes = mesMap[m]; topMes = m; }
    document.getElementById('kpiCompTopMes').innerText = topMes;
    document.getElementById('kpiCompTopMesTempo').innerText = formatDuration(maxMes);
    
    let avgMesMins = countMeses > 0 ? Math.round(totalMins / countMeses) : 0;
    document.getElementById('kpiCompMediaMes').innerText = formatDuration(avgMesMins);

    let validRowsCount = validData.filter(r => r.DurationMinutes > 0).length;
    let avgRegMins = validRowsCount > 0 ? Math.round(totalMins / validRowsCount) : 0;
    document.getElementById('kpiCompMediaRegistro').innerText = formatDuration(avgRegMins);

    // --- TAB 3 KPIs (Manuseio) ---
    let topOp = 'Nenhum', maxOp = 0;
    for (let o in opMap) if (opMap[o] > maxOp) { maxOp = opMap[o]; topOp = o; }
    document.getElementById('kpiManTopOp').innerText = topOp;
    document.getElementById('kpiManTopOpTempo').innerText = formatDuration(maxOp);

    document.getElementById('kpiManTotalManha').innerText = formatDuration(totalManhaMins);
    document.getElementById('kpiManTotalTarde').innerText = formatDuration(totalTardeMins);

    let pctM = totalMins > 0 ? Math.round((totalManhaMins / totalMins) * 100) : 0;
    let pctT = totalMins > 0 ? Math.round((totalTardeMins / totalMins) * 100) : 0;
    document.getElementById('kpiManPctManha').innerText = `${pctM}% do total`;
    document.getElementById('kpiManPctTarde').innerText = `${pctT}% do total`;

    // --- TAB 4 KPIs (Roçadeiras) ---
    let bestRendEquip = 'Nenhuma', maxRendAvg = 0, bestRendTotal = 0;
    for (let eq in equipMap) {
        const count = equipCountMap[eq] || 1;
        const avg = equipMap[eq] / count;
        if (avg > maxRendAvg) {
            maxRendAvg = avg;
            bestRendEquip = eq;
            bestRendTotal = equipMap[eq];
        }
    }
    document.getElementById('kpiRocMelhorRendimento').innerText = bestRendEquip;
    document.getElementById('kpiRocMelhorRendimentoVal').innerText = maxRendAvg > 0 ? `Média: ${formatDuration(Math.round(maxRendAvg))} / uso (${formatDuration(bestRendTotal)} total)` : 'Média: 0 h 0 min';

    // Equipamento mais usado no bloco líder
    let topRocInTopBloco = 'Nenhuma';
    if (topB !== 'Nenhum' && rocBlocoMap[topB]) {
        let maxMinsInBloco = 0;
        for (let eq in rocBlocoMap[topB]) {
            if (rocBlocoMap[topB][eq] > maxMinsInBloco) {
                maxMinsInBloco = rocBlocoMap[topB][eq];
                topRocInTopBloco = eq;
            }
        }
    }
    document.getElementById('kpiRocTopBlocoEquip').innerText = topRocInTopBloco;
    document.getElementById('kpiRocTopBlocoNome').innerText = topB !== 'Nenhum' ? `Bloco: ${topB}` : 'Bloco: -';

    const activeEquipsCount = Object.keys(equipMap).length;
    document.getElementById('kpiRocTotalAtivas').innerText = activeEquipsCount;

    const avgPerEquip = activeEquipsCount > 0 ? Math.round(totalMins / activeEquipsCount) : 0;
    document.getElementById('kpiRocMediaGeral').innerText = formatDuration(avgPerEquip);
}

function renderCharts() {
    const chartDefaults = {
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: { label: (ctx) => ` ${formatHMM(Math.round(ctx.raw * 60))}` }
            },
            datalabels: {
                anchor: 'end', 
                align: 'top', 
                color: '#475569', 
                font: { weight: 'bold', size: 10 },
                clip: false,
                formatter: (val) => val === 0 ? '' : formatHMM(Math.round(val * 60))
            }
        },
        maintainAspectRatio: false,
        scales: {
            y: { 
                beginAtZero: true, 
                grace: '15%',
                title: { display: true, text: 'Horas' }, 
                grid: { color: '#f1f5f9' } 
            },
            x: { grid: { display: false } }
        }
    };

    const blocosData = {}, equipData = {};
    const mesData = {};
    const opData = {};
    const periodoMesData = {};
    const periodoSemData = {};
    const equipSemanaData = {}; 
    const allEquipsChart = new Set();
    const rocBlocoDetail = {}; // Para gráfico de roçadeiras por bloco
    const equipCountMap = {}; // Para cálculo de rendimento

    validData.forEach(r => {
        if (r.DurationMinutes > 0) {
            blocosData[r.Local] = (blocosData[r.Local] || 0) + r.DurationMinutes;
            equipData[r.Equipamento] = (equipData[r.Equipamento] || 0) + r.DurationMinutes;
            equipCountMap[r.Equipamento] = (equipCountMap[r.Equipamento] || 0) + 1;

            // Mapeamento Roçadeiras por Bloco
            if (!rocBlocoDetail[r.Local]) rocBlocoDetail[r.Local] = {};
            rocBlocoDetail[r.Local][r.Equipamento] = (rocBlocoDetail[r.Local][r.Equipamento] || 0) + r.DurationMinutes;
            
            if (r.MesCode) {
                if(!mesData[r.MesCode]) mesData[r.MesCode] = { label: r.Mes, total: 0 };
                mesData[r.MesCode].total += r.DurationMinutes;

                if(!periodoMesData[r.MesCode]) periodoMesData[r.MesCode] = { label: r.Mes, manha: 0, tarde: 0 };
                if(r.PeriodoCat === 'Manhã') periodoMesData[r.MesCode].manha += r.DurationMinutes;
                else if(r.PeriodoCat === 'Tarde') periodoMesData[r.MesCode].tarde += r.DurationMinutes;
            }

            if (r.SemanaCode) {
                if(!periodoSemData[r.SemanaCode]) periodoSemData[r.SemanaCode] = { label: r.Semana, manha: 0, tarde: 0 };
                if(r.PeriodoCat === 'Manhã') periodoSemData[r.SemanaCode].manha += r.DurationMinutes;
                else if(r.PeriodoCat === 'Tarde') periodoSemData[r.SemanaCode].tarde += r.DurationMinutes;
                
                if(!equipSemanaData[r.SemanaCode]) equipSemanaData[r.SemanaCode] = { label: r.Semana, equips: {} };
                equipSemanaData[r.SemanaCode].equips[r.Equipamento] = (equipSemanaData[r.SemanaCode].equips[r.Equipamento] || 0) + r.DurationMinutes;
                allEquipsChart.add(r.Equipamento);
            }

            if(r.Operador !== 'Não Informado') opData[r.Operador] = (opData[r.Operador] || 0) + r.DurationMinutes;
        }
    });

    // 1. DADOS GERAIS: Tempo por Bloco
    const bKeys = Object.keys(blocosData).sort();
    if(chartBlocoInst) chartBlocoInst.destroy();
    chartBlocoInst = new Chart(document.getElementById('chartBloco'), {
        type: 'bar',
        data: {
            labels: bKeys,
            datasets: [{
                data: bKeys.map(k => (blocosData[k]/60)),
                backgroundColor: '#10b981', borderRadius: 6
            }]
        },
        options: chartDefaults
    });

    // 2. DADOS GERAIS: Tempo por Equipamento
    const eKeys = Object.keys(equipData).sort();
    if(chartEquipInst) chartEquipInst.destroy();
    chartEquipInst = new Chart(document.getElementById('chartEquipamento'), {
        type: 'bar',
        data: {
            labels: eKeys,
            datasets: [{
                data: eKeys.map(k => (equipData[k]/60)),
                backgroundColor: '#f97316', borderRadius: 6
            }]
        },
        options: chartDefaults
    });

    // 3. COMPARATIVO: Tempo por Mês
    const mesKeys = Object.keys(mesData).sort((a,b) => a - b);
    if(chartMesInst) chartMesInst.destroy();
    chartMesInst = new Chart(document.getElementById('chartMes'), {
        type: 'bar',
        data: {
            labels: mesKeys.map(k => mesData[k].label),
            datasets: [{
                data: mesKeys.map(k => (mesData[k].total/60)),
                backgroundColor: '#a855f7', borderRadius: 6
            }]
        },
        options: chartDefaults
    });

    // 4. COMPARATIVO: Uso de Roçadeiras por Semana
    const esKeys = Object.keys(equipSemanaData).sort((a,b) => a - b);
    const labelsES = esKeys.map(k => equipSemanaData[k].label);
    const equipsArray = Array.from(allEquipsChart).sort();
    const colorsList = ['#f87171', '#fb923c', '#facc15', '#a3e635', '#34d399', '#2dd4bf', '#38bdf8', '#818cf8', '#a78bfa', '#e879f9'];

    const datasetsES = equipsArray.map((eName, idx) => ({
        label: eName,
        data: esKeys.map(k => ((equipSemanaData[k].equips[eName]||0)/60)),
        backgroundColor: colorsList[idx % colorsList.length],
        borderRadius: 4
    }));

    if(chartBlocoSemanaInst) chartBlocoSemanaInst.destroy();
    chartBlocoSemanaInst = new Chart(document.getElementById('chartBlocoSemana'), {
        type: 'bar',
        data: { labels: labelsES, datasets: datasetsES },
        options: {
            ...chartDefaults,
            plugins: {
                ...chartDefaults.plugins,
                legend: { display: true, position: 'top', labels: { boxWidth: 12 } },
                datalabels: {
                    color: '#ffffff',
                    font: { weight: 'bold', size: 9 },
                    anchor: 'center', align: 'center',
                    formatter: (val) => val === 0 ? '' : formatHMM(Math.round(val * 60)),
                    display: function(context) { return context.dataset.data[context.dataIndex] > 0.5; } 
                }
            },
            scales: {
                x: { stacked: true, grid: { display: false } },
                y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Horas' } }
            }
        }
    });

    // 5. MANUSEIO: Operador (Decrescente)
    const opKeys = Object.keys(opData).sort((a,b) => opData[b] - opData[a]);
    if(chartOperadorInst) chartOperadorInst.destroy();
    chartOperadorInst = new Chart(document.getElementById('chartOperador'), {
        type: 'bar',
        data: {
            labels: opKeys,
            datasets: [{
                data: opKeys.map(k => (opData[k]/60)),
                backgroundColor: '#38bdf8', borderRadius: 6
            }]
        },
        options: chartDefaults
    });

    // Config para Gráficos de Período em Barras
    const periodBarOptions = {...chartDefaults, plugins: {...chartDefaults.plugins, datalabels: {...chartDefaults.plugins.datalabels}}};
    periodBarOptions.plugins.legend = { display: true, position: 'top' };
    periodBarOptions.plugins.datalabels.formatter = (val) => val === 0 ? '' : formatHMM(Math.round(val * 60));

    // 6. MANUSEIO: Manhã vs Tarde (Por Mês)
    const pmKeys = Object.keys(periodoMesData).sort((a,b) => a - b);
    if(chartPeriodoMesInst) chartPeriodoMesInst.destroy();
    chartPeriodoMesInst = new Chart(document.getElementById('chartPeriodoMes'), {
        type: 'bar',
        data: {
            labels: pmKeys.map(k => periodoMesData[k].label),
            datasets: [
                {
                    label: 'Manhã',
                    data: pmKeys.map(k => (periodoMesData[k].manha/60)),
                    backgroundColor: '#fbbf24', borderRadius: 4
                },
                {
                    label: 'Tarde',
                    data: pmKeys.map(k => (periodoMesData[k].tarde/60)),
                    backgroundColor: '#6366f1', borderRadius: 4
                }
            ]
        },
        options: periodBarOptions
    });

    // 7. MANUSEIO: Manhã vs Tarde (Por Semana)
    const psKeys = Object.keys(periodoSemData).sort((a,b) => a - b);
    if(chartPeriodoSemInst) chartPeriodoSemInst.destroy();
    chartPeriodoSemInst = new Chart(document.getElementById('chartPeriodoSemana'), {
        type: 'bar',
        data: {
            labels: psKeys.map(k => periodoSemData[k].label),
            datasets: [
                {
                    label: 'Manhã',
                    data: psKeys.map(k => (periodoSemData[k].manha/60)),
                    backgroundColor: '#fbbf24', borderRadius: 4
                },
                {
                    label: 'Tarde',
                    data: psKeys.map(k => (periodoSemData[k].tarde/60)),
                    backgroundColor: '#6366f1', borderRadius: 4
                }
            ]
        },
        options: periodBarOptions
    });

    // 8. ROÇADEIRAS: Roçadeiras Mais Usadas por Bloco (Gráfico de Barras Agrupado por Bloco)
    const blocosList = Object.keys(rocBlocoDetail).sort();
    const allEquipNames = Array.from(allEquipsChart).length > 0 ? Array.from(allEquipsChart).sort() : Object.keys(equipData).sort();
    
    const rocBlocoDatasets = allEquipNames.map((eName, idx) => ({
        label: eName,
        data: blocosList.map(b => ((rocBlocoDetail[b][eName] || 0)/60)),
        backgroundColor: colorsList[idx % colorsList.length],
        borderRadius: 4
    }));

    if(chartRocBlocoInst) chartRocBlocoInst.destroy();
    chartRocBlocoInst = new Chart(document.getElementById('chartRocBloco'), {
        type: 'bar',
        data: {
            labels: blocosList,
            datasets: rocBlocoDatasets
        },
        options: {
            ...chartDefaults,
            plugins: {
                ...chartDefaults.plugins,
                legend: { display: true, position: 'top', labels: { boxWidth: 12 } },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    color: '#475569',
                    font: { weight: 'bold', size: 9 },
                    formatter: (val) => val === 0 ? '' : formatHMM(Math.round(val * 60))
                }
            },
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, title: { display: true, text: 'Horas' } }
            }
        }
    });

    // 9. ROÇADEIRAS: Rendimento por Roçadeira (Performance e Rendimento Médio por Uso)
    const sortedEquipsByRend = Object.keys(equipData).sort((a,b) => {
        const avgA = equipData[a] / (equipCountMap[a] || 1);
        const avgB = equipData[b] / (equipCountMap[b] || 1);
        return avgB - avgA; // Decrescente por rendimento médio por sessão
    });

    const bestRendName = sortedEquipsByRend[0] || '';
    const bgColorsRend = sortedEquipsByRend.map(eq => eq === bestRendName ? '#f59e0b' : '#3b82f6'); // Destaque Dourado para o #1 em rendimento

    const avgDataRend = sortedEquipsByRend.map(eq => ((equipData[eq] / (equipCountMap[eq] || 1))/60));
    const totalDataRend = sortedEquipsByRend.map(eq => (equipData[eq]/60));

    if(chartRocRendimentoInst) chartRocRendimentoInst.destroy();
    chartRocRendimentoInst = new Chart(document.getElementById('chartRocRendimento'), {
        type: 'bar',
        data: {
            labels: sortedEquipsByRend,
            datasets: [
                {
                    label: 'Rendimento Médio por Uso (Horas)',
                    data: avgDataRend,
                    backgroundColor: bgColorsRend,
                    borderRadius: 6
                },
                {
                    label: 'Tempo Total Acumulado (Horas)',
                    data: totalDataRend,
                    backgroundColor: '#93c5fd',
                    borderRadius: 6
                }
            ]
        },
        options: {
            ...chartDefaults,
            plugins: {
                ...chartDefaults.plugins,
                legend: { display: true, position: 'top' },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` ${ctx.dataset.label}: ${formatHMM(Math.round(ctx.raw * 60))}`
                    }
                },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    color: '#1e293b',
                    font: { weight: 'bold', size: 10 },
                    formatter: (val) => val === 0 ? '' : formatHMM(Math.round(val * 60))
                }
            }
        }
    });
}

function renderTable() {
    const tbody = document.getElementById('tableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    validData.forEach((row, idx) => {
        const tr = document.createElement('tr');
        tr.className = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
        const dText = row.DurationMinutes > 0 ? formatDuration(row.DurationMinutes) : '-';
        
        tr.innerHTML = `
            <td class="p-4 font-medium text-slate-800">${reportEscape(row.Data)}</td>
            <td class="p-4 text-slate-600">${reportEscape(row.PeriodoCat)} (${reportEscape(row.Periodo)})</td>
            <td class="p-4"><span class="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-semibold rounded-md">${reportEscape(row.Local)}</span></td>
            <td class="p-4"><span class="px-2.5 py-1 bg-brand-50 text-brand-700 font-semibold rounded-md">${reportEscape(row.Equipamento)}</span></td>
            <td class="p-4 text-slate-600">${reportEscape(row.Operador)}</td>
            <td class="p-4 text-slate-500">${reportEscape(row.Inicio)}</td>
            <td class="p-4 text-slate-500">${reportEscape(row.Fim)}</td>
            <td class="p-4 text-right font-bold text-blue-600">${dText}</td>
        `;
        tbody.appendChild(tr);
    });
    document.getElementById('tableTotalCount').innerText = validData.length;
}

function switchTab(tabName) {
    const tabs = ['gerais', 'comparativo', 'manuseio', 'rocadeiras', 'tabela'];
    
    tabs.forEach(t => {
        const content = document.getElementById(`tabContent-${t}`);
        const btn = document.getElementById(`tabBtn-${t}`);
        
        if (t === tabName) {
            content.classList.add('active');
            btn.className = 'tab-btn px-4 py-2 rounded-lg transition flex items-center gap-2 whitespace-nowrap bg-brand-600 text-white shadow-md';
        } else {
            content.classList.remove('active');
            btn.className = 'tab-btn px-4 py-2 rounded-lg transition flex items-center gap-2 whitespace-nowrap text-slate-300 hover:bg-slate-800 hover:text-white';
        }
    });

    setTimeout(() => {
        if (tabName === 'gerais') {
            if(chartBlocoInst) chartBlocoInst.resize();
            if(chartEquipInst) chartEquipInst.resize();
        } else if (tabName === 'comparativo') {
            if(chartMesInst) chartMesInst.resize();
            if(chartBlocoSemanaInst) chartBlocoSemanaInst.resize();
        } else if (tabName === 'manuseio') {
            if(chartOperadorInst) chartOperadorInst.resize();
            if(chartPeriodoMesInst) chartPeriodoMesInst.resize();
            if(chartPeriodoSemInst) chartPeriodoSemInst.resize();
        } else if (tabName === 'rocadeiras') {
            if(chartRocBlocoInst) chartRocBlocoInst.resize();
            if(chartRocRendimentoInst) chartRocRendimentoInst.resize();
        }
    }, 50);
}

function openExportModal() {
    document.getElementById('exportModal').classList.remove('hidden');
}

function closeExportModal() {
    document.getElementById('exportModal').classList.add('hidden');
}