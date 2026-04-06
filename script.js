(() => {
  "use strict";

  const UPDATE_INTERVAL_MS = 60 * 1000;
  const NEWS_INTERVAL_MS = 15 * 60 * 1000;
  const OUNCE_TO_GRAM = 31.1034768;
  const USD_TO_EGP = 50.0;
  const LOCAL_PREMIUM_PER_GRAM_24 = 550;
  const GOLD_API_URL = "https://api.gold-api.com/price/XAU";

  const AVG_WORKMANSHIP_PER_GRAM = {
    "24": 120,
    "22": 140,
    "21": 150,
    "18": 170,
    "14": 180
  };

  const AVG_COIN_WORKMANSHIP = {
    quarter: 100,
    half: 175,
    pound: 250
  };

  const NEWS_FEEDS = [
    "https://news.google.com/rss/search?q=gold%20price%20OR%20XAU%20OR%20bullion&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=%D8%A7%D9%84%D8%B0%D9%87%D8%A8%20OR%20%D8%A3%D8%B3%D8%B9%D8%A7%D8%B1%20%D8%A7%D9%84%D8%B0%D9%87%D8%A8&hl=ar&gl=EG&ceid=EG:ar"
  ];

  const menuToggle = document.getElementById("menuToggle");
  const topnav = document.getElementById("topnav");
  const navLinks = document.querySelectorAll(".nav-link");
  const viewSections = document.querySelectorAll(".view-section");
  const categoryButtons = document.querySelectorAll(".category-btn");
  const priceCategories = document.querySelectorAll(".price-category");

  const els = {
    chartCanvas: document.getElementById("goldChart"),
    lastUpdateText: document.getElementById("lastUpdateText"),
    autoUpdateBadge: document.getElementById("autoUpdateBadge"),
    changeBadge: document.getElementById("changeBadge"),
    predictionBadge: document.getElementById("predictionBadge"),
    statusBadge: document.getElementById("statusBadge"),
    newsList: document.getElementById("newsList"),
    refreshNewsBtn: document.getElementById("refreshNewsBtn"),

    caratButtons: document.querySelectorAll("[data-carat]"),
    rangeButtons: document.querySelectorAll("[data-range]"),

    price24: document.getElementById("price24"),
    price22: document.getElementById("price22"),
    price21: document.getElementById("price21"),
    price18: document.getElementById("price18"),
    price14: document.getElementById("price14"),

    price24MadeNote: document.getElementById("price24MadeNote"),
    price22MadeNote: document.getElementById("price22MadeNote"),
    price21MadeNote: document.getElementById("price21MadeNote"),
    price18MadeNote: document.getElementById("price18MadeNote"),
    price14MadeNote: document.getElementById("price14MadeNote"),

    miniPrice24: document.getElementById("miniPrice24"),
    miniPrice22: document.getElementById("miniPrice22"),
    miniPrice21: document.getElementById("miniPrice21"),
    miniPrice18: document.getElementById("miniPrice18"),
    miniPrice14: document.getElementById("miniPrice14"),

    miniDelta24: document.getElementById("miniDelta24"),
    miniDelta22: document.getElementById("miniDelta22"),
    miniDelta21: document.getElementById("miniDelta21"),
    miniDelta18: document.getElementById("miniDelta18"),
    miniDelta14: document.getElementById("miniDelta14"),

    ounceUsd: document.getElementById("ounce-usd"),

    bar05: document.getElementById("bar-0.5"),
    bar1: document.getElementById("bar-1"),
    bar25: document.getElementById("bar-2.5"),
    bar5: document.getElementById("bar-5"),
    bar10: document.getElementById("bar-10"),
    bar20: document.getElementById("bar-20"),
    bar311: document.getElementById("bar-31.1"),
    bar50: document.getElementById("bar-50"),
    bar100: document.getElementById("bar-100"),
    bar250: document.getElementById("bar-250"),
    bar500: document.getElementById("bar-500"),
    bar1000: document.getElementById("bar-1000"),

    coinQuarter: document.getElementById("coin-quarter"),
    coinHalf: document.getElementById("coin-half"),
    coinPound: document.getElementById("coin-pound"),

    coinQuarterMadeNote: document.getElementById("coin-quarter-made-note"),
    coinHalfMadeNote: document.getElementById("coin-half-made-note"),
    coinPoundMadeNote: document.getElementById("coin-pound-made-note")
  };

  let goldChart = null;
  let selectedCarat = "all";
  let selectedRange = "hour";
  let lastOunceUsd = 0;
  let newsBusy = false;

  let livePrices = {
    "24": 0,
    "22": 0,
    "21": 0,
    "18": 0,
    "14": 0
  };

  let lastFetchedPrices = {
    "24": 0,
    "22": 0,
    "21": 0,
    "18": 0,
    "14": 0
  };

  let lastPriceDiffs = {
    "24": 0,
    "22": 0,
    "21": 0,
    "18": 0,
    "14": 0
  };

  let cachedNews = [];

  let priceHistory = {
    hour: { "24": [], "22": [], "21": [], "18": [], "14": [], labels: [] },
    day: { "24": [], "22": [], "21": [], "18": [], "14": [], labels: [] },
    week: { "24": [], "22": [], "21": [], "18": [], "14": [], labels: [] },
    month: { "24": [], "22": [], "21": [], "18": [], "14": [], labels: [] },
    year: { "24": [], "22": [], "21": [], "18": [], "14": [], labels: [] }
  };

  function formatNumber(num) {
    return Number(num).toLocaleString("en-US");
  }

  function formatCurrency(num) {
    return `${formatNumber(Math.round(num))} ج.م`;
  }

  function formatUsd(num) {
    return `$${Number(num).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }

  function setText(el, text) {
    if (el) el.textContent = text;
  }

  function setBadgeState(el, text, type = "neutral") {
    if (!el) return;

    el.textContent = text;
    el.classList.remove("state-up", "state-down", "state-neutral", "state-warn");

    if (type === "up") el.classList.add("state-up");
    else if (type === "down") el.classList.add("state-down");
    else if (type === "warn") el.classList.add("state-warn");
    else el.classList.add("state-neutral");
  }

  function getStorageKey() {
    return "gold_tracker_local_data_v21";
  }

  function saveToLocalStorage() {
    try {
      localStorage.setItem(
        getStorageKey(),
        JSON.stringify({
          livePrices,
          lastFetchedPrices,
          lastPriceDiffs,
          priceHistory,
          selectedCarat,
          selectedRange,
          lastOunceUsd,
          cachedNews
        })
      );
    } catch (err) {
      console.error("خطأ في الحفظ:", err);
    }
  }

  function loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(getStorageKey());
      if (!raw) return;

      const parsed = JSON.parse(raw);

      if (parsed.livePrices) livePrices = parsed.livePrices;
      if (parsed.lastFetchedPrices) lastFetchedPrices = parsed.lastFetchedPrices;
      if (parsed.lastPriceDiffs) lastPriceDiffs = parsed.lastPriceDiffs;
      if (parsed.priceHistory) priceHistory = parsed.priceHistory;
      if (parsed.selectedCarat) selectedCarat = parsed.selectedCarat;
      if (parsed.selectedRange) selectedRange = parsed.selectedRange;
      if (parsed.lastOunceUsd) lastOunceUsd = parsed.lastOunceUsd;
      if (parsed.cachedNews) cachedNews = parsed.cachedNews;
    } catch (err) {
      console.error("خطأ في القراءة:", err);
    }
  }

  function showView(viewId) {
    viewSections.forEach(section => {
      section.classList.toggle("active", section.id === viewId);
    });

    navLinks.forEach(link => {
      link.classList.toggle("active", link.dataset.view === viewId);
    });

    if (topnav) topnav.classList.remove("open");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showPriceCategory(categoryName) {
    priceCategories.forEach(category => {
      category.classList.toggle("active", category.id === `category-${categoryName}`);
    });

    categoryButtons.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.category === categoryName);
    });
  }

  function bindNavigation() {
    if (menuToggle) {
      menuToggle.addEventListener("click", () => {
        if (topnav) topnav.classList.toggle("open");
      });
    }

    navLinks.forEach(link => {
      link.addEventListener("click", () => {
        showView(link.dataset.view);
      });
    });

    categoryButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        showPriceCategory(btn.dataset.category);
      });
    });
  }

  function getTimeNowString() {
    return new Date().toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  function updateLastUpdate() {
    setText(els.lastUpdateText, `آخر تحديث: ${getTimeNowString()}`);
    setText(els.autoUpdateBadge, "تحديث تلقائي كل 60 ثانية");
  }

  function safeArrayPush(arr, value, maxLen) {
    arr.push(value);
    while (arr.length > maxLen) arr.shift();
  }

  function getRangeMaxPoints(range) {
    switch (range) {
      case "hour": return 12;
      case "day": return 24;
      case "week": return 7;
      case "month": return 30;
      case "year": return 12;
      default: return 12;
    }
  }

  function getCaratFactor(carat) {
    const factors = {
      "24": 1,
      "22": 22 / 24,
      "21": 21 / 24,
      "18": 18 / 24,
      "14": 14 / 24
    };
    return factors[carat] || 1;
  }

  function buildLocalPricesFrom24(price24) {
    return {
      "24": Math.round(price24),
      "22": Math.round(price24 * getCaratFactor("22")),
      "21": Math.round(price24 * getCaratFactor("21")),
      "18": Math.round(price24 * getCaratFactor("18")),
      "14": Math.round(price24 * getCaratFactor("14"))
    };
  }

  function appendPoint(range, pricesObj, label) {
    const maxLen = getRangeMaxPoints(range);

    safeArrayPush(priceHistory[range]["24"], pricesObj["24"], maxLen);
    safeArrayPush(priceHistory[range]["22"], pricesObj["22"], maxLen);
    safeArrayPush(priceHistory[range]["21"], pricesObj["21"], maxLen);
    safeArrayPush(priceHistory[range]["18"], pricesObj["18"], maxLen);
    safeArrayPush(priceHistory[range]["14"], pricesObj["14"], maxLen);
    safeArrayPush(priceHistory[range].labels, label, maxLen);
  }

  function seedInitialHistoryIfNeeded() {
    const hasData = priceHistory.hour["24"] && priceHistory.hour["24"].length > 0;
    if (hasData) return;

    const base24 = 8100;
    const basePrices = buildLocalPricesFrom24(base24);

    livePrices = { ...basePrices };
    lastFetchedPrices = { ...basePrices };
    lastOunceUsd = 3050;

    for (let i = 11; i >= 0; i--) {
      const val24 = base24 - 18 + (11 - i) * 2 + (i % 2 === 0 ? 1 : -1);
      appendPoint("hour", buildLocalPricesFrom24(val24), `${(55 - i * 5).toString().padStart(2, "0")} د`);
    }

    for (let i = 23; i >= 0; i--) {
      const val24 = base24 - 35 + (23 - i) * 2;
      appendPoint("day", buildLocalPricesFrom24(val24), `${24 - i}س`);
    }

    const weekLabels = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
    for (let i = 0; i < 7; i++) {
      const val24 = base24 - 45 + i * 8;
      appendPoint("week", buildLocalPricesFrom24(val24), weekLabels[i]);
    }

    for (let i = 1; i <= 30; i++) {
      const val24 = base24 - 60 + i * 3;
      appendPoint("month", buildLocalPricesFrom24(val24), `${i}`);
    }

    const months = ["ينا", "فبر", "مار", "أبر", "ماي", "يون", "يول", "أغس", "سبت", "أكت", "نوف", "ديس"];
    for (let i = 0; i < 12; i++) {
      const val24 = base24 - 220 + i * 20;
      appendPoint("year", buildLocalPricesFrom24(val24), months[i]);
    }
  }

  function updatePersistedChangeBadge() {
    const diff = Number(lastPriceDiffs["24"] || 0);

    if (diff > 0) {
      setBadgeState(els.changeBadge, `↑ آخر حركة: +${formatNumber(diff)} جنيه`, "up");
    } else if (diff < 0) {
      setBadgeState(els.changeBadge, `↓ آخر حركة: ${formatNumber(diff)} جنيه`, "down");
    } else {
      setBadgeState(els.changeBadge, "↔ لا يوجد تغير مسجل بعد", "neutral");
    }
  }

  function setMiniDelta(el, diff) {
    if (!el) return;

    if (diff > 0) {
      el.textContent = `آخر حركة: +${formatNumber(diff)}`;
      el.style.color = "#22c55e";
    } else if (diff < 0) {
      el.textContent = `آخر حركة: ${formatNumber(diff)}`;
      el.style.color = "#ef4444";
    } else {
      el.textContent = "آخر حركة: 0";
      el.style.color = "#a3a3a3";
    }
  }

  function updateGramPrices() {
    setText(els.price24, formatCurrency(livePrices["24"]));
    setText(els.price22, formatCurrency(livePrices["22"]));
    setText(els.price21, formatCurrency(livePrices["21"]));
    setText(els.price18, formatCurrency(livePrices["18"]));
    setText(els.price14, formatCurrency(livePrices["14"]));

    setText(els.price24MadeNote, `المصنعية: ${formatCurrency(AVG_WORKMANSHIP_PER_GRAM["24"])}`);
    setText(els.price22MadeNote, `المصنعية: ${formatCurrency(AVG_WORKMANSHIP_PER_GRAM["22"])}`);
    setText(els.price21MadeNote, `المصنعية: ${formatCurrency(AVG_WORKMANSHIP_PER_GRAM["21"])}`);
    setText(els.price18MadeNote, `المصنعية: ${formatCurrency(AVG_WORKMANSHIP_PER_GRAM["18"])}`);
    setText(els.price14MadeNote, `المصنعية: ${formatCurrency(AVG_WORKMANSHIP_PER_GRAM["14"])}`);
  }

  function updateMiniGramPrices() {
    setText(els.miniPrice24, formatCurrency(livePrices["24"]));
    setText(els.miniPrice22, formatCurrency(livePrices["22"]));
    setText(els.miniPrice21, formatCurrency(livePrices["21"]));
    setText(els.miniPrice18, formatCurrency(livePrices["18"]));
    setText(els.miniPrice14, formatCurrency(livePrices["14"]));

    setMiniDelta(els.miniDelta24, lastPriceDiffs["24"]);
    setMiniDelta(els.miniDelta22, lastPriceDiffs["22"]);
    setMiniDelta(els.miniDelta21, lastPriceDiffs["21"]);
    setMiniDelta(els.miniDelta18, lastPriceDiffs["18"]);
    setMiniDelta(els.miniDelta14, lastPriceDiffs["14"]);
  }

  function updateBullionPrices() {
    const gram24 = Number(livePrices["24"] || 0);

    setText(els.ounceUsd, lastOunceUsd ? formatUsd(lastOunceUsd) : "جاري التحميل...");

    const bars = [
      { el: els.bar05, grams: 0.5 },
      { el: els.bar1, grams: 1 },
      { el: els.bar25, grams: 2.5 },
      { el: els.bar5, grams: 5 },
      { el: els.bar10, grams: 10 },
      { el: els.bar20, grams: 20 },
      { el: els.bar311, grams: 31.1 },
      { el: els.bar50, grams: 50 },
      { el: els.bar100, grams: 100 },
      { el: els.bar250, grams: 250 },
      { el: els.bar500, grams: 500 },
      { el: els.bar1000, grams: 1000 }
    ];

    bars.forEach(bar => {
      if (bar.el) {
        setText(bar.el, formatCurrency(gram24 * bar.grams));
      }
    });
  }

  function updateCoinPrices() {
    const gram21 = Number(livePrices["21"] || 0);

    const quarterBase = gram21 * 2;
    const halfBase = gram21 * 4;
    const poundBase = gram21 * 8;

    setText(els.coinQuarter, formatCurrency(quarterBase));
    setText(els.coinHalf, formatCurrency(halfBase));
    setText(els.coinPound, formatCurrency(poundBase));

    setText(els.coinQuarterMadeNote, `المصنعية: ${formatCurrency(AVG_COIN_WORKMANSHIP.quarter)}`);
    setText(els.coinHalfMadeNote, `المصنعية: ${formatCurrency(AVG_COIN_WORKMANSHIP.half)}`);
    setText(els.coinPoundMadeNote, `المصنعية: ${formatCurrency(AVG_COIN_WORKMANSHIP.pound)}`);
  }

  function updateAllPriceDisplays() {
    updateGramPrices();
    updateMiniGramPrices();
    updateBullionPrices();
    updateCoinPrices();
    updatePersistedChangeBadge();
  }

  function applyRealPriceChange(newPrices) {
    const hadPreviousRealFetch = Object.values(lastFetchedPrices).some(v => Number(v) > 0);

    if (!hadPreviousRealFetch) {
      livePrices = { ...newPrices };
      lastFetchedPrices = { ...newPrices };
      saveToLocalStorage();
      return;
    }

    ["24", "22", "21", "18", "14"].forEach(carat => {
      const oldVal = Number(lastFetchedPrices[carat] || 0);
      const newVal = Number(newPrices[carat] || 0);
      const diff = Math.round(newVal - oldVal);

      if (diff !== 0) {
        lastPriceDiffs[carat] = diff;
      }
    });

    livePrices = { ...newPrices };

    const changed = ["24", "22", "21", "18", "14"].some(carat => {
      return Number(newPrices[carat]) !== Number(lastFetchedPrices[carat]);
    });

    if (changed) {
      lastFetchedPrices = { ...newPrices };
    }

    saveToLocalStorage();
  }

  async function fetchLiveSpotAndSyncLocal() {
    try {
      setBadgeState(els.statusBadge, "جاري تحديث السعر...", "neutral");

      const res = await fetch(GOLD_API_URL, {
        method: "GET",
        cache: "no-store"
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const ouncePriceUsd = Number(data.price);

      if (!Number.isFinite(ouncePriceUsd) || ouncePriceUsd <= 0) {
        throw new Error("السعر الراجع غير صالح");
      }

      lastOunceUsd = ouncePriceUsd;

      const gramUsd24 = ouncePriceUsd / OUNCE_TO_GRAM;
      const gramEgp24 = gramUsd24 * USD_TO_EGP;
      const local24 = gramEgp24 + LOCAL_PREMIUM_PER_GRAM_24;
      const newPrices = buildLocalPricesFrom24(local24);

      applyRealPriceChange(newPrices);

      const now = new Date();
      appendPoint("hour", livePrices, now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }));
      appendPoint("day", livePrices, now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }));
      appendPoint("week", livePrices, now.toLocaleDateString("ar-EG", { weekday: "short" }));
      appendPoint("month", livePrices, now.getDate().toString());
      appendPoint("year", livePrices, now.toLocaleDateString("ar-EG", { month: "short" }));

      updateAllPriceDisplays();
      updateLastUpdate();
      updateChart();
      await updatePredictionAI();

      saveToLocalStorage();
      setBadgeState(els.statusBadge, "تم التحديث بنجاح", "neutral");
    } catch (err) {
      console.error("خطأ في جلب السعر:", err);
      setBadgeState(els.statusBadge, "تعذر تحديث السعر الآن", "warn");
      await updatePredictionAI(true);
    }
  }

  function buildDatasetsForRange(range) {
    const configMap = {
      "24": { color: "#e0bc46" },
      "22": { color: "#9ec5ff" },
      "21": { color: "#31d67b" },
      "18": { color: "#ff8a57" },
      "14": { color: "#bb6bd9" }
    };

    const caratsToShow = selectedCarat === "all"
      ? ["24", "22", "21", "18", "14"]
      : [selectedCarat];

    return caratsToShow.map(carat => ({
      label: `عيار ${carat}`,
      data: priceHistory[range][carat] || [],
      borderColor: configMap[carat].color,
      pointBackgroundColor: configMap[carat].color,
      pointBorderColor: configMap[carat].color,
      pointRadius: 3,
      pointHoverRadius: 5,
      borderWidth: selectedCarat === "all" ? 2.5 : 4,
      tension: 0.35,
      fill: false
    }));
  }

  function createChart() {
    if (!els.chartCanvas || typeof Chart === "undefined") return;

    const ctx = els.chartCanvas.getContext("2d");

    goldChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: priceHistory[selectedRange].labels,
        datasets: buildDatasetsForRange(selectedRange)
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "nearest",
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            labels: {
              color: "#d7d7d7",
              font: {
                family: "Cairo, sans-serif",
                size: 13
              }
            }
          },
          tooltip: {
            rtl: true,
            titleFont: { family: "Cairo, sans-serif" },
            bodyFont: { family: "Cairo, sans-serif" },
            callbacks: {
              label(context) {
                return `${context.dataset.label}: ${formatNumber(context.parsed.y)} ج.م`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: "#bfbfbf",
              font: { family: "Cairo, sans-serif", size: 11 }
            },
            grid: { color: "rgba(255,255,255,0.08)" }
          },
          y: {
            ticks: {
              color: "#bfbfbf",
              font: { family: "Cairo, sans-serif", size: 11 },
              callback(value) {
                return formatNumber(value);
              }
            },
            grid: { color: "rgba(255,255,255,0.08)" }
          }
        }
      }
    });
  }

  function updateChart() {
    if (!goldChart) {
      createChart();
      return;
    }

    goldChart.data.labels = priceHistory[selectedRange].labels;
    goldChart.data.datasets = buildDatasetsForRange(selectedRange);
    goldChart.update();
  }

  function getPredictionSeries() {
    const carat = selectedCarat === "all" ? "24" : selectedCarat;
    return (priceHistory[selectedRange][carat] || []).filter(v => Number.isFinite(v));
  }

  function runFallbackPrediction(series) {
    if (!series || series.length < 3) {
      return {
        state: "neutral",
        confidence: 50,
        predicted: series?.[series.length - 1] || 0
      };
    }

    const last = series[series.length - 1];
    const prev = series[series.length - 2];
    const prev2 = series[series.length - 3];

    const momentum = (last - prev) + (prev - prev2);
    const predicted = last + momentum * 0.5;
    const confidence = Math.max(52, Math.min(78, 60 + Math.abs(momentum)));

    if (momentum > 1) {
      return { state: "up", confidence: Math.round(confidence), predicted };
    }
    if (momentum < -1) {
      return { state: "down", confidence: Math.round(confidence), predicted };
    }

    return { state: "neutral", confidence: 58, predicted: last };
  }

  async function runTensorPrediction(series) {
    if (!window.tf) {
      throw new Error("TensorFlow.js غير متاح");
    }

    const cleanSeries = series.filter(v => Number.isFinite(v));

    if (cleanSeries.length < 12) {
      throw new Error("بيانات غير كافية");
    }

    const min = Math.min(...cleanSeries);
    const max = Math.max(...cleanSeries);
    const scale = max - min || 1;

    const normalized = cleanSeries.map(v => (v - min) / scale);
    const windowSize = Math.min(6, Math.max(4, Math.floor(normalized.length / 3)));

    const xs = [];
    const ys = [];

    for (let i = 0; i < normalized.length - windowSize; i++) {
      xs.push(normalized.slice(i, i + windowSize));
      ys.push([normalized[i + windowSize]]);
    }

    if (xs.length < 4) {
      throw new Error("عينات التدريب قليلة");
    }

    const xTensor = tf.tensor2d(xs);
    const yTensor = tf.tensor2d(ys);

    const model = tf.sequential();
    model.add(tf.layers.dense({
      inputShape: [windowSize],
      units: 12,
      activation: "relu"
    }));
    model.add(tf.layers.dense({
      units: 6,
      activation: "relu"
    }));
    model.add(tf.layers.dense({
      units: 1
    }));

    model.compile({
      optimizer: tf.train.adam(0.02),
      loss: "meanSquaredError"
    });

    await model.fit(xTensor, yTensor, {
      epochs: 25,
      batchSize: Math.min(8, xs.length),
      verbose: 0
    });

    const input = tf.tensor2d([normalized.slice(-windowSize)]);
    const output = model.predict(input);
    const predictedNorm = (await output.data())[0];
    const predicted = predictedNorm * scale + min;

    xTensor.dispose();
    yTensor.dispose();
    input.dispose();
    output.dispose();
    model.dispose();

    const last = cleanSeries[cleanSeries.length - 1];
    const diff = predicted - last;
    const confidence = Math.max(55, Math.min(84, 60 + Math.abs(diff)));

    if (diff > 1) {
      return { state: "up", confidence: Math.round(confidence), predicted };
    }
    if (diff < -1) {
      return { state: "down", confidence: Math.round(confidence), predicted };
    }

    return { state: "neutral", confidence: 60, predicted: last };
  }

  async function updatePredictionAI(forceFallback = false) {
    try {
      const series = getPredictionSeries();
      let result;

      if (forceFallback) {
        result = runFallbackPrediction(series);
      } else {
        try {
          result = await runTensorPrediction(series);
        } catch (err) {
          result = runFallbackPrediction(series);
        }
      }

      const predictedText = formatCurrency(result.predicted);

      if (result.state === "up") {
        setBadgeState(
          els.predictionBadge,
          `توقع AI: صعود ${result.confidence}% | التالي ${predictedText}`,
          "up"
        );
      } else if (result.state === "down") {
        setBadgeState(
          els.predictionBadge,
          `توقع AI: هبوط ${result.confidence}% | التالي ${predictedText}`,
          "down"
        );
      } else {
        setBadgeState(
          els.predictionBadge,
          `توقع AI: حركة عرضية ${result.confidence}% | التالي ${predictedText}`,
          "neutral"
        );
      }
    } catch (err) {
      console.error("خطأ التوقع:", err);
      setBadgeState(els.predictionBadge, "توقع AI: تعذر التحليل الآن", "warn");
    }
  }

  function bindChartControls() {
    els.caratButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        els.caratButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        selectedCarat = btn.dataset.carat;
        updateChart();
        updatePredictionAI();
        saveToLocalStorage();
      });
    });

    els.rangeButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        els.rangeButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        selectedRange = btn.dataset.range;
        updateChart();
        updatePredictionAI();
        saveToLocalStorage();
      });
    });
  }

  function syncActiveButtons() {
    els.caratButtons.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.carat === selectedCarat);
    });

    els.rangeButtons.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.range === selectedRange);
    });
  }

  function decodeHtmlEntities(str) {
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
  }

  function stripHtml(html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    return (div.textContent || div.innerText || "").trim();
  }

  function getBestImageFromHtml(html) {
    if (!html) return "";

    const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch && imgMatch[1]) return imgMatch[1];

    return "";
  }

  function normalizeNewsItem(item) {
    return {
      title: decodeHtmlEntities(item.title || "خبر بدون عنوان").trim(),
      link: item.link || "#",
      pubDate: item.pubDate || item.pubdate || "",
      description: stripHtml(item.description || item.content || item.contentSnippet || ""),
      image: item.image || item.thumbnail || item.enclosure || ""
    };
  }

  async function fetchRSSViaRss2Json(feedUrl) {
    const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      throw new Error(`rss2json HTTP ${res.status}`);
    }

    const data = await res.json();

    if (data.status !== "ok" || !Array.isArray(data.items)) {
      throw new Error(data.message || "rss2json invalid response");
    }

    return data.items.slice(0, 8).map(item => {
      const normalized = normalizeNewsItem(item);

      if (!normalized.image) {
        normalized.image = getBestImageFromHtml(item.description || item.content || "");
      }

      return normalized;
    });
  }

  async function fetchTextThroughProxy(url) {
  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`
  ];

  for (const proxyUrl of proxies) {
    try {
      const res = await fetch(proxyUrl, { cache: "no-store" });
      if (!res.ok) continue;

      const text = await res.text();
      if (
        text &&
        text.length > 50 &&
        (text.includes("<rss") || text.includes("<feed") || text.includes("<item"))
      ) {
        return text;
      }
    } catch (err) {
      console.warn("فشل بروكسي:", proxyUrl, err);
    }
  }

  throw new Error("تعذر جلب الـ RSS من كل المصادر");
}

  function extractImageFromItem(item) {
    const mediaContent = item.querySelector("media\\:content, content");
    if (mediaContent && mediaContent.getAttribute("url")) {
      return mediaContent.getAttribute("url");
    }

    const mediaThumbnail = item.querySelector("media\\:thumbnail");
    if (mediaThumbnail && mediaThumbnail.getAttribute("url")) {
      return mediaThumbnail.getAttribute("url");
    }

    const enclosure = item.querySelector("enclosure");
    if (enclosure && enclosure.getAttribute("url")) {
      return enclosure.getAttribute("url");
    }

    const descriptionHtml = item.querySelector("description")?.textContent || "";
    const imageFromDescription = getBestImageFromHtml(descriptionHtml);
    if (imageFromDescription) return imageFromDescription;

    return "";
  }

  function parseRssItems(xmlText) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, "text/xml");
    const items = [...xml.querySelectorAll("item")];

    return items.slice(0, 8).map(item => ({
      title: decodeHtmlEntities(item.querySelector("title")?.textContent?.trim() || "خبر بدون عنوان"),
      link: item.querySelector("link")?.textContent?.trim() || "#",
      pubDate: item.querySelector("pubDate")?.textContent?.trim() || "",
      description: stripHtml(item.querySelector("description")?.textContent || ""),
      image: extractImageFromItem(item)
    }));
  }

  function getFallbackImageByKeyword(title = "", description = "") {
    const content = `${title} ${description}`.toLowerCase();

    if (
      content.includes("gold") ||
      content.includes("bullion") ||
      content.includes("xau") ||
      content.includes("الذهب") ||
      content.includes("سعر الذهب")
    ) {
      return "https://images.unsplash.com/photo-1610375461369-d613b5642ce5?auto=format&fit=crop&w=1200&q=80";
    }

    return "";
  }

  function renderNews(items) {
    if (!els.newsList) return;

    if (!items || !items.length) {
      els.newsList.innerHTML = `
        <div class="news-item">
          <div class="news-body">
            <h3>لا توجد أخبار متاحة الآن</h3>
            <p>حاول مرة أخرى بعد قليل.</p>
          </div>
        </div>
      `;
      return;
    }

    els.newsList.innerHTML = items.map(item => {
      const safeImage = item.image || getFallbackImageByKeyword(item.title, item.description);

      return `
        <article class="news-item">
          ${safeImage ? `
            <div class="news-thumb-wrap">
              <img
                class="news-thumb"
                src="${safeImage}"
                alt="صورة الخبر"
                loading="lazy"
                referrerpolicy="no-referrer"
                onerror="this.parentElement.style.display='none';"
              >
            </div>
          ` : ""}

          <div class="news-body">
            <h3>${item.title}</h3>
            <div class="news-meta">${item.pubDate || "تحديث حديث"}</div>
            <p>${item.description || "اضغط لقراءة الخبر كاملًا."}</p>
            <a class="news-link" href="${item.link}" target="_blank" rel="noopener noreferrer">قراءة الخبر</a>
          </div>
        </article>
      `;
    }).join("");
  }

  async function fetchSingleFeed(feed) {
    try {
      const items = await fetchRSSViaRss2Json(feed);
      if (items?.length) return items;
    } catch (err) {
      console.warn("rss2json failed:", feed, err);
    }

    const xmlText = await fetchTextThroughProxy(feed);
    return parseRssItems(xmlText);
  }

  async function updateNews() {
    if (newsBusy) return;
    newsBusy = true;

    if (els.refreshNewsBtn) els.refreshNewsBtn.disabled = true;

    try {
      if (els.newsList) {
        els.newsList.innerHTML = `
          <div class="news-item">
            <div class="news-body">
              <h3>جاري تحديث الأخبار...</h3>
              <p>لحظات ونرجعلك بأحدث الأخبار.</p>
            </div>
          </div>
        `;
      }

      const allItems = [];

      for (const feed of NEWS_FEEDS) {
        try {
          const parsed = await fetchSingleFeed(feed);
          allItems.push(...parsed);
        } catch (err) {
          console.warn("فشل في جلب feed:", feed, err);
        }
      }

      const uniqueMap = new Map();

      allItems.forEach(item => {
        const key = `${item.title}|${item.link}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, item);
        }
      });

      cachedNews = [...uniqueMap.values()]
        .filter(item => item.title && item.link)
        .slice(0, 10);

      if (cachedNews.length) {
        renderNews(cachedNews);
        saveToLocalStorage();
      } else {
        throw new Error("لم يتم العثور على أخبار");
      }
    } catch (err) {
      console.error("خطأ الأخبار:", err);

      if (cachedNews.length) {
        renderNews(cachedNews);
      } else if (els.newsList) {
        els.newsList.innerHTML = `
          <div class="news-item">
            <div class="news-body">
              <h3>تعذر تحميل الأخبار</h3>
              <p>حاول مرة أخرى بعد قليل.</p>
            </div>
          </div>
        `;
      }
    } finally {
      newsBusy = false;
      if (els.refreshNewsBtn) els.refreshNewsBtn.disabled = false;
    }
  }

  function bindNewsRefresh() {
    if (els.refreshNewsBtn) {
      els.refreshNewsBtn.addEventListener("click", updateNews);
    }
  }

  function bindNewsRefresh() {
  if (els.refreshNewsBtn) {
    els.refreshNewsBtn.addEventListener("click", updateNews);
  }
}

function init() {
  loadFromLocalStorage();
  seedInitialHistoryIfNeeded();
  bindNavigation();
  bindChartControls();
  bindNewsRefresh();
  syncActiveButtons();
  showPriceCategory("grams");
  updateAllPriceDisplays();
  updateLastUpdate();
  createChart();
  updatePredictionAI();

  if (cachedNews.length) {
    renderNews(cachedNews);
  } else {
    updateNews();
  }

  fetchLiveSpotAndSyncLocal();
  setInterval(fetchLiveSpotAndSyncLocal, UPDATE_INTERVAL_MS);
  setInterval(updateNews, NEWS_INTERVAL_MS);
}

document.addEventListener("DOMContentLoaded", init);
})();