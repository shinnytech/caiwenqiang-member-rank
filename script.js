let csvData = [];
let csvDataPrev = [];
let allData = [];          // 全市场合约+期货公司数据（用于持仓排行榜）
let brokerDataAll = [];    // 当前选中期货公司的专用数据（来自带期货公司后缀的CSV）
let trendChart = null;           // 趋势图表实例
let netPositionTrendChart = null; // 前5/前10/前20净持仓趋势图实例
let crossPeriodBrokerChart = null; // 按会员跨期净持仓分段堆叠条形图
// 持仓排行榜页：合约多空持仓趋势图时间范围 'week'|'month'|'quarter'
let trendChartRange = 'quarter';
// 公司持仓分析页：持仓趋势图时间范围 'week'|'month'|'quarter'
let brokerTrendRange = 'quarter';
// 公司持仓分析页：是否显示趋势图下方数据表格，默认显示
let brokerTrendTableVisible = true;

// 当前选择（品种 + 合约）下可用的交易日期集合（字符串形式：YYYYMMDD）
let availableDateSet = new Set();
// 日期选择器实例（flatpickr）
let datePickerInstance = null;

// 快期风格：蓝/灰/绿金融配色（无紫色）
const chartColors = [
    '#2563eb', '#64748b', '#16a34a', '#0ea5e9', '#475569', '#0d9488', '#f59e0b', '#dc2626', '#6366f1', '#0891b2'
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

// 品种CSV文件列表（按品种命名，例如：SHFE_rb.csv）
// 这些文件包含该品种下所有合约的数据
// 程序会自动发现可用的CSV文件
let PRODUCT_CSV_FILES = [];

// 当前选中的品种
let currentProduct = null;

// 根据当前合约和期货公司推导对应的“期货公司专用”CSV文件名
// 约定：公司专用文件名 = 原合约汇总文件名去掉“.csv”后 + '_' + 清洗后的期货公司名 + '.csv'
// 例如：SHFE_rb2605_2025-09-05_2026-01-12.csv + BROKER="Z中信期货"
//      => SHFE_rb2605_2025-09-05_2026-01-12_Z中信期货.csv
// 根据品种和期货公司推导对应的"期货公司专用"CSV文件名
// 约定：公司专用文件名 = {交易所}_{品种}_{期货公司}.csv
// 例如：SHFE_rb.csv + BROKER="Z中信期货" => SHFE_rb_Z中信期货.csv
function getBrokerCsvFilename(product, brokerName) {
    if (!product || !brokerName) return null;
    
    // 清洗期货公司名称，去掉不适合文件名的字符
    const brokerClean = brokerName.trim().replace(/[\\/:*?"<>|\s]+/g, '_');
    return `${product}_${brokerClean}.csv`;
}

// 发现可用的品种CSV文件（当前只支持 SHFE_rb，可根据需要扩展）
async function discoverProductFiles() {
    // 这里直接返回已知的品种文件列表
    // 如果将来有更多品种，只需在数组中追加，例如 "DCE_m.csv" 等
    return ["SHFE_rb.csv"];
}

// 加载品种CSV数据
async function loadProductCSV(product) {
    if (!product) return [];
    
    try {
        const filename = `${product}.csv`;
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
        console.warn(`加载文件 ${product}.csv 失败:`, error);
        return [];
    }
}

// 初始化：发现并加载品种文件
async function initialize() {
    try {
        const startTime = performance.now();
        
        // 发现可用的品种文件
        PRODUCT_CSV_FILES = await discoverProductFiles();
        
        if (PRODUCT_CSV_FILES.length === 0) {
            document.getElementById('rankings-container').innerHTML = 
                '<div class="error">未找到品种CSV文件，请先运行后端程序生成数据</div>';
            return;
        }
        
        // 填充品种选择器
        populateProductSelect();
        
        // 默认选择第一个品种
        if (PRODUCT_CSV_FILES.length > 0) {
            const firstProduct = PRODUCT_CSV_FILES[0].replace('.csv', '');
            document.getElementById('product').value = firstProduct;
            await onProductChange();
        }
        
        const loadTime = performance.now() - startTime;
        console.log(`初始化完成，耗时: ${loadTime.toFixed(2)}ms，发现 ${PRODUCT_CSV_FILES.length} 个品种文件`);
    } catch (error) {
        document.getElementById('rankings-container').innerHTML = 
            '<div class="error">初始化失败，请确保CSV文件在同一目录下</div>';
        console.error('Error initializing:', error);
    }
}

// 品种变化事件
async function onProductChange() {
    const productSelect = document.getElementById('product');
    const product = productSelect ? productSelect.value : null;
    
    if (!product) {
        allData = [];
        return;
    }
    
    currentProduct = product;
    
    try {
        // 加载该品种的全部数据（所有合约）
        allData = await loadProductCSV(product);
        
        if (allData.length === 0) {
            document.getElementById('rankings-container').innerHTML = 
                '<div class="error">该品种暂无数据</div>';
            return;
        }
        
        // 统计当前品种下所有合约
        const symbolSet = new Set();
        for (let i = 0, len = allData.length; i < len; i++) {
            if (allData[i].symbol) {
                symbolSet.add(allData[i].symbol);
            }
        }

        const sortedSymbols = Array.from(symbolSet).sort();
        populateContractSelect(sortedSymbols);

        // 按当前选中合约统计可用日期，并初始化日期选择器
        const contractSelect = document.getElementById('contract');
        const selectedContract = contractSelect ? contractSelect.value : (sortedSymbols[0] || '');
        const datesForSelection = getAvailableDatesForSelection(selectedContract);
        availableDateSet = new Set(datesForSelection);
        setupDatePicker(datesForSelection);
        
        // 填充期货公司选择器（自动检测有专用CSV的公司）
        await populateBrokerSelect();
        
        console.log(`品种 ${product} 数据加载完成，共 ${allData.length} 条记录，${symbolSet.size} 个合约`);
        
        queryData();
    } catch (error) {
        document.getElementById('rankings-container').innerHTML = 
            '<div class="error">加载品种数据失败</div>';
        console.error('Error loading product data:', error);
    }
}

// 填充品种选择器
function populateProductSelect() {
    const select = document.getElementById('product');
    if (!select) return;
    
    select.innerHTML = '';
    
    PRODUCT_CSV_FILES.forEach(filename => {
        const product = filename.replace('.csv', '');
        const option = document.createElement('option');
        option.value = product;
        // 格式化显示名称：SHFE_rb -> SHFE.rb
        const displayName = product.replace('_', '.');
        option.textContent = displayName;
        select.appendChild(option);
    });
}

// 填充合约选择器（按具体合约，如 rb2601 / rb2603 展示，无“全部合约”选项）
function populateContractSelect(symbols) {
    const select = document.getElementById('contract');
    if (!select) return;

    select.innerHTML = '';
    symbols.forEach(symbol => {
        const option = document.createElement('option');
        option.value = symbol;
        const parts = symbol.split('.');
        const inst = parts.length > 1 ? parts[1] : symbol;
        option.textContent = inst;
        select.appendChild(option);
    });
    if (symbols.length > 0) select.value = symbols[0];
}


// 根据当前选择（合约）计算可用日期列表
function getAvailableDatesForSelection(selectedContract) {
    const dateSet = new Set();
    for (let i = 0, len = allData.length; i < len; i++) {
        const row = allData[i];
        if (!row.datetime) continue;
        if (selectedContract && row.symbol !== selectedContract) continue;
        dateSet.add(row.datetime);
    }
    return Array.from(dateSet).sort(); // 升序
}

// 初始化 / 更新日期选择器（使用 flatpickr，并灰掉无数据日期）
function setupDatePicker(dateList) {
    const input = document.getElementById('date');
    if (!input || dateList.length === 0 || typeof flatpickr === 'undefined') return;

    // 转为 flatpickr 需要的 YYYY-MM-DD 格式
    const enabledDates = dateList.map(d =>
        `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`
    );

    if (datePickerInstance) {
        // 已存在实例：只更新可用日期，尽量保留当前选中的日期
        datePickerInstance.set('enable', enabledDates);
        const currentValue = input.value;

        if (currentValue && enabledDates.includes(currentValue)) {
            // 当前选择依然合法，则保留用户选择的日期
            datePickerInstance.setDate(currentValue, false);
        } else {
            // 当前选择不合法（例如切换了合约），则回退到最新一个有数据的交易日
            const latest = enabledDates[enabledDates.length - 1];
            datePickerInstance.setDate(latest, false);
            input.value = latest;
        }
    } else {
        datePickerInstance = flatpickr(input, {
            dateFormat: 'Y-m-d',
            enable: enabledDates,          // 只启用有数据的日期，其余日期自动灰掉并禁用
            defaultDate: enabledDates[enabledDates.length - 1],
            locale: 'zh',
            onChange: function () {
                onControlChange();
            }
        });
    }
}

// 查询数据
function queryData() {
    const contractSelect = document.getElementById('contract');
    const selectedContract = contractSelect ? contractSelect.value.trim() : '';
    let dateInput = document.getElementById('date').value;
    
    if (!currentProduct) {
        return;
    }
    
    // 通过日期选择器只会选到有效交易日，这里直接使用
    if (!dateInput) {
        const allDates = Array.from(availableDateSet).sort();
        if (allDates.length === 0) {
            document.getElementById('rankings-container').innerHTML =
                '<div class="error">该品种暂无数据</div>';
            return;
        }
        const latest = allDates[allDates.length - 1];
        const toInputFormat = (d) =>
            `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`;
        dateInput = toInputFormat(latest);
        document.getElementById('date').value = dateInput;
    }

    const dateStr = dateInput.replace(/-/g, '');
    const rowDateYmd = (dt) => (dt && typeof dt === 'string') ? (dt.length >= 8 ? dt.substring(0, 8) : dt) : '';

    // 获取本日数据
    // 如果选择了具体合约，只显示该合约；否则显示该品种下所有合约
    csvData = allData.filter(row => {
        if (rowDateYmd(row.datetime) !== dateStr) return false;
        if (selectedContract && row.symbol !== selectedContract) return false;
        return true;
    });
    
    // 获取上日数据（用于对比）
    const dateObj = new Date(dateInput);
    dateObj.setDate(dateObj.getDate() - 1);
    const prevDateStr = dateObj.toISOString().slice(0, 10).replace(/-/g, '');
    
    csvDataPrev = allData.filter(row => {
        if (rowDateYmd(row.datetime) !== prevDateStr) return false;
        if (selectedContract && row.symbol !== selectedContract) return false;
        return true;
    });
    
    if (csvData.length === 0) {
        document.getElementById('rankings-container').innerHTML = 
            '<div class="error">未找到指定日期的数据</div>';
        renderAnalysisCharts();
        return;
    }
    
    renderRankings();
    renderAnalysisCharts();
}

// 查找指定品种有数据的最新日期
function findLatestDateForProduct() {
    const dateSet = new Set();
    for (let i = 0, len = allData.length; i < len; i++) {
        if (allData[i].datetime) {
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
    const contractSelect = document.getElementById('contract');
    const selectedContract = contractSelect ? contractSelect.value.trim() : '';
    
    // 渲染趋势图（使用选中的合约，如果没有选中则使用第一个合约）
    const symbol = selectedContract || (allData.length > 0 ? allData[0].symbol : '');
    renderTrendChart(symbol);
    renderNetPositionTrendChart(symbol);
    
    // 跨期净持仓表格（按合约汇总）
    renderCrossPeriodTable();
    // 按会员跨期净持仓：分段堆叠条形图 + 明细表
    renderCrossPeriodBrokerChart();
    renderCrossPeriodBrokerTable();
}

// 根据范围计算起止日期（endDate 为终点，往前推；统一用天数避免 setMonth 月末溢出）
function getTrendStartEnd(range, endDate) {
    const end = endDate ? new Date(endDate) : new Date();
    const endYmdOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const endTime = endYmdOnly.getTime();
    const start = new Date(endTime);
    let daysBack = 90;
    if (range === 'week') daysBack = 7;
    else if (range === 'month') daysBack = 30;
    start.setDate(start.getDate() - daysBack);
    return { startDate: start, endDate: new Date(endTime) };
}

// 格式化为 YYYYMMDD，避免 Date 比较的时区/时间导致边界错误
function dateToYmd(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return '' + y + m + day;
}

// 切换合约多空持仓趋势图时间范围（前一周 / 前一月 / 前三月）
function setTrendChartRange(range) {
    trendChartRange = range || 'quarter';
    document.querySelectorAll('#analysis-charts .chart-header-right .range-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-range') === trendChartRange);
    });
    const contractSelect = document.getElementById('contract');
    const symbol = contractSelect ? contractSelect.value.trim() : (allData.length ? allData[0].symbol : '');
    renderTrendChart(symbol);
    renderNetPositionTrendChart(symbol);
}

// 渲染趋势图（按前一周/前一月/前三月）
function renderTrendChart(symbol) {
    if (!symbol && allData.length) symbol = allData[0].symbol;
    if (!symbol) return;

    // 以日期选择器的日期为终点；若为空则用该合约在 allData 中的最新日期
    const dateInput = document.getElementById('date');
    let endDateForRange = null;
    if (dateInput && dateInput.value && dateInput.value.trim()) {
        endDateForRange = new Date(dateInput.value.trim().replace(/-/g, '/'));
    }
    if (!endDateForRange || isNaN(endDateForRange.getTime())) {
        const maxDt = allData.reduce((max, row) => {
            if (row.symbol !== symbol || !row.datetime) return max;
            return row.datetime > max ? row.datetime : max;
        }, '');
        if (maxDt) endDateForRange = new Date(maxDt.substring(0, 4), parseInt(maxDt.substring(4, 6), 10) - 1, parseInt(maxDt.substring(6, 8), 10));
        else endDateForRange = new Date();
    }
    const { startDate, endDate } = getTrendStartEnd(trendChartRange, endDateForRange);
    const startYmd = dateToYmd(startDate);
    const endYmd = dateToYmd(endDate);
    
    // 过滤数据：指定合约，时间范围内（用 YYYYMMDD 字符串比较，避免时区/时间边界问题）
    const filteredData = allData.filter(row => {
        if (row.symbol !== symbol) return false;
        const dt = row.datetime;
        if (!dt || typeof dt !== 'string') return false;
        const ymd = dt.length >= 8 ? dt.substring(0, 8) : dt;
        return ymd >= startYmd && ymd <= endYmd;
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
        let canvas = document.getElementById('trendChart');
        const wrapper = document.querySelector('#analysis-charts .chart-wrapper');
        if (!canvas && wrapper) {
            wrapper.innerHTML = '<canvas id="trendChart"></canvas>';
            canvas = document.getElementById('trendChart');
        }
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#666';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('暂无数据', canvas.width / 2, canvas.height / 2);
        }
        if (trendChart) {
            trendChart.destroy();
            trendChart = null;
        }
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
    const volumeData = chartData.map(d => d.totalVolume);
    // 日环比增减（当日 - 前一日）
    const totalLongChange = chartData.map((d, i) => i === 0 ? null : d.totalLong - chartData[i - 1].totalLong);
    const totalShortChange = chartData.map((d, i) => i === 0 ? null : d.totalShort - chartData[i - 1].totalShort);
    const totalVolumeChange = chartData.map((d, i) => i === 0 ? null : d.totalVolume - chartData[i - 1].totalVolume);

    // 计算价格数据（使用净持仓变化模拟，CSV中无价格）
    const priceData = chartData.map(d => {
        const basePrice = 65000;
        const variation = (d.totalLong - d.totalShort) / 1000;
        return basePrice + variation;
    });

    // 销毁旧图表
    if (trendChart) {
        trendChart.destroy();
        trendChart = null;
    }

    let trendCanvas = document.getElementById('trendChart');
    if (!trendCanvas) {
        const wrapper = document.querySelector('#analysis-charts .chart-wrapper');
        if (wrapper) wrapper.innerHTML = '<canvas id="trendChart"></canvas>';
        trendCanvas = document.getElementById('trendChart');
    }
    if (!trendCanvas) return;

    const ctx = trendCanvas.getContext('2d');
    // 混合图表：折线（总多头/总空头/净持仓/收盘价）+ 柱状（成交量）
    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '总多头',
                    data: totalLongData,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.08)',
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
                    borderColor: '#16a34a',
                    backgroundColor: 'rgba(22, 163, 74, 0.08)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    yAxisID: 'y'
                },
                {
                    label: '净持仓',
                    data: netPositionData,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.08)',
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
                    borderColor: '#dc2626',
                    backgroundColor: 'rgba(220, 38, 38, 0.08)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    yAxisID: 'y1',
                    order: 0
                },
                {
                    type: 'bar',
                    label: '成交量',
                    data: volumeData,
                    yAxisID: 'y',
                    backgroundColor: 'rgba(100, 116, 139, 0.25)',
                    borderColor: 'rgba(100, 116, 139, 0.5)',
                    borderWidth: 1,
                    barPercentage: 0.5,
                    categoryPercentage: 0.8,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        afterBody: function(tooltipItems) {
                            if (!tooltipItems.length) return '';
                            const idx = tooltipItems[0].dataIndex;
                            if (idx == null) return '';
                            const parts = [];
                            const netCh = totalLongChange[idx] != null && totalShortChange[idx] != null
                                ? (totalLongChange[idx] - totalShortChange[idx]) : null;
                            tooltipItems.forEach(function(item) {
                                if (item.datasetIndex === 0 && totalLongChange[idx] != null && totalLongChange[idx] !== 0)
                                    parts.push('总多头增减: ' + (totalLongChange[idx] >= 0 ? '+' : '') + totalLongChange[idx].toLocaleString());
                                if (item.datasetIndex === 1 && totalShortChange[idx] != null && totalShortChange[idx] !== 0)
                                    parts.push('总空头增减: ' + (totalShortChange[idx] >= 0 ? '+' : '') + totalShortChange[idx].toLocaleString());
                                if (item.datasetIndex === 2 && netCh != null && netCh !== 0)
                                    parts.push('净持仓增减: ' + (netCh >= 0 ? '+' : '') + netCh.toLocaleString());
                                if (item.datasetIndex === 4 && totalVolumeChange[idx] != null && totalVolumeChange[idx] !== 0)
                                    parts.push('成交量增减: ' + (totalVolumeChange[idx] >= 0 ? '+' : '') + totalVolumeChange[idx].toLocaleString());
                            });
                            return parts.length ? parts.join('\n') : '';
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: { display: true, text: '日期' },
                    ticks: { maxRotation: 45, minRotation: 45, maxTicksLimit: 15 }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: '持仓量' },
                    beginAtZero: false,
                    ticks: { callback: function(v) { return v.toLocaleString(); } }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: { display: true, text: '价格' },
                    grid: { drawOnChartArea: false },
                    beginAtZero: false,
                    ticks: { callback: function(v) { return v.toLocaleString(); } }
                }
            }
        }
    });
}

// 渲染前5 / 前10 / 前20 净持仓趋势图（与合约多空趋势同时间范围；按日汇总各会员净持仓后取前5/10/20合计，与排行榜一致）
function renderNetPositionTrendChart(symbol) {
    if (!symbol && allData.length) symbol = allData[0].symbol;
    if (!symbol) return;

    const dateInput = document.getElementById('date');
    let endDateForRange = null;
    if (dateInput && dateInput.value && dateInput.value.trim()) {
        endDateForRange = new Date(dateInput.value.trim().replace(/-/g, '/'));
    }
    if (!endDateForRange || isNaN(endDateForRange.getTime())) {
        const maxDt = allData.reduce((max, row) => {
            if (row.symbol !== symbol || !row.datetime) return max;
            return row.datetime > max ? row.datetime : max;
        }, '');
        if (maxDt) endDateForRange = new Date(maxDt.substring(0, 4), parseInt(maxDt.substring(4, 6), 10) - 1, parseInt(maxDt.substring(6, 8), 10));
        else endDateForRange = new Date();
    }
    const { startDate, endDate } = getTrendStartEnd(trendChartRange, endDateForRange);
    const startYmd = dateToYmd(startDate);
    const endYmd = dateToYmd(endDate);

    const filteredData = allData.filter(row => {
        if (row.symbol !== symbol) return false;
        const dt = row.datetime;
        if (!dt || typeof dt !== 'string') return false;
        const ymd = dt.length >= 8 ? dt.substring(0, 8) : dt;
        return ymd >= startYmd && ymd <= endYmd;
    });

    const dateBrokerMap = new Map();
    filteredData.forEach(row => {
        const date = row.datetime;
        const broker = row.broker;
        const key = `${date}_${broker}`;
        if (!dateBrokerMap.has(key)) {
            dateBrokerMap.set(key, { date: date, broker: broker, long_oi: 0, short_oi: 0 });
        }
        const item = dateBrokerMap.get(key);
        item.long_oi = Math.max(item.long_oi, parseFloat(row.long_oi) || 0);
        item.short_oi = Math.max(item.short_oi, parseFloat(row.short_oi) || 0);
    });

    const dateList = [];
    const byDate = new Map();
    const dateTotals = new Map(); // 每日总多头/总空头，用于模拟收盘价
    dateBrokerMap.forEach(item => {
        const date = item.date;
        if (!byDate.has(date)) {
            dateList.push(date);
            byDate.set(date, []);
            dateTotals.set(date, { totalLong: 0, totalShort: 0 });
        }
        const net = item.long_oi - item.short_oi;
        byDate.get(date).push({ broker: item.broker, net: net });
        const tot = dateTotals.get(date);
        tot.totalLong += item.long_oi;
        tot.totalShort += item.short_oi;
    });
    dateList.sort((a, b) => a.localeCompare(b));

    const top5Data = [];
    const top10Data = [];
    const top20Data = [];
    const priceData = [];
    const basePrice = 3500; // 与合约多空趋势图一致用净持仓模拟价格（螺纹等可调）
    dateList.forEach(date => {
        const arr = byDate.get(date).slice();
        arr.sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
        let sum5 = 0, sum10 = 0, sum20 = 0;
        for (let i = 0; i < arr.length; i++) {
            if (i < 5) sum5 += arr[i].net;
            if (i < 10) sum10 += arr[i].net;
            if (i < 20) sum20 += arr[i].net;
        }
        top5Data.push(sum5);
        top10Data.push(sum10);
        top20Data.push(sum20);
        const tot = dateTotals.get(date);
        const net = (tot && (tot.totalLong !== undefined)) ? (tot.totalLong - tot.totalShort) : 0;
        priceData.push(basePrice + net / 1000);
    });

    const labels = dateList.map(d => `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`).slice(-90);

    const canvas = document.getElementById('netPositionTrendChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (dateList.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#666';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('暂无数据', canvas.width / 2, canvas.height / 2);
        if (netPositionTrendChart) {
            netPositionTrendChart.destroy();
            netPositionTrendChart = null;
        }
        return;
    }

    if (netPositionTrendChart) {
        netPositionTrendChart.destroy();
        netPositionTrendChart = null;
    }

    const productName = (currentProduct || '').split('_')[1] || symbol.split('.')[1] || symbol;
    netPositionTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: productName + ': 前5名净持仓合计',
                    data: top5Data.slice(-90),
                    borderColor: '#0d9488',
                    backgroundColor: 'rgba(13, 148, 136, 0.08)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4
                },
                {
                    label: productName + ': 前10名净持仓合计',
                    data: top10Data.slice(-90),
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.08)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4
                },
                {
                    label: productName + ': 前20名净持仓合计',
                    data: top20Data.slice(-90),
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.08)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4
                },
                {
                    label: '收盘价',
                    data: priceData.slice(-90),
                    borderColor: '#dc2626',
                    backgroundColor: 'rgba(220, 38, 38, 0.08)',
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
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            const v = ctx.parsed.y;
                            if (ctx.dataset.yAxisID === 'y1') return (ctx.dataset.label || '') + ': ' + v.toLocaleString() + ' 元/吨';
                            return (ctx.dataset.label || '') + ': ' + v.toLocaleString() + ' 手';
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: { display: true, text: '日期' },
                    ticks: { maxRotation: 45, minRotation: 45, maxTicksLimit: 15 }
                },
                y: {
                    display: true,
                    position: 'left',
                    title: { display: true, text: '净持仓 (手)' },
                    ticks: { callback: function(v) { return v.toLocaleString(); } }
                },
                y1: {
                    display: true,
                    position: 'right',
                    title: { display: true, text: '元/吨' },
                    grid: { drawOnChartArea: false },
                    ticks: { callback: function(v) { return v.toLocaleString(); } }
                }
            }
        }
    });
}

// 渲染跨期净持仓表格
function renderCrossPeriodTable() {
    let dateInput = document.getElementById('date').value;
    if (!dateInput && allData.length > 0) {
        const latest = findLatestDateForProduct();
        if (latest) {
            document.getElementById('date').value = latest;
            dateInput = latest;
        }
    }
    if (!dateInput) return;

    const dateStr = dateInput.replace(/-/g, '');
    
    // 获取指定日期的所有合约数据（按合约和期货公司去重）
    const contractBrokerMap = new Map();
    
    const rowDateYmd = (dt) => (dt && typeof dt === 'string') ? (dt.length >= 8 ? dt.substring(0, 8) : dt) : '';
    allData.forEach(row => {
        if (rowDateYmd(row.datetime) !== dateStr) return;
        
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
    
    // 关闭表格主体
    tableHTML += `
            </tbody>
        </table>
    `;

    // 使用独立的汇总条（不在 table 里），用 CSS Grid 做 4 列对齐
    tableHTML += `
        <div class="cross-period-summary">
            <div class="summary-label">合计</div>
            <div class="summary-value net-long">${totalNetLong > 0 ? totalNetLong.toLocaleString() : '-'}</div>
            <div class="summary-value net-short">${totalNetShort > 0 ? totalNetShort.toLocaleString() : '-'}</div>
            <div class="summary-value total-position">${totalPosition.toLocaleString()}</div>
        </div>
    `;
    
    document.getElementById('cross-period-table').innerHTML = tableHTML;
}

// 按会员跨期净持仓：统一数据准备，返回 { brokerList, symbolList, matrix, toShortSymbol } 或 null
function getCrossPeriodBrokerData() {
    let dateInput = document.getElementById('date').value;
    if (!dateInput && allData.length > 0) {
        const latest = findLatestDateForProduct();
        if (latest) dateInput = latest;
    }
    if (!dateInput) return null;
    const dateStr = dateInput.replace(/-/g, '');
    const rowDateYmd = (dt) => (dt && typeof dt === 'string') ? (dt.length >= 8 ? dt.substring(0, 8) : dt) : '';
    const rows = allData.filter(row => rowDateYmd(row.datetime) === dateStr);
    if (rows.length === 0) return { brokerList: [], symbolList: [], matrix: new Map(), toShortSymbol: s => (s && s.indexOf('.') >= 0) ? s.split('.')[1] : s };
    const brokerSymbolMap = new Map();
    rows.forEach(row => {
        const key = `${row.broker}_${row.symbol}`;
        const long = parseFloat(row.long_oi) || 0;
        const short = parseFloat(row.short_oi) || 0;
        if (!brokerSymbolMap.has(key)) {
            brokerSymbolMap.set(key, { broker: row.broker, symbol: row.symbol, long_oi: 0, short_oi: 0 });
        }
        const item = brokerSymbolMap.get(key);
        item.long_oi = Math.max(item.long_oi, long);
        item.short_oi = Math.max(item.short_oi, short);
    });
    const brokerSet = new Set();
    const symbolList = [];
    const symbolSet = new Set();
    brokerSymbolMap.forEach(item => {
        brokerSet.add(item.broker);
        if (!symbolSet.has(item.symbol)) {
            symbolSet.add(item.symbol);
            symbolList.push(item.symbol);
        }
    });
    symbolList.sort((a, b) => {
        const am = a.match(/(\d{4})/);
        const bm = b.match(/(\d{4})/);
        if (am && bm) return am[1].localeCompare(bm[1]);
        return a.localeCompare(b);
    });
    const brokerList = Array.from(brokerSet).sort();
    const toShortSymbol = (s) => (s && s.indexOf('.') >= 0) ? s.split('.')[1] : s;
    const matrix = new Map();
    brokerSymbolMap.forEach(item => {
        const netLong = Math.max(0, item.long_oi - item.short_oi);
        const netShort = Math.max(0, item.short_oi - item.long_oi);
        if (netLong === 0 && netShort === 0) return;
        if (!matrix.has(item.broker)) matrix.set(item.broker, new Map());
        matrix.get(item.broker).set(item.symbol, { netLong, netShort });
    });
    return { brokerList, symbolList, matrix, toShortSymbol };
}

// 按会员跨期净持仓表：行=会员简称，列=各合约的净多仓/净空仓
function renderCrossPeriodBrokerTable() {
    const container = document.getElementById('cross-period-broker-table');
    if (!container) return;
    const data = getCrossPeriodBrokerData();
    if (!data) {
        container.innerHTML = '<div class="loading">请选择日期</div>';
        return;
    }
    const { brokerList, symbolList, matrix, toShortSymbol } = data;
    if (brokerList.length === 0) {
        container.innerHTML = '<div class="loading">暂无数据</div>';
        return;
    }
    let html = '<table class="cross-period-table cross-period-broker-table"><thead><tr><th>会员简称</th>';
    symbolList.forEach(sym => {
        const shortSym = toShortSymbol(sym);
        html += `<th>${shortSym}净多仓</th><th>${shortSym}净空仓</th>`;
    });
    html += '</tr></thead><tbody>';
    brokerList.forEach(broker => {
        html += `<tr><td>${broker}</td>`;
        symbolList.forEach(sym => {
            const cell = matrix.get(broker) && matrix.get(broker).get(sym);
            const netLong = cell ? cell.netLong : 0;
            const netShort = cell ? cell.netShort : 0;
            html += `<td class="cell-net-long">${netLong > 0 ? netLong.toLocaleString() : '-'}</td>`;
            html += `<td class="cell-net-short">${netShort > 0 ? netShort.toLocaleString() : '-'}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

// 按会员跨期净持仓：分段堆叠条形图，每行 = 一家公司 + 一个合约（不同合约各自一行）
function renderCrossPeriodBrokerChart() {
    const canvas = document.getElementById('crossPeriodBrokerChart');
    const wrapper = document.getElementById('cross-period-broker-chart-wrapper');
    if (!canvas || !wrapper) return;
    const data = getCrossPeriodBrokerData();
    if (crossPeriodBrokerChart) {
        crossPeriodBrokerChart.destroy();
        crossPeriodBrokerChart = null;
    }
    const scrollEl = document.getElementById('cross-period-broker-chart-scroll');
    if (!data || !data.brokerList.length || !data.symbolList.length) {
        wrapper.style.display = 'none';
        if (scrollEl) scrollEl.style.display = 'none';
        return;
    }
    wrapper.style.display = 'block';
    if (scrollEl) scrollEl.style.display = 'block';
    const { brokerList, symbolList, matrix, toShortSymbol } = data;
    const TOP_BROKERS = 20;
    const brokerTotal = new Map();
    brokerList.forEach(broker => {
        let total = 0;
        const m = matrix.get(broker);
        if (m) symbolList.forEach(sym => { const c = m.get(sym); if (c) total += c.netLong + c.netShort; });
        brokerTotal.set(broker, total);
    });
    const sortedBrokers = brokerList.slice().sort((a, b) => (brokerTotal.get(b) || 0) - (brokerTotal.get(a) || 0));
    const topBrokers = sortedBrokers.slice(0, TOP_BROKERS);
    // 每行 = 一个(公司, 合约)；标签：同公司只首行显示公司名，其余行只显示合约（颜色已区分）
    const rowCount = topBrokers.length * symbolList.length;
    const ROW_HEIGHT_PX = 28;
    const labels = [];
    for (let bi = 0; bi < topBrokers.length; bi++) {
        for (let si = 0; si < symbolList.length; si++) {
            const symShort = toShortSymbol(symbolList[si]);
            labels.push(si === 0 ? topBrokers[bi] + ' · ' + symShort : '\u2007\u2007' + symShort);
        }
    }
    wrapper.style.height = (rowCount * ROW_HEIGHT_PX) + 'px';
    wrapper.style.minHeight = wrapper.style.height;
    const colorPairs = [
        { short: '#b91c1c', long: '#fecaca' },
        { short: '#1d4ed8', long: '#bfdbfe' },
        { short: '#047857', long: '#bbf7d0' },
        { short: '#92400e', long: '#fed7aa' },
        { short: '#6b21a8', long: '#e9d5ff' },
        { short: '#0369a1', long: '#bae6fd' },
        { short: '#15803d', long: '#bbf7d0' }
    ];
    const datasets = [];
    symbolList.forEach((sym, symIdx) => {
        const shortLabel = toShortSymbol(sym) + ' 净空';
        const longLabel = toShortSymbol(sym) + ' 净多';
        const shortData = new Array(rowCount).fill(0);
        const longData = new Array(rowCount).fill(0);
        topBrokers.forEach((b, bi) => {
            const cell = matrix.get(b) && matrix.get(b).get(sym);
            const idx = bi * symbolList.length + symIdx;
            if (cell) {
                shortData[idx] = -(cell.netShort || 0);
                longData[idx] = cell.netLong || 0;
            }
        });
        const pair = colorPairs[symIdx % colorPairs.length];
        datasets.push({
            label: shortLabel,
            data: shortData,
            stack: 'short',
            backgroundColor: pair.short,
            barThickness: 18
        });
        datasets.push({
            label: longLabel,
            data: longData,
            stack: 'long',
            backgroundColor: pair.long,
            barThickness: 18
        });
    });
    crossPeriodBrokerChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 8, right: 8, bottom: 8, left: 4 } },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { boxWidth: 14, font: { size: 12 } }
                },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            const v = ctx.raw;
                            if (v === 0) return null;
                            const label = (ctx.dataset.label || '') + ': ' + (v >= 0 ? v.toLocaleString() : '(' + (-v).toLocaleString() + ')');
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    title: { display: true, text: '净持仓（左净空 / 右净多）', font: { size: 13 } },
                    ticks: { font: { size: 12 } }
                },
                y: {
                    stacked: true,
                    ticks: { font: { size: 12 }, maxRotation: 0, autoSkip: false },
                    categoryPercentage: 0.75,
                    barPercentage: 0.88
                }
            }
        }
    });
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
        
        // 显示品种、合约和日期，隐藏期货公司选择器和查询按钮
        if (controlSymbol) controlSymbol.style.display = 'flex';
        const controlContract = document.getElementById('control-contract');
        if (controlContract) controlContract.style.display = 'flex';
        if (controlDate) controlDate.style.display = 'flex';
        if (controlBroker) controlBroker.style.display = 'none';
        if (btnQuery) btnQuery.style.display = 'block';
    } else if (pageType === 'broker-detail') {
        rankingsPage.style.display = 'none';
        brokerDetailPage.style.display = 'block';
        navRankings.classList.remove('active');
        navBrokerDetail.classList.add('active');
        
        // 显示所有控制项（品种、合约、日期、期货公司），隐藏查询按钮
        if (controlSymbol) controlSymbol.style.display = 'flex';
        const controlContract = document.getElementById('control-contract');
        if (controlContract) controlContract.style.display = 'flex';
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

// 填充期货公司选择器（只展示当前品种有“公司专用CSV文件”的期货公司）
async function populateBrokerSelect() {
    const brokerSelectHeader = document.getElementById('broker-select-header');
    if (!brokerSelectHeader) return;

    brokerSelectHeader.innerHTML = '<option value="">请选择期货公司</option>';
    if (!currentProduct || !allData || allData.length === 0) return;

    const brokerSet = new Set();
    for (let i = 0, len = allData.length; i < len; i++) {
        const b = allData[i].broker;
        if (b && b.trim()) brokerSet.add(b.trim());
    }

    const checkPromises = Array.from(brokerSet).map(async (broker) => {
        const filename = getBrokerCsvFilename(currentProduct, broker);
        if (!filename) return null;
        try {
            const resp = await fetch(encodeURI(filename), { method: 'HEAD' });
            return resp.ok ? broker : null;
        } catch { return null; }
    });
    const results = await Promise.all(checkPromises);
    const brokers = results.filter(Boolean);

    brokerSelectHeader.innerHTML = '<option value="">请选择期货公司</option>';

    // 如果没有匹配的公司文件，则直接返回（只显示“请选择”）
    if (brokers.length === 0) return;

    const sortedBrokers = [...brokers].sort();
    sortedBrokers.forEach(broker => {
        const option = document.createElement('option');
        option.value = broker;
        option.textContent = broker;
        brokerSelectHeader.appendChild(option);
    });
    console.log('自动发现期货公司专用数据:', sortedBrokers.join(', '));
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

// 切换期货公司持仓趋势图时间范围（前一周 / 前一月 / 前三月）
function setBrokerTrendRange(range) {
    brokerTrendRange = range || 'quarter';
    document.querySelectorAll('.broker-chart-card .chart-header-right .range-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-range') === brokerTrendRange);
    });
    const brokerSelectHeader = document.getElementById('broker-select-header');
    const brokerName = brokerSelectHeader ? brokerSelectHeader.value : '';
    if (brokerName) renderBrokerTrendChart(brokerName);
}

// 切换公司持仓分析页「持仓趋势图」下方表格的显示/隐藏
function toggleBrokerTrendTable() {
    brokerTrendTableVisible = !brokerTrendTableVisible;
    const tableEl = document.getElementById('broker-trend-table');
    const btn = document.getElementById('broker-trend-table-toggle');
    if (tableEl) tableEl.style.display = brokerTrendTableVisible ? '' : 'none';
    if (btn) btn.textContent = brokerTrendTableVisible ? '隐藏表格' : '显示表格';
}

// 清空期货公司图表
function clearBrokerCharts() {
    const trendCanvas = document.getElementById('brokerTrendChart');
    const longCanvas = document.getElementById('brokerCrossPeriodChartLong');
    const shortCanvas = document.getElementById('brokerCrossPeriodChartShort');
    
    if (trendCanvas) {
        const ctx = trendCanvas.getContext('2d');
        ctx.clearRect(0, 0, trendCanvas.width, trendCanvas.height);
        if (window.brokerTrendChartInstance) {
            window.brokerTrendChartInstance.destroy();
            window.brokerTrendChartInstance = null;
        }
    }
    const brokerTrendTable = document.getElementById('broker-trend-table');
    if (brokerTrendTable) brokerTrendTable.innerHTML = '';

    [longCanvas, shortCanvas].forEach(canvas => {
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    });
    if (window.brokerCrossPeriodChartLongInstance) {
        window.brokerCrossPeriodChartLongInstance.destroy();
        window.brokerCrossPeriodChartLongInstance = null;
    }
    if (window.brokerCrossPeriodChartShortInstance) {
        window.brokerCrossPeriodChartShortInstance.destroy();
        window.brokerCrossPeriodChartShortInstance = null;
    }
    const summaryEl = document.getElementById('broker-cross-period-summary');
    if (summaryEl) summaryEl.innerHTML = '';
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
        // 在第一个页面，根据最新的合约选择更新可用日期，然后更新排行榜数据
        const contractSelect = document.getElementById('contract');
        const selectedContract = contractSelect ? contractSelect.value.trim() : '';

        const dates = getAvailableDatesForSelection(selectedContract);
        availableDateSet = new Set(dates);
        setupDatePicker(dates);

        queryData();
    }
}

// 加载指定期货公司专用CSV数据（带期货公司后缀的文件）
async function loadBrokerDataForCurrentSelection(brokerName) {
    if (!currentProduct || !brokerName) {
        brokerDataAll = [];
        return;
    }
    
    const filename = getBrokerCsvFilename(currentProduct, brokerName);
    if (!filename) {
        console.warn(`未配置期货公司专用CSV文件: product=${currentProduct}, broker=${brokerName}`);
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
    // 获取当前的日期
    const date = document.getElementById('date').value;
    
    // 先加载该期货公司的专用CSV数据
    await loadBrokerDataForCurrentSelection(brokerName);
    
    // 切换到第二个页面
    switchPage('broker-detail');
    
    // 设置控制项的值（保持日期，设置期货公司）
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
    const contractSelect = document.getElementById('contract');
    const symbol = contractSelect ? contractSelect.value.trim() : '';
    const date = document.getElementById('date').value;
    
    if (!date) return;
    
    // 选择数据源：如果已加载期货公司专用数据，则优先使用；否则回退到全量数据
    const sourceData = (brokerDataAll && brokerDataAll.length > 0) ? brokerDataAll : allData;

    // 筛选该期货公司在所选时间范围内的数据（用 YYYYMMDD 字符串比较）
    const endDateObj = new Date(date.replace(/-/g, '/'));
    const { startDate, endDate } = getTrendStartEnd(brokerTrendRange || 'quarter', endDateObj);
    const startYmd = dateToYmd(startDate);
    const endYmd = dateToYmd(endDate);

    const brokerData = sourceData.filter(row => {
        if (row.broker !== brokerName) return false;
        if (symbol && row.symbol !== symbol) return false;
        const dt = row.datetime;
        if (!dt || typeof dt !== 'string') return false;
        const ymd = dt.length >= 8 ? dt.substring(0, 8) : dt;
        return ymd >= startYmd && ymd <= endYmd;
    });
    
    if (brokerData.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#666';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('暂无数据', canvas.width / 2, canvas.height / 2);
        const tableEl = document.getElementById('broker-trend-table');
        if (tableEl) {
            tableEl.innerHTML = '<div class="loading">暂无数据</div>';
            tableEl.style.display = brokerTrendTableVisible ? '' : 'none';
        }
        const toggleBtn = document.getElementById('broker-trend-table-toggle');
        if (toggleBtn) toggleBtn.textContent = brokerTrendTableVisible ? '隐藏表格' : '显示表格';
        return;
    }

    // 按交易日聚合到“每日一条”，含成交量及增减
    const dateAggMap = new Map();
    brokerData.forEach(row => {
        if (!row.datetime) return;
        const key = row.datetime;
        const long = parseFloat(row.long_oi) || 0;
        const short = parseFloat(row.short_oi) || 0;
        const volume = parseFloat(row.volume) || 0;
        const longChange = parseFloat(row.long_change) || 0;
        const shortChange = parseFloat(row.short_change) || 0;
        const volumeChange = parseFloat(row.volume_change) || 0;

        if (!dateAggMap.has(key)) {
            dateAggMap.set(key, {
                date: key, long: 0, short: 0, volume: 0,
                long_change: 0, short_change: 0, volume_change: 0
            });
        }
        const agg = dateAggMap.get(key);
        if (long > agg.long) { agg.long = long; agg.long_change = longChange; }
        if (short > agg.short) { agg.short = short; agg.short_change = shortChange; }
        if (volume > agg.volume) { agg.volume = volume; agg.volume_change = volumeChange; }
    });

    const aggArr = Array.from(dateAggMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // 渲染趋势图对应的数据表格
    renderBrokerTrendTable(aggArr);

    // 准备图表数据
    const labels = aggArr.map(d => {
        const dateStr = d.date;
        return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
    });
    const longData = aggArr.map(d => d.long);
    const shortData = aggArr.map(d => d.short);
    const netData = aggArr.map(d => d.long - d.short);
    const volumeData = aggArr.map(d => d.volume);
    
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
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.08)',
                    fill: false,
                    tension: 0.2,
                    pointRadius: 2,
                    pointHoverRadius: 4
                },
                {
                    label: '空头持仓',
                    data: shortData,
                    borderColor: '#dc2626',
                    backgroundColor: 'rgba(220, 38, 38, 0.08)',
                    fill: false,
                    tension: 0.2,
                    pointRadius: 2,
                    pointHoverRadius: 4
                },
                {
                    label: '净持仓',
                    data: netData,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.08)',
                    fill: false,
                    tension: 0.2,
                    borderWidth: 2,
                    pointRadius: 2,
                    pointHoverRadius: 4
                },
                {
                    type: 'bar',
                    label: '成交量',
                    data: volumeData,
                    yAxisID: 'y1',
                    backgroundColor: 'rgba(100, 116, 139, 0.25)',
                    borderColor: 'rgba(100, 116, 139, 0.5)',
                    borderWidth: 1,
                    barPercentage: 0.6,
                    categoryPercentage: 0.8
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        afterBody: function(tooltipItems) {
                            if (!tooltipItems.length) return '';
                            const idx = tooltipItems[0].dataIndex;
                            if (idx == null || !aggArr[idx]) return '';
                            const d = aggArr[idx];
                            const parts = [];
                            tooltipItems.forEach(function(item) {
                                if (item.datasetIndex === 0 && d.long_change != null && d.long_change !== 0)
                                    parts.push('多头增减: ' + (d.long_change >= 0 ? '+' : '') + d.long_change.toLocaleString());
                                if (item.datasetIndex === 1 && d.short_change != null && d.short_change !== 0)
                                    parts.push('空头增减: ' + (d.short_change >= 0 ? '+' : '') + d.short_change.toLocaleString());
                                if (item.datasetIndex === 2) {
                                    const netCh = (d.long_change != null ? d.long_change : 0) - (d.short_change != null ? d.short_change : 0);
                                    if (netCh !== 0) parts.push('净持仓增减: ' + (netCh >= 0 ? '+' : '') + netCh.toLocaleString());
                                }
                                if (item.datasetIndex === 3 && d.volume_change != null && d.volume_change !== 0)
                                    parts.push('成交量增减: ' + (d.volume_change >= 0 ? '+' : '') + d.volume_change.toLocaleString());
                            });
                            return parts.length ? parts.join('\n') : '';
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    position: 'left',
                    beginAtZero: false,
                    grid: { drawOnChartArea: true },
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString();
                        }
                    }
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    beginAtZero: true,
                    grid: { drawOnChartArea: false },
                    title: { display: true, text: '成交量' },
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

// 渲染持仓趋势图对应的数据表格（日期、多头、空头、净持仓、成交量及增减）
function renderBrokerTrendTable(aggArr) {
    const container = document.getElementById('broker-trend-table');
    if (!container) return;
    if (!aggArr || aggArr.length === 0) {
        container.innerHTML = '<div class="loading">暂无数据</div>';
        return;
    }
    const fmtChange = (v) => {
        if (v == null || v === 0) return '-';
        const n = Number(v);
        const s = (n >= 0 ? '+' : '') + n.toLocaleString();
        return s;
    };
    const changeClass = (v) => (v != null && Number(v) < 0 ? 'negative' : 'positive');
    let html = `
        <table class="cross-period-table broker-trend-table">
            <thead>
                <tr>
                    <th>日期</th>
                    <th>多头持仓</th>
                    <th>多头增减</th>
                    <th>空头持仓</th>
                    <th>空头增减</th>
                    <th>净持仓</th>
                    <th>成交量</th>
                    <th>成交量增减</th>
                </tr>
            </thead>
            <tbody>
    `;
    aggArr.forEach(d => {
        const dateStr = `${d.date.substring(0, 4)}-${d.date.substring(4, 6)}-${d.date.substring(6, 8)}`;
        const net = (d.long || 0) - (d.short || 0);
        const longCh = fmtChange(d.long_change);
        const shortCh = fmtChange(d.short_change);
        const volCh = fmtChange(d.volume_change);
        html += `
            <tr>
                <td>${dateStr}</td>
                <td>${(d.long || 0).toLocaleString()}</td>
                <td class="summary-value ${changeClass(d.long_change)}">${longCh}</td>
                <td>${(d.short || 0).toLocaleString()}</td>
                <td class="summary-value ${changeClass(d.short_change)}">${shortCh}</td>
                <td>${net.toLocaleString()}</td>
                <td>${(d.volume || 0).toLocaleString()}</td>
                <td class="summary-value ${changeClass(d.volume_change)}">${volCh}</td>
            </tr>
        `;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
    container.style.display = brokerTrendTableVisible ? '' : 'none';
    const toggleBtn = document.getElementById('broker-trend-table-toggle');
    if (toggleBtn) toggleBtn.textContent = brokerTrendTableVisible ? '隐藏表格' : '显示表格';
}

// 合约显示简称：2605 -> 05，rb2605 -> 05（取最后两位月份）
function contractShortName(contract) {
    const m = (contract || '').match(/(\d{2})$/);
    return m ? m[1] : (contract || '');
}

// 完整合约名用于 X 轴：rb2601 / 2601 -> rb2601（无品种前缀时用当前品种补全）
function fullContractName(contract) {
    if (!contract) return '';
    if (/^[a-z]+/i.test(String(contract))) return String(contract);
    const product = (currentProduct || '').split('_')[1] || 'rb';
    return product + contract;
}

// 渲染期货公司跨期持仓对比图（照抄参考：左图 05多仓 vs 各月空仓 竖条，右图 05空仓 vs 各月多仓 竖条）
function renderBrokerCrossPeriodChart(brokerName) {
    const canvasLong = document.getElementById('brokerCrossPeriodChartLong');
    const canvasShort = document.getElementById('brokerCrossPeriodChartShort');
    if (!canvasLong || !canvasShort) return;

    const dateInput = document.getElementById('date').value;
    if (!dateInput) return;
    const dateStr = String(dateInput).replace(/-/g, '').substring(0, 8);

    const sourceData = (brokerDataAll && brokerDataAll.length > 0) ? brokerDataAll : allData;
    const brokerData = sourceData.filter(row => {
        if (row.broker !== brokerName) return false;
        const rowDate = String(row.datetime || '').replace(/-/g, '').substring(0, 8);
        return rowDate === dateStr;
    });

    const showNoData = (canvas, msg) => {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#666';
        ctx.font = '14px Arial, "Microsoft YaHei"';
        ctx.textAlign = 'center';
        ctx.fillText(msg || '暂无数据', canvas.width / 2, canvas.height / 2);
    };

    if (brokerData.length === 0) {
        showNoData(canvasLong, '暂无数据，请选择日期并确保已加载该公司数据');
        showNoData(canvasShort, '');
        const summaryEl = document.getElementById('broker-cross-period-summary');
        if (summaryEl) summaryEl.textContent = '未找到 ' + brokerName + ' 在所选日期的多合约持仓数据';
        return;
    }

    const contractMap = new Map();
    brokerData.forEach(row => {
        const contract = (row.instrument_id || (row.symbol && row.symbol.split('.').pop()) || '').trim();
        if (!contract) return;
        const longVal = parseFloat(row.long_oi) || 0;
        const shortVal = parseFloat(row.short_oi) || 0;
        if (!contractMap.has(contract)) {
            contractMap.set(contract, { contract: contract, long: 0, short: 0 });
        }
        const data = contractMap.get(contract);
        data.long = Math.max(data.long, longVal);
        data.short = Math.max(data.short, shortVal);
    });

    const contracts = Array.from(contractMap.values()).sort((a, b) => {
        const numA = parseInt((a.contract.match(/\d+/) || ['0'])[0], 10);
        const numB = parseInt((b.contract.match(/\d+/) || ['0'])[0], 10);
        return numA - numB;
    });

    if (contracts.length < 2) {
        showNoData(canvasLong, '跨期对比至少需 2 个合约');
        showNoData(canvasShort, '');
        const summaryEl = document.getElementById('broker-cross-period-summary');
        if (summaryEl) summaryEl.textContent = brokerName + '：请确保品种下有多个月份合约数据';
        return;
    }

    const contractSelect = document.getElementById('contract');
    const selectedCode = (contractSelect && contractSelect.value || '').split('.').pop();
    let base = contracts.find(c => c.contract === selectedCode || (selectedCode && (c.contract === selectedCode || c.contract.endsWith(selectedCode))));
    if (!base) base = contracts.reduce((best, c) => (c.long + c.short) > (best.long + best.short) ? c : best);
    const others = contracts.filter(c => c.contract !== base.contract);

    const baseShort = contractShortName(base.contract);
    const colorLong = '#dc2626';
    const colorShort = '#16a34a';

    const baseFull = fullContractName(base.contract);
    // 左图：X 轴「rb2601多仓 vs rb2603空仓」…
    const labelsLong = others.map(o => baseFull + '多仓 vs ' + fullContractName(o.contract) + '空仓');
    const multiData = others.map(() => base.long);
    const shortData = others.map(o => o.short);

    // 右图：X 轴「rb2601空仓 vs rb2603多仓」…
    const labelsShort = others.map(o => baseFull + '空仓 vs ' + fullContractName(o.contract) + '多仓');
    const shortBaseData = others.map(() => base.short);
    const longOtherData = others.map(o => o.long);

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: true, position: 'top' },
            tooltip: {
                callbacks: {
                    label: function(ctx) {
                        const v = ctx.parsed.y != null ? ctx.parsed.y : ctx.parsed.x;
                        return (ctx.dataset.label || '') + ': ' + Number(v).toLocaleString() + ' 手';
                    }
                }
            }
        },
        scales: {
            x: { display: true, ticks: { maxRotation: 0, minRotation: 0 } },
            y: { beginAtZero: true, ticks: { callback: v => Number(v).toLocaleString() } }
        }
    };

    if (window.brokerCrossPeriodChartLongInstance) {
        window.brokerCrossPeriodChartLongInstance.destroy();
        window.brokerCrossPeriodChartLongInstance = null;
    }
    window.brokerCrossPeriodChartLongInstance = new Chart(canvasLong.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labelsLong,
            datasets: [
                { label: '多', data: multiData, backgroundColor: colorLong, borderColor: colorLong, borderWidth: 1 },
                { label: '空', data: shortData, backgroundColor: colorShort, borderColor: colorShort, borderWidth: 1 }
            ]
        },
        options: commonOptions
    });

    if (window.brokerCrossPeriodChartShortInstance) {
        window.brokerCrossPeriodChartShortInstance.destroy();
        window.brokerCrossPeriodChartShortInstance = null;
    }
    window.brokerCrossPeriodChartShortInstance = new Chart(canvasShort.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labelsShort,
            datasets: [
                { label: '空', data: shortBaseData, backgroundColor: colorShort, borderColor: colorShort, borderWidth: 1 },
                { label: '多', data: longOtherData, backgroundColor: colorLong, borderColor: colorLong, borderWidth: 1 }
            ]
        },
        options: commonOptions
    });

    const titleEl = document.getElementById('broker-cross-period-title');
    if (titleEl) titleEl.textContent = brokerName + ' 跨期持仓对比图';

    const summaryEl = document.getElementById('broker-cross-period-summary');
    if (summaryEl) {
        summaryEl.textContent = '本合约 ' + baseShort + '：多头 ' + base.long.toLocaleString() + ' 手，空头 ' + base.short.toLocaleString() + ' 手（日期：' + dateInput + '）';
    }
}

// 页面加载时初始化
window.onload = function() {
    initialize();
};

