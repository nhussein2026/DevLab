/**
 * Branch Productivity Dashboard
 * Reads multiple Excel report files and drives KPIs, charts, filters, and export.
 */

/* ============================================================
   0. GLOBAL STATE
   ============================================================ */
const STATE = {
    files: [],
    unifiedMatrix: null,
    lastUpdated: null,
    charts: {}
};

/* ============================================================
   1. REPORT TYPE DETECTION — uses BOTH sheet names & headers
   ============================================================ */

function detectReportType(sheetNames, headers, fileName) {
    const allText = [...sheetNames, ...headers].join(' ');
    const fileNameLower = (fileName || '').toLowerCase();

    // Check for card-specific indicators
    const cardKeywords = ['بطاقات', 'بطاقة', 'Cards', 'Card'];
    const cardCodes = ['283', '406', '285'];
    let cardScore = 0;
    for (const kw of cardKeywords) { if (allText.includes(kw)) cardScore += 3; }
    for (const code of cardCodes) { if (headers.includes(code)) cardScore += 2; }
    if (fileNameLower.includes('بطا') || fileNameLower.includes('card')) cardScore += 5;

    // Check for account-specific indicators
    const acctKeywords = ['تمويل مرابحة', 'حساب توفير', 'حساب جاري', 'ودائع استثمار', 'Savings', 'Current'];
    let acctScore = 0;
    for (const kw of acctKeywords) { if (allText.includes(kw)) acctScore += 2; }

    // Check for operations-specific indicators (broader keywords)
    const opsKeywords = ['عدد العمليات', 'بالمعادل', 'المعادل', 'العمليات', 'Operation',
                         'المستخدمين', 'الإجمالي بالمعادل', 'عدد', 'المجموع الكلي'];
    let opsScore = 0;
    for (const kw of opsKeywords) { if (allText.includes(kw)) opsScore += 2; }
    // Sheet name hints
    if (sheetNames.some(s => s.includes('المستخدمين') || s.includes('عمليات'))) opsScore += 5;

    const currencyKeywords = ['ريال يمني', 'يمني', 'سعودي', 'دولار امريكي', 'العملة'];
    let currencyScore = 0;
    for (const kw of currencyKeywords) { if (allText.includes(kw)) currencyScore += 3; }
    if (fileNameLower.includes('currency') || fileNameLower.includes('عملة') || fileNameLower.includes('تفصيلي')) currencyScore += 5;

    console.log(`[Detect] File "${fileName}" — ops:${opsScore}, acct:${acctScore}, cards:${cardScore}, curr:${currencyScore}`);

    if (currencyScore > acctScore && currencyScore > opsScore && currencyScore > cardScore) return 'currency';
    if (cardScore > acctScore && cardScore > opsScore) return 'cards';
    if (acctScore > opsScore && acctScore > cardScore) return 'accounts';
    if (opsScore > 0) return 'operations';

    return 'unknown';
}

/* ============================================================
   2. EXCEL PARSING
   ============================================================ */

function parseExcelBuffer(buffer, fileName) {
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
    let meta = { fileName, sheets: [] };

    for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (!json || json.length === 0) continue;

        if ((fileName || '').toLowerCase().includes('branch') || sheetName.toLowerCase().includes('branch')) {
            console.log(`[Parse] Unified Matrix Detected! -> ${sheetName}`);
            return { type: 'unified', matrix: json, meta, rows: [] };
        }
    }
    return { type: 'unknown', rows: [], meta, headers: [] };
}

function parseArabicDate(str) {
    const clean = str.replace(/\s.+/, '').trim();
    const parts = clean.split('/');
    if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return null;
}

/* ============================================================
   3. DATA AGGREGATION
   ============================================================ */

function createEmptyResult() {
    return {
        totalDeposits: 0, totalWithdrawals: 0, financingTotal: 0,
        newAccounts: 0, savingsAccounts: 0, currentAccounts: 0, investmentDeposits: 0,
        transfersOutCount: 0, transfersOutAmount: 0, transfersInCount: 0, transfersInAmount: 0,
        cardActivity: 0, cardBreakdown: {}, 
        atmOps: 0, digitalOps: 0, employeeOps: 0,
        yerTotal: 0, sarTotal: 0, usdTotal: 0,
        liquidityYER: 0, liquiditySAR: 0, liquidityUSD: 0,
        employees: [], digitalChannels: [],
        allOps: [], totalTxVolume: 0
    };
}

function aggregateData() {
    console.log('[Aggregate] Parsing unified matrix for exact input reflection...');
    if (!STATE.unifiedMatrix || STATE.unifiedMatrix.length === 0) return createEmptyResult();

    const matrix = STATE.unifiedMatrix;
    const res = createEmptyResult();

    const valAt = (r, c) => {
        if (!matrix[r] || matrix[r][c] === undefined) return 0;
        let v = matrix[r][c];
        if (typeof v === 'string') v = v.replace(/,/g, '').replace(/[^\d.\-]/g, '');
        return parseFloat(v) || 0;
    };
    const strAt = (r, c) => (matrix[r] && matrix[r][c] !== undefined ? String(matrix[r][c]).trim() : '');

    // 1. Operations & Currencies (Left Matrix: Cols 0-7)
    // Header/label keywords to skip — these describe columns, not operations
    // Exact matches for single-word headers + partial matches for descriptive/calculated rows
    const headerLabelsExact = /^(المبلغ|العملة|عدد|البيان|النوع|الوصف|الرقم|م|#|ر\.م|التاريخ|ملاحظات|الموظف|اسم الموظف|رقم|العملية)$/i;
    const headerLabelsPartial = /^(نسبة|نمو|السيولة النقدية)/i;

    for (let r = 2; r < matrix.length; r++) {
        const opName = strAt(r, 0);
        if (!opName || headerLabelsExact.test(opName) || headerLabelsPartial.test(opName)) continue;
        
        // Flexible Grand Total Row Detection
        if (/إجمالي|مجموع|total|sum/i.test(opName) && !/نسبة|نمو/i.test(opName)) {
            res.allOps.push({ name: opName, count: valAt(r, 7), yer: valAt(r, 2), sar: valAt(r, 4), usd: valAt(r, 6), isTotal: true });
            res.yerTotal = valAt(r, 2);
            res.sarTotal = valAt(r, 4);
            res.usdTotal = valAt(r, 6);
            continue; 
        }

        const totalCount = valAt(r, 1) + valAt(r, 3) + valAt(r, 5); 
        const yerAmt = valAt(r, 2); 
        const sarAmt = valAt(r, 4);
        const usdAmt = valAt(r, 6);

        // Track every operation for the Summary Table and Breakdown Charts
        res.allOps.push({ name: opName, count: totalCount, yer: yerAmt, sar: sarAmt, usd: usdAmt });
        res.totalTxVolume += totalCount;

        // Comprehensive Inflow/Outflow Categorization
        if (/إيداع|قبض|وارد|شراء|deposit|receipt|inward|buy/i.test(opName)) {
            res.totalDeposits += yerAmt;
        } else if (/سحب|صرف|صادر|بيع|withdraw|payment|outward|sell/i.test(opName)) {
            res.totalWithdrawals += yerAmt;
        }

        // Sector KPIs
        if (/حول?ات?\s*صادر|outgoing/i.test(opName)) { 
            res.transfersOutCount += totalCount; 
            res.transfersOutAmount += yerAmt; 
        } else if (/حول?ات?\s*وارد|incoming/i.test(opName)) { 
            res.transfersInCount += totalCount; 
            res.transfersInAmount += yerAmt; 
        }

        if (/صراف|atm|cdm/i.test(opName)) {
            res.digitalChannels.push({ name: opName, count: totalCount, amount: yerAmt });
            res.atmOps += totalCount;
        } else if (/انترنت|تطبيق|mobile|internet/i.test(opName)) {
            res.digitalChannels.push({ name: opName, count: totalCount, amount: yerAmt });
            res.digitalOps += totalCount;
        }
    }

    // 1.5 Treasury Liquidity (Exact Position: Row 20 in unified matrix)
    // Headers: Col 0: "السيولة النقدية المتاحة بخزينة الفرع", Col 2: YER, Col 3: SAR, Col 5: USD
    res.liquidityYER = valAt(20, 2);
    res.liquiditySAR = valAt(20, 3);
    res.liquidityUSD = valAt(20, 5);

    // 2. Accounts Generation (Top-Right: Row 2, Cols 12-17)
    // Mapping: 12:Murabaha, 13:Savings, 14:Current, 15:Investment, 16:Companies, 17:Guarantees
    const accounts = [
        { key: 'financingTotal', col: 12, label: 'تمويل مرابحة' },
        { key: 'savingsAccounts', col: 13, label: 'حساب توفير' },
        { key: 'currentAccounts', col: 14, label: 'حساب جاري' },
        { key: 'investmentDeposits', col: 15, label: 'ودائع استثمار مطلقة' },
        { key: 'companyAccounts', col: 16, label: 'شركات وكيانات اعتبارة' },
        { key: 'guaranteeLetters', col: 17, label: 'خطابات الضمان' }
    ];

    accounts.forEach(acc => {
        const val = valAt(2, acc.col);
        res[acc.key] = val;
        res.newAccounts += val;
    });

    // 3. Cards Monitoring (Middle-Right: Cols 11-13)
    // Logic: Look for "طلب" and "تفعيل" labels in Col 11
    for(let r = 4; r < 20; r++) {
        const rowLabel = strAt(r, 11);
        if (rowLabel === 'طلب') {
            res.cardBreakdown['محلية (طلب)'] = valAt(r, 12); 
            res.cardBreakdown['ماستر (طلب)'] = valAt(r, 13);
        } else if (rowLabel === 'تفعيل') {
            res.cardBreakdown['محلية (تفعيل)'] = valAt(r, 12); 
            res.cardBreakdown['ماستر (تفعيل)'] = valAt(r, 13);
        }
    }
    res.cardActivity = Object.values(res.cardBreakdown).reduce((a, b) => a + b, 0);

    // 4. Employee Achievement (Bottom-Right: Cols 10-12)
    // Logic: Find "الموظف" header, then pull everyone below it
    let empHeaderIndex = -1;
    for(let r = 5; r < matrix.length; r++) {
        if (strAt(r, 10) === 'الموظف' || strAt(r, 10) === 'اسم الموظف') { empHeaderIndex = r; break; }
    }
    
    if (empHeaderIndex !== -1) {
        for(let r = empHeaderIndex + 1; r < matrix.length; r++) {
            const name = strAt(r, 10);
            if (!name || /الإجمالي|المجموع|Total|الكلية|نسبة|نمو/i.test(name)) continue;
            const count = valAt(r, 11);
            const amount = valAt(r, 12);
            res.employees.push({ name, count, amount });
            res.employeeOps += count;
        }
    }

    console.log('[Aggregate] Logic synced with Excel 1:1. Results:', res);
    return res;
}

/* ---- Helpers ---- */
function getFirstNumeric(row) {
    const keys = Object.keys(row).filter(k => !k.startsWith('_'));
    for (let i = 1; i < keys.length; i++) {
        const val = row[keys[i]];
        const n = toNumber(val);
        if (n > 0) return n;
    }
    return 0;
}

function getSecondNumeric(row) {
    const keys = Object.keys(row).filter(k => !k.startsWith('_'));
    let found = 0;
    for (let i = 1; i < keys.length; i++) {
        const val = row[keys[i]];
        const n = toNumber(val);
        if (n > 0) {
            found++;
            if (found === 2) return n;
        }
    }
    return 0;
}

function toNumber(val) {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (typeof val === 'string') {
        const cleaned = val.replace(/,/g, '').replace(/[^\d.\-]/g, '');
        const n = parseFloat(cleaned);
        return isNaN(n) ? 0 : n;
    }
    return 0;
}

function getRowName(row) {
    const keys = Object.keys(row).filter(k => !k.startsWith('_'));
    if (keys.length === 0) return '';
    const val = row[keys[0]];
    if (typeof val === 'string' && val.trim()) return val.trim();
    if (typeof val === 'number') return String(val);
    return '';
}

function isDepositRelated(name) {
    return /إيداع|deposit/i.test(name);
}
function isWithdrawalRelated(name) {
    return /سحب|withdraw/i.test(name);
}
function isTransferOut(name) {
    return /حوالات?\s*صادر|outgoing/i.test(name);
}
function isTransferIn(name) {
    return /حوالات?\s*وارد|incoming/i.test(name);
}

/* ============================================================
   4. KPI RENDERING
   ============================================================ */

function renderKPIs(data) {
    animateValue('kpi-yer-total', data.yerTotal, true);
    animateValue('kpi-sar-total', data.sarTotal, true);
    animateValue('kpi-usd-total', data.usdTotal, true);

    // New Liquidity KPIs
    animateValue('kpi-liquidity-yer', data.liquidityYER, true);
    animateValue('kpi-liquidity-sar', data.liquiditySAR, true);
    animateValue('kpi-liquidity-usd', data.liquidityUSD, true);

    animateValue('kpi-total-deposits', data.totalDeposits, true);
    animateValue('kpi-total-withdrawals', data.totalWithdrawals, true);
    animateValue('kpi-total-financing', data.financingTotal, false);
    animateValue('kpi-new-accounts', data.newAccounts, false);
    animateValue('kpi-savings-accounts', data.savingsAccounts, false);
    animateValue('kpi-current-accounts', data.currentAccounts, false);
    animateValue('kpi-investment-accounts', data.investmentDeposits, false);
    animateValue('kpi-transfers-out', data.transfersOutCount, false);
    animateValue('kpi-transfers-in', data.transfersInCount, false);
    animateValue('kpi-credit-cards', data.cardActivity, false);

    const outAmtEl = document.getElementById('kpi-transfers-out-amount');
    if (outAmtEl) outAmtEl.textContent = data.transfersOutAmount ? formatNumber(data.transfersOutAmount) : '';
    const inAmtEl = document.getElementById('kpi-transfers-in-amount');
    if (inAmtEl) inAmtEl.textContent = data.transfersInAmount ? formatNumber(data.transfersInAmount) : '';
}

function animateValue(id, endVal, isCurrency) {
    const el = document.getElementById(id);
    if (!el) return;

    const duration = 1200;
    const start = performance.now();

    function tick(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        const current = endVal * ease;
        el.textContent = isCurrency ? formatNumber(current) : formatInt(current);
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

function formatNumber(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
    return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatInt(n) {
    return Math.round(n).toLocaleString('en-US');
}

/* ============================================================
   5. CHART RENDERING
   ============================================================ */

function getChartColors() {
    const isDark = document.documentElement.classList.contains('dark');
    return {
        blue: '#3FA9F5', darkBlue: isDark ? '#5BB8F7' : '#003A70',
        green: '#22C55E', red: '#EF4444', amber: '#F59E0B',
        purple: '#8B5CF6', pink: '#EC4899', teal: '#14B8A6',
        text: isDark ? '#ccd6f6' : '#4B5563',
        grid: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        bg: isDark ? '#172a45' : '#FFFFFF',
        palette: ['#3FA9F5', '#003A70', '#22C55E', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#EF4444', '#6366F1', '#0EA5E9']
    };
}

function renderCharts(data) {
    if (!data) return;
    renderEmployeeAmountChart(data);
    renderEmployeeCountChart(data);
    renderTopOpsDualChart(data);
    renderCurrencyBreakdownChart(data);
    renderAccountsPieChart(data);
    renderCardsDonutChart(data);
    renderOpsChannelsChart(data);
    renderOpVolumeChart(data);
    renderOpAmountChart(data);
}

function destroyChart(key) {
    if (STATE.charts[key]) { STATE.charts[key].destroy(); delete STATE.charts[key]; }
}

function renderEmployeeAmountChart(data) {
    destroyChart('employeeAmount');
    const ctx = document.getElementById('employeeAmountChart');
    if (!ctx) return;
    const colors = getChartColors();
    const users = [], amounts = [];

    (data.employees || []).forEach(emp => {
        users.push(emp.name);
        amounts.push(emp.amount);
    });

    if (users.length === 0) {
        STATE.charts.employeeAmount = new Chart(ctx, { type: 'bar', data: { labels: ['لا توجد بيانات'], datasets: [{ label: 'المبلغ', data: [0], backgroundColor: colors.blue }] } });
        return;
    }

    STATE.charts.employeeAmount = new Chart(ctx, {
        type: 'bar',
        data: { labels: users, datasets: [{ type: 'bar', label: 'المبلغ (بالمعادل) | Amount', data: amounts, backgroundColor: colors.blue, borderRadius: 4 }] },
        options: {
            responsive: true, maintainAspectRatio: true,
            plugins: { legend: { labels: { color: colors.text, font: { family: "'Cairo','Inter',sans-serif" } } } },
            scales: { x: { ticks: { color: colors.text, font: { family: "'Cairo'" } }, grid: { display: false } }, y: { ticks: { color: colors.blue, callback: v => formatNumber(v) }, grid: { color: colors.grid } } }
        }
    });
}

function renderEmployeeCountChart(data) {
    destroyChart('employeeCount');
    const ctx = document.getElementById('employeeCountChart');
    if (!ctx) return;
    const colors = getChartColors();
    const users = [], counts = [];

    (data.employees || []).forEach(emp => {
        users.push(emp.name);
        counts.push(emp.count);
    });

    if (users.length === 0) {
        STATE.charts.employeeCount = new Chart(ctx, { type: 'bar', data: { labels: ['لا توجد بيانات'], datasets: [{ label: 'العمليات', data: [0], backgroundColor: colors.green }] } });
        return;
    }

    STATE.charts.employeeCount = new Chart(ctx, {
        type: 'bar',
        data: { labels: users, datasets: [{ type: 'bar', label: 'عدد العمليات | Transactions', data: counts, backgroundColor: colors.green, borderRadius: 4 }] },
        options: {
            responsive: true, maintainAspectRatio: true,
            plugins: { legend: { labels: { color: colors.text, font: { family: "'Cairo','Inter',sans-serif" } } } },
            scales: { x: { ticks: { color: colors.text, font: { family: "'Cairo'" } }, grid: { display: false } }, y: { ticks: { color: colors.green }, grid: { color: colors.grid } } }
        }
    });
}

function renderTopOpsDualChart(data) {
    destroyChart('topOpsDual');
    const ctx = document.getElementById('topOpsDualChart');
    if (!ctx) return;
    const colors = getChartColors();
    const ops = [], amounts = [], counts = [];

    // Get top 5 operations by count
    const topOps = (data.allOps || [])
        .filter(op => !op.isTotal)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    topOps.forEach(op => {
        ops.push(op.name);
        amounts.push(op.yer); // Use YER as the primary amount metric
        counts.push(op.count);
    });

    if (ops.length === 0) {
        STATE.charts.topOpsDual = new Chart(ctx, { type: 'bar', data: { labels: ['لا توجد بيانات'], datasets: [{ label: 'المبلغ', data: [0], backgroundColor: colors.purple }] } });
        return;
    }

    STATE.charts.topOpsDual = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ops,
            datasets: [
                { type: 'bar', label: 'المبلغ المستحق (يمني) | Amount', data: amounts, backgroundColor: colors.purple, borderRadius: 4, yAxisID: 'y' },
                { type: 'line', label: 'عدد العمليات | Count', data: counts, borderColor: colors.amber, backgroundColor: colors.amber, fill: false, tension: 0.4, pointRadius: 5, yAxisID: 'y1' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: true,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: colors.text, font: { family: "'Cairo','Inter',sans-serif" } } },
                tooltip: { rtl: true, callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}` } }
            },
            scales: {
                x: { ticks: { color: colors.text, font: { family: "'Cairo'" }, maxRotation: 45 }, grid: { display: false } },
                y: { position: 'right', ticks: { color: colors.purple, callback: v => formatNumber(v) }, grid: { color: colors.grid } },
                y1: { position: 'left', ticks: { color: colors.amber }, grid: { drawOnChartArea: false } }
            }
        }
    });
}

function renderCurrencyBreakdownChart(data) {
    destroyChart('currencyBreakdown');
    const ctx = document.getElementById('currencyBreakdownChart');
    if (!ctx) return;
    const colors = getChartColors();

    // Get operations that have amounts in at least one currency
    const ops = (data.allOps || [])
        .filter(op => !op.isTotal && (op.yer > 0 || op.sar > 0 || op.usd > 0))
        .sort((a, b) => (b.yer + b.sar + b.usd) - (a.yer + a.sar + a.usd))
        .slice(0, 10);

    const labels = ops.map(op => op.name);

    if (labels.length === 0) {
        STATE.charts.currencyBreakdown = new Chart(ctx, {
            type: 'bar',
            data: { labels: ['لا توجد بيانات'], datasets: [{ label: '-', data: [0], backgroundColor: colors.blue }] },
            options: { responsive: true, maintainAspectRatio: true }
        });
        return;
    }

    STATE.charts.currencyBreakdown = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'ريال يمني | YER',
                    data: ops.map(op => op.yer),
                    backgroundColor: colors.blue,
                    borderRadius: 4
                },
                {
                    label: 'ريال سعودي | SAR',
                    data: ops.map(op => op.sar),
                    backgroundColor: colors.green,
                    borderRadius: 4
                },
                {
                    label: 'دولار | USD',
                    data: ops.map(op => op.usd),
                    backgroundColor: colors.amber,
                    borderRadius: 4
                }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top',
                    rtl: true,
                    labels: { color: colors.text, font: { family: "'Cairo','Inter',sans-serif", size: 12 }, padding: 16 }
                },
                tooltip: {
                    rtl: true,
                    callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.x.toLocaleString()}` }
                }
            },
            scales: {
                x: {
                    stacked: false,
                    ticks: { color: colors.text, callback: v => formatNumber(v) },
                    grid: { color: colors.grid }
                },
                y: {
                    stacked: false,
                    ticks: { color: colors.text, font: { family: "'Cairo'" } },
                    grid: { display: false }
                }
            }
        }
    });
}

function renderAccountsPieChart(data) {
    destroyChart('accounts');
    const ctx = document.getElementById('accountsPieChart');
    if (!ctx) return;
    const colors = getChartColors();

    const labels = [], values = [];
    if (data.savingsAccounts > 0) { labels.push('حساب توفير'); values.push(data.savingsAccounts); }
    if (data.currentAccounts > 0) { labels.push('حساب جاري'); values.push(data.currentAccounts); }
    if (data.investmentDeposits > 0) { labels.push('ودائع استثمار مطلقة'); values.push(data.investmentDeposits); }
    if (data.financingTotal > 0) { labels.push('تمويل مرابحة'); values.push(data.financingTotal); }
    if (data.companyAccounts > 0) { labels.push('شركات وكيانات اعتبارة'); values.push(data.companyAccounts); }
    if (data.guaranteeLetters > 0) { labels.push('خطابات الضمان'); values.push(data.guaranteeLetters); }
    
    if (labels.length === 0 && data.newAccounts > 0) { labels.push('حسابات'); values.push(data.newAccounts); }

    STATE.charts.accounts = new Chart(ctx, {
        type: 'pie',
        data: { labels, datasets: [{ data: values, backgroundColor: colors.palette.slice(0, values.length), borderWidth: 2, borderColor: colors.bg }] },
        options: {
            responsive: true, maintainAspectRatio: true,
            plugins: {
                legend: { position: 'bottom', rtl: true, labels: { color: colors.text, font: { family: "'Cairo','Inter',sans-serif", size: 12 }, padding: 16 } },
                tooltip: { rtl: true }
            }
        }
    });
}

function renderCardsDonutChart(data) {
    destroyChart('cards');
    const ctx = document.getElementById('cardsDonutChart');
    if (!ctx) return;
    const colors = getChartColors();

    let labels = Object.keys(data.cardBreakdown);
    let values = Object.values(data.cardBreakdown);
    if (labels.length === 0 && data.cardActivity > 0) { labels = ['بطاقات']; values = [data.cardActivity]; }

    STATE.charts.cards = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels.map(l => `نوع ${l}`),
            datasets: [{ data: values, backgroundColor: [colors.blue, colors.darkBlue, colors.green, colors.amber, colors.purple], borderWidth: 2, borderColor: colors.bg, cutout: '55%' }]
        },
        options: {
            responsive: true, maintainAspectRatio: true,
            plugins: {
                legend: { position: 'bottom', rtl: true, labels: { color: colors.text, font: { family: "'Cairo','Inter',sans-serif", size: 12 }, padding: 16 } },
                tooltip: { rtl: true }
            }
        }
    });
}

function renderOpsChannelsChart(data) {
    destroyChart('opsChannels');
    const ctx = document.getElementById('opsChannelsChart');
    if (!ctx) return;
    const colors = getChartColors();

    const labels = [];
    const values = [];
    
    if (data.employeeOps > 0) { labels.push('موظفي الفرع'); values.push(data.employeeOps); }
    if (data.atmOps > 0) { labels.push('الصراف الآلي'); values.push(data.atmOps); }
    if (data.digitalOps > 0) { labels.push('القنوات الرقمية'); values.push(data.digitalOps); }

    STATE.charts.opsChannels = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{ 
                data: values, 
                backgroundColor: [colors.blue, colors.amber, colors.green, colors.pink], 
                borderWidth: 2, 
                borderColor: colors.bg, 
                cutout: '65%' 
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: true,
            plugins: {
                legend: { position: 'bottom', rtl: true, labels: { color: colors.text, font: { family: "'Cairo','Inter',sans-serif", size: 12 }, padding: 16 } },
                tooltip: { rtl: true }
            }
        }
    });
}

function renderOpVolumeChart(data) {
    destroyChart('opVolume');
    const ctx = document.getElementById('opVolumeChart');
    if (!ctx) return;
    const colors = getChartColors();

    const sortedOps = (data.allOps || [])
        .filter(op => !op.isTotal && op.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 12);

    const labels = sortedOps.map(op => op.name);
    const counts = sortedOps.map(op => op.count);

    if (labels.length === 0) return;

    STATE.charts.opVolume = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'عدد العمليات | Count', data: counts, backgroundColor: colors.blue, borderRadius: 4 }] },
        options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: true,
            plugins: { 
                legend: { display: false },
                tooltip: { rtl: true }
            },
            scales: {
                x: { ticks: { color: colors.text }, grid: { color: colors.grid } },
                y: { ticks: { color: colors.text, font: { family: "'Cairo'" } }, grid: { display: false } }
            }
        }
    });
}

function renderOpAmountChart(data) {
    destroyChart('opAmount');
    const ctx = document.getElementById('opAmountChart');
    if (!ctx) return;
    const colors = getChartColors();

    const sortedOps = (data.allOps || [])
        .filter(op => !op.isTotal && op.yer > 0)
        .sort((a, b) => b.yer - a.yer)
        .slice(0, 12);

    const labels = sortedOps.map(op => op.name);
    const amounts = sortedOps.map(op => op.yer);

    if (labels.length === 0) return;

    STATE.charts.opAmount = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'المبلغ (بالمعادل) | Amount', data: amounts, backgroundColor: colors.teal, borderRadius: 4 }] },
        options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: true,
            plugins: { 
                legend: { display: false },
                tooltip: { rtl: true, callbacks: { label: ctx => `${ctx.parsed.x.toLocaleString()} YER` } }
            },
            scales: {
                x: { ticks: { color: colors.text, callback: v => formatNumber(v) }, grid: { color: colors.grid } },
                y: { ticks: { color: colors.text, font: { family: "'Cairo'" } }, grid: { display: false } }
            }
        }
    });
}

/* ============================================================
   6. FILE UPLOAD HANDLING
   ============================================================ */

function initUploadZone() {
    const zone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('excel-file-input');
    if (!zone || !fileInput) return;

    zone.addEventListener('click', (e) => {
        if (e.target.closest('.file-chip-remove')) return;
        fileInput.click();
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) handleFiles(fileInput.files);
    });

    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    });
}

async function handleFiles(fileList) {
    showLoading();
    const uploadStatus = document.getElementById('upload-status');

    for (const file of fileList) {
        if (uploadStatus) uploadStatus.textContent = `جاري قراءة: ${file.name}...`;
        try {
            const buffer = await file.arrayBuffer();
            const parsed = parseExcelBuffer(buffer, file.name);
            STATE.files.push({ fileName: file.name, ...parsed });

            if (parsed.type === 'unified') {
                STATE.unifiedMatrix = parsed.matrix;
            }

            console.log(`[Upload] ${file.name} → ${parsed.type}`);
        } catch (err) {
            console.error(`Error reading ${file.name}:`, err);
        }
    }

    renderFileChips();
    refreshDashboard();
    collapseUploadZone();
    hideLoading();
    if (uploadStatus) uploadStatus.textContent = '';
}

function renderFileChips() {
    const container = document.getElementById('file-chips');
    if (!container) return;
    container.innerHTML = '';

    const typeLabels = { operations: '📊 عمليات', accounts: '🏦 حسابات', cards: '💳 بطاقات', unknown: '📄 ملف' };

    for (const f of STATE.files) {
        const chip = document.createElement('div');
        chip.className = 'file-chip';
        chip.innerHTML = `
            <span class="file-chip-type">${typeLabels[f.type] || typeLabels.unknown}</span>
            <span class="file-chip-name">${f.fileName}</span>
            <button class="file-chip-remove" data-file="${f.fileName}" title="إزالة">&times;</button>
        `;
        container.appendChild(chip);
    }

    container.querySelectorAll('.file-chip-remove').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            removeFile(btn.dataset.file);
        });
    });
}

function removeFile(fileName) {
    STATE.files = STATE.files.filter(f => f.fileName !== fileName);
    // Find the latest unified file to set as matrix, or null
    const latestUnified = [...STATE.files].reverse().find(f => f.type === 'unified');
    STATE.unifiedMatrix = latestUnified ? latestUnified.matrix : null;
    
    renderFileChips();
    refreshDashboard();
    if (STATE.files.length === 0) expandUploadZone();
}

function collapseUploadZone() {
    const zone = document.getElementById('upload-zone');
    if (zone) zone.classList.add('collapsed');
}
function expandUploadZone() {
    const zone = document.getElementById('upload-zone');
    if (zone) zone.classList.remove('collapsed');
}

/* ============================================================
   7. QUICK INSIGHTS BAR
   ============================================================ */

function updateInsightsBar(data) {
    // Status chip
    const statusEl = document.getElementById('insight-status-value');
    const statusChip = document.getElementById('insight-status');
    if (statusEl && statusChip) {
        if (STATE.files.length > 0) {
            statusEl.textContent = 'بيانات نشطة ✓';
            statusChip.classList.add('active-data');
        } else {
            statusEl.textContent = 'في انتظار البيانات';
            statusChip.classList.remove('active-data');
        }
    }

    // Last Updated chip
    const timeEl = document.getElementById('insight-time-value');
    if (timeEl) {
        if (STATE.lastUpdated) {
            const d = STATE.lastUpdated;
            const pad = n => String(n).padStart(2, '0');
            timeEl.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())} — ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
        } else {
            timeEl.textContent = '—';
        }
    }

    // Source File chip
    const sourceEl = document.getElementById('insight-source-value');
    if (sourceEl) {
        if (STATE.files.length > 0) {
            const names = STATE.files.map(f => f.fileName).join('، ');
            sourceEl.textContent = names.length > 60 ? names.substring(0, 57) + '...' : names;
            sourceEl.title = names;
        } else {
            sourceEl.textContent = 'لم يتم رفع ملف';
            sourceEl.title = '';
        }
    }

    // Stats pills
    const opsEl = document.getElementById('stat-ops-count');
    const empEl = document.getElementById('stat-emp-count');
    const filesEl = document.getElementById('stat-file-count');
    if (opsEl) opsEl.textContent = data ? formatInt(data.totalTxVolume || 0) : '0';
    if (empEl) empEl.textContent = data ? (data.employees || []).length : '0';
    if (filesEl) filesEl.textContent = STATE.files.length;
}

/* ============================================================
   7b. KPI SEARCH & SECTION NAVIGATION
   ============================================================ */

function initKPISearch() {
    const input = document.getElementById('kpi-search-input');
    const clearBtn = document.getElementById('kpi-search-clear');
    if (!input || !clearBtn) return;

    input.addEventListener('input', () => {
        const query = input.value.trim().toLowerCase();
        clearBtn.classList.toggle('hidden', query.length === 0);
        filterKPICards(query);
    });

    clearBtn.addEventListener('click', () => {
        input.value = '';
        clearBtn.classList.add('hidden');
        filterKPICards('');
        input.focus();
    });

    // Section navigation
    const navBtns = document.querySelectorAll('.scroll-nav-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const section = btn.dataset.section;
            handleSectionNav(section);
        });
    });
}

function filterKPICards(query) {
    const cards = document.querySelectorAll('.kpi-card');
    cards.forEach(card => {
        if (!query) {
            card.classList.remove('search-hidden', 'search-highlight');
            return;
        }
        const text = card.textContent.toLowerCase();
        if (text.includes(query)) {
            card.classList.remove('search-hidden');
            card.classList.add('search-highlight');
        } else {
            card.classList.add('search-hidden');
            card.classList.remove('search-highlight');
        }
    });
}

function handleSectionNav(section) {
    // Reset search
    const input = document.getElementById('kpi-search-input');
    const clearBtn = document.getElementById('kpi-search-clear');
    if (input) input.value = '';
    if (clearBtn) clearBtn.classList.add('hidden');
    filterKPICards('');

    // Scroll to section
    let target = null;
    switch (section) {
        case 'currencies':
            target = document.getElementById('kpi-yer-total');
            break;
        case 'accounts':
            target = document.getElementById('kpi-new-accounts');
            break;
        case 'transfers':
            target = document.getElementById('kpi-transfers-out');
            break;
        case 'charts':
            target = document.querySelector('.charts-grid');
            break;
        case 'all':
        default:
            target = document.getElementById('kpi-grid');
            break;
    }

    if (target) {
        const card = target.closest('.kpi-card') || target;
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Brief highlight pulse
        if (card.classList.contains('kpi-card')) {
            card.classList.add('search-highlight');
            setTimeout(() => card.classList.remove('search-highlight'), 1500);
        }
    }
}

/* ============================================================
   8. REFRESH PIPELINE
   ============================================================ */

function refreshDashboard() {
    STATE.lastUpdated = new Date();
    const data = aggregateData();
    renderKPIs(data);
    renderCharts(data);
    updateInsightsBar(data);
}

/* ============================================================
   9. THEME TOGGLE
   ============================================================ */

function initTheme() {
    const btn = document.getElementById('theme-toggle-btn');
    if (!btn) return;

    const saved = localStorage.getItem('dashboard-theme');
    if (saved === 'dark') document.documentElement.classList.add('dark');

    btn.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        const isDark = document.documentElement.classList.contains('dark');
        localStorage.setItem('dashboard-theme', isDark ? 'dark' : 'light');
        if (STATE.files.length > 0) refreshDashboard();
    });
}

/* ============================================================
   10. PDF EXPORT
   ============================================================ */

function initPDFExport() {
    const btn = document.getElementById('export-pdf-btn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.title = 'جاري التصدير...';
        try {
            const container = document.getElementById('dashboard-container');
            const canvas = await html2canvas(container, {
                scale: 2, useCORS: true,
                backgroundColor: getComputedStyle(document.body).backgroundColor
            });
            const { jsPDF } = window.jspdf;
            const imgData = canvas.toDataURL('image/png');
            const pdfW = canvas.width * 0.264583;
            const pdfH = canvas.height * 0.264583;
            const pdf = new jsPDF({ orientation: pdfW > pdfH ? 'landscape' : 'portrait', unit: 'mm', format: [pdfW, pdfH] });
            pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
            pdf.save('branch-dashboard.pdf');
        } catch (err) {
            console.error('PDF export error:', err);
            alert('حدث خطأ أثناء تصدير PDF');
        }
        btn.disabled = false;
        btn.title = 'حفظ PDF';
    });
}

/* ============================================================
   11. LOGO CUSTOMIZATION
   ============================================================ */

function initLogoCustomizer() {
    const customizeBtn = document.getElementById('customize-btn');
    const modal = document.getElementById('design-modal');
    const logoUpload = document.getElementById('logo-upload');
    const logoPreview = document.getElementById('logo-preview');
    const bankLogo = document.getElementById('bank-logo');
    const logoStatus = document.getElementById('logo-status');

    if (!customizeBtn || !modal) return;
    customizeBtn.addEventListener('click', () => modal.classList.remove('hidden'));

    const savedLogo = localStorage.getItem('dashboard-logo');
    if (savedLogo) {
        if (bankLogo) bankLogo.src = savedLogo;
        if (logoPreview) logoPreview.src = savedLogo;
    }

    if (logoUpload) {
        logoUpload.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                const dataUrl = ev.target.result;
                if (bankLogo) bankLogo.src = dataUrl;
                if (logoPreview) logoPreview.src = dataUrl;
                localStorage.setItem('dashboard-logo', dataUrl);
                if (logoStatus) {
                    logoStatus.classList.remove('hidden');
                    setTimeout(() => logoStatus.classList.add('hidden'), 3000);
                }
            };
            reader.readAsDataURL(file);
        });
    }
}

/* ============================================================
   12. MODAL MANAGEMENT
   ============================================================ */

function initModals() {
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.modal-overlay').classList.add('hidden'));
    });

    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });
    });

    const addBtn = document.getElementById('add-data-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            expandUploadZone();
            document.getElementById('upload-zone')?.scrollIntoView({ behavior: 'smooth' });
            document.getElementById('excel-file-input')?.click();
        });
    }

    const manageBtn = document.getElementById('manage-data-btn');
    const listModal = document.getElementById('data-list-modal');
    if (manageBtn && listModal) {
        manageBtn.addEventListener('click', () => {
            renderDataListModal();
            listModal.classList.remove('hidden');
        });
    }
}

function renderDataListModal() {
    const container = document.getElementById('data-list-container');
    if (!container) return;

    if (STATE.files.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-secondary);">لا توجد ملفات محملة بعد.</p>';
        return;
    }

    const typeLabels = { operations: '📊 عمليات', accounts: '🏦 حسابات', cards: '💳 بطاقات', unknown: '📄 ملف' };
    container.innerHTML = STATE.files.map(f => `
        <div class="data-list-item" data-file="${f.fileName}">
            <div>
                <span class="list-date">${f.fileName}</span>
                <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:4px;">
                    📊 تقرير موحد — ${f.matrix ? f.matrix.length : 0} صف
                    ${f.meta.branch ? ' — ' + f.meta.branch : ''}
                </div>
            </div>
            <button class="btn btn-secondary" style="padding:0.25rem 0.75rem;font-size:0.75rem;" onclick="removeFile('${f.fileName}');renderDataListModal();">حذف</button>
        </div>
    `).join('');
}

window.removeFile = removeFile;
window.renderDataListModal = renderDataListModal;

/* ============================================================
   13. LOADING INDICATOR
   ============================================================ */

function showLoading() {
    const el = document.getElementById('loading-indicator');
    if (el) el.classList.remove('hidden');
}

function hideLoading() {
    const el = document.getElementById('loading-indicator');
    if (el) el.classList.add('hidden');
}

/* ============================================================
   14. INITIALIZATION
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    hideLoading();
    initUploadZone();
    initKPISearch();
    initTheme();
    initPDFExport();
    initLogoCustomizer();
    initModals();
    updateInsightsBar(null);
});
