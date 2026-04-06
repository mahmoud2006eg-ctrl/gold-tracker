const LIVE_API_URL = "https://api.gold-api.com/price/XAU/EGP";

/*
  الأخبار هنا معمولة من Google News RSS عبر proxy front-end.
  لو الـ proxy وقف، الأخبار ممكن متظهرش مؤقتًا.
*/
const NEWS_FEED_URL =
  "https://news.google.com/rss/search?q=" +
  encodeURIComponent("سعر الذهب في مصر OR gold price Egypt") +
  "&hl=ar&gl=EG&ceid=EG:ar";

const CORS_PROXY_URL = "https://api.allorigins.win/get?url=";

const LOCAL_MARKET_PRICES = {
  24: 8126,
  22: 7450,
  21: 7110,
  18: 6094,
  14: 4747
};

const BAR_PREMIUMS = {
  1: 160,
  2.5: 320,
  5: 620,
  10: 1250,
  20: 2500,
  31.1: 3900,
  50: 6200,
  100: 11000
};

const monthNamesAr = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

let goldChart;
let currentRange = "1h";
let currentChartMode = "all";
let chartLabels = [];
let chartSeries = {};
let spotBaseline = null;
let currentSection = "home";

function $(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const el = $(id);
  if (el) el.innerText = value;
}

function formatNumber(num) {
  return Number(num).toLocaleString("en-US", {
    maximumFractionDigits: 2
  });
}

function roundPrice(value) {
  return Math.round(value);
}

function getNowTimeString() {
  return new Date().toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function getGoldPoundPrice() {
  return roundPrice(LOCAL_MARKET_PRICES[21] * 8 + 840);
}

function getBarPrice(weight) {
  const premium = BAR_PREMIUMS[weight] || 0;
  return roundPrice((LOCAL_MARKET_PRICES[24] * Number(weight)) + premium);
}

function generateKaratPriceFrom24(price24, karat) {
  return roundPrice(price24 * (Number(karat) / 24));
}

function buildBaseSeriesFrom24(base24Array) {
  return {
    24: base24Array.map(roundPrice),
    22: base24Array.map(v => generateKaratPriceFrom24(v, 22)),
    21: base24Array.map(v => generateKaratPriceFrom24(v, 21)),
    18: base24Array.map(v => generateKaratPriceFrom24(v, 18)),
    14: base24Array.map(v => generateKaratPriceFrom24(v, 14))
  };
}

function buildIntradayData(pointsCount, spread, currentPrice, mode) {
  const labels = [];
  const prices24 = [];
  const now = new Date();

  for (let i = pointsCount - 1; i >= 0; i--) {
    const d = new Date(now);

    if (mode === "minute") {
      d.setMinutes(now.getMinutes() - i * 10);
    } else {
      d.setHours(now.getHours() - i * 3);
    }

    labels.push(
      d.toLocaleTimeString("ar-EG", {
        hour: "2-digit",
        minute: "2-digit"
      })
    );

    const wave = Math.sin(i * 0.9) * spread;
    const micro = Math.cos(i * 1.35) * (spread * 0.35);
    const value = currentPrice - (i * spread * 0.25) + wave + micro;
    prices24.push(roundPrice(value));
  }

  prices24[prices24.length - 1] = roundPrice(currentPrice);

  return {
    labels,
    series: buildBaseSeriesFrom24(prices24)
  };
}

function buildWeekData(currentPrice) {
  const labels = [];
  const prices24 = [];
  const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    labels.push(dayNames[d.getDay()]);
    const wave = Math.sin(i * 0.8) * 22;
    prices24.push(roundPrice(currentPrice - (6 - i) * 22 + wave));
  }

  prices24[prices24.length - 1] = roundPrice(currentPrice);

  return {
    labels,
    series: buildBaseSeriesFrom24(prices24)
  };
}

function buildMonthData(currentPrice) {
  const labels = [];
  const prices24 = [];

  for (let i = 5; i >= 0; i--) {
    const day = 30 - i * 5;
    labels.push(`يوم ${day}`);
    const trend = currentPrice - i * 35;
    const wave = Math.cos(i * 0.7) * 18;
    prices24.push(roundPrice(trend + wave));
  }

  prices24[prices24.length - 1] = roundPrice(currentPrice);

  return {
    labels,
    series: buildBaseSeriesFrom24(prices24)
  };
}

function buildYearData(currentPrice) {
  const labels = [];
  const prices24 = [];
  const now = new Date();
  const currentMonthIndex = now.getMonth();

  for (let i = 0; i <= currentMonthIndex; i++) {
    labels.push(monthNamesAr[i]);
    const monthsRemaining = currentMonthIndex - i;
    const trend = currentPrice - monthsRemaining * 140;
    const wave = Math.sin(i * 0.9) * 45;
    prices24.push(roundPrice(trend + wave));
  }

  prices24[prices24.length - 1] = roundPrice(currentPrice);

  return {
    labels,
    series: buildBaseSeriesFrom24(prices24)
  };
}

function generateRangeData() {
  const local24 = Number(LOCAL_MARKET_PRICES[24]);

  return {
    "1h": buildIntradayData(6, 10, local24, "minute"),
    "1d": buildIntradayData(8, 55, local24, "hour"),
    "1w": buildWeekData(local24),
    "1m": buildMonthData(local24),
    "1y": buildYearData(local24)
  };
}

function seedInitialData(range = "1h") {
  const rangesData = generateRangeData();
  chartLabels = [...rangesData[range].labels];
  chartSeries = JSON.parse(JSON.stringify(rangesData[range].series));
}

function getSegmentColor(ctx) {
  const y1 = ctx.p0.parsed.y;
  const y2 = ctx.p1.parsed.y;
  return y2 >= y1 ? "#35d07f" : "#ff5f5f";
}

function getDatasetsForMode(mode) {
  const datasetsMap = {
    24: {
      label: "عيار 24",
      data: chartSeries[24],
      borderColor: "#d4af37",
      backgroundColor: "rgba(212, 175, 55, 0.15)",
      borderWidth: 3,
      pointRadius: 3,
      pointHoverRadius: 5,
      fill: false,
      tension: 0.35,
      segment: { borderColor: getSegmentColor }
    },
    22: {
      label: "عيار 22",
      data: chartSeries[22],
      borderColor: "#89b8ff",
      backgroundColor: "rgba(137, 184, 255, 0.12)",
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
      fill: false,
      tension: 0.35,
      segment: { borderColor: getSegmentColor }
    },
    21: {
      label: "عيار 21",
      data: chartSeries[21],
      borderColor: "#35d07f",
      backgroundColor: "rgba(53, 208, 127, 0.12)",
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
      fill: false,
      tension: 0.35,
      segment: { borderColor: getSegmentColor }
    },
    18: {
      label: "عيار 18",
      data: chartSeries[18],
      borderColor: "#ff8a65",
      backgroundColor: "rgba(255, 138, 101, 0.12)",
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
      fill: false,
      tension: 0.35,
      segment: { borderColor: getSegmentColor }
    },
    14: {
      label: "عيار 14",
      data: chartSeries[14],
      borderColor: "#ba68c8",
      backgroundColor: "rgba(186, 104, 200, 0.12)",
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
      fill: false,
      tension: 0.35,
      segment: { borderColor: getSegmentColor }
    }
  };

  if (mode === "all") {
    return [datasetsMap[24], datasetsMap[22], datasetsMap[21], datasetsMap[18], datasetsMap[14]];
  }

  return [datasetsMap[mode]];
}

function updateTrendBadge() {
  const badge = $("trendBadge");
  if (!badge) return;

  let activeSeries = chartSeries[24];
  if (currentChartMode !== "all" && chartSeries[currentChartMode]) {
    activeSeries = chartSeries[currentChartMode];
  }

  if (!activeSeries || activeSeries.length < 2) {
    badge.textContent = "آخر حركة: بيانات غير كافية";
    badge.className = "trend-badge trend-neutral";
    return;
  }

  const lastValue = activeSeries[activeSeries.length - 1];
  const prevValue = activeSeries[activeSeries.length - 2];
  const diff = lastValue - prevValue;

  if (diff > 0) {
    badge.textContent = `↑ كسب +${formatNumber(diff)} جنيه في آخر تحديث`;
    badge.className = "trend-badge trend-up";
  } else if (diff < 0) {
    badge.textContent = `↓ خسر ${formatNumber(Math.abs(diff))} جنيه في آخر تحديث`;
    badge.className = "trend-badge trend-down";
  } else {
    badge.textContent = "→ بدون تغيير في آخر تحديث";
    badge.className = "trend-badge trend-neutral";
  }
}

/*
  توقع بسيط جدًا وغير دقيق:
  بيعتمد على متوسط قصير ومتوسط أطول + آخر ميل
  الهدف منه مؤشر بصري فقط
*/
function updatePredictionBadge() {
  const badge = $("predictionBadge");
  if (!badge) return;

  let activeSeries = chartSeries[24];
  if (currentChartMode !== "all" && chartSeries[currentChartMode]) {
    activeSeries = chartSeries[currentChartMode];
  }

  if (!activeSeries || activeSeries.length < 4) {
    badge.textContent = "التوقع: بيانات غير كافية | غير دقيق";
    badge.className = "trend-badge trend-neutral";
    return;
  }

  const last = activeSeries[activeSeries.length - 1];
  const prev = activeSeries[activeSeries.length - 2];

  const shortSlice = activeSeries.slice(-3);
  const longSlice = activeSeries.slice(-6);

  const shortAvg = shortSlice.reduce((a, b) => a + b, 0) / shortSlice.length;
  const longAvg = longSlice.reduce((a, b) => a + b, 0) / longSlice.length;
  const slope = last - prev;

  if (shortAvg > longAvg && slope >= 0) {
    badge.textContent = "التوقع: صاعد ↑ | غير دقيق";
    badge.className = "trend-badge trend-up";
  } else if (shortAvg < longAvg && slope <= 0) {
    badge.textContent = "التوقع: هابط ↓ | غير دقيق";
    badge.className = "trend-badge trend-down";
  } else {
    badge.textContent = "التوقع: متذبذب ↔ | غير دقيق";
    badge.className = "trend-badge trend-neutral";
  }
}

function createChart() {
  const ctx = $("chart");
  if (!ctx || typeof Chart === "undefined") return;

  goldChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: chartLabels,
      datasets: getDatasetsForMode(currentChartMode)
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          labels: {
            color: "#d9d9d9",
            font: { size: 13 }
          }
        },
        tooltip: {
          backgroundColor: "#17181c",
          titleColor: "#ffffff",
          bodyColor: "#e8e8e8",
          borderColor: "rgba(212, 175, 55, 0.25)",
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${formatNumber(context.raw)} جنيه`;
            },
            title: function(context) {
              return `الفترة: ${context[0].label}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: "#9f9f9f" },
          grid: { color: "rgba(255,255,255,0.06)" }
        },
        y: {
          ticks: {
            color: "#9f9f9f",
            callback: function(value) {
              return formatNumber(value);
            }
          },
          grid: { color: "rgba(255,255,255,0.06)" }
        }
      }
    }
  });

  updateTrendBadge();
  updatePredictionBadge();
}

function refreshChart() {
  if (!goldChart) return;

  goldChart.data.labels = chartLabels;
  goldChart.data.datasets = getDatasetsForMode(currentChartMode);
  goldChart.update();

  updateTrendBadge();
  updatePredictionBadge();
}

function renderKaratPrices() {
  const karatPricesList = $("karatPricesList");
  if (!karatPricesList) return;

  const karats = [
    { label: "جرام عيار 24", value: LOCAL_MARKET_PRICES[24] },
    { label: "جرام عيار 22", value: LOCAL_MARKET_PRICES[22] },
    { label: "جرام عيار 21", value: LOCAL_MARKET_PRICES[21] },
    { label: "جرام عيار 18", value: LOCAL_MARKET_PRICES[18] },
    { label: "جرام عيار 14", value: LOCAL_MARKET_PRICES[14] }
  ];

  karatPricesList.innerHTML = karats.map(item => `
    <div class="price-row">
      <div class="label">${item.label}</div>
      <div class="value">${formatNumber(item.value)} جنيه</div>
    </div>
  `).join("");
}

function renderProductsPrices() {
  const productsPricesList = $("productsPricesList");
  if (!productsPricesList) return;

  const products = [
  { label: "سبيكة 1 جرام", value: getBarPrice(1) },
  { label: "سبيكة 2.5 جرام", value: getBarPrice(2.5) },
  { label: "سبيكة 5 جرام", value: getBarPrice(5) },
  { label: "سبيكة 10 جرام", value: getBarPrice(10) },
  { label: "سبيكة 20 جرام", value: getBarPrice(20) },
  { label: "أونصة 31.1 جرام", value: getBarPrice(31.1) },
  { label: "سبيكة 50 جرام", value: getBarPrice(50) },
  { label: "سبيكة 100 جرام", value: getBarPrice(100) },
    { label: "🪙 جنيه ذهب", value: getGoldPoundPrice() }
  ];

  productsPricesList.innerHTML = products.map(item => `
    <div class="price-row">
      <div class="label">${item.label}</div>
      <div class="value">${formatNumber(item.value)} جنيه</div>
    </div>
  `).join("");
}

function updateCards() {
  setText("price24", `${formatNumber(LOCAL_MARKET_PRICES[24])} جنيه`);
  setText("price21", `${formatNumber(LOCAL_MARKET_PRICES[21])} جنيه`);
  setText("goldPoundCard", `${formatNumber(getGoldPoundPrice())} جنيه`);
  setText("lastUpdate", getNowTimeString());
}

function onPurchaseTypeChange() {
  const purchaseType = $("purchaseType")?.value;
  const weightGroup = $("weightGroup");
  const barGroup = $("barGroup");
  const karatType = $("karatType");
  const buyInput = $("buyPricePerUnit");

  if (!purchaseType || !weightGroup || !barGroup || !karatType || !buyInput) return;

  if (purchaseType === "gram") {
    weightGroup.style.display = "flex";
    barGroup.style.display = "none";
    karatType.disabled = false;
    buyInput.placeholder = "مثال: 7110 سعر الجرام وقت الشراء";
    buyInput.value = LOCAL_MARKET_PRICES[Number(karatType.value)];
  } else if (purchaseType === "bar") {
    weightGroup.style.display = "none";
    barGroup.style.display = "flex";
    karatType.value = "24";
    karatType.disabled = true;
    buyInput.placeholder = "مثال: سعر السبيكة كامل وقت الشراء";
    buyInput.value = getBarPrice(Number($("barWeight")?.value || 1));
  } else {
    weightGroup.style.display = "none";
    barGroup.style.display = "none";
    karatType.value = "21";
    karatType.disabled = true;
    buyInput.placeholder = "مثال: سعر الجنيه الذهب وقت الشراء";
    buyInput.value = getGoldPoundPrice();
  }

  calculateProfit();
}

function calculateProfit() {
  const purchaseType = $("purchaseType")?.value;
  const buyPricePerUnit = Number($("buyPricePerUnit")?.value || 0);
  const karat = Number($("karatType")?.value || 21);
  const grams = Number($("grams")?.value || 0);
  const barWeight = Number($("barWeight")?.value || 0);
  const calcResult = $("calcResult");
  const profitElement = $("profit");
  const profitNote = $("profitNote");

  if (!calcResult) return;

  if (!buyPricePerUnit) {
    calcResult.innerText = "من فضلك ادخل سعر الشراء.";
    return;
  }

  let currentValue = 0;
  let buyTotal = 0;
  let description = "";

  if (purchaseType === "gram") {
    if (!grams) {
      calcResult.innerText = "من فضلك ادخل عدد الجرامات.";
      return;
    }

    const currentPricePerGram = LOCAL_MARKET_PRICES[karat];
    currentValue = currentPricePerGram * grams;
    buyTotal = buyPricePerUnit * grams;
    description = `${grams} جرام عيار ${karat}`;
    if (profitNote) {
      profitNote.innerText = `${description} | شراء الجرام: ${formatNumber(buyPricePerUnit)} جنيه`;
    }
  } else if (purchaseType === "bar") {
    currentValue = getBarPrice(barWeight);
    buyTotal = buyPricePerUnit;
    description = `سبيكة ${barWeight} جرام`;
    if (profitNote) {
      profitNote.innerText = `${description} | سعر الشراء الكلي`;
    }
  } else {
    currentValue = getGoldPoundPrice();
    buyTotal = buyPricePerUnit;
    description = "جنيه ذهب";
    if (profitNote) {
      profitNote.innerText = `${description} | سعر الشراء الكلي`;
    }
  }

  const difference = currentValue - buyTotal;
  const state = difference >= 0 ? "مكسب" : "خسارة";

  if (profitElement) {
    profitElement.innerText = `${difference >= 0 ? "+" : ""}${formatNumber(difference)} جنيه`;
    profitElement.classList.remove("profit-positive", "profit-negative");
    profitElement.classList.add(difference >= 0 ? "profit-positive" : "profit-negative");
  }

  calcResult.innerText =
`النوع: ${description}
القيمة الحالية: ${formatNumber(currentValue)} جنيه
إجمالي الشراء: ${formatNumber(buyTotal)} جنيه
${state}: ${difference >= 0 ? "+" : ""}${formatNumber(difference)} جنيه`;
}

function changeRange(range, clickedButton) {
  currentRange = range;
  seedInitialData(range);
  refreshChart();

  document.querySelectorAll(".range-btn").forEach(btn => {
    btn.classList.remove("active");
  });

  if (clickedButton) clickedButton.classList.add("active");
}

function changeChartMode(mode, clickedButton) {
  currentChartMode = mode;
  refreshChart();

  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.classList.remove("active");
  });

  if (clickedButton) clickedButton.classList.add("active");
}

function pushLivePointForAllKarats() {
  if (currentRange !== "1h") return;

  const timeLabel = new Date().toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit"
  });

  chartLabels.push(timeLabel);
  chartSeries[24].push(roundPrice(LOCAL_MARKET_PRICES[24]));
  chartSeries[22].push(roundPrice(LOCAL_MARKET_PRICES[22]));
  chartSeries[21].push(roundPrice(LOCAL_MARKET_PRICES[21]));
  chartSeries[18].push(roundPrice(LOCAL_MARKET_PRICES[18]));
  chartSeries[14].push(roundPrice(LOCAL_MARKET_PRICES[14]));

  if (chartLabels.length > 20) {
    chartLabels.shift();
    chartSeries[24].shift();
    chartSeries[22].shift();
    chartSeries[21].shift();
    chartSeries[18].shift();
    chartSeries[14].shift();
  }

  refreshChart();
}

function updateLocalPricesFromSpot(newSpot) {
  if (!spotBaseline) {
    spotBaseline = newSpot;
    return;
  }

  const ratio = newSpot / spotBaseline;

  LOCAL_MARKET_PRICES[24] = roundPrice(LOCAL_MARKET_PRICES[24] * ratio);
  LOCAL_MARKET_PRICES[22] = generateKaratPriceFrom24(LOCAL_MARKET_PRICES[24], 22);
  LOCAL_MARKET_PRICES[21] = generateKaratPriceFrom24(LOCAL_MARKET_PRICES[24], 21);
  LOCAL_MARKET_PRICES[18] = generateKaratPriceFrom24(LOCAL_MARKET_PRICES[24], 18);
  LOCAL_MARKET_PRICES[14] = generateKaratPriceFrom24(LOCAL_MARKET_PRICES[24], 14);

  spotBaseline = newSpot;
}

async function fetchLiveSpotAndSyncLocal() {
  try {
    const response = await fetch(LIVE_API_URL);
    const data = await response.json();

    const newSpot = data.price ?? data.rate ?? data.value ?? data.ask;

    if (!newSpot || isNaN(newSpot)) {
      throw new Error("تعذر قراءة السعر من الـ API");
    }

    if (!spotBaseline) {
      spotBaseline = Number(newSpot);
    } else {
      updateLocalPricesFromSpot(Number(newSpot));
    }

    updateCards();
    renderKaratPrices();
    renderProductsPrices();
    pushLivePointForAllKarats();
    calculateProfit();
    updateTrendBadge();
    updatePredictionBadge();
  } catch (error) {
    console.error("خطأ في جلب السعر:", error);
  }
}

function openSidebar() {
  $("sidebar")?.classList.add("active");
  $("sidebarOverlay")?.classList.add("active");
  document.body.classList.add("menu-open");
}

function closeSidebar() {
  $("sidebar")?.classList.remove("active");
  $("sidebarOverlay")?.classList.remove("active");
  document.body.classList.remove("menu-open");
}

function showSection(sectionId) {
  currentSection = sectionId;

  document.querySelectorAll(".page-section").forEach(section => {
    section.style.display = "none";
  });

  const target = $(sectionId);
  if (target) target.style.display = "block";

  closeSidebar();
}

function setupSectionNavigation() {
  document.querySelectorAll("[data-section]").forEach(link => {
    link.addEventListener("click", function(e) {
      e.preventDefault();
      const sectionId = this.getAttribute("data-section");
      showSection(sectionId);
    });
  });
}

function decodeHtmlEntities(str) {
  const txt = document.createElement("textarea");
  txt.innerHTML = str;
  return txt.value;
}

function extractSourceFromTitle(title) {
  const parts = title.split(" - ");
  if (parts.length > 1) {
    return parts[parts.length - 1].trim();
  }
  return "مصدر خبري";
}

function formatNewsDate(pubDate) {
  if (!pubDate) return "تاريخ غير متوفر";

  const d = new Date(pubDate);
  if (isNaN(d.getTime())) return "تاريخ غير متوفر";

  return d.toLocaleString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function fetchGoldNews() {
  const newsList = $("newsList");
  if (!newsList) return;

  newsList.innerHTML = `<div class="price-row"><div class="label">جاري تحميل الأخبار...</div></div>`;

  try {
    const proxyUrl = `${CORS_PROXY_URL}${encodeURIComponent(NEWS_FEED_URL)}`;
    const response = await fetch(proxyUrl);
    const data = await response.json();

    const xmlString = data.contents || data.body || data.data || "";
    if (!xmlString) {
      throw new Error("مفيش بيانات أخبار رجعت");
    }

    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlString, "text/xml");
    const items = Array.from(xml.querySelectorAll("item")).slice(0, 8);

    if (!items.length) {
      newsList.innerHTML = `<div class="price-row"><div class="label">لا توجد أخبار متاحة الآن.</div></div>`;
      return;
    }

    newsList.innerHTML = items.map(item => {
      const title = decodeHtmlEntities(item.querySelector("title")?.textContent || "خبر بدون عنوان");
      const link = item.querySelector("link")?.textContent || "#";
      const pubDate = item.querySelector("pubDate")?.textContent || "";
      const source = extractSourceFromTitle(title);
      const cleanTitle = title.replace(/\s-\s[^-]+$/, "").trim();

      return `
        <a class="news-card" href="${link}" target="_blank" rel="noopener noreferrer">
          <div class="news-title">${cleanTitle}</div>
          <div class="news-meta">
            <span>${source}</span>
            <span>${formatNewsDate(pubDate)}</span>
          </div>
        </a>
      `;
    }).join("");
  } catch (error) {
    console.error("خطأ في جلب الأخبار:", error);
    newsList.innerHTML = `
      <div class="price-row">
        <div class="label">تعذر تحميل الأخبار حاليًا. جرّب مرة تانية بعد شوية.</div>
      </div>
    `;
  }
}

function bindRangeButtons() {
  document.querySelectorAll(".range-btn").forEach(btn => {
    btn.addEventListener("click", function() {
      const range = this.dataset.range;
      if (!range) return;
      changeRange(range, this);
    });
  });
}

function bindFilterButtons() {
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", function() {
      const mode = this.dataset.mode;
      if (!mode) return;
      changeChartMode(mode, this);
    });
  });
}

function bindCalcInputs() {
  $("purchaseType")?.addEventListener("change", onPurchaseTypeChange);
  $("karatType")?.addEventListener("change", onPurchaseTypeChange);
  $("barWeight")?.addEventListener("change", onPurchaseTypeChange);

  $("grams")?.addEventListener("input", calculateProfit);
  $("buyPricePerUnit")?.addEventListener("input", calculateProfit);
  $("barWeight")?.addEventListener("input", calculateProfit);
  $("karatType")?.addEventListener("input", calculateProfit);

  $("calcBtn")?.addEventListener("click", calculateProfit);
}

function bindSidebarEvents() {
  $("menuToggle")?.addEventListener("click", openSidebar);
  $("closeSidebarBtn")?.addEventListener("click", closeSidebar);
  $("sidebarOverlay")?.addEventListener("click", closeSidebar);
}

function setDefaultActiveButtons() {
  const defaultRangeBtn = document.querySelector(`.range-btn[data-range="${currentRange}"]`);
  const defaultFilterBtn = document.querySelector(`.filter-btn[data-mode="${currentChartMode}"]`);

  defaultRangeBtn?.classList.add("active");
  defaultFilterBtn?.classList.add("active");
}

function initApp() {
  seedInitialData(currentRange);
  updateCards();
  renderKaratPrices();
  renderProductsPrices();
  createChart();
  setupSectionNavigation();
  bindRangeButtons();
  bindFilterButtons();
  bindCalcInputs();
  bindSidebarEvents();
  setDefaultActiveButtons();
  onPurchaseTypeChange();
  calculateProfit();
  showSection("home");
  fetchGoldNews();
  fetchLiveSpotAndSyncLocal();

  setInterval(() => {
    updateCards();
  }, 1000);

  setInterval(() => {
    fetchLiveSpotAndSyncLocal();
  }, 60000);

  setInterval(() => {
    fetchGoldNews();
  }, 300000);
}

document.addEventListener("DOMContentLoaded", initApp);

// علشان تقدر تناديهم من الـ HTML لو مستخدم onclick
window.changeRange = changeRange;
window.changeChartMode = changeChartMode;
window.calculateProfit = calculateProfit;
window.openSidebar = openSidebar;
window.closeSidebar = closeSidebar;
window.showSection = showSection;