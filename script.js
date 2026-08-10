// =========================
// Password Lock
// =========================
// यहाँ अपना password बदल सकते हैं
const DSS_PASSWORD = "IMTEYAZ786";
const SESSION_KEY = "DSS_UNLOCKED";

window.addEventListener("DOMContentLoaded", () => {
  const lockScreen = document.getElementById("lockScreen");
  const appContent = document.getElementById("appContent");
  const lockPassword = document.getElementById("lockPassword");
  const lockSubmitBtn = document.getElementById("lockSubmitBtn");
  const lockError = document.getElementById("lockError");

  function unlockApp() {
    lockScreen.style.display = "none";
    appContent.style.display = "block";
  }

  // इसी browser tab में दोबारा password न मांगे (session भर के लिए)
  if (sessionStorage.getItem(SESSION_KEY) === "yes") {
    unlockApp();
  }

  function tryUnlock() {
    if (lockPassword.value === DSS_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "yes");
      lockError.textContent = "";
      unlockApp();
    } else {
      lockError.textContent = "❌ गलत Password, दोबारा कोशिश करें";
      lockPassword.value = "";
    }
  }

  lockSubmitBtn.addEventListener("click", tryUnlock);
  lockPassword.addEventListener("keydown", (e) => {
    if (e.key === "Enter") tryUnlock();
  });
});

window.addEventListener("DOMContentLoaded", () => {

  // =========================
  // Buttons
  // =========================
  const addBtn = document.getElementById("addBtn");
  const playBtn = document.getElementById("playBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const saveBtn = document.getElementById("saveBtn");
  const loadBtn = document.getElementById("loadBtn");
  const playlistLoader = document.getElementById("playlistLoader");
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  const muteBtn = document.getElementById("muteBtn");


  // =========================
  // Media
  // =========================
  const filePicker = document.getElementById("filePicker");
  const imagePlayer = document.getElementById("imagePlayer");
  const videoPlayer = document.getElementById("videoPlayer");
  const welcome = document.getElementById("welcome");

  // =========================
  // Playlist
  // =========================
  const playlist = document.getElementById("playlist");
  const statusText = document.getElementById("statusText");

  // =========================
  // Variables
  // =========================
  let media = [];
  let current = -1;
  let slideTimer = null;
  const imageDuration = document.getElementById("imageDuration");
  let imageTime = 5000; // डिफ़ॉल्ट 5 सेकंड

  // यूज़र ने वीडियो को Unmute किया है या नहीं — यह याद रखा जाएगा
  // ताकि अगली हर वीडियो पर यही स्थिति लागू हो (सिर्फ़ पहली वीडियो
  // हमेशा browser की autoplay policy की वजह से muted शुरू होगी)
  let userWantsSound = false;

  // पिछली object URL को याद रखते हैं ताकि मीडिया बदलते समय उसे
  // हटा (revoke) सकें और memory leak न हो
  let currentObjectUrl = null;

  // =========================
  // IndexedDB (असली फ़ाइलें सेव करने के लिए)
  // =========================
  const DB_NAME = "DSS_DB";
  const DB_VERSION = 1;
  const STORE_NAME = "playlist";
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
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

  async function savePlaylistToDB(files) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.clear(); // पुराना playlist हटाकर नया सेव करेंगे
      files.forEach((file) => {
        store.add({ name: file.name, type: file.type, blob: file });
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

  // पेज खुलते ही पहले से सेव प्लेलिस्ट अपने आप लोड करें
  (async function autoLoadOnStart() {
    try {
      const rows = await loadPlaylistFromDB();
      if (rows.length > 0) {
        media = rows.map((row) => new File([row.blob], row.name, { type: row.type }));
        refreshPlaylist();
        statusText.textContent = `Playlist loaded (${media.length} items)`;
      }
    } catch (err) {
      console.error("पुरानी playlist लोड नहीं हो सकी:", err);
    }
  })();

  // =========================
  // Add Media
  // =========================
  addBtn.addEventListener("click", () => {
    filePicker.click();
  });

  filePicker.addEventListener("change", (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      media.push(file);
    });
    refreshPlaylist();
    if (current === -1 && media.length > 0) {
      show(0);
    }
    filePicker.value = ""; // ताकि वही फ़ाइल दोबारा चुनने पर भी change event चले
  });

  // =========================
  // Show Media
  // =========================
  function show(index) {
    clearTimeout(slideTimer);

    if (index < 0 || index >= media.length) return;

    current = index;
    const file = media[current];

    welcome.style.display = "none";
    imagePlayer.style.display = "none";
    videoPlayer.style.display = "none";
    videoPlayer.pause();

    // पुरानी object URL को हटाएं ताकि memory leak न हो
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
    }
    const url = URL.createObjectURL(file);
    currentObjectUrl = url;

    document.querySelectorAll("#playlist li").forEach((item, i) => {
      item.classList.toggle("active", i === current);
    });

    if (file.type.startsWith("image")) {
      imagePlayer.src = url;
      imagePlayer.style.display = "block";
      statusText.textContent = `Image ${current + 1} / ${media.length}`;
      slideTimer = setTimeout(nextMedia, imageTime);
    } else {
      videoPlayer.src = url;
      videoPlayer.style.display = "block";

      // पहली बार autoplay policy के कारण muted रखना ज़रूरी है,
      // लेकिन अगर यूज़र पहले Unmute कर चुका है तो वही स्थिति बनाए रखें
      videoPlayer.muted = !userWantsSound;

      statusText.textContent = `Video ${current + 1} / ${media.length}`;
      videoPlayer.load();
      videoPlayer.play().catch(() => {
        // अगर unmuted autoplay ब्राउज़र ने रोक दिया, तो mute करके फिर कोशिश करें
        videoPlayer.muted = true;
        videoPlayer.play();
      });

      muteBtn.textContent = videoPlayer.muted ? "🔇 Mute" : "🔊 Unmute";
    }
  }
  // =========================
  // Refresh Playlist
  // =========================
  function refreshPlaylist() {
    playlist.innerHTML = "";

    media.forEach((file, index) => {
      const li = document.createElement("li");
      li.className = "playlistItem";

      const title = document.createElement("span");
      title.className = "title";
      title.textContent = file.name;
      title.addEventListener("click", () => {
        show(index);
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
          if (current >= media.length) {
            current = media.length - 1;
          }
          if (current >= 0) {
            show(current);
          }
        }
        refreshPlaylist();
      });

      li.appendChild(title);
      li.appendChild(deleteBtn);
      playlist.appendChild(li);
    });
  }

  // =========================
  // Next
  // =========================
  function nextMedia() {
    if (media.length === 0) return;
    current++;
    if (current >= media.length) {
      current = 0;
    }
    show(current);
  }

  // =========================
  // Previous
  // =========================
  function prevMedia() {
    if (media.length === 0) return;
    current--;
    if (current < 0) {
      current = media.length - 1;
    }
    show(current);
  }

  // =========================
  // Buttons
  // =========================
  playBtn.addEventListener("click", () => {
    if (videoPlayer.style.display === "block") {
      videoPlayer.play();
    }
  });

  pauseBtn.addEventListener("click", () => {
    if (videoPlayer.style.display === "block") {
      videoPlayer.pause();
    }
  });

  nextBtn.addEventListener("click", () => {
    nextMedia();
  });

  prevBtn.addEventListener("click", () => {
    prevMedia();
  });

  // =========================
  // Auto Next Video
  // =========================
  videoPlayer.addEventListener("ended", () => {
    nextMedia();
  });

  // =========================
  // Load Playlist (अब पुराने "फिर से चुनो" तरीके की जगह
  // सीधे IndexedDB से पहले से सेव प्लेलिस्ट लोड होती है)
  // =========================
  loadBtn.addEventListener("click", async () => {
    try {
      const rows = await loadPlaylistFromDB();
      if (rows.length === 0) {
        alert("कोई सेव की हुई Playlist नहीं मिली");
        return;
      }
      media = rows.map((row) => new File([row.blob], row.name, { type: row.type }));
      refreshPlaylist();
      current = -1;
      show(0);
      alert("✅ Playlist Loaded Successfully");
    } catch (err) {
      console.error(err);
      alert("Playlist लोड नहीं हो सकी");
    }
  });

  // =========================
  // Save Playlist (अब असली फ़ाइलें IndexedDB में सेव होती हैं,
  // सिर्फ़ नाम नहीं — इसलिए Load करने पर मीडिया वापस मिलेगा)
  // =========================
  saveBtn.addEventListener("click", async () => {
    if (media.length === 0) {
      alert("Playlist is empty!");
      return;
    }
    try {
      await savePlaylistToDB(media);
      alert("✅ Playlist Saved Successfully");
    } catch (err) {
      console.error(err);
      alert("Playlist सेव नहीं हो सकी");
    }
  });

  // =========================
  // Presentation Mode (अब असली Fullscreen API के साथ)
  // =========================
  const exitBtn = document.getElementById("exitPresentationBtn");
  const fullBtn = document.getElementById("fullscreenBtn");
  let hideTimer = null;

  function showExitButton() {
    exitBtn.style.display = "inline-block";
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      exitBtn.style.display = "none";
    }, 4000); // 4 सेकंड बाद छिप जाएगा
  }

  function enterPresentation() {
    document.body.classList.add("presentation-mode");
    const el = document.documentElement;
    const request = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (request) {
      request.call(el).catch(() => {
        // कुछ ब्राउज़र/डिवाइस असली fullscreen की इजाज़त नहीं देते,
        // उस स्थिति में सिर्फ़ CSS presentation-mode ही काम करेगा
      });
    }
    showExitButton();
  }

  function exitPresentation() {
    document.body.classList.remove("presentation-mode");
    exitBtn.style.display = ""; // रीसेट
    clearTimeout(hideTimer);
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document).catch(() => {});
    }
  }

  fullBtn.addEventListener("click", enterPresentation);
  exitBtn.addEventListener("click", exitPresentation);

  // अगर यूज़र Esc दबाकर या सिस्टम जेस्चर से fullscreen से बाहर आ जाए,
  // तो presentation-mode भी अपने आप हट जाए
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) {
      document.body.classList.remove("presentation-mode");
      clearTimeout(hideTimer);
    }
  });

  // स्क्रीन पर टैप करने से Exit बटन फिर से दिखे
  document.querySelector(".screen").addEventListener("click", function () {
    if (document.body.classList.contains("presentation-mode")) {
      showExitButton();
    }
  });

  // इमेज ड्यूरेशन बदलना
  imageDuration.addEventListener("change", function () {
    imageTime = Number(imageDuration.value) * 1000;
  });

  // =========================
  // Mute / Unmute
  // (अब यह स्थिति अगली सभी videos पर भी लागू रहेगी)
  // =========================
  muteBtn.addEventListener("click", function () {
    if (videoPlayer.muted) {
      videoPlayer.muted = false;
      userWantsSound = true;
      muteBtn.textContent = "🔊 Unmute";
    } else {
      videoPlayer.muted = true;
      userWantsSound = false;
      muteBtn.textContent = "🔇 Mute";
    }
  });

  // =========================
  // Clock
  // =========================
  function updateClock() {
    const now = new Date();

    const time = now.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const date = now.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const clock = document.getElementById("clock");
    if (clock) {
      clock.textContent = time + " | " + date;
    }
  }

  updateClock();
  setInterval(updateClock, 1000);

  // =========================
  // Ticker Text
  // =========================
  const tickerInput = document.getElementById("tickerInput");
  const tickerText = document.getElementById("tickerText");
  const tickerSaveBtn = document.getElementById("tickerSaveBtn");

  // पहले से सेव किया हुआ मैसेज लोड करें
  const savedTicker = localStorage.getItem("DSS_TICKER");
  if (savedTicker) {
    tickerText.textContent = savedTicker;
    tickerInput.value = savedTicker;
  }

  tickerSaveBtn.addEventListener("click", function () {
    const message = tickerInput.value.trim();
    if (message === "") {
      alert("कृपया कुछ लिखें");
      return;
    }
    tickerText.textContent = message;
    localStorage.setItem("DSS_TICKER", message);
    alert("✅ Ticker सेव हो गया");
  });

});
