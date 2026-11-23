
const $ = id => document.getElementById(id);

let deviceId = null;
let pollTimer = null;

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request gagal");
  }

  return data;
}

function showLogin() {
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

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();

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
      error.message === "Unauthorized"
        ? "ID atau password salah"
        : error.message;
  } finally {
    button.disabled = false;
    button.textContent = "LOGIN DASHBOARD";
  }
});

$("logoutButton").addEventListener("click", async () => {
  stopMonitoring();

  await fetch("/api/auth/logout", {
    method: "POST"
  });

  deviceId = null;
  showLogin();
});

async function loadData() {
  try {
    const result = await api("/info/dataJSON");

    const data = result.data;

    if (!data) {
      setOffline();
      return;
    }

    const online =
      Date.now() - data.last_seen < 15000;

    $("connection").textContent =
      online ? "ONLINE" : "OFFLINE";

    $("connection").className =
      online ? "badge online" : "badge offline";

    $("temperature").textContent =
      Number(data.temperature).toFixed(1) + " °C";

    $("humidity").textContent =
      Number(data.humidity).toFixed(1) + " %";

    $("currentMode").textContent = data.mode;

    $("uptime").textContent =
      formatUptime(data.uptime);

    $("lastUpdate").textContent =
      new Date(data.last_seen).toLocaleTimeString("id-ID");

    updateModeButtons(data.mode);

    updateAlarm(data);

  } catch (error) {
    console.error(error);
    setOffline();
  }
}

async function loadMode() {
  try {
    const result = await api("/info/modeJSON");

    $("currentMode").textContent = result.mode;

    $("temperatureLimit").textContent =
      `Batas: ${result.temperature_min} sampai ${result.temperature_max} °C`;

    $("humidityLimit").textContent =
      `Batas: ${result.humidity_min} sampai ${result.humidity_max} %`;

    updateModeButtons(result.mode);

  } catch (error) {
    console.error("Mode:", error);
  }
}

async function changeMode(mode) {
  try {
    const result = await api("/info/modeJSON", {
      method: "POST",
      body: JSON.stringify({ mode })
    });

    await loadMode();
    await loadData();

    console.log("Mode berhasil diubah:", result.mode);

  } catch (error) {
    alert("Gagal mengubah mode: " + error.message);
  }
}

document.querySelectorAll("[data-mode]").forEach(button => {
  button.addEventListener("click", () => {
    changeMode(button.dataset.mode);
  });
});

function updateModeButtons(mode) {
  document.querySelectorAll("[data-mode]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.mode === mode
    );
  });
}

function updateAlarm(data) {
  const status = data.status || "NORMAL";

  $("systemStatus").textContent =
    data.sensor_error ? "SENSOR ERROR" : status;

  $("systemStatus").className =
    data.alarm_active || data.sensor_error
      ? "status"
      : "status normal";

  if (data.alarm_active || data.sensor_error) {
    $("systemStatus").style.background = "#450a0a";
    $("systemStatus").style.color = "#f87171";
  } else {
    $("systemStatus").style.background = "#064e3b";
    $("systemStatus").style.color = "#4ade80";
  }

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
  const s = Number(seconds) || 0;

  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  return `${h} jam ${m} menit ${sec} detik`;
}

function setOffline() {
  $("connection").textContent = "OFFLINE";
  $("connection").className = "badge offline";
}

function startMonitoring() {
  stopMonitoring();

  loadMode();
  loadData();

  pollTimer = setInterval(() => {
    loadData();
    loadMode();
  }, 2000);
}

function stopMonitoring() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function initialize() {
  try {
    const result = await api("/api/auth/session");

    if (result.authenticated) {
      showDashboard(result.deviceId);
    } else {
      showLogin();
    }
  } catch {
    showLogin();
  }
}

initialize();
