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
        depositsYER: 0, depositsSAR: 0, depositsUSD: 0,
        withdrawalsYER: 0, withdrawalsSAR: 0, withdrawalsUSD: 0,
        atmWithdrawalsYER: 0, atmWithdrawalsSAR: 0, atmWithdrawalsUSD: 0,
        savingsAccounts: 0, currentAccounts: 0, investmentDeposits: 0,
        companyAccounts: 0, guaranteeLetters: 0,
        transfersOutCount: 0, transfersOutYER: 0, transfersOutSAR: 0, transfersOutUSD: 0,
        transfersInCount: 0, transfersInYER: 0, transfersInSAR: 0, transfersInUSD: 0,
        cardActivity: 0, cardBreakdown: {}, 
        atmOps: 0, digitalOps: 0, employeeOps: 0,
        // Digital Operations Breakdown
        internetBankingCount: 0, internetBankingYER: 0, internetBankingSAR: 0, internetBankingUSD: 0,
        mobileBankingCount: 0, mobileBankingYER: 0, mobileBankingSAR: 0, mobileBankingUSD: 0,
        yerTotal: 0, sarTotal: 0, usdTotal: 0,
        liquidityYER: 0, liquiditySAR: 0, liquidityUSD: 0,
        employees: [], digitalChannels: [],
        allOps: [], totalTxVolume: 0,
        withdrawalRatio: 0, accountGrowth: 0
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
        const col1Label = strAt(r, 1);
        
        // Capture Executive Metrics (labels may be in Col 0 or Col 1)
        if (/نسبة السحب من الإيداع/i.test(opName) || /نسبة السحب من الإيداع/i.test(col1Label)) {
            res.withdrawalRatio = valAt(r, 2) || valAt(r, 1);
            continue;
        }
        if (/نمو الحسابات/i.test(opName) || /نمو الحسابات/i.test(col1Label)) {
            res.accountGrowth = valAt(r, 2) || valAt(r, 1);
            continue;
        }

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

        // Explicit Matching for Main Deposits and Withdrawals (Cells C4/E4/G4 and C3/E3/G3)
        // This avoids artificially inflating the totals by accidentally mixing in ATM uses or transfers
        const opNameClean = opName.trim();
        // Updated regex to account for optional "الـ" prefix on "إيداع"
        if (/^(ال)?[اإأ]يداع الى الحساب$/i.test(opNameClean)) {
            res.depositsYER += yerAmt;
            res.depositsSAR += sarAmt;
            res.depositsUSD += usdAmt;
        } else if (/^السحب من الحساب$/i.test(opNameClean)) {
            res.withdrawalsYER += yerAmt;
            res.withdrawalsSAR += sarAmt;
            res.withdrawalsUSD += usdAmt;
        } else if (/^السحب من الصراف الالي$/i.test(opNameClean) || /^السحب من الصراف الألي$/i.test(opNameClean)) {
            res.atmWithdrawalsYER += yerAmt;
            res.atmWithdrawalsSAR += sarAmt;
            res.atmWithdrawalsUSD += usdAmt;
        }

        // Sector KPIs
        if (/حول?ات?\s*صادر|outgoing/i.test(opName)) { 
            res.transfersOutCount += totalCount; 
            res.transfersOutYER += yerAmt; 
            res.transfersOutSAR += sarAmt; 
            res.transfersOutUSD += usdAmt; 
        } else if (/حول?ات?\s*وارد|incoming/i.test(opName)) { 
            res.transfersInCount += totalCount; 
            res.transfersInYER += yerAmt; 
            res.transfersInSAR += sarAmt; 
            res.transfersInUSD += usdAmt; 
        }

        if (/صراف|atm|cdm/i.test(opName)) {
            res.digitalChannels.push({ name: opName, count: totalCount, amount: yerAmt });
            res.atmOps += totalCount;
        } else if (/انترنت|internet/i.test(opName)) {
            res.digitalChannels.push({ name: opName, count: totalCount, amount: yerAmt });
            res.digitalOps += totalCount;
            res.internetBankingCount += totalCount;
            res.internetBankingYER += yerAmt;
            res.internetBankingSAR += sarAmt;
            res.internetBankingUSD += usdAmt;
        } else if (/موبايل|تطبيق|mobile/i.test(opName)) {
            res.digitalChannels.push({ name: opName, count: totalCount, amount: yerAmt });
            res.digitalOps += totalCount;
            res.mobileBankingCount += totalCount;
            res.mobileBankingYER += yerAmt;
            res.mobileBankingSAR += sarAmt;
            res.mobileBankingUSD += usdAmt;
        }
    }

    // 1.5 Treasury Liquidity (Dynamic: search for header row, values in the next row)
    // Header label: "السيولة النقدية المتاحة بخزينة الفرع" in Col 0, values in next row
    for (let r = 0; r < matrix.length; r++) {
        if (/السيولة النقدية/i.test(strAt(r, 0))) {
            // Values are in the next row (r+1): Col 2 = YER, Col 3 = SAR, Col 5 = USD
            res.liquidityYER = valAt(r + 1, 2);
            res.liquiditySAR = valAt(r + 1, 3);
            res.liquidityUSD = valAt(r + 1, 5);
            console.log(`[Aggregate] Liquidity found at row ${r+1}: YER=${res.liquidityYER}, SAR=${res.liquiditySAR}, USD=${res.liquidityUSD}`);
            break;
        }
    }

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

    // Executive Ratio KPIs
    animatePercent('kpi-withdrawal-ratio', data.withdrawalRatio);
    animatePercent('kpi-account-growth', data.accountGrowth);

    // New Liquidity KPIs
    animateValue('kpi-liquidity-yer', data.liquidityYER, true);
    animateValue('kpi-liquidity-sar', data.liquiditySAR, true);
    animateValue('kpi-liquidity-usd', data.liquidityUSD, true);

    animateValue('kpi-total-deposits-yer', data.depositsYER, true);
    animateValue('kpi-total-deposits-sar', data.depositsSAR, true);
    animateValue('kpi-total-deposits-usd', data.depositsUSD, true);

    animateValue('kpi-total-withdrawals-yer', data.withdrawalsYER, true);
    animateValue('kpi-total-withdrawals-sar', data.withdrawalsSAR, true);
    animateValue('kpi-total-withdrawals-usd', data.withdrawalsUSD, true);

    animateValue('kpi-atm-withdrawals-yer', data.atmWithdrawalsYER, true);
    animateValue('kpi-atm-withdrawals-sar', data.atmWithdrawalsSAR, true);
    animateValue('kpi-atm-withdrawals-usd', data.atmWithdrawalsUSD, true);

    animateValue('kpi-total-financing', data.financingTotal, false);
    animateValue('kpi-total-operations', data.totalTxVolume, false);
    animateValue('kpi-savings-accounts', data.savingsAccounts, false);
    animateValue('kpi-current-accounts', data.currentAccounts, false);
    animateValue('kpi-investment-accounts', data.investmentDeposits, false);
    animateValue('kpi-company-accounts', data.companyAccounts, false);
    animateValue('kpi-guarantee-letters', data.guaranteeLetters, false);
    animateValue('kpi-transfers-out', data.transfersOutCount, false);
    animateValue('kpi-transfers-out-yer', data.transfersOutYER, true);
    animateValue('kpi-transfers-out-sar', data.transfersOutSAR, true);
    animateValue('kpi-transfers-out-usd', data.transfersOutUSD, true);

    animateValue('kpi-transfers-in', data.transfersInCount, false);
    animateValue('kpi-transfers-in-yer', data.transfersInYER, true);
    animateValue('kpi-transfers-in-sar', data.transfersInSAR, true);
    animateValue('kpi-transfers-in-usd', data.transfersInUSD, true);

    animateValue('kpi-credit-cards', data.cardActivity, false);

    // Digital Operations Breakdown
    animateValue('kpi-internet-banking-count', data.internetBankingCount, false);
    animateValue('kpi-internet-banking-yer', data.internetBankingYER, true);
    animateValue('kpi-internet-banking-sar', data.internetBankingSAR, true);
    animateValue('kpi-internet-banking-usd', data.internetBankingUSD, true);

    animateValue('kpi-mobile-banking-count', data.mobileBankingCount, false);
    animateValue('kpi-mobile-banking-yer', data.mobileBankingYER, true);
    animateValue('kpi-mobile-banking-sar', data.mobileBankingSAR, true);
    animateValue('kpi-mobile-banking-usd', data.mobileBankingUSD, true);
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

function animatePercent(id, endVal) {
    const el = document.getElementById(id);
    if (!el) return;

    const targetPct = endVal * 100;
    const duration = 1200;
    const start = performance.now();

    function tick(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        const current = targetPct * ease;
        el.textContent = current.toFixed(1) + '%';
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
        blue: '#0ea5e9', darkBlue: isDark ? '#38bdf8' : '#0369a1',
        green: '#10b981', red: '#f43f5e', amber: '#f59e0b',
        purple: '#8b5cf6', pink: '#ec4899', teal: '#14b8a6',
        text: isDark ? '#f8fafc' : '#334155',
        grid: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
        bg: isDark ? 'rgba(15, 23, 42, 0.4)' : 'rgba(255, 255, 255, 0.7)',
        palette: ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#14b8a6', '#6366f1', '#f43f5e', '#3b82f6', '#84cc16']
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
                { 
                    type: 'bar', 
                    label: 'عدد العمليات', 
                    data: counts, 
                    backgroundColor: colors.blue, 
                    borderRadius: 6,
                    barPercentage: 0.6,
                    yAxisID: 'y' 
                },
                { 
                    type: 'line', 
                    label: 'المبلغ (يمني)', 
                    data: amounts, 
                    borderColor: colors.amber, 
                    backgroundColor: 'rgba(245, 158, 11, 0.15)', 
                    borderWidth: 3,
                    fill: true, 
                    tension: 0.4, 
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: colors.amber,
                    pointBorderWidth: 2,
                    yAxisID: 'y1' 
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: true,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { 
                    position: 'top',
                    labels: { color: colors.text, font: { family: "'Cairo','Inter',sans-serif", size: 12 }, padding: 20, usePointStyle: true }
                },
                tooltip: { 
                    rtl: true,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleFont: { family: "'Cairo'", size: 14 },
                    bodyFont: { family: "'Cairo'", size: 13 },
                    padding: 12,
                    callbacks: { label: ctx => `${ctx.dataset.label.split('|')[0].trim()}: ${ctx.parsed.y.toLocaleString()}` } 
                }
            },
            scales: {
                x: { 
                    ticks: { color: colors.text, font: { family: "'Cairo'" }, maxRotation: 45 }, 
                    grid: { display: false } 
                },
                y: { 
                    position: 'right', 
                    title: { display: true, text: 'العدد', color: colors.blue, font: { family: "'Cairo'" } },
                    ticks: { color: colors.blue, callback: v => formatNumber(v) }, 
                    grid: { color: colors.grid, drawBorder: false } 
                },
                y1: { 
                    position: 'left', 
                    title: { display: true, text: 'المبلغ', color: colors.amber, font: { family: "'Cairo'" } },
                    ticks: { color: colors.amber, callback: v => formatNumber(v) }, 
                    grid: { drawOnChartArea: false, drawBorder: false } 
                }
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
                    label: 'ريال يمني',
                    data: ops.map(op => op.yer),
                    backgroundColor: colors.blue,
                    borderRadius: 4
                },
                {
                    label: 'ريال سعودي',
                    data: ops.map(op => op.sar),
                    backgroundColor: colors.green,
                    borderRadius: 4
                },
                {
                    label: 'دولار',
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
                    type: 'logarithmic',
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
    renderFindings(data);
    renderSummaryTable(data);
}

/* ============================================================
   9. SMART FINDINGS & SUMMARY TABLE
   ============================================================ */

function renderFindings(data) {
    const section = document.getElementById('findings-section');
    const container = document.getElementById('findings-container');
    if (!section || !container) return;
    
    if (!data.allOps || data.allOps.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    container.innerHTML = '';

    const addFinding = (icon, title, desc, severity = 'info') => {
        let colors = '';
        if (severity === 'success') colors = 'finding-success';
        else if (severity === 'alert') colors = 'finding-alert';
        else if (severity === 'warning') colors = 'finding-warning';
        else colors = 'finding-info';

        const card = document.createElement('div');
        card.className = `finding-card ${colors}`;
        card.innerHTML = `
            <div class="finding-icon">${icon}</div>
            <div class="finding-content">
                <h3 class="finding-title">${title}</h3>
                <p class="finding-desc">${desc}</p>
            </div>
        `;
        container.appendChild(card);
    };

    // 1. Top Employee
    const topEmp = [...data.employees].sort((a, b) => b.amount - a.amount)[0];
    if (topEmp) {
        addFinding(
            '<svg class="finding-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>',
            'أفضل الموظفين أداءً | Top Performer',
            `حقق الموظف <strong>${topEmp.name}</strong> أعلى إجمالي بمبلغ ${formatNumber(topEmp.amount)} يمني عبر ${topEmp.count} عملية.`,
            'success'
        );
    }

    // 2. Liquidity / Withdrawal Ratio Alert
    const wRatio = data.withdrawalRatio;
    if (wRatio > 0.8) {
        addFinding(
            '<svg class="finding-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>',
            'تنبيه سيولة | Liquidity Alert',
            `نسبة السحوبات مقارنة بالإيداعات مرتفعة (${(wRatio * 100).toFixed(1)}%). يجب مراقبة سيولة الخزينة.`,
            'alert'
        );
    } else if (wRatio > 0) {
        addFinding(
            '<svg class="finding-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>',
            'استقرار السيولة | Stable Liquidity',
            `نسبة السحوبات إلى الإيداعات مستقرة (${(wRatio * 100).toFixed(1)}%). وضع السيولة آمن.`,
            'info'
        );
    }

    // 3. Channels Overview
    if (data.atmOps > 0 && data.digitalOps === 0) {
        addFinding(
            '<svg class="finding-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>',
            'القنوات الرقمية | Digital Channels',
            `هناك اعتماد على الصرافات الآلية (${data.atmOps} عملية) ولكن لا توجد عمليات مسجلة عبر تطبيق الموبايل/الإنترنت.`,
            'warning'
        );
    }

    // 4. Accounts Growth
    if (data.accountGrowth > 0.5) {
        addFinding(
            '<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>',
            'نمو ممتاز للحسابات | Excellent Account Growth',
            `بلغ معدل نمو الحسابات ${(data.accountGrowth * 100).toFixed(1)}% مما يعكس نجاحاً في جذب عملاء جدد.`,
            'success'
        );
    } else if (data.accountGrowth > 0) {
        addFinding(
            '<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>',
            'نمو الحسابات | Account Growth',
            `بلغ معدل نمو الحسابات ${(data.accountGrowth * 100).toFixed(1)}%.`,
            'info'
        );
    }
}

function renderSummaryTable(data) {
    const section = document.getElementById('summary-section');
    const tbody = document.getElementById('summary-table-body');
    if (!section || !tbody) return;

    if (!data.allOps || data.allOps.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    tbody.innerHTML = '';

    // Calculate max potential for performance bar
    const maxLocalAmt = Math.max(...data.allOps.filter(o => !o.isTotal).map(o => o.yer));

    data.allOps.forEach(op => {
        const tr = document.createElement('tr');
        if (op.isTotal) {
            tr.className = 'total-row';
        }
        
        const perfPct = op.isTotal || maxLocalAmt === 0 ? 0 : Math.min((op.yer / maxLocalAmt) * 100, 100);
        let perfCol = op.isTotal ? '-' : `
            <div class="perf-bar-bg">
                <div class="perf-bar-fill" style="width: ${perfPct}%;"></div>
            </div>
        `;

        tr.innerHTML = `
            <td>${op.name}</td>
            <td>${formatInt(op.count)}</td>
            <td dir="ltr" class="font-mono">${formatNumber(op.yer)}</td>
            <td dir="ltr" class="font-mono">${formatNumber(op.sar)}</td>
            <td dir="ltr" class="font-mono">${formatNumber(op.usd)}</td>
            <td class="perf-col">${perfCol}</td>
        `;

        tbody.appendChild(tr);
    });
}

/* ============================================================
   10. THEME TOGGLE
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
            const isDark = document.documentElement.classList.contains('dark');
            
            // Resolve the actual background color for the PDF
            const bodyBg = isDark ? '#020617' : '#f1f5f9';

            // Temporarily expand the container to ensure all content is visible
            const origMaxHeight = container.style.maxHeight;
            const origOverflow = container.style.overflow;
            container.style.maxHeight = 'none';
            container.style.overflow = 'visible';

            // Ensure all scrollable areas within are fully visible
            container.querySelectorAll('.table-responsive').forEach(el => {
                el.style.overflow = 'visible';
                el.style.maxHeight = 'none';
            });

            const canvas = await html2canvas(container, {
                scale: 2,
                useCORS: true,
                backgroundColor: bodyBg,
                logging: false,
                windowWidth: container.scrollWidth,
                windowHeight: container.scrollHeight,
                // The onclone callback runs on a CLONED copy of the DOM
                // We use it to resolve all CSS variables into concrete values
                // so html2canvas can render them correctly
                onclone: (clonedDoc) => {
                    const clonedRoot = clonedDoc.documentElement;
                    const clonedBody = clonedDoc.body;
                    
                    // Preserve dark class on cloned document
                    if (isDark) {
                        clonedRoot.classList.add('dark');
                    }
                    
                    // Set solid background on body (gradients don't render well)
                    clonedBody.style.background = bodyBg;
                    clonedBody.style.backgroundColor = bodyBg;

                    // Expand the cloned container fully
                    const clonedContainer = clonedDoc.getElementById('dashboard-container');
                    if (clonedContainer) {
                        clonedContainer.style.maxHeight = 'none';
                        clonedContainer.style.overflow = 'visible';
                        clonedContainer.style.height = 'auto';
                    }

                    // Ensure hidden sections are shown for PDF capture
                    clonedDoc.querySelectorAll('.hidden').forEach(el => {
                        // Don't show modals, only show data sections
                        if (el.classList.contains('modal-overlay')) return;
                        if (el.id === 'loading-indicator') return;
                        if (el.id === 'kpi-search-clear') return;
                    });

                    // Expand all scrollable areas
                    clonedDoc.querySelectorAll('.table-responsive').forEach(el => {
                        el.style.overflow = 'visible';
                        el.style.maxHeight = 'none';
                    });
                    
                    // Get all elements in the cloned DOM and resolve their computed styles
                    const allElements = clonedDoc.querySelectorAll('*');
                    
                    allElements.forEach(el => {
                        const computed = getComputedStyle(el);
                        const bgColor = computed.backgroundColor;
                        const color = computed.color;
                        const borderTopColor = computed.borderTopColor;
                        const borderRightColor = computed.borderRightColor;
                        const borderBottomColor = computed.borderBottomColor;
                        const borderLeftColor = computed.borderLeftColor;
                        
                        // Resolve semi-transparent backgrounds to solid colors
                        // html2canvas struggles with rgba on dark backgrounds
                        if (bgColor && bgColor !== 'transparent' && bgColor !== 'rgba(0, 0, 0, 0)') {
                            const solidBg = resolveRGBA(bgColor, bodyBg);
                            el.style.backgroundColor = solidBg;
                        }
                        
                        // Ensure text colors are resolved
                        if (color) {
                            el.style.color = color;
                        }
                        
                        // Resolve border colors
                        if (borderTopColor) el.style.borderTopColor = borderTopColor;
                        if (borderRightColor) el.style.borderRightColor = borderRightColor;
                        if (borderBottomColor) el.style.borderBottomColor = borderBottomColor;
                        if (borderLeftColor) el.style.borderLeftColor = borderLeftColor;
                        
                        // Remove backdrop-filter (html2canvas can't render it)
                        el.style.backdropFilter = 'none';
                        el.style.webkitBackdropFilter = 'none';
                        
                        // Remove transitions/animations (not needed for static capture)
                        el.style.transition = 'none';
                        el.style.animation = 'none';
                        
                        // Resolve background gradients on specific elements
                        const bg = computed.background;
                        if (bg && bg.includes('gradient')) {
                            // For cards in dark mode, use solid dark background
                            if (el.classList.contains('kpi-card') || 
                                el.classList.contains('chart-card') ||
                                el.classList.contains('insight-chip') ||
                                el.classList.contains('insights-bar') ||
                                el.classList.contains('table-card')) {
                                el.style.background = isDark ? '#0f172a' : '#ffffff';
                                el.style.backgroundColor = isDark ? '#0f172a' : '#ffffff';
                            }
                        }
                    });
                    
                    // Force KPI cards to have solid backgrounds
                    clonedDoc.querySelectorAll('.kpi-card, .chart-card, .insight-chip, .insights-bar, .modal-content, .table-card').forEach(el => {
                        if (isDark) {
                            el.style.backgroundColor = '#0f172a';
                            el.style.background = '#0f172a';
                        } else {
                            el.style.backgroundColor = '#ffffff';
                            el.style.background = '#ffffff';
                        }
                        el.style.backdropFilter = 'none';
                        el.style.webkitBackdropFilter = 'none';
                    });
                    
                    // Fix chart headers
                    clonedDoc.querySelectorAll('.chart-header').forEach(el => {
                        el.style.background = 'linear-gradient(90deg, #0369a1, #004A8D)';
                    });

                    // Fix section titles
                    clonedDoc.querySelectorAll('.section-title').forEach(el => {
                        el.style.color = isDark ? '#f8fafc' : '#0f172a';
                    });

                    // Fix finding cards
                    clonedDoc.querySelectorAll('.finding-card').forEach(el => {
                        el.style.backgroundColor = isDark ? '#0f172a' : '#ffffff';
                        el.style.backdropFilter = 'none';
                    });
                    
                    // Fix summary table
                    clonedDoc.querySelectorAll('.summary-table th').forEach(el => {
                        el.style.backgroundColor = isDark ? '#1e293b' : '#f1f5f9';
                        el.style.color = isDark ? '#f8fafc' : '#0f172a';
                    });
                    clonedDoc.querySelectorAll('.summary-table td').forEach(el => {
                        el.style.color = isDark ? '#cbd5e1' : '#334155';
                        el.style.borderColor = isDark ? '#334155' : '#e2e8f0';
                    });
                    clonedDoc.querySelectorAll('.total-row td').forEach(el => {
                        el.style.backgroundColor = isDark ? '#1e293b' : '#f8fafc';
                    });
                }
            });

            // Restore original styles
            container.style.maxHeight = origMaxHeight;
            container.style.overflow = origOverflow;
            container.querySelectorAll('.table-responsive').forEach(el => {
                el.style.overflow = '';
                el.style.maxHeight = '';
            });

            // Generate multi-page A4 PDF
            const { jsPDF } = window.jspdf;
            
            // A4 dimensions in mm
            const a4W = 210;
            const a4H = 297;
            const margin = 10;
            const contentW = a4W - (margin * 2);
            const contentH = a4H - (margin * 2);
            
            // Calculate the scale to fit canvas width into A4 content width
            const imgWidthMM = canvas.width * 0.264583;  // px to mm at 96dpi
            const scaleFactor = contentW / imgWidthMM;
            const scaledHeightMM = canvas.height * 0.264583 * scaleFactor;
            
            // How many pages do we need?
            const totalPages = Math.ceil(scaledHeightMM / contentH);
            
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            
            for (let page = 0; page < totalPages; page++) {
                if (page > 0) pdf.addPage();
                
                // Calculate the source slice from the canvas
                const sliceTopPx = (page * contentH / scaleFactor) / 0.264583;
                const sliceHeightPx = Math.min(
                    (contentH / scaleFactor) / 0.264583,
                    canvas.height - sliceTopPx
                );
                
                if (sliceHeightPx <= 0) break;
                
                // Create a temporary canvas for this page slice
                const pageCanvas = document.createElement('canvas');
                pageCanvas.width = canvas.width;
                pageCanvas.height = Math.ceil(sliceHeightPx);
                const ctx = pageCanvas.getContext('2d');
                
                // Fill background
                const bgHex = isDark ? '#020617' : '#f1f5f9';
                ctx.fillStyle = bgHex;
                ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
                
                // Draw the slice from the full canvas
                ctx.drawImage(
                    canvas,
                    0, Math.floor(sliceTopPx),                    // source x, y
                    canvas.width, Math.ceil(sliceHeightPx),       // source w, h
                    0, 0,                                          // dest x, y
                    canvas.width, Math.ceil(sliceHeightPx)        // dest w, h
                );
                
                const pageImgData = pageCanvas.toDataURL('image/png');
                const drawH = Math.min(contentH, sliceHeightPx * 0.264583 * scaleFactor);
                
                pdf.addImage(pageImgData, 'PNG', margin, margin, contentW, drawH);
                
                // Add page number footer
                pdf.setFontSize(8);
                pdf.setTextColor(150, 150, 150);
                pdf.text(
                    `Page ${page + 1} / ${totalPages}  •  Branch Productivity Dashboard`,
                    a4W / 2, a4H - 5,
                    { align: 'center' }
                );
            }
            
            pdf.save('branch-dashboard.pdf');
        } catch (err) {
            console.error('PDF export error:', err);
            alert('حدث خطأ أثناء تصدير PDF');
        }
        btn.disabled = false;
        btn.title = 'حفظ PDF';
    });
}

/**
 * Blends an RGBA color against a solid background color.
 * html2canvas can't properly composite semi-transparent colors on dark backgrounds,
 * so we pre-compute the result as a solid RGB color.
 */
function resolveRGBA(rgbaStr, bgColorStr) {
    // Parse rgba(r, g, b, a) or rgb(r, g, b)
    const rgba = rgbaStr.match(/[\d.]+/g);
    if (!rgba || rgba.length < 3) return rgbaStr;
    
    const r = parseInt(rgba[0]);
    const g = parseInt(rgba[1]);
    const b = parseInt(rgba[2]);
    const a = rgba.length >= 4 ? parseFloat(rgba[3]) : 1;
    
    if (a >= 0.99) return rgbaStr; // Already opaque, no blending needed
    
    // Parse background color
    let bgR = 255, bgG = 255, bgB = 255;
    if (bgColorStr.startsWith('#')) {
        const hex = bgColorStr.replace('#', '');
        bgR = parseInt(hex.substring(0, 2), 16);
        bgG = parseInt(hex.substring(2, 4), 16);
        bgB = parseInt(hex.substring(4, 6), 16);
    }
    
    // Alpha composite: result = fg * alpha + bg * (1 - alpha)
    const outR = Math.round(r * a + bgR * (1 - a));
    const outG = Math.round(g * a + bgG * (1 - a));
    const outB = Math.round(b * a + bgB * (1 - a));
    
    return `rgb(${outR}, ${outG}, ${outB})`;
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
