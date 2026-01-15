let csvData = [];
let csvDataPrev = [];
let allData = [];          // 全市场合约+期货公司数据（用于持仓排行榜）
let brokerDataAll = [];    // 当前选中期货公司的专用数据（来自带期货公司后缀的CSV）
let trendChart = null;     // 趋势图表实例

// 饼状图颜色配置
const chartColors = [
    '#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#fee140', '#30cfd0', '#a8edea', '#fed6e3', '#d299c2'
];

// 优化的CSV解析函数（更快）
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    const len = line.length;
    
    for (let i = 0; i < len; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

// 批量解析CSV（优化性能）
function parseCSV(text) {
    const lines = text.split('\n');
    const headers = parseCSVLine(lines[0]);
    const data = [];
    const headerCount = headers.length;
    
    for (let i = 1, len = lines.length; i < len; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = parseCSVLine(line);
        if (values.length >= headerCount && values[0]) {
            const row = {};
            for (let j = 0; j < headerCount; j++) {
                row[headers[j]] = values[j] || '';
            }
            if (row.datetime) {
                data.push(row);
            }
        }
    }
    return data;
}

// 绘制饼状图（带标签）
function drawPieChart(canvas, data) {
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 40; // 减小半径，为标签留空间
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let currentAngle = -Math.PI / 2;
    const total = data.reduce((sum, item) => sum + item.value, 0);
    
    data.forEach((item, index) => {
        const sliceAngle = (item.value / total) * 2 * Math.PI;
        const midAngle = currentAngle + sliceAngle / 2; // 扇形的中心角度
        
        // 绘制扇形
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = item.color;
        ctx.fill();
        
        // 绘制边框
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 计算标签位置（在扇形外部）
        const labelRadius = radius + 25; // 标签距离圆心的距离
        const labelX = centerX + Math.cos(midAngle) * labelRadius;
        const labelY = centerY + Math.sin(midAngle) * labelRadius;
        
        // 绘制标签文字
        ctx.save();
        ctx.font = 'bold 12px Arial, "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 绘制文字背景（白色半透明）
        const labelText = item.label;
        const percentText = item.percentage + '%';
        const textMetrics1 = ctx.measureText(labelText);
        const textMetrics2 = ctx.measureText(percentText);
        const textWidth = Math.max(textMetrics1.width, textMetrics2.width);
        const textHeight = 30;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(labelX - textWidth / 2 - 5, labelY - textHeight / 2, textWidth + 10, textHeight);
        
        // 绘制边框
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        ctx.strokeRect(labelX - textWidth / 2 - 5, labelY - textHeight / 2, textWidth + 10, textHeight);
        
        // 绘制名称
        ctx.fillStyle = '#333';
        ctx.fillText(labelText, labelX, labelY - 8);
        
        // 绘制百分比
        ctx.fillStyle = '#666';
        ctx.font = '11px Arial, "Microsoft YaHei", sans-serif';
        ctx.fillText(percentText, labelX, labelY + 8);
        
        ctx.restore();
        
        currentAngle += sliceAngle;
    });
}

// 计算汇总数据
function calculateSummary(data, prevBrokerMap, field) {
    // 本日合计
    const todayTotal = data.reduce((sum, item) => sum + item.value, 0);
    
    // 上日合计
    let prevTotal = 0;
    if (field === 'netLong' || field === 'netShort') {
        // 净持仓需要特殊处理
        prevBrokerMap.forEach(broker => {
            const netValue = field === 'netLong' ? (broker.long_oi - broker.short_oi) : (broker.short_oi - broker.long_oi);
            if (netValue > 0) prevTotal += netValue;
        });
    } else {
        prevBrokerMap.forEach(broker => {
            prevTotal += broker[field] || 0;
        });
    }
    
    // 总量增减
    const change = todayTotal - prevTotal;
    
    // 前5名、前10名、前20名合计
    const top5Total = data.slice(0, 5).reduce((sum, item) => sum + item.value, 0);
    const top10Total = data.slice(0, 10).reduce((sum, item) => sum + item.value, 0);
    const top20Total = data.slice(0, 20).reduce((sum, item) => sum + item.value, 0);
    
    return {
        todayTotal,
        prevTotal,
        change,
        top5Total,
        top10Total,
        top20Total
    };
}

// 生成饼状图数据（前5名 + 其他）
function generateChartData(rankingData) {
    if (rankingData.length === 0) return [];
    
    const top5 = rankingData.slice(0, 5);
    const others = rankingData.slice(5);
    const othersTotal = others.reduce((sum, item) => sum + item.value, 0);
    
    const chartData = top5.map((item, index) => ({
        label: item.broker,
        value: item.value,
        color: chartColors[index % chartColors.length],
        percentage: 0
    }));
    
    if (othersTotal > 0) {
        chartData.push({
            label: '其他',
            value: othersTotal,
            color: '#e0e0e0',
            percentage: 0
        });
    }
    
    const total = chartData.reduce((sum, item) => sum + item.value, 0);
    chartData.forEach(item => {
        item.percentage = ((item.value / total) * 100).toFixed(1);
    });
    
    return chartData;
}

// CSV文件列表（合约维度的汇总数据，用于“持仓排行榜”页面）
// 注意：这些文件是不带期货公司后缀的全市场数据
const CSV_FILES = [
    'SHFE_rb2601_2025-08-15_2026-01-13.csv',
    'SHFE_rb2603_2025-08-14_2026-01-12.csv',
    'SHFE_rb2605_2025-09-05_2026-01-12.csv'
];

// 根据当前合约和期货公司推导对应的“期货公司专用”CSV文件名
// 约定：公司专用文件名 = 原合约汇总文件名去掉“.csv”后 + '_' + 清洗后的期货公司名 + '.csv'
// 例如：SHFE_rb2605_2025-09-05_2026-01-12.csv + BROKER="Z中信期货"
//      => SHFE_rb2605_2025-09-05_2026-01-12_Z中信期货.csv
function getBrokerCsvFilename(symbol, brokerName) {
    if (!symbol || !brokerName) return null;
    
    const symbolKey = symbol.replace('.', '_'); // SHFE.rb2605 -> SHFE_rb2605
    // 找到与该合约匹配的基础汇总文件
    const baseFile = CSV_FILES.find(f => f.startsWith(`${symbolKey}_`));
    if (!baseFile) {
        console.warn(`未找到合约 ${symbol} 对应的基础CSV文件，无法推导期货公司专用文件名`);
        return null;
    }
    const baseName = baseFile.replace(/\.csv$/i, ''); // 去掉 .csv
    // 清洗期货公司名称，去掉不适合文件名的字符
    const brokerClean = brokerName.trim().replace(/[\\/:*?"<>|\s]+/g, '_');
    return `${baseName}_${brokerClean}.csv`;
}

// 加载CSV数据（优化版 - 支持多个文件）
async function loadCSV() {
    try {
        const startTime = performance.now();
        allData = [];
        
        // 并行加载所有CSV文件
        const loadPromises = CSV_FILES.map(async (filename) => {
            try {
                const response = await fetch(filename);
                if (!response.ok) {
                    console.warn(`无法加载文件: ${filename}`);
                    return [];
                }
                const text = await response.text();
                const data = parseCSV(text);
                console.log(`成功加载 ${filename}: ${data.length} 条记录`);
                return data;
            } catch (error) {
                console.warn(`加载文件 ${filename} 失败:`, error);
                return [];
            }
        });
        
        // 等待所有文件加载完成并合并数据
        const allFileData = await Promise.all(loadPromises);
        allData = allFileData.flat(); // 合并所有数组
        
        // 设置默认日期为最新日期（优化：使用Set去重更快）
        const dateSet = new Set();
        const symbolSet = new Set();
        for (let i = 0, len = allData.length; i < len; i++) {
            if (allData[i].datetime) {
                dateSet.add(allData[i].datetime);
            }
            if (allData[i].symbol) {
                symbolSet.add(allData[i].symbol);
            }
        }
        const dates = Array.from(dateSet).sort().reverse();
        
        if (dates.length > 0) {
            const latestDate = dates[0];
            const formattedDate = `${latestDate.substring(0, 4)}-${latestDate.substring(4, 6)}-${latestDate.substring(6, 8)}`;
            document.getElementById('date').value = formattedDate;
        }
        
        // 动态加载合约列表
        populateSymbolSelect(Array.from(symbolSet).sort());
        
        // 填充期货公司选择器
        populateBrokerSelect();
        
        const loadTime = performance.now() - startTime;
        console.log(`数据加载完成，耗时: ${loadTime.toFixed(2)}ms，共 ${allData.length} 条记录，${symbolSet.size} 个合约`);
        
        queryData();
    } catch (error) {
        document.getElementById('rankings-container').innerHTML = 
            '<div class="error">加载数据失败，请确保CSV文件在同一目录下</div>';
        console.error('Error loading CSV:', error);
    }
}

// 动态填充合约选择器
function populateSymbolSelect(symbols) {
    const select = document.getElementById('symbol');
    // 清空选择器
    select.innerHTML = '';
    
    // 添加所有合约选项
    symbols.forEach(symbol => {
        const option = document.createElement('option');
        option.value = symbol;
        option.textContent = symbol;
        select.appendChild(option);
    });
    
    // 默认选择第一个合约
    if (symbols.length > 0) {
        select.value = symbols[0];
    }
}

// 查询数据
function queryData() {
    const symbol = document.getElementById('symbol').value.trim();
    let dateInput = document.getElementById('date').value;
    
    if (!symbol) {
        // 如果没有选择合约，不执行查询
        return;
    }
    
    // 如果没有选择日期，或者选择的日期在当前合约中没有数据，自动选择该合约有数据的最新日期
    if (!dateInput) {
        dateInput = findLatestDateForSymbol(symbol);
        if (dateInput) {
            document.getElementById('date').value = dateInput;
        } else {
            document.getElementById('rankings-container').innerHTML = 
                '<div class="error">该合约暂无数据</div>';
            return;
        }
    } else {
        // 检查选择的日期是否有数据
        const dateStr = dateInput.replace(/-/g, '');
        const hasData = allData.some(row => row.datetime === dateStr && row.symbol === symbol);
        if (!hasData) {
            // 如果选择的日期没有数据，自动切换到该合约有数据的最新日期
            const latestDate = findLatestDateForSymbol(symbol);
            if (latestDate) {
                document.getElementById('date').value = latestDate;
                dateInput = latestDate;
            } else {
                document.getElementById('rankings-container').innerHTML = 
                    '<div class="error">该合约在选择的日期没有数据，请选择其他日期</div>';
                return;
            }
        }
    }
    
    const dateStr = dateInput.replace(/-/g, '');
    
    // 获取本日数据，只显示选择的合约
    csvData = allData.filter(row => {
        return row.datetime === dateStr && row.symbol === symbol;
    });
    
    // 获取上日数据（用于对比）
    const dateObj = new Date(dateInput);
    dateObj.setDate(dateObj.getDate() - 1);
    const prevDateStr = dateObj.toISOString().slice(0, 10).replace(/-/g, '');
    
    csvDataPrev = allData.filter(row => {
        return row.datetime === prevDateStr && row.symbol === symbol;
    });
    
    if (csvData.length === 0) {
        document.getElementById('rankings-container').innerHTML = 
            '<div class="error">未找到指定日期和合约的数据</div>';
        // 即使没有数据，也尝试渲染分析图表（可能跨期表格有数据）
        renderAnalysisCharts();
        return;
    }
    
    renderRankings();
    renderAnalysisCharts();
}

// 查找指定合约有数据的最新日期
function findLatestDateForSymbol(symbol) {
    const dateSet = new Set();
    for (let i = 0, len = allData.length; i < len; i++) {
        if (allData[i].symbol === symbol && allData[i].datetime) {
            dateSet.add(allData[i].datetime);
        }
    }
    const dates = Array.from(dateSet).sort().reverse();
    if (dates.length > 0) {
        const latestDate = dates[0];
        return `${latestDate.substring(0, 4)}-${latestDate.substring(4, 6)}-${latestDate.substring(6, 8)}`;
    }
    return null;
}

// 渲染排名（优化版）
function renderRankings() {
    const startTime = performance.now();
    const container = document.getElementById('rankings-container');
    
    // 合并同一天同一期货公司的数据（优化：减少parseFloat调用）
    const brokerMap = new Map();
    const dataLen = csvData.length;
    
    for (let i = 0; i < dataLen; i++) {
        const d = csvData[i];
        const key = d.broker;
        let broker = brokerMap.get(key);
        
        if (!broker) {
            broker = {
                broker: key,
                volume: 0,
                volume_change: 0,
                volume_ranking: 999,
                long_oi: 0,
                long_change: 0,
                long_ranking: 999,
                short_oi: 0,
                short_change: 0,
                short_ranking: 999
            };
            brokerMap.set(key, broker);
        }
        
        // 批量处理数值转换（减少函数调用）
        const vol = +d.volume || 0;
        const long = +d.long_oi || 0;
        const short = +d.short_oi || 0;
        const volRank = +d.volume_ranking || 999;
        const longRank = +d.long_ranking || 999;
        const shortRank = +d.short_ranking || 999;
        
        if (vol > broker.volume) {
            broker.volume = vol;
            broker.volume_change = +d.volume_change || 0;
            broker.volume_ranking = volRank;
        }
        if (long > broker.long_oi) {
            broker.long_oi = long;
            broker.long_change = +d.long_change || 0;
            broker.long_ranking = longRank;
        }
        if (short > broker.short_oi) {
            broker.short_oi = short;
            broker.short_change = +d.short_change || 0;
            broker.short_ranking = shortRank;
        }
    }
    
    const allBrokers = Array.from(brokerMap.values());
    
    // 数据处理（优化：减少链式调用，合并操作）
    const volumeData = [];
    const longData = [];
    const shortData = [];
    const netLongData = [];
    const netShortData = [];
    
    // 预处理数据
    for (let i = 0, len = allBrokers.length; i < len; i++) {
        const d = allBrokers[i];
        
        if (d.volume > 0) {
            volumeData.push({
                broker: d.broker,
                value: d.volume,
                change: d.volume_change,
                rank: d.volume_ranking
            });
        }
        
        if (d.long_oi > 0) {
            longData.push({
                broker: d.broker,
                value: d.long_oi,
                change: d.long_change,
                rank: d.long_ranking
            });
        }
        
        if (d.short_oi > 0) {
            shortData.push({
                broker: d.broker,
                value: d.short_oi,
                change: d.short_change,
                rank: d.short_ranking
            });
        }
        
        const netLong = d.long_oi - d.short_oi;
        if (netLong > 0) {
            netLongData.push({
                broker: d.broker,
                value: netLong,
                rank: 0
            });
        }
        
        const netShort = d.short_oi - d.long_oi;
        if (netShort > 0) {
            netShortData.push({
                broker: d.broker,
                value: netShort,
                rank: 0
            });
        }
    }
    
    // 排序和切片（优化：一次性完成）
    volumeData.sort((a, b) => a.rank - b.rank).splice(20);
    longData.sort((a, b) => {
        if (a.rank !== 999 && b.rank !== 999) return a.rank - b.rank;
        return b.value - a.value;
    }).splice(20);
    longData.forEach((d, i) => { if (d.rank === 999) d.rank = i + 1; });
    
    shortData.sort((a, b) => {
        if (a.rank !== 999 && b.rank !== 999) return a.rank - b.rank;
        return b.value - a.value;
    }).splice(20);
    shortData.forEach((d, i) => { if (d.rank === 999) d.rank = i + 1; });
    
    netLongData.sort((a, b) => b.value - a.value).splice(20);
    netLongData.forEach((d, i) => { d.rank = i + 1; });
    
    netShortData.sort((a, b) => b.value - a.value).splice(20);
    netShortData.forEach((d, i) => { d.rank = i + 1; });
    
    // 使用DocumentFragment优化DOM操作
    const fragment = document.createDocumentFragment();
    const grid = document.createElement('div');
    grid.className = 'rankings-grid';
    
    // 预先计算图表数据，避免后续DOM查询
    const chartDataMap = new Map();
    chartDataMap.set('volume', generateChartData(volumeData));
    chartDataMap.set('long', generateChartData(longData));
    chartDataMap.set('short', generateChartData(shortData));
    chartDataMap.set('netLong', generateChartData(netLongData));
    chartDataMap.set('netShort', generateChartData(netShortData));
    
    // 计算上日数据（用于汇总对比）
    const prevBrokerMap = new Map();
    for (let i = 0, len = csvDataPrev.length; i < len; i++) {
        const d = csvDataPrev[i];
        const key = d.broker;
        let broker = prevBrokerMap.get(key);
        if (!broker) {
            broker = { volume: 0, long_oi: 0, short_oi: 0 };
            prevBrokerMap.set(key, broker);
        }
        broker.volume = Math.max(broker.volume, +d.volume || 0);
        broker.long_oi = Math.max(broker.long_oi, +d.long_oi || 0);
        broker.short_oi = Math.max(broker.short_oi, +d.short_oi || 0);
    }
    
    // 计算各类型的汇总数据
    const volumeSummary = calculateSummary(volumeData, prevBrokerMap, 'volume');
    const longSummary = calculateSummary(longData, prevBrokerMap, 'long_oi');
    const shortSummary = calculateSummary(shortData, prevBrokerMap, 'short_oi');
    const netLongSummary = calculateSummary(netLongData, prevBrokerMap, 'netLong');
    const netShortSummary = calculateSummary(netShortData, prevBrokerMap, 'netShort');
    
    grid.innerHTML = 
        renderRankingCard('成交量排名', volumeData, 'volume', chartDataMap.get('volume'), volumeSummary) +
        renderRankingCard('多头持仓排名', longData, 'long', chartDataMap.get('long'), longSummary) +
        renderRankingCard('空头持仓排名', shortData, 'short', chartDataMap.get('short'), shortSummary) +
        renderRankingCard('净多头排名', netLongData, 'netLong', chartDataMap.get('netLong'), netLongSummary) +
        renderRankingCard('净空头排名', netShortData, 'netShort', chartDataMap.get('netShort'), netShortSummary);
    
    fragment.appendChild(grid);
    container.innerHTML = '';
    container.appendChild(fragment);
    
    // 使用requestAnimationFrame优化渲染，直接使用预计算的图表数据
    requestAnimationFrame(() => {
        const charts = document.querySelectorAll('.pie-chart canvas');
        const chartDataArray = [
            chartDataMap.get('volume'),
            chartDataMap.get('long'),
            chartDataMap.get('short'),
            chartDataMap.get('netLong'),
            chartDataMap.get('netShort')
        ];
        
        for (let i = 0, len = charts.length; i < len; i++) {
            if (chartDataArray[i] && chartDataArray[i].length > 0) {
                drawPieChart(charts[i], chartDataArray[i]);
            }
        }
        
        const renderTime = performance.now() - startTime;
        console.log(`渲染完成，耗时: ${renderTime.toFixed(2)}ms`);
    });
}

// 渲染排名卡片（优化版：接受预计算的图表数据和汇总数据）
function renderRankingCard(title, data, type, chartData, summary) {
    if (data.length === 0) {
        return `
            <div class="ranking-card">
                <div class="ranking-header">
                    <h2 class="ranking-title">${title}</h2>
                </div>
                <div class="chart-container">
                    <div class="loading">暂无数据</div>
                </div>
            </div>
        `;
    }
    
    // 使用传入的预计算图表数据
    if (!chartData || chartData.length === 0) {
        chartData = generateChartData(data);
    }
    
    const chartId = `chart-${type}-${Date.now()}-${Math.random()}`;
    const cardId = `card-${type}`;
    
    // 渲染汇总数据面板
    let summaryPanel = '';
    if (summary) {
        const changeClass = summary.change >= 0 ? 'positive' : 'negative';
        const changeStr = summary.change >= 0 ? '+' + summary.change.toLocaleString() : summary.change.toLocaleString();
        summaryPanel = `
            <div class="summary-panel">
                <div class="summary-left">
                    <div class="summary-row">
                        <span class="summary-label">本日合计:</span>
                        <span class="summary-value">${summary.todayTotal.toLocaleString()}</span>
                    </div>
                    <div class="summary-row">
                        <span class="summary-label">上日合计:</span>
                        <span class="summary-value">${summary.prevTotal.toLocaleString()}</span>
                    </div>
                    <div class="summary-row">
                        <span class="summary-label">总量增减:</span>
                        <span class="summary-value ${changeClass}">${changeStr}</span>
                    </div>
                </div>
                <div class="summary-right">
                    <div class="summary-row">
                        <span class="summary-label">前5名合计:</span>
                        <span class="summary-value">${summary.top5Total.toLocaleString()}</span>
                    </div>
                    <div class="summary-row">
                        <span class="summary-label">前10名合计:</span>
                        <span class="summary-value">${summary.top10Total.toLocaleString()}</span>
                    </div>
                    <div class="summary-row">
                        <span class="summary-label">前20名合计:</span>
                        <span class="summary-value">${summary.top20Total.toLocaleString()}</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    // 渲染表头（支持排序）
    const tableHeader = `
        <div class="ranking-header-row">
            <div class="header-cell rank-header" onclick="sortTable('${cardId}', 'rank')">
                <span>排名</span>
                <span class="sort-icon" id="${cardId}-rank-icon">⇅</span>
            </div>
            <div class="header-cell name-header" onclick="sortTable('${cardId}', 'name')">
                <span>期货公司</span>
                <span class="sort-icon" id="${cardId}-name-icon">⇅</span>
            </div>
            <div class="header-cell value-header" onclick="sortTable('${cardId}', 'value')">
                <span>数值</span>
                <span class="sort-icon" id="${cardId}-value-icon">⇅</span>
            </div>
            <div class="header-cell change-header" onclick="sortTable('${cardId}', 'change')">
                <span>变化</span>
                <span class="sort-icon" id="${cardId}-change-icon">⇅</span>
            </div>
        </div>
    `;
    
    // 优化：使用for循环和数组拼接，比map+join更快
    let items = '';
    const dataLen = data.length;
    for (let i = 0; i < dataLen; i++) {
        const item = data[i];
        const rank = item.rank || (i + 1);
        const change = item.change || 0;
        const changeClass = change >= 0 ? 'positive' : 'negative';
        let changeIndicator = '';
        if (change !== 0) {
            const changeStr = change >= 0 ? '+' + change.toLocaleString() : change.toLocaleString();
            changeIndicator = `<span class="change-indicator ${change >= 0 ? 'up' : 'down'}"></span>
             <span class="change-value ${changeClass}">${changeStr}</span>`;
        }
        
        const rankClass = rank === 1 ? 'top1' : (rank <= 3 ? 'top3' : '');
        const valueStr = item.value.toLocaleString();
        
        items += `
            <div class="ranking-item" data-rank="${rank}" data-name="${item.broker}" data-value="${item.value}" data-change="${change}">
                <div class="rank-number ${rankClass}">${rank}</div>
                <div class="broker-name clickable" onclick="showBrokerDetail('${item.broker}')" title="点击查看详情">${item.broker}</div>
                <div class="value-container">
                    <div class="value">${valueStr}</div>
                    ${changeIndicator}
                </div>
            </div>
        `;
    }
    
    return `
        <div class="ranking-card" id="${cardId}">
            <div class="ranking-header">
                <h2 class="ranking-title">${title}</h2>
            </div>
            <div class="chart-container">
                <div class="pie-chart-wrapper">
                    <div class="pie-chart">
                        <canvas id="${chartId}" width="300" height="300"></canvas>
                    </div>
                    ${summaryPanel}
                </div>
            </div>
            <div class="ranking-list-container">
                ${tableHeader}
                <div class="ranking-list">${items}</div>
            </div>
        </div>
    `;
}

// 排序函数
function sortTable(cardId, field) {
    const card = document.getElementById(cardId);
    if (!card) return;
    
    const list = card.querySelector('.ranking-list');
    const items = Array.from(list.querySelectorAll('.ranking-item'));
    
    // 获取当前排序状态
    const icon = document.getElementById(`${cardId}-${field}-icon`);
    let currentSort = icon.getAttribute('data-sort') || 'none';
    
    // 切换排序方向
    let sortOrder = 'asc';
    if (currentSort === 'asc') {
        sortOrder = 'desc';
    } else if (currentSort === 'desc') {
        sortOrder = 'asc';
    }
    
    // 重置所有排序图标
    card.querySelectorAll('.sort-icon').forEach(ic => {
        ic.textContent = '⇅';
        ic.setAttribute('data-sort', 'none');
    });
    
    // 设置当前排序图标
    icon.textContent = sortOrder === 'asc' ? '↑' : '↓';
    icon.setAttribute('data-sort', sortOrder);
    
    // 排序数据
    items.sort((a, b) => {
        let aVal, bVal;
        
        switch(field) {
            case 'rank':
                aVal = parseInt(a.getAttribute('data-rank')) || 0;
                bVal = parseInt(b.getAttribute('data-rank')) || 0;
                break;
            case 'name':
                aVal = a.getAttribute('data-name') || '';
                bVal = b.getAttribute('data-name') || '';
                break;
            case 'value':
                aVal = parseFloat(a.getAttribute('data-value')) || 0;
                bVal = parseFloat(b.getAttribute('data-value')) || 0;
                break;
            case 'change':
                aVal = parseFloat(a.getAttribute('data-change')) || 0;
                bVal = parseFloat(b.getAttribute('data-change')) || 0;
                break;
            default:
                return 0;
        }
        
        if (field === 'name') {
            // 字符串排序
            return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        } else {
            // 数字排序
            return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        }
    });
    
    // 重新插入排序后的元素
    items.forEach(item => list.appendChild(item));
}

// 渲染分析图表
function renderAnalysisCharts() {
    const symbol = document.getElementById('symbol').value.trim();
    
    // 渲染趋势图
    renderTrendChart(symbol);
    
    // 渲染跨期净持仓表格
    renderCrossPeriodTable(symbol);
}

// 渲染趋势图（近3个月）
function renderTrendChart(symbol) {
    if (!symbol) return;
    
    // 获取近3个月的数据
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);
    
    // 过滤数据：指定合约，近3个月
    const filteredData = allData.filter(row => {
        if (row.symbol !== symbol) return false;
        if (!row.datetime) return false;
        
        const rowDate = new Date(
            parseInt(row.datetime.substring(0, 4)),
            parseInt(row.datetime.substring(4, 6)) - 1,
            parseInt(row.datetime.substring(6, 8))
        );
        
        return rowDate >= startDate && rowDate <= endDate;
    });
    
    // 按日期和期货公司聚合数据（避免重复计算）
    const dateBrokerMap = new Map();
    
    filteredData.forEach(row => {
        const date = row.datetime;
        const broker = row.broker;
        const key = `${date}_${broker}`;
        
        if (!dateBrokerMap.has(key)) {
            dateBrokerMap.set(key, {
                date: date,
                broker: broker,
                long_oi: 0,
                short_oi: 0,
                volume: 0
            });
        }
        
        const item = dateBrokerMap.get(key);
        // 取最大值，因为同一期货公司可能有多条记录（不同排名类型）
        item.long_oi = Math.max(item.long_oi, parseFloat(row.long_oi) || 0);
        item.short_oi = Math.max(item.short_oi, parseFloat(row.short_oi) || 0);
        item.volume = Math.max(item.volume, parseFloat(row.volume) || 0);
    });
    
    // 按日期聚合所有期货公司的数据
    const dateMap = new Map();
    
    dateBrokerMap.forEach(item => {
        const date = item.date;
        if (!dateMap.has(date)) {
            dateMap.set(date, {
                date: date,
                totalLong: 0,
                totalShort: 0,
                totalVolume: 0
            });
        }
        
        const dayData = dateMap.get(date);
        dayData.totalLong += item.long_oi;
        dayData.totalShort += item.short_oi;
        dayData.totalVolume += item.volume;
    });
    
    // 转换为数组并排序
    const chartData = Array.from(dateMap.values())
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-90); // 最多显示90天
    
    if (chartData.length === 0) {
        document.getElementById('trendChart').parentElement.innerHTML = 
            '<div class="loading">暂无数据</div>';
        return;
    }
    
    // 准备图表数据
    const labels = chartData.map(d => {
        const date = d.date;
        return `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
    });
    
    const totalLongData = chartData.map(d => d.totalLong);
    const totalShortData = chartData.map(d => d.totalShort);
    const netPositionData = chartData.map(d => d.totalLong - d.totalShort);
    
    // 计算价格数据（使用成交量作为价格代理，因为CSV中没有价格数据）
    // 实际应用中应该从价格数据源获取
    const priceData = chartData.map(d => {
        // 使用持仓量变化趋势模拟价格，实际应该用真实价格数据
        const basePrice = 65000;
        const variation = (d.totalLong - d.totalShort) / 1000;
        return basePrice + variation;
    });
    
    // 销毁旧图表
    if (trendChart) {
        trendChart.destroy();
    }
    
    // 创建新图表
    const ctx = document.getElementById('trendChart').getContext('2d');
    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '总多头',
                    data: totalLongData,
                    borderColor: '#2196F3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    yAxisID: 'y'
                },
                {
                    label: '总空头',
                    data: totalShortData,
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    yAxisID: 'y'
                },
                {
                    label: '收盘价',
                    data: priceData,
                    borderColor: '#F44336',
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                },
                tooltip: {
                    enabled: true,
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: '日期'
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: '持仓量'
                    },
                    beginAtZero: false
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: '价格'
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                    beginAtZero: false
                }
            }
        }
    });
    
    // 重新创建包含所有数据的图表（使用混合图表）
    trendChart.destroy();
    
    // 创建混合图表：折线图 + 柱状图
    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '总多头',
                    data: totalLongData,
                    borderColor: '#2196F3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    yAxisID: 'y'
                },
                {
                    label: '总空头',
                    data: totalShortData,
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    yAxisID: 'y'
                },
                {
                    type: 'bar',
                    label: '净持仓',
                    data: netPositionData,
                    backgroundColor: netPositionData.map(v => v >= 0 ? 'rgba(255, 193, 7, 0.6)' : 'rgba(255, 87, 34, 0.6)'),
                    borderColor: netPositionData.map(v => v >= 0 ? 'rgba(255, 193, 7, 1)' : 'rgba(255, 87, 34, 1)'),
                    borderWidth: 1,
                    yAxisID: 'y',
                    order: 1
                },
                {
                    label: '收盘价',
                    data: priceData,
                    borderColor: '#F44336',
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    yAxisID: 'y1',
                    order: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                },
                tooltip: {
                    enabled: true,
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: '日期'
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        maxTicksLimit: 15
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: '持仓量'
                    },
                    beginAtZero: false
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: '价格'
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                    beginAtZero: false
                }
            }
        }
    });
}

// 渲染跨期净持仓表格
function renderCrossPeriodTable(symbol) {
    if (!symbol) return;
    
    // 获取当前查询日期的数据
    const dateInput = document.getElementById('date').value;
    if (!dateInput) return;
    
    const dateStr = dateInput.replace(/-/g, '');
    
    // 获取指定日期的所有合约数据（按合约和期货公司去重）
    const contractBrokerMap = new Map();
    
    // 提取品种代码（例如：SHFE.rb2605 -> rb）
    const symbolParts = symbol.split('.');
    const productCode = symbolParts.length > 1 ? symbolParts[1].substring(0, 2) : '';
    
    allData.forEach(row => {
        // 只处理指定日期的数据
        if (row.datetime !== dateStr) return;
        
        // 只显示相同品种的合约（例如：rb2605, rb2603, rb2601 等）
        if (productCode && !row.symbol.includes(productCode)) {
            return;
        }
        
        const contractSymbol = row.symbol;
        const broker = row.broker;
        const key = `${contractSymbol}_${broker}`;
        
        if (!contractBrokerMap.has(key)) {
            contractBrokerMap.set(key, {
                symbol: contractSymbol,
                broker: broker,
                long_oi: 0,
                short_oi: 0
            });
        }
        
        const item = contractBrokerMap.get(key);
        // 取最大值，避免重复计算
        item.long_oi = Math.max(item.long_oi, parseFloat(row.long_oi) || 0);
        item.short_oi = Math.max(item.short_oi, parseFloat(row.short_oi) || 0);
    });
    
    // 按合约聚合所有期货公司的数据
    const symbolMap = new Map();
    
    contractBrokerMap.forEach(item => {
        const contractSymbol = item.symbol;
        if (!symbolMap.has(contractSymbol)) {
            symbolMap.set(contractSymbol, {
                symbol: contractSymbol,
                totalLong: 0,
                totalShort: 0
            });
        }
        
        const contractData = symbolMap.get(contractSymbol);
        contractData.totalLong += item.long_oi;
        contractData.totalShort += item.short_oi;
    });
    
    // 转换为数组并计算净持仓
    const tableData = Array.from(symbolMap.values())
        .map(item => {
            const netLong = item.totalLong - item.totalShort;
            const netShort = item.totalShort - item.totalLong;
            
            return {
                symbol: item.symbol,
                netLong: netLong > 0 ? netLong : 0,
                netShort: netShort > 0 ? netShort : 0,
                totalPosition: item.totalLong + item.totalShort
            };
        })
        .filter(item => item.totalPosition > 0)
        .sort((a, b) => {
            // 按合约月份排序
            const aMatch = a.symbol.match(/(\d{4})/);
            const bMatch = b.symbol.match(/(\d{4})/);
            if (aMatch && bMatch) {
                return aMatch[1].localeCompare(bMatch[1]);
            }
            return a.symbol.localeCompare(b.symbol);
        });
    
    if (tableData.length === 0) {
        document.getElementById('cross-period-table').innerHTML = 
            '<div class="loading">暂无数据</div>';
        return;
    }
    
    // 渲染表格
    let tableHTML = `
        <table class="cross-period-table">
            <thead>
                <tr>
                    <th>合约月份</th>
                    <th>净多头 (手)</th>
                    <th>净空头 (手)</th>
                    <th>总持仓</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    // 计算汇总数据
    let totalNetLong = 0;
    let totalNetShort = 0;
    let totalPosition = 0;
    
    tableData.forEach(item => {
        totalNetLong += item.netLong;
        totalNetShort += item.netShort;
        totalPosition += item.totalPosition;
        
        tableHTML += `
            <tr>
                <td>${item.symbol}</td>
                <td class="net-long">${item.netLong > 0 ? item.netLong.toLocaleString() : '-'}</td>
                <td class="net-short">${item.netShort > 0 ? item.netShort.toLocaleString() : '-'}</td>
                <td class="total-position">${item.totalPosition.toLocaleString()}</td>
            </tr>
        `;
    });
    
    // 添加汇总行
    tableHTML += `
            </tbody>
            <tfoot>
                <tr class="summary-row">
                    <td><strong>合计</strong></td>
                    <td class="net-long"><strong>${totalNetLong > 0 ? totalNetLong.toLocaleString() : '-'}</strong></td>
                    <td class="net-short"><strong>${totalNetShort > 0 ? totalNetShort.toLocaleString() : '-'}</strong></td>
                    <td class="total-position"><strong>${totalPosition.toLocaleString()}</strong></td>
                </tr>
            </tfoot>
        </table>
    `;
    
    document.getElementById('cross-period-table').innerHTML = tableHTML;
}

// 页面切换函数
function switchPage(pageType) {
    const rankingsPage = document.getElementById('page-rankings');
    const brokerDetailPage = document.getElementById('page-broker-detail');
    const navRankings = document.getElementById('nav-rankings');
    const navBrokerDetail = document.getElementById('nav-broker-detail');
    
    // 控制顶部控制栏的显示
    const controlSymbol = document.getElementById('control-symbol');
    const controlDate = document.getElementById('control-date');
    const controlBroker = document.getElementById('control-broker');
    const btnQuery = document.getElementById('btn-query');
    
    if (pageType === 'rankings') {
        rankingsPage.style.display = 'block';
        brokerDetailPage.style.display = 'none';
        navRankings.classList.add('active');
        navBrokerDetail.classList.remove('active');
        
        // 显示合约代码和日期，隐藏期货公司选择器和查询按钮
        if (controlSymbol) controlSymbol.style.display = 'flex';
        if (controlDate) controlDate.style.display = 'flex';
        if (controlBroker) controlBroker.style.display = 'none';
        if (btnQuery) btnQuery.style.display = 'block';
    } else if (pageType === 'broker-detail') {
        rankingsPage.style.display = 'none';
        brokerDetailPage.style.display = 'block';
        navRankings.classList.remove('active');
        navBrokerDetail.classList.add('active');
        
        // 显示所有控制项（合约代码、日期、期货公司），隐藏查询按钮
        if (controlSymbol) controlSymbol.style.display = 'flex';
        if (controlDate) controlDate.style.display = 'flex';
        if (controlBroker) controlBroker.style.display = 'flex';
        if (btnQuery) btnQuery.style.display = 'none';
        
        // 如果已经选择了期货公司，自动更新图表
        const brokerSelectHeader = document.getElementById('broker-select-header');
        if (brokerSelectHeader && brokerSelectHeader.value) {
            updateBrokerDetail(brokerSelectHeader.value);
        }
    }
}

// 填充期货公司选择器
function populateBrokerSelect() {
    const brokerSelectHeader = document.getElementById('broker-select-header');
    if (!brokerSelectHeader) return;
    
    // 获取所有唯一的期货公司名称
    const brokers = new Set();
    allData.forEach(row => {
        if (row.broker) {
            brokers.add(row.broker);
        }
    });
    
    // 清空现有选项（保留第一个"请选择"选项）
    brokerSelectHeader.innerHTML = '<option value="">请选择期货公司</option>';
    
    // 按字母顺序排序并添加选项
    const sortedBrokers = Array.from(brokers).sort();
    sortedBrokers.forEach(broker => {
        const option = document.createElement('option');
        option.value = broker;
        option.textContent = broker;
        brokerSelectHeader.appendChild(option);
    });
}

// 期货公司选择器变化事件（切换期货公司时，优先加载对应的专用CSV数据）
async function onBrokerSelectChange() {
    const brokerSelectHeader = document.getElementById('broker-select-header');
    const brokerName = brokerSelectHeader ? brokerSelectHeader.value : '';
    
    if (brokerName) {
        await loadBrokerDataForCurrentSelection(brokerName);
        updateBrokerDetail(brokerName);
    } else {
        brokerDataAll = [];
        clearBrokerCharts();
    }
}

// 更新期货公司详情页
function updateBrokerDetail(brokerName) {
    // 更新标题
    document.getElementById('broker-detail-title').textContent = `${brokerName} - 持仓分析`;
    
    // 渲染图表
    renderBrokerTrendChart(brokerName);
    renderBrokerCrossPeriodChart(brokerName);
}

// 清空期货公司图表
function clearBrokerCharts() {
    const trendCanvas = document.getElementById('brokerTrendChart');
    const crossPeriodCanvas = document.getElementById('brokerCrossPeriodChart');
    
    if (trendCanvas) {
        const ctx = trendCanvas.getContext('2d');
        ctx.clearRect(0, 0, trendCanvas.width, trendCanvas.height);
        if (window.brokerTrendChartInstance) {
            window.brokerTrendChartInstance.destroy();
            window.brokerTrendChartInstance = null;
        }
    }
    
    if (crossPeriodCanvas) {
        const ctx = crossPeriodCanvas.getContext('2d');
        ctx.clearRect(0, 0, crossPeriodCanvas.width, crossPeriodCanvas.height);
        if (window.brokerCrossPeriodChartInstance) {
            window.brokerCrossPeriodChartInstance.destroy();
            window.brokerCrossPeriodChartInstance = null;
        }
    }
}

// 控制项变化事件（合约代码、日期、期货公司）
function onControlChange() {
    // 检查当前在哪个页面
    const brokerDetailPage = document.getElementById('page-broker-detail');
    if (brokerDetailPage && brokerDetailPage.style.display !== 'none') {
        // 在第二个页面，更新图表
        const brokerSelectHeader = document.getElementById('broker-select-header');
        if (brokerSelectHeader && brokerSelectHeader.value) {
            updateBrokerDetail(brokerSelectHeader.value);
        }
    } else {
        // 在第一个页面，更新排行榜数据
        queryData();
    }
}

// 加载指定期货公司专用CSV数据（带期货公司后缀的文件）
async function loadBrokerDataForCurrentSelection(brokerName) {
    const symbol = document.getElementById('symbol').value;
    if (!symbol || !brokerName) {
        brokerDataAll = [];
        return;
    }
    
    const filename = getBrokerCsvFilename(symbol, brokerName);
    if (!filename) {
        console.warn(`未配置期货公司专用CSV文件: symbol=${symbol}, broker=${brokerName}`);
        brokerDataAll = [];
        return;
    }
    
    try {
        const resp = await fetch(encodeURI(filename));
        if (!resp.ok) {
            console.warn(`无法加载期货公司专用数据文件: ${filename}，状态码: ${resp.status}`);
            brokerDataAll = [];
            return;
        }
        const text = await resp.read ? await resp.read() : await resp.text();
        brokerDataAll = parseCSV(text);
        console.log(`已加载期货公司专用数据: ${filename}，记录数: ${brokerDataAll.length}`);
    } catch (e) {
        console.warn(`加载期货公司专用数据失败: ${filename}`, e);
        brokerDataAll = [];
    }
}

// 页面切换：显示期货公司详情页（从第一个页面点击期货公司跳转）
async function showBrokerDetail(brokerName) {
    // 获取当前的合约代码和日期
    const symbol = document.getElementById('symbol').value;
    const date = document.getElementById('date').value;
    
    // 先加载该期货公司的专用CSV数据
    await loadBrokerDataForCurrentSelection(brokerName);
    
    // 切换到第二个页面
    switchPage('broker-detail');
    
    // 设置控制项的值（保持合约代码和日期，设置期货公司）
    if (symbol) {
        document.getElementById('symbol').value = symbol;
    }
    if (date) {
        document.getElementById('date').value = date;
    }
    
    const brokerSelectHeader = document.getElementById('broker-select-header');
    if (brokerSelectHeader) {
        brokerSelectHeader.value = brokerName;
        updateBrokerDetail(brokerName);
    }
}

// 渲染期货公司持仓趋势图（优先使用期货公司专用CSV数据）
function renderBrokerTrendChart(brokerName) {
    const canvas = document.getElementById('brokerTrendChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // 获取当前选中的合约和日期
    const symbol = document.getElementById('symbol').value;
    const date = document.getElementById('date').value;
    
    if (!symbol || !date) return;
    
    // 选择数据源：如果已加载期货公司专用数据，则优先使用；否则回退到全量数据
    const sourceData = (brokerDataAll && brokerDataAll.length > 0) ? brokerDataAll : allData;
    
    // 筛选该期货公司的数据（近3个月）
    const endDate = new Date(date);
    const startDate = new Date(endDate);
    startDate.setMonth(startDate.getMonth() - 3);
    
    const brokerData = sourceData.filter(row => {
        if (row.broker !== brokerName) return false;
        if (row.symbol !== symbol) return false;
        const rowDate = new Date(row.datetime);
        return rowDate >= startDate && rowDate <= endDate;
    });
    
    if (brokerData.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#666';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('暂无数据', canvas.width / 2, canvas.height / 2);
        return;
    }
    
    // 按日期排序
    brokerData.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
    
    // 准备图表数据
    const labels = brokerData.map(row => {
        const d = new Date(row.datetime);
        return `${d.getMonth() + 1}-${d.getDate()}`;
    });
    
    const longData = brokerData.map(row => parseFloat(row.long_oi) || 0);
    const shortData = brokerData.map(row => parseFloat(row.short_oi) || 0);
    const netData = brokerData.map(row => {
        const long = parseFloat(row.long_oi) || 0;
        const short = parseFloat(row.short_oi) || 0;
        return long - short;
    });
    
    // 销毁旧图表
    if (window.brokerTrendChartInstance) {
        window.brokerTrendChartInstance.destroy();
    }
    
    // 创建新图表
    window.brokerTrendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '多头持仓',
                    data: longData,
                    borderColor: '#4facfe',
                    backgroundColor: 'rgba(79, 172, 254, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: '空头持仓',
                    data: shortData,
                    borderColor: '#43e97b',
                    backgroundColor: 'rgba(67, 233, 123, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: '净持仓',
                    data: netData,
                    borderColor: '#fee140',
                    backgroundColor: 'rgba(254, 225, 64, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// 渲染期货公司跨期持仓分布图（优先使用期货公司专用CSV数据）
function renderBrokerCrossPeriodChart(brokerName) {
    const canvas = document.getElementById('brokerCrossPeriodChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // 获取当前选中的日期
    const date = document.getElementById('date').value;
    if (!date) return;
    
    // 获取该期货公司在所有合约的数据（当前日期）
    const sourceData = (brokerDataAll && brokerDataAll.length > 0) ? brokerDataAll : allData;
    const brokerData = sourceData.filter(row => {
        if (row.broker !== brokerName) return false;
        return row.datetime === date;
    });
    
    if (brokerData.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#666';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('暂无数据', canvas.width / 2, canvas.height / 2);
        return;
    }
    
    // 按合约分组
    const contractMap = new Map();
    brokerData.forEach(row => {
        const contract = row.instrument_id || row.symbol.split('.').pop();
        if (!contractMap.has(contract)) {
            contractMap.set(contract, {
                contract: contract,
                long: 0,
                short: 0
            });
        }
        const data = contractMap.get(contract);
        data.long += parseFloat(row.long_oi) || 0;
        data.short += parseFloat(row.short_oi) || 0;
    });
    
    // 转换为数组并按合约排序
    const contracts = Array.from(contractMap.values()).sort((a, b) => {
        // 提取数字部分进行排序
        const numA = parseInt(a.contract.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.contract.match(/\d+/)?.[0] || '0');
        return numA - numB;
    });
    
    // 准备图表数据
    const labels = contracts.map(c => c.contract);
    const longData = contracts.map(c => c.long);
    const shortData = contracts.map(c => c.short);
    
    // 计算跨期持仓：本合约多头 vs 他月空头，本合约空头 vs 他月多头
    const crossLongData = contracts.map((current, index) => {
        // 本合约多头 vs 其他合约空头
        let otherShort = 0;
        contracts.forEach((other, otherIndex) => {
            if (index !== otherIndex) {
                otherShort += other.short;
            }
        });
        return Math.min(current.long, otherShort);
    });
    
    const crossShortData = contracts.map((current, index) => {
        // 本合约空头 vs 其他合约多头
        let otherLong = 0;
        contracts.forEach((other, otherIndex) => {
            if (index !== otherIndex) {
                otherLong += other.long;
            }
        });
        return Math.min(current.short, otherLong);
    });
    
    // 销毁旧图表
    if (window.brokerCrossPeriodChartInstance) {
        window.brokerCrossPeriodChartInstance.destroy();
    }
    
    // 创建新图表（横向柱状图）
    window.brokerCrossPeriodChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '本合约多头 vs 他月空头',
                    data: crossLongData,
                    backgroundColor: '#fa709a',
                    borderColor: '#fa709a',
                    borderWidth: 1
                },
                {
                    label: '本合约空头 vs 他月多头',
                    data: crossShortData,
                    backgroundColor: '#43e97b',
                    borderColor: '#43e97b',
                    borderWidth: 1
                }
            ]
        },
        options: {
            indexAxis: 'y', // 横向柱状图
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + context.parsed.x.toLocaleString();
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// 页面加载时初始化
window.onload = function() {
    loadCSV();
};

