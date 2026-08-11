// =========================
// Password Lock
// =========================
const DSS_PASSWORD = "IMTEYAZ786";
const SESSION_KEY = "DSS_UNLOCKED";

window.addEventListener("DOMContentLoaded", () => {

  const lockScreen = document.getElementById("lockScreen");
  const appContent = document.getElementById("appContent");
  const lockPassword = document.getElementById("lockPassword");
  const lockSubmitBtn = document.getElementById("lockSubmitBtn");
  const lockError = document.getElementById("lockError");

  // =========================
  // Elements
  // =========================
  const addBtn = document.getElementById("addBtn");
  const playBtn = document.getElementById("playBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const saveBtn = document.getElementById("saveBtn");
  const loadBtn = document.getElementById("loadBtn");
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  const exitBtn = document.getElementById("exitPresentationBtn");
  const muteBtn = document.getElementById("muteBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  const closeSettingsBtn = document.getElementById("closeSettingsBtn");
  const toggleControlsBtn = document.getElementById("toggleControlsBtn");
  const controlsPanel = document.getElementById("controlsPanel");
  const settingsPanel = document.getElementById("settingsPanel");

  const filePicker = document.getElementById("filePicker");
  const qrFile = document.getElementById("qrFile");
  const imagePlayer = document.getElementById("imagePlayer");
  const videoPlayer = document.getElementById("videoPlayer");
  const welcome = document.getElementById("welcome");
  const playlist = document.getElementById("playlist");
  const statusText = document.getElementById("statusText");
  const tickerInput = document.getElementById("tickerInput");
  const tickerText = document.getElementById("tickerText");
  const tickerSaveBtn = document.getElementById("tickerSaveBtn");
  const qrBox = document.getElementById("qrBox");
  const qrImage = document.getElementById("qrImage");

  // =========================
  // Variables
  // =========================
  let media = [];
  let current = -1;
  let slideTimer = null;
  let userWantsSound = false;
  let currentObjectUrl = null;
  let hideTimer = null;

  // =========================
  // IndexedDB
  // =========================
  const DB_NAME = "DSS_DB";
  const STORE_NAME = "playlist";
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return dbPromise;
  }

  async function savePlaylistToDB(items) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      items.forEach((item) => {
        store.add({
          name: item.file.name,
          type: item.file.type,
          blob: item.file,
          duration: item.duration || 5
        });
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function loadPlaylistFromDB() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // =========================
  // Unlock
  // =========================
  function unlockApp() {
    lockScreen.style.display = "none";
    appContent.style.display = "block";

    setTimeout(() => {
      if (media.length > 0) {
        enterPresentation();
        if (current === -1) show(0);
      }
    }, 700);
  }

  if (sessionStorage.getItem(SESSION_KEY) === "yes") {
    unlockApp();
  }

  function tryUnlock() {
    if (lockPassword.value === DSS_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "yes");
      lockError.textContent = "";
      unlockApp();
    } else {
      lockError.textContent = "❌ गलत Password";
      lockPassword.value = "";
    }
  }

  lockSubmitBtn.addEventListener("click", tryUnlock);
  lockPassword.addEventListener("keydown", (e) => {
    if (e.key === "Enter") tryUnlock();
  });

  // =========================
  // Auto load playlist
  // =========================
  (async function autoLoadOnStart() {
    try {
      const rows = await loadPlaylistFromDB();
      if (rows.length > 0) {
        media = rows.map((row) => ({
          file: new File([row.blob], row.name, { type: row.type }),
          duration: row.duration || 5
        }));
        refreshPlaylist();
        statusText.textContent = `Playlist loaded (${media.length} items)`;
      }
    } catch (err) {
      console.error(err);
    }
  })();

  // =========================
  // Add Media
  // =========================
  addBtn.addEventListener("click", () => filePicker.click());

  filePicker.addEventListener("change", (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      media.push({ file: file, duration: 5 });
    });
    refreshPlaylist();
    if (current === -1 && media.length > 0) show(0);
    filePicker.value = "";
  });

  // =========================
  // Show Media (with fade)
  // =========================
  function show(index) {
    clearTimeout(slideTimer);
    if (index < 0 || index >= media.length) return;

    current = index;
    const item = media[current];
    const file = item.file;
    const duration = (item.duration || 5) * 1000;

    welcome.style.display = "none";
    videoPlayer.style.display = "none";
    videoPlayer.pause();

    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    const url = URL.createObjectURL(file);
    currentObjectUrl = url;

    document.querySelectorAll("#playlist li").forEach((li, i) => {
      li.classList.toggle("active", i === current);
    });

    if (file.type.startsWith("image")) {
      imagePlayer.classList.add("fade-out");
      setTimeout(() => {
        imagePlayer.src = url;
        imagePlayer.style.display = "block";
        imagePlayer.classList.remove("fade-out");
        statusText.textContent = `Image ${current + 1} / ${media.length}`;
        slideTimer = setTimeout(nextMedia, duration);
      }, 600);
    } else {
      imagePlayer.style.display = "none";
      videoPlayer.src = url;
      videoPlayer.style.display = "block";
      videoPlayer.muted = !userWantsSound;
      statusText.textContent = `Video ${current + 1} / ${media.length}`;
      videoPlayer.load();
      videoPlayer.play().catch(() => {
        videoPlayer.muted = true;
        videoPlayer.play();
      });
      muteBtn.textContent = videoPlayer.muted ? "🔇" : "🔊";
    }
  }

  // =========================
  // Refresh Playlist
  // =========================
  function refreshPlaylist() {
    playlist.innerHTML = "";
    media.forEach((item, index) => {
      const li = document.createElement("li");
      li.className = "playlistItem";

      const title = document.createElement("span");
      title.className = "title";
      title.textContent = item.file.name;
      title.addEventListener("click", () => show(index));

      const timeInput = document.createElement("input");
      timeInput.type = "number";
      timeInput.min = "1";
      timeInput.max = "300";
      timeInput.value = item.duration || 5;
      timeInput.style.width = "55px";
      timeInput.style.padding = "3px";
      timeInput.style.borderRadius = "4px";
      timeInput.style.border = "none";
      timeInput.addEventListener("change", () => {
        item.duration = Number(timeInput.value) || 5;
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "deleteBtn";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        media.splice(index, 1);
        if (media.length === 0) {
          current = -1;
          welcome.style.display = "block";
          imagePlayer.style.display = "none";
          videoPlayer.style.display = "none";
          statusText.textContent = "Ready";
        } else {
          if (current >= media.length) current = media.length - 1;
          if (current >= 0) show(current);
        }
        refreshPlaylist();
      });

      li.appendChild(title);
      li.appendChild(timeInput);
      li.appendChild(deleteBtn);
      playlist.appendChild(li);
    });
  }

  // =========================
  // Next / Prev
  // =========================
  function nextMedia() {
    if (media.length === 0) return;
    current = (current + 1) % media.length;
    show(current);
  }

  function prevMedia() {
    if (media.length === 0) return;
    current = (current - 1 + media.length) % media.length;
    show(current);
  }

  playBtn.addEventListener("click", () => {
    if (videoPlayer.style.display === "block") videoPlayer.play();
  });
  pauseBtn.addEventListener("click", () => {
    if (videoPlayer.style.display === "block") videoPlayer.pause();
  });
  nextBtn.addEventListener("click", nextMedia);
  prevBtn.addEventListener("click", prevMedia);
  videoPlayer.addEventListener("ended", nextMedia);

  // =========================
  // Save / Load
  // =========================
  saveBtn.addEventListener("click", async () => {
    if (media.length === 0) return alert("Playlist is empty!");
    try {
      await savePlaylistToDB(media);
      alert("✅ Playlist Saved");
    } catch (err) {
      alert("Save failed");
    }
  });

  loadBtn.addEventListener("click", async () => {
    try {
      const rows = await loadPlaylistFromDB();
      if (rows.length === 0) return alert("No saved playlist");
      media = rows.map((row) => ({
        file: new File([row.blob], row.name, { type: row.type }),
        duration: row.duration || 5
      }));
      refreshPlaylist();
      current = -1;
      show(0);
      alert("✅ Playlist Loaded");
    } catch (err) {
      alert("Load failed");
    }
  });

  // =========================
  // Presentation Mode
  // =========================
  function showExitButton() {
    exitBtn.style.display = "inline-block";
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      // optional: hide after time
    }, 4000);
  }

  function enterPresentation() {
    document.body.classList.add("presentation-mode");
    const el = document.documentElement;
    const request = el.requestFullscreen || el.webkitRequestFullscreen;
    if (request) request.call(el).catch(() => {});
    showExitButton();
  }

  function exitPresentation() {
    document.body.classList.remove("presentation-mode");
    if (document.fullscreenElement) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document).catch(() => {});
    }
  }

  fullscreenBtn.addEventListener("click", enterPresentation);
  exitBtn.addEventListener("click", exitPresentation);

  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) {
      document.body.classList.remove("presentation-mode");
    }
  });

  // =========================
  // Side Controls Toggle
  // =========================
  toggleControlsBtn.addEventListener("click", () => {
    controlsPanel.classList.toggle("show");
  });

  // =========================
  // Settings Panel
  // =========================
  settingsBtn.addEventListener("click", () => {
    settingsPanel.classList.add("show");
    controlsPanel.classList.remove("show");
  });

  closeSettingsBtn.addEventListener("click", () => {
    settingsPanel.classList.remove("show");
  });

  // =========================
  // Mute
  // =========================
  muteBtn.addEventListener("click", () => {
    if (videoPlayer.muted) {
      videoPlayer.muted = false;
      userWantsSound = true;
      muteBtn.textContent = "🔊";
    } else {
      videoPlayer.muted = true;
      userWantsSound = false;
      muteBtn.textContent = "🔇";
    }
  });

  // =========================
  // QR Code
  // =========================
  // पहले से सेव QR लोड करें
  const savedQR = localStorage.getItem("DSS_QR");
  if (savedQR) {
    qrImage.src = savedQR;
  }

  qrFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      qrImage.src = reader.result;
      localStorage.setItem("DSS_QR", reader.result);
      alert("✅ QR Code सेव हो गया");
    };
    reader.readAsDataURL(file);
  });

  // =========================
  // Clock
  // =========================
  function updateClock() {
    const now = new Date();
    const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const date = now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    const clock = document.getElementById("clock");
    if (clock) clock.textContent = time + " | " + date;
  }
  updateClock();
  setInterval(updateClock, 1000);

  // =========================
  // Ticker
  // =========================
  const savedTicker = localStorage.getItem("DSS_TICKER");
  if (savedTicker) {
    tickerText.textContent = savedTicker;
    tickerInput.value = savedTicker;
  }

  tickerSaveBtn.addEventListener("click", () => {
    const message = tickerInput.value.trim();
    if (!message) return alert("कृपया कुछ लिखें");
    tickerText.textContent = message;
    localStorage.setItem("DSS_TICKER", message);
    alert("✅ Ticker सेव हो गया");
  });

});