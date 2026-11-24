const $ = id => document.getElementById(id);

let deviceId = null;
let pollTimer = null;
let historyTimer = null;
let historyPoints = [];
let currentRangeHours = 24;
let lastMode = null;
let requestInFlight = false;

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers: options.body
      ? { "Content-Type": "application/json", ...options.headers }
      : { ...options.headers }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request gagal");
  return data;
}

function showLogin() {
  stopMonitoring();
  $("loginPage").hidden = false;
  $("dashboard").hidden = true;
}

function showDashboard(id) {
  deviceId = id;
  $("loginPage").hidden = true;
  $("dashboard").hidden = false;
  $("deviceLabel").textContent = id;
  $("infoDevice").textContent = id;
  startMonitoring();
}

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = $("loginButton");
  button.disabled = true;
  button.textContent = "MEMERIKSA...";
  try {
    const result = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        deviceId: $("deviceId").value.trim(),
        password: $("password").value
      })
    });
    $("loginError").textContent = "";
    showDashboard(result.deviceId);
  } catch (error) {
    $("loginError").textContent =
      error.message === "Unauthorized" ? "ID atau password salah" : error.message;
  } finally {
    button.disabled = false;
    button.textContent = "LOGIN DASHBOARD";
  }
});

$("logoutButton").addEventListener("click", async () => {
  stopMonitoring();
  try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
  deviceId = null;
  showLogin();
});

async function loadData() {
  if (requestInFlight || !deviceId) return;
  requestInFlight = true;
  try {
    const result = await api("/info/dataJSON");
    const data = result.data;
    if (!data) {
      setOffline();
      return;
    }

    const online = Date.now() - Number(data.last_seen) < 15000;
    $("connection").textContent = online ? "ONLINE" : "OFFLINE";
    $("connection").className = online ? "badge online" : "badge offline";
    $("temperature").textContent = data.temperature == null
      ? "--.- °C" : Number(data.temperature).toFixed(1) + " °C";
    $("humidity").textContent = data.humidity == null
      ? "--.- %" : Number(data.humidity).toFixed(1) + " %";
    $("uptime").textContent = formatUptime(data.uptime);
    $("lastUpdate").textContent = new Date(data.last_seen).toLocaleTimeString("id-ID");
    if (data.mode && data.mode !== lastMode) {
      lastMode = data.mode;
      $("currentMode").textContent = data.mode;
      updateModeButtons(data.mode);
    }
    updateAlarm(data);
    if (!online) setOfflineBadgeOnly();
  } catch (error) {
    console.error("Data:", error);
    setOffline();
  } finally {
    requestInFlight = false;
  }
}

async function loadMode() {
  try {
    const result = await api("/info/modeJSON");
    applyMode(result);
  } catch (error) {
    console.error("Mode:", error);
  }
}

function applyMode(result) {
  lastMode = result.mode;
  $("currentMode").textContent = result.mode;
  $("temperatureLimit").textContent =
    `Batas: ${result.temperature_min} sampai ${result.temperature_max} °C`;
  $("humidityLimit").textContent =
    `Batas: ${result.humidity_min} sampai ${result.humidity_max} %`;
  updateModeButtons(result.mode);
}

async function changeMode(mode) {
  try {
    const result = await api("/info/modeJSON", {
      method: "POST",
      body: JSON.stringify({ mode })
    });
    applyMode(result);
  } catch (error) {
    alert("Gagal mengubah mode: " + error.message);
  }
}

document.querySelectorAll("[data-mode]").forEach(button => {
  button.addEventListener("click", () => changeMode(button.dataset.mode));
});

function updateModeButtons(mode) {
  document.querySelectorAll("[data-mode]").forEach(button => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
}

function updateAlarm(data) {
  const status = data.status || "NORMAL";
  $("systemStatus").textContent = data.sensor_error ? "SENSOR ERROR" : status;
  $("systemStatus").className =
    data.alarm_active || data.sensor_error ? "status" : "status normal";
  $("systemStatus").style.background =
    data.alarm_active || data.sensor_error ? "#450a0a" : "#064e3b";
  $("systemStatus").style.color =
    data.alarm_active || data.sensor_error ? "#f87171" : "#4ade80";

  const alarm = $("alarmInfo");
  if (data.sensor_error) {
    alarm.textContent = "SENSOR ERROR";
    alarm.className = "alarm-active";
  } else if (data.alarm_active) {
    alarm.textContent = data.alarm_reason || "ALARM AKTIF";
    alarm.className = "alarm-active";
  } else {
    alarm.textContent = "Tidak ada alarm aktif";
    alarm.className = "alarm-normal";
  }
}

function formatUptime(seconds) {
  const value = Number(seconds) || 0;
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  const sec = value % 60;
  return `${h} jam ${m} menit ${sec} detik`;
}

function setOfflineBadgeOnly() {
  $("connection").textContent = "OFFLINE";
  $("connection").className = "badge offline";
}

function setOffline() {
  setOfflineBadgeOnly();
  $("systemStatus").textContent = "DATA TERPUTUS";
  $("systemStatus").className = "status";
  $("alarmInfo").textContent = "Tidak menerima data dari perangkat";
  $("alarmInfo").className = "alarm-active";
}

async function loadHistory() {
  try {
    const result = await api(`/info/historyJSON?hours=${currentRangeHours}`);
    historyPoints = Array.isArray(result.points) ? result.points : [];
    drawHistory();
    $("historyInfo").textContent = historyPoints.length
      ? `${historyPoints.length} titik data · pencatatan setiap 30 detik · retensi 7 hari`
      : "Belum ada riwayat. Data logger mulai terisi setelah perangkat mengirim data.";
  } catch (error) {
    console.error("History:", error);
    $("historyInfo").textContent = "Riwayat belum dapat dimuat.";
  }
}

function drawHistory() {
  const cutoff = Date.now() - currentRangeHours * 60 * 60 * 1000;
  const points = historyPoints.filter(point => Number(point.timestamp) >= cutoff);
  drawLineChart($("temperatureChart"), points, "temperature", "°C");
  drawLineChart($("humidityChart"), points, "humidity", "%");
  if (!points.length && historyPoints.length) {
    $("historyInfo").textContent = "Tidak ada data pada rentang waktu ini.";
  }
}

// Canvas native tanpa library grafik tambahan agar halaman tetap ringan.
function drawLineChart(canvas, points, field, unit) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(280, rect.width || 600);
  const height = 150;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const left = 42, right = 10, top = 10, bottom = 25;
  const plotW = width - left - right;
  const plotH = height - top - bottom;

  ctx.font = "10px Arial";
  ctx.fillStyle = "#94a3b8";
  ctx.strokeStyle = "#26364c";
  ctx.lineWidth = 1;

  if (!points.length) {
    ctx.textAlign = "center";
    ctx.fillText("Belum ada data", width / 2, height / 2);
    return;
  }

  const values = points.map(p => Number(p[field])).filter(Number.isFinite);
  if (!values.length) return;
  let min = Math.min(...values), max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const padding = (max - min) * 0.12;
  min -= padding; max += padding;

  for (let i = 0; i <= 3; i++) {
    const y = top + (plotH * i / 3);
    const value = max - ((max - min) * i / 3);
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(width - right, y);
    ctx.stroke();
    ctx.textAlign = "right";
    ctx.fillText(value.toFixed(1), left - 7, y + 3);
  }

  const firstTime = Number(points[0].timestamp);
  const lastTime = Number(points[points.length - 1].timestamp);
  const timeSpan = Math.max(1, lastTime - firstTime);
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = left + ((Number(point.timestamp) - firstTime) / timeSpan) * plotW;
    const y = top + ((max - Number(point[field])) / (max - min)) * plotH;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = field === "temperature" ? "#f59e0b" : "#38bdf8";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();

  ctx.fillStyle = "#94a3b8";
  ctx.textAlign = "left";
  ctx.fillText(new Date(firstTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }), left, height - 5);
  ctx.textAlign = "right";
  ctx.fillText(new Date(lastTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }), width - right, height - 5);
}

$("historyRange").addEventListener("change", event => {
  currentRangeHours = Number(event.target.value) || 24;
  loadHistory();
});

window.addEventListener("resize", drawHistory);

function startMonitoring() {
  stopMonitoring();
  loadMode();
  loadData();
  loadHistory();

  // Jadwal berikutnya dibuat setelah request selesai; tidak ada request bertumpuk.
  const poll = async () => {
    if (!deviceId) return;
    await loadData();
    pollTimer = setTimeout(poll, 5000);
  };
  pollTimer = setTimeout(poll, 5000);

  const refreshHistory = async () => {
    if (!deviceId) return;
    await loadHistory();
    historyTimer = setTimeout(refreshHistory, 30000);
  };
  historyTimer = setTimeout(refreshHistory, 30000);
}

function stopMonitoring() {
  if (pollTimer) clearTimeout(pollTimer);
  if (historyTimer) clearTimeout(historyTimer);
  pollTimer = null;
  historyTimer = null;
}

async function initialize() {
  try {
    const result = await api("/api/auth/session");
    if (result.authenticated) showDashboard(result.deviceId);
    else showLogin();
  } catch {
    showLogin();
  }
}

initialize();
