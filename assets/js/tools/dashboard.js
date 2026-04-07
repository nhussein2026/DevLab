/**
 * Branch Productivity Dashboard
 * Reads multiple Excel report files and drives KPIs, charts, filters, and export.
 */

/* ============================================================
   0. GLOBAL STATE
   ============================================================ */
const STATE = {
    files: [],
    operationRows: [],
    accountRows: [],
    cardRows: [],
    filters: { period: 'Monthly', currency: 'ALL', accountType: 'ALL' },
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

    console.log(`[Detect] File "${fileName}" — ops:${opsScore}, acct:${acctScore}, cards:${cardScore}`);

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
    let allRows = [];
    let allHeaders = [];
    let meta = { fileName, sheets: [] };

    for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (!json.length) continue;

        // State sheets contain metadata
        if (sheetName.startsWith('State_') || sheetName.startsWith('state_')) {
            meta.sheets.push({ name: sheetName, data: json });
            for (const row of json) {
                const rowStr = Array.isArray(row) ? row.map(String).join(' ') : '';
                if (rowStr.includes('الفرع') || rowStr.includes('Branch')) {
                    meta.branch = row[1] || row[0];
                }
                for (const cell of row) {
                    if (cell instanceof Date && !isNaN(cell)) {
                        if (!meta.startDate) meta.startDate = cell;
                        else meta.endDate = cell;
                    } else if (typeof cell === 'string' && /\d{1,2}\/\d{1,2}\/\d{4}/.test(cell)) {
                        const d = parseArabicDate(cell);
                        if (d) {
                            if (!meta.startDate) meta.startDate = d;
                            else meta.endDate = d;
                        }
                    }
                }
            }
            continue;
        }

        // Data sheet — find the REAL header row.
        // Excel reports often have: row 0 = merged branch name, row 1 = sub-headers, row 2 = actual column headers.
        // Strategy: find the row with the most UNIQUE non-empty string values (not numbers, not same value repeated).
        let headerRowIdx = 0;
        let bestUniqueCount = 0;

        for (let i = 0; i < Math.min(json.length, 10); i++) {
            const row = json[i];
            if (!row) continue;

            const nonEmpty = row
                .map(c => String(c).trim())
                .filter(c => c !== '' && c !== 'undefined' && c !== 'null');
            if (nonEmpty.length < 2) continue;

            // Count unique values
            const uniqueVals = new Set(nonEmpty);

            // Prefer rows where values are diverse (not same branch name repeated)
            // Also prefer rows with known keywords
            const knownWords = ['عدد', 'مجموع', 'إجمالي', 'Total', 'توفير', 'جاري', 'مرابحة', 'استثمار', 'حساب', 'تمويل', 'عمليات', 'المعادل', 'Grand'];
            const hasKnown = knownWords.some(kw => nonEmpty.some(v => v.includes(kw)));

            let score = uniqueVals.size;
            if (hasKnown) score += 10; // Strong boost for rows with known keywords

            // Penalize rows where all cells are the same (branch name rows)
            if (uniqueVals.size === 1) score = 0;

            if (score > bestUniqueCount) {
                bestUniqueCount = score;
                headerRowIdx = i;
            }
        }

        const rawHeaders = json[headerRowIdx].map(h => String(h).trim());
        allHeaders = [...allHeaders, ...rawHeaders.filter(h => h !== '')];
        meta.sheets.push({ name: sheetName, rowCount: json.length - headerRowIdx - 1, headers: rawHeaders });

        console.log(`[Parse] Sheet "${sheetName}" headers:`, rawHeaders);

        // Parse data rows (everything after header)
        for (let i = headerRowIdx + 1; i < json.length; i++) {
            const row = json[i];
            if (!row || row.every(c => c === '' || c === null || c === undefined)) continue;

            const obj = {};
            rawHeaders.forEach((h, idx) => {
                if (h) obj[h] = row[idx] !== undefined ? row[idx] : '';
            });
            obj._sheet = sheetName;
            obj._file = fileName;
            allRows.push(obj);
        }
    }

    const type = detectReportType(wb.SheetNames, allHeaders, fileName);
    console.log(`[Parse] File "${fileName}" → type: ${type}, rows: ${allRows.length}, headers:`, allHeaders);

    // Log first row for debugging
    if (allRows.length > 0) {
        console.log(`[Parse] Sample row:`, JSON.stringify(allRows[0]));
    }

    return { type, rows: allRows, meta, headers: allHeaders };
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

function aggregateData() {
    const ops = STATE.operationRows;
    const accts = STATE.accountRows;
    const cards = STATE.cardRows;

    console.log(`[Aggregate] ops:${ops.length}, accts:${accts.length}, cards:${cards.length}`);

    // ---- Operations KPIs ----
    let totalDeposits = 0, totalWithdrawals = 0;
    let transfersOutCount = 0, transfersOutAmount = 0;
    let transfersInCount = 0, transfersInAmount = 0;
    let totalOpsAmount = 0, totalOpsCount = 0;

    for (const row of ops) {
        const name = getRowName(row);
        if (!name) continue;

        // Get numeric values from any column that looks numeric
        const amount = getFirstNumeric(row);
        const count = getSecondNumeric(row);

        // Check if this is a total/summary row
        const isTotalRow = /^(الإجمالي|Total|المجموع|الإجمالي الكلي|Grand Total)$/i.test(name);
        if (isTotalRow) continue; // skip totals, we sum ourselves

        if (isDepositRelated(name)) {
            totalDeposits += amount;
        } else if (isWithdrawalRelated(name)) {
            totalWithdrawals += amount;
        } else if (isTransferOut(name)) {
            transfersOutCount += count;
            transfersOutAmount += amount;
        } else if (isTransferIn(name)) {
            transfersInCount += count;
            transfersInAmount += amount;
        } else {
            // General operation — add to running total
            totalOpsAmount += amount;
            totalOpsCount += count;
        }
    }

    // If no deposit/withdrawal distinction, use overall total as deposits
    if (totalDeposits === 0 && totalOpsAmount > 0) {
        totalDeposits = totalOpsAmount;
    }

    // ---- Account KPIs ----
    let newAccounts = 0, personalAccounts = 0, corporateAccounts = 0;
    let investmentDeposits = 0, financingTotal = 0;

    for (const row of accts) {
        const name = getRowName(row);
        if (!name) continue;
        if (/^(الإجمالي|Total|المجموع|الإجمالي الكلي|Grand Total)$/i.test(name)) continue;

        // Get values by exact column key matching
        const keys = Object.keys(row).filter(k => !k.startsWith('_'));
        let rowTotal = 0;

        for (const key of keys) {
            const val = toNumber(row[key]);
            if (val === 0) continue;
            if (key === keys[0]) continue; // skip name column

            const lk = key.toLowerCase();
            if (lk.includes('مرابحة') || lk.includes('murabaha') || lk.includes('تمويل')) {
                financingTotal += val;
            } else if (lk.includes('توفير') || lk.includes('savings')) {
                personalAccounts += val;
            } else if (lk.includes('جاري') || lk.includes('current')) {
                personalAccounts += val;
            } else if (lk.includes('استثمار') || lk.includes('investment')) {
                investmentDeposits += val;
            } else if (lk.includes('شركات') || lk.includes('corporate')) {
                corporateAccounts += val;
            } else if (lk.includes('شباب') || lk.includes('youth')) {
                personalAccounts += val;
            } else if (key === 'Total' || key === 'الإجمالي' || key === 'المجموع') {
                rowTotal = val;
            } else if (key === 'Grand Total' || key === 'الإجمالي الكلي') {
                rowTotal = val;
            }
        }

        // Use row total for new accounts count
        if (rowTotal > 0) {
            newAccounts += rowTotal;
        }
    }

    // If newAccounts is 0 but we have individual counts, sum them
    if (newAccounts === 0) {
        newAccounts = personalAccounts + corporateAccounts + investmentDeposits + financingTotal;
    }

    // ---- Card KPIs ----
    let cardActivity = 0;
    const cardBreakdown = {};

    for (const row of cards) {
        const name = getRowName(row);
        if (!name) continue;
        if (/^(الإجمالي|Total|المجموع|الإجمالي الكلي|Grand Total)$/i.test(name)) continue;

        const keys = Object.keys(row).filter(k => !k.startsWith('_'));
        let rowTotal = 0;

        for (const key of keys) {
            const val = toNumber(row[key]);
            if (val === 0) continue;
            if (key === keys[0]) continue; // skip name column

            // Skip total/summary columns and branch-name columns
            const isTotalCol = /^(Total|الإجمالي|المجموع|Grand Total|الإجمالي الكلي)$/i.test(key.trim());
            const isBranchCol = /مركز|فرع|رئيسي|مأرب|المجموع$/i.test(key.trim());

            if (isTotalCol) {
                rowTotal = Math.max(rowTotal, val);
            } else if (!isBranchCol) {
                // Real card type column
                cardBreakdown[key] = (cardBreakdown[key] || 0) + val;
            }
        }
        cardActivity += rowTotal;
    }

    const result = {
        totalDeposits,
        totalWithdrawals,
        financingTotal,
        newAccounts,
        personalAccounts,
        corporateAccounts,
        investmentDeposits,
        transfersOutCount,
        transfersOutAmount,
        transfersInCount,
        transfersInAmount,
        cardActivity,
        cardBreakdown
    };

    console.log('[Aggregate] Result:', result);
    return result;
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
    animateValue('kpi-total-deposits', data.totalDeposits, true);
    animateValue('kpi-total-withdrawals', data.totalWithdrawals, true);
    animateValue('kpi-total-financing', data.financingTotal, false);
    animateValue('kpi-new-accounts', data.newAccounts, false);
    animateValue('kpi-personal-accounts', data.personalAccounts, false);
    animateValue('kpi-corporate-accounts', data.corporateAccounts, false);
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
    renderDailyLineChart();
    renderMonthlyBarChart();
    renderAccountsPieChart(data);
    renderCardsDonutChart(data);
}

function destroyChart(key) {
    if (STATE.charts[key]) { STATE.charts[key].destroy(); delete STATE.charts[key]; }
}

function renderDailyLineChart() {
    destroyChart('daily');
    const ctx = document.getElementById('dailyLineChart');
    if (!ctx) return;
    const colors = getChartColors();

    const users = [], amounts = [], counts = [];

    for (const row of STATE.operationRows) {
        const name = getRowName(row);
        if (!name || /^(الإجمالي|Total|المجموع|الإجمالي الكلي|Grand Total)$/i.test(name)) continue;
        users.push(name);
        amounts.push(getFirstNumeric(row));
        counts.push(getSecondNumeric(row));
    }

    if (users.length === 0) {
        // No operations data — show placeholder
        STATE.charts.daily = new Chart(ctx, {
            type: 'line',
            data: { labels: ['لا توجد بيانات'], datasets: [{ label: 'المبلغ', data: [0], borderColor: colors.blue }] },
            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { labels: { color: colors.text } } } }
        });
        return;
    }

    STATE.charts.daily = new Chart(ctx, {
        type: 'line',
        data: {
            labels: users,
            datasets: [
                { label: 'المبلغ (بالمعادل) | Amount', data: amounts, borderColor: colors.blue, backgroundColor: colors.blue + '22', fill: true, tension: 0.4, pointRadius: 5, pointHoverRadius: 8, yAxisID: 'y' },
                { label: 'عدد العمليات | Count', data: counts, borderColor: colors.green, backgroundColor: colors.green + '22', fill: false, tension: 0.4, pointRadius: 5, pointHoverRadius: 8, yAxisID: 'y1' }
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
                x: { ticks: { color: colors.text, font: { family: "'Cairo'" }, maxRotation: 45 }, grid: { color: colors.grid } },
                y: { position: 'right', ticks: { color: colors.blue, callback: v => formatNumber(v) }, grid: { color: colors.grid } },
                y1: { position: 'left', ticks: { color: colors.green }, grid: { drawOnChartArea: false } }
            }
        }
    });
}

function renderMonthlyBarChart() {
    destroyChart('monthly');
    const ctx = document.getElementById('monthlyColumnChart');
    if (!ctx) return;
    const colors = getChartColors();

    const users = [], datasets = {};

    for (const row of STATE.accountRows) {
        const name = getRowName(row);
        if (!name || /^(الإجمالي|Total|المجموع|الإجمالي الكلي|Grand Total)$/i.test(name)) continue;
        users.push(name);

        const keys = Object.keys(row).filter(k => !k.startsWith('_'));
        for (const key of keys) {
            if (key === keys[0]) continue; // skip name
            if (/total|إجمالي|مجموع/i.test(key)) continue; // skip totals
            const val = toNumber(row[key]);
            if (!datasets[key]) datasets[key] = [];
            datasets[key].push(val);
        }
    }

    const colorArr = [colors.darkBlue, colors.blue, colors.green, colors.amber, colors.purple, colors.pink];
    const dsArr = Object.entries(datasets).map(([label, data], i) => ({
        label, data, backgroundColor: colorArr[i % colorArr.length], borderRadius: 4
    }));

    STATE.charts.monthly = new Chart(ctx, {
        type: 'bar',
        data: { labels: users, datasets: dsArr },
        options: {
            responsive: true, maintainAspectRatio: true,
            plugins: { legend: { labels: { color: colors.text, font: { family: "'Cairo','Inter',sans-serif", size: 11 } } } },
            scales: {
                x: { stacked: true, ticks: { color: colors.text, font: { family: "'Cairo'" }, maxRotation: 45 }, grid: { display: false } },
                y: { stacked: true, ticks: { color: colors.text }, grid: { color: colors.grid } }
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
    if (data.personalAccounts > 0) { labels.push('أفراد (جاري+توفير)'); values.push(data.personalAccounts); }
    if (data.corporateAccounts > 0) { labels.push('شركات'); values.push(data.corporateAccounts); }
    if (data.investmentDeposits > 0) { labels.push('ودائع استثمارية'); values.push(data.investmentDeposits); }
    if (data.financingTotal > 0) { labels.push('تمويل مرابحة'); values.push(data.financingTotal); }
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

            if (parsed.type === 'operations') STATE.operationRows.push(...parsed.rows);
            else if (parsed.type === 'accounts') STATE.accountRows.push(...parsed.rows);
            else if (parsed.type === 'cards') STATE.cardRows.push(...parsed.rows);
            else STATE.operationRows.push(...parsed.rows);

            console.log(`[Upload] ${file.name} → ${parsed.type} (${parsed.rows.length} rows)`);
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
    STATE.operationRows = [];
    STATE.accountRows = [];
    STATE.cardRows = [];
    for (const f of STATE.files) {
        if (f.type === 'operations') STATE.operationRows.push(...f.rows);
        else if (f.type === 'accounts') STATE.accountRows.push(...f.rows);
        else if (f.type === 'cards') STATE.cardRows.push(...f.rows);
        else STATE.operationRows.push(...f.rows);
    }
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
   7. FILTER SLICERS
   ============================================================ */

function initSlicers() {
    initSlicerGroup('date-slicer', val => { STATE.filters.period = val; refreshDashboard(); });
    initSlicerGroup('currency-slicer', val => { STATE.filters.currency = val; refreshDashboard(); });
    initSlicerGroup('account-type-slicer', val => { STATE.filters.accountType = val; refreshDashboard(); });
}

function initSlicerGroup(groupId, onChange) {
    const group = document.getElementById(groupId);
    if (!group) return;
    group.querySelectorAll('.slicer-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            group.querySelectorAll('.slicer-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            onChange(btn.dataset.value);
        });
    });
}

/* ============================================================
   8. REFRESH PIPELINE
   ============================================================ */

function refreshDashboard() {
    const data = aggregateData();
    renderKPIs(data);
    renderCharts(data);
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
                    ${typeLabels[f.type] || typeLabels.unknown} — ${f.rows.length} سجل
                    ${f.meta.branch ? ' — ' + f.meta.branch : ''}
                    ${f.meta.startDate ? ' — ' + f.meta.startDate.toLocaleDateString('ar-EG') : ''}
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
    initSlicers();
    initTheme();
    initPDFExport();
    initLogoCustomizer();
    initModals();
});
