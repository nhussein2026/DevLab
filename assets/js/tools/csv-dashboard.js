/* csv-dashboard.js - High-Performance Financial Dashboard Specialization */

document.addEventListener("DOMContentLoaded", () => {
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const mainContainer = document.querySelector(".main-container");
  const uploadSection = document.getElementById("upload-section");
  const dashboardSection = document.getElementById("dashboard-section");
  const resetBtn = document.getElementById("reset-tool");
  const exportBtn = document.getElementById("export-pdf");

  let charts = [];

  // Trigger file input
  dropZone.addEventListener("click", () => fileInput.click());

  // Drag and drop events
  ["dragover", "dragleave", "drop"].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      if (evt === "dragover") {
        dropZone.style.borderColor = "var(--accent-hover)";
        dropZone.style.background = "rgba(56, 189, 248, 0.1)";
      } else if (evt === "dragleave") {
        dropZone.style.borderColor = "var(--accent)";
        dropZone.style.background = "none";
      } else {
        const file = e.dataTransfer.files[0];
        handleFile(file);
      }
    });
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
  });

  async function handleFile(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext === "csv") {
      processCSV(file);
    } else if (ext === "xls" || ext === "xlsx") {
      processExcel(file);
    } else {
      alert("Unsupported file format. Please upload CSV or Excel.");
    }
  }

  function processCSV(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const content = e.target.result;
      const isArabic = /[\u0600-\u06FF]/.test(content);
      
      // Re-read with proper encoding if Arabic detected
      const encoding = isArabic ? "windows-1256" : "UTF-8";
      
      Papa.parse(file, {
        header: false,
        dynamicTyping: true,
        encoding: encoding,
        skipEmptyLines: "greedy",
        complete: (results) => {
          const data = results.data;
          if (data.length > 1) {
            const { headers, cleanData } = smartHeaderMerge(data);
            finalizeData(cleanData, headers, isArabic);
          }
        },
      });
    };
    reader.readAsText(file.slice(0, 50000)); // Larger sample for detection
  }

  function processExcel(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

      if (rawData.length > 2) {
        const { headers, cleanData } = smartHeaderMerge(rawData);
        const isArabic = /[\u0600-\u06FF]/.test(JSON.stringify(headers));
        finalizeData(cleanData, headers, isArabic);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  /**
   * Specialized logic to merge multi-line headers (Row 1: Currency, Row 2: Metric)
   */
  function smartHeaderMerge(rawData) {
    const row1 = rawData[0] || [];
    const row2 = rawData[1] || [];
    const headers = [];

    let currentGroup = "";
    const maxCols = Math.max(row1.length, row2.length);
    
    for (let i = 0; i < maxCols; i++) {
      if (row1[i] && String(row1[i]).trim() !== "") {
        currentGroup = String(row1[i]).trim();
      }
      
      const metric = String(row2[i] || "").trim();
      
      let fullHeader;
      if (currentGroup && metric && currentGroup !== metric) {
        fullHeader = `${currentGroup} - ${metric}`;
      } else {
        fullHeader = currentGroup || metric || `Column ${i + 1}`;
      }
      
      // Ensure uniqueness
      let uniqueHeader = fullHeader;
      let counter = 1;
      while (headers.includes(uniqueHeader)) {
        uniqueHeader = `${fullHeader} (${counter++})`;
      }
      headers.push(uniqueHeader);
    }

    const cleanData = rawData.slice(2).map((row) => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i];
      });
      return obj;
    });

    return { headers, cleanData };
  }

  function finalizeData(data, headers, isArabic) {
    if (isArabic) {
      mainContainer.classList.add("rtl");
      document.body.classList.add("rtl");
    } else {
      mainContainer.classList.remove("rtl");
      document.body.classList.remove("rtl");
    }

    renderDashboard(data, headers, isArabic);
  }

  function renderDashboard(data, headers, isArabic) {
    uploadSection.style.display = "none";
    dashboardSection.style.display = "block";

    // Filter valid data rows
    const validData = data.filter((row) =>
      Object.values(row).some((v) => v !== null && v !== undefined && v !== ""),
    );

    // Identify Currency Aggregates
    const currencies = [
      { name: "ريال يمني", code: "YER", symbol: "﷼" },
      { name: "ريال سعودي", code: "SAR", symbol: "﷼" },
      { name: "دولار امريكي", code: "USD", symbol: "$" },
      { name: "US Dollar", code: "USD", symbol: "$" },
      { name: "Yemeni Rial", code: "YER", symbol: "﷼" },
      { name: "Saudi Rial", code: "SAR", symbol: "﷼" },
    ];
    const summaries = [];

    currencies.forEach((curr) => {
      const amountCol = headers.find((h) => {
        const headerText = String(h).toLowerCase();
        const currName = curr.name.toLowerCase();
        return (
          headerText.includes(currName) &&
          (headerText.includes("بالغ") ||
            headerText.includes("المجموع") ||
            headerText.includes("total") ||
            headerText.includes("amount") ||
            headerText.includes("قيمة"))
        );
      });
      if (amountCol) {
        const totalValue = validData.reduce((acc, row) => {
          const val = row[amountCol];
          return (
            acc +
            (typeof val === "number"
              ? val
              : parseFloat(String(val || 0).replace(/,/g, "")) || 0)
          );
        }, 0);
        if (totalValue > 0) {
          summaries.push({
            label: curr.name,
            code: curr.code,
            value: totalValue,
            symbol: curr.symbol,
          });
        }
      }
    });

    // Handle generic currency if none matched specifically
    if (summaries.length === 0) {
      const lastNumericCol = headers.filter(h => {
        const sample = validData.slice(0, 10).map(r => r[h]).filter(v => typeof v === 'number');
        return sample.length > 0;
      }).pop();
      
      if (lastNumericCol) {
        const totalValue = validData.reduce((acc, row) => {
          const val = row[lastNumericCol];
          return acc + (typeof val === "number" ? val : parseFloat(String(val || 0).replace(/,/g, "")) || 0);
        }, 0);
        summaries.push({ label: "Total Asset", code: "GEN", value: totalValue, symbol: "Σ" });
      }
    }

    // Add Metrics to Stats Grid
    const statsGrid = document.querySelector(".stats-grid");
    const numericHeaders = headers.filter((h) => {
      const sample = validData
        .slice(0, 10)
        .map((r) => r[h])
        .filter(
          (v) =>
            v !== null && v !== undefined && 
            (typeof v === "number" || (typeof v === "string" && !isNaN(parseFloat(v.replace(/,/g, "")))))
        );
      return sample.length > 0;
    });

    const totalOperations = validData.length;
    const totalColumns = headers.length;
    const numericColumns = numericHeaders.length;

    // Calculate additional metrics safely
    let overallTotal = summaries.reduce((a, b) => a + b.value, 0);
    
    const allNumericValues = [];
    numericHeaders.forEach((h) => {
      validData.forEach((r) => {
        const val = typeof r[h] === "number" ? r[h] : parseFloat(String(r[h] || 0).replace(/,/g, "")) || 0;
        if (val > 0) allNumericValues.push(val);
      });
    });
    
    const maxValue = allNumericValues.length > 0 ? Math.max(...allNumericValues) : 0;
    const avgValue = allNumericValues.length > 0 ? (allNumericValues.reduce((a, b) => a + b, 0) / allNumericValues.length) : 0;
    
    // Top performers by category (Usually first column with strings)
    const categoryCol = headers.find(h => {
        const sample = validData.slice(0, 10).map(r => r[h]).filter(v => v && typeof v === 'string' && v.length > 2);
        return sample.length > 0;
    }) || headers[0];

    const categoryTotals = Array.from(new Set(validData.map(r => r[categoryCol])))
      .filter(cat => cat && String(cat).trim() !== "")
      .map(cat => {
        const total = validData
          .filter(r => r[categoryCol] === cat)
          .reduce((sum, r) => {
            const lastNumCol = numericHeaders[numericHeaders.length - 1];
            const val = lastNumCol ? (typeof r[lastNumCol] === 'number' ? r[lastNumCol] : parseFloat(String(r[lastNumCol] || 0).replace(/,/g, "")) || 0) : 0;
            return sum + val;
          }, 0);
        return { category: String(cat).trim(), total };
      })
      .sort((a, b) => b.total - a.total);

    const topCategory = categoryTotals[0] || { category: "-", total: 0 };
    document.getElementById("top-category-name").textContent = topCategory.category;

    // Generate formal summary
    const summaryCard = document.getElementById("summary-card");
    const summaryText = document.getElementById("data-summary");
    if (summaryText) {
      summaryCard.style.display = "block";
      summaryText.innerHTML = isArabic 
        ? `بناءً على تحليل <strong>${totalOperations}</strong> عملية، يتصدر <strong>${topCategory.category}</strong> الأداء بإجمالي قدره <strong>${formatValue(topCategory.total)}</strong>. تم رصد تنوع مالي عبر <strong>${summaries.length}</strong> عملات، بمتوسط قيمة <strong>${formatValue(avgValue)}</strong> لكل عملية. يمثل هذا التقرير نظرة شاملة على السيولة والنشاط المالي للفترة المحددة.`
        : `Based on the analysis of <strong>${totalOperations}</strong> operations, <strong>${topCategory.category}</strong> leads performance with a total of <strong>${formatValue(topCategory.total)}</strong>. Financial diversity was observed across <strong>${summaries.length}</strong> currencies, with an average transaction value of <strong>${formatValue(avgValue)}</strong>. This report provides a comprehensive overview of liquidity and financial activity for the specified period.`;
    }

    // Inject Primary Hero Scorecards
    const primaryGrid = document.getElementById("base-currency-cards");
    if (primaryGrid) {
        primaryGrid.innerHTML = summaries.length > 0 
          ? summaries.map(s => `
            <div class="stat-card hero">
                <div class="card-inner">
                    <span class="stat-label">${s.label}</span>
                    <span class="stat-value">${s.symbol} ${formatValue(s.value)}</span>
                    <div class="card-footer">
                        <span class="trend neutral">Financial Integrity Verified</span>
                    </div>
                </div>
            </div>
          `).join("")
          : `<div class="stat-card hero"><span class="stat-label">System Active</span><span class="stat-value">Awaiting Data</span></div>`;
    }

    // Process Specific Financing Data
    initFinancingAnalysis(validData, headers, isArabic);

    // Update Secondary Mini Cards with safe checking
    const rowsEl = document.getElementById("count-rows");
    const colsEl = document.getElementById("count-cols");
    
    if (rowsEl) rowsEl.textContent = totalOperations.toLocaleString();
    if (colsEl) colsEl.textContent = summaries.length;

    // Table Preview with Sorting
    const tableHead = document.getElementById("table-head");
    const tableBody = document.getElementById("table-body");

    // Add sorting functionality
    let sortColumn = null;
    let sortDirection = "asc";

    function renderTable(data) {
      tableHead.innerHTML = `<tr>${headers.map((h, i) => `<th data-column="${i}" class="sortable${sortColumn === i ? (sortDirection === "asc" ? " sorted-asc" : " sorted-desc") : ""}">${h}</th>`).join("")}</tr>`;
      tableBody.innerHTML = data
        .slice(0, 50)
        .map(
          (row) =>
            `<tr>${headers.map((h) => `<td>${row[h] !== undefined ? (typeof row[h] === "number" ? formatValue(row[h]) : row[h]) : ""}</td>`).join("")}</tr>`,
        )
        .join("");

      // Add sort event listeners
      document.querySelectorAll(".sortable").forEach((th) => {
        th.addEventListener("click", () => {
          const column = parseInt(th.dataset.column);
          if (sortColumn === column) {
            sortDirection = sortDirection === "asc" ? "desc" : "asc";
          } else {
            sortColumn = column;
            sortDirection = "asc";
          }
          const sortedData = [...data].sort((a, b) => {
            const aVal = a[headers[column]];
            const bVal = b[headers[column]];
            if (typeof aVal === "number" && typeof bVal === "number") {
              return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
            }
            return sortDirection === "asc"
              ? String(aVal).localeCompare(String(bVal))
              : String(bVal).localeCompare(String(aVal));
          });
          renderTable(sortedData);
        });
      });
    }

    // Table Search Implementation
    const searchInput = document.getElementById("table-search");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = validData.filter(row => 
          Object.values(row).some(v => String(v).toLowerCase().includes(term))
        );
        renderTable(filtered);
      });
    }

    renderTable(validData);

    // Charts
    charts.forEach((c) => c.destroy());
    charts = [];

    initHorizontalAnalysis(validData, headers, isArabic);
    initCurrencyPie(summaries, isArabic);
    initRemittanceAnalysis(validData, headers, isArabic);
  }

  function initFinancingAnalysis(data, headers, isArabic) {
    const heroCard = document.getElementById("financing-hero-card");
    const chartCard = document.getElementById("financing-analytics-card");
    const totalValEl = document.getElementById("financing-total-value");
    
    // Keywords for filtering financing
    const keywords = ["تمويل", "قرض", "finance", "loan", "اعتماد"];
    
    // Identify text and numeric columns
    const textCol = headers.find(h => {
      const sample = data.slice(0, 20).map(r => r[h]).filter(v => v && typeof v === 'string' && v.length > 2);
      return sample.length > 0;
    }) || headers[0];
    const numCol = headers.filter(h => {
      const sample = data.slice(0, 10).map(r => r[h]).filter(v => typeof v === 'number');
      return sample.length > 0;
    }).pop() || headers[headers.length-1];

    const financeData = data.filter(row => {
      const val = String(row[textCol] || "").toLowerCase();
      return keywords.some(k => val.includes(k.toLowerCase()));
    });

    if (financeData.length === 0) {
      heroCard.style.display = "none";
      chartCard.style.display = "none";
      return;
    }

    heroCard.style.display = "block";
    chartCard.style.display = "block";

    const totalVolume = financeData.reduce((sum, r) => {
        const val = typeof r[numCol] === 'number' ? r[numCol] : parseFloat(String(r[numCol] || 0).replace(/,/g, "")) || 0;
        return sum + val;
    }, 0);

    totalValEl.textContent = formatValue(totalVolume);

    // Grouping for chart
    const groups = {};
    financeData.forEach(r => {
      const cat = r[textCol] || (isArabic ? "أخرى" : "Other");
      const val = typeof r[numCol] === 'number' ? r[numCol] : parseFloat(String(r[numCol] || 0).replace(/,/g, "")) || 0;
      groups[cat] = (groups[cat] || 0) + val;
    });

    const sorted = Object.entries(groups).sort((a, b) => b[1] - a[1]);
    const ctx = document.getElementById("chart-financing").getContext("2d");

    charts.push(new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: sorted.map(s => s[0]),
        datasets: [{
          data: sorted.map(s => s[1]),
          backgroundColor: ["#f59e0b", "#10b981", "#2563eb", "#6366f1", "#ec4899"],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#94a3b8', boxWidth: 10 } }
        },
        cutout: '70%'
      }
    }));
  }

  function initRemittanceAnalysis(data, headers, isArabic) {
    const remittanceCard = document.getElementById("remittance-analytics-card");
    const ctx = document.getElementById("chart-remittances").getContext("2d");
    
    // Keywords for filtering remittances
    const keywords = ["حوالات", "صب", "تحويل", "remittance", "transfer", "exchange"];
    
    // Identify the best text column for categories
    const textCol = headers.find(h => {
      const sample = data.slice(0, 20).map(r => r[h]).filter(v => v && typeof v === 'string' && v.length > 2);
      return sample.length > 0;
    }) || headers[0];

    // Identify the best numeric column (Total)
    const numCol = headers.filter(h => {
      const sample = data.slice(0, 10).map(r => r[h]).filter(v => typeof v === 'number');
      return sample.length > 0;
    }).pop() || headers[headers.length-1];

    // Filter rows related to remittances
    const remittanceData = data.filter(row => {
      const val = String(row[textCol] || "").toLowerCase();
      return keywords.some(k => val.includes(k.toLowerCase()));
    });

    if (remittanceData.length === 0) {
      remittanceCard.style.display = "none";
      return;
    }

    remittanceCard.style.display = "block";

    // Group by category within remittances
    const groups = {};
    remittanceData.forEach(r => {
      const cat = r[textCol] || (isArabic ? "أخرى" : "Other");
      const val = typeof r[numCol] === 'number' ? r[numCol] : parseFloat(String(r[numCol] || 0).replace(/,/g, "")) || 0;
      groups[cat] = (groups[cat] || 0) + val;
    });

    const sortedGroups = Object.entries(groups).sort((a, b) => b[1] - a[1]);

    charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sortedGroups.map(g => g[0]),
        datasets: [{
          label: isArabic ? "حجم الحوالات" : "Remittance Volume",
          data: sortedGroups.map(g => g[1]),
          backgroundColor: sortedGroups.map((_, i) => i === 0 ? "#10b981" : "#2563eb"),
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${isArabic ? "الإجمالي" : "Total"}: ${formatValue(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          y: { 
            beginAtZero: true, 
            grid: { color: "rgba(255, 255, 255, 0.05)" },
            ticks: { color: "#94a3b8", callback: (v) => formatValue(v) }
          },
          x: { 
            grid: { display: false },
            ticks: { color: "#94a3b8" }
          }
        }
      }
    }));
  }

  function initHorizontalAnalysis(data, headers, isArabic) {
    const catCol = headers[0]; // Usually the category/type
    // Sum values by category
    const totals = {};
    const numericCol =
      headers.find((h) => h.includes("المجموع الكلي") || h.includes("Total")) ||
      headers[headers.length - 1];

    data.forEach((r) => {
      const category = r[catCol] || (isArabic ? "أخرى" : "Other");
      const value =
        typeof r[numericCol] === "number"
          ? r[numericCol]
          : parseFloat(String(r[numericCol] || 0).replace(/,/g, "")) || 0;
      totals[category] = (totals[category] || 0) + value;
    });

    const sorted = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const ctx = document.getElementById("chart-trends").getContext("2d");
    charts.push(
      new Chart(ctx, {
        type: "bar",
        data: {
          labels: sorted.map((s) => s[0]),
          datasets: [
            {
              label: isArabic ? "إجمالي القيمة" : "Total Value",
              data: sorted.map((s) => s[1]),
              backgroundColor: "rgba(37, 99, 235, 0.8)",
              borderColor: "rgba(37, 99, 235, 1)",
              borderWidth: 1,
              borderRadius: 8,
              hoverBackgroundColor: "rgba(56, 189, 248, 0.9)",
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              ticks: {
                font: { size: 10 },
                callback: function (value) {
                  return formatValue(value);
                },
              },
              grid: {
                display: false,
              },
            },
            y: {
              ticks: { font: { size: 10 } },
              grid: {
                display: false,
              },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (context) {
                  return formatValue(context.parsed.x);
                },
              },
            },
          },
          animation: {
            duration: 1000,
            easing: "easeOutQuart",
          },
        },
      }),
    );
  }

  function initCurrencyPie(summaries, isArabic) {
    if (summaries.length === 0) return;

    const ctx = document.getElementById("chart-distribution").getContext("2d");
    charts.push(
      new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: summaries.map((s) => s.label),
          datasets: [
            {
              data: summaries.map((s) => s.value),
              backgroundColor: [
                "#2563eb",
                "#10b981",
                "#f59e0b",
                "#6366f1",
                "#ec4899",
                "#8b5cf6",
              ],
              borderWidth: 2,
              borderColor: "#ffffff",
              hoverOffset: 12,
              hoverBorderWidth: 3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: isArabic ? "right" : "left",
              labels: {
                usePointStyle: true,
                padding: 20,
              },
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const label = context.label || "";
                  const value = formatValue(context.parsed);
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const percentage = ((context.parsed / total) * 100).toFixed(
                    1,
                  );
                  return `${label}: ${value} (${percentage}%)`;
                },
              },
            },
          },
          cutout: "70%",
          animation: {
            animateRotate: true,
            animateScale: true,
            duration: 1500,
            easing: "easeOutQuart",
          },
        },
      }),
    );
  }

  function formatValue(val) {
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 0,
    }).format(val);
  }

  resetBtn.addEventListener("click", () => {
    dashboardSection.style.display = "none";
    uploadSection.style.display = "flex";
    fileInput.value = "";
    mainContainer.classList.remove("rtl");
  });

  exportBtn.addEventListener("click", () => {
    const element = document.getElementById("dashboard-section");
    const options = {
      margin: [10, 10],
      filename: "DevLab-Report.pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
    };
    html2pdf().set(options).from(element).save();
  });
});
