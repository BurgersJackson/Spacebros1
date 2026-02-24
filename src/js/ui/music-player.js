const MUSIC_TRACKS = [
  { id: "interstellar-journey", name: "Interstellar Journey", url: "assets/sfx/background1.mp3" },
  { id: "space-dark1", name: "Space Dark 1", url: "assets/music/space dark1.mp3" },
  { id: "space-dark2", name: "Space Dark 2", url: "assets/music/space dark2.mp3" },
  { id: "space-lofi", name: "Space Lofi 1", url: "assets/music/space lofi.mp3" },
  { id: "space-lofi2", name: "Space Lofi 2", url: "assets/music/space lofi2.mp3" },
  { id: "celestial-drift1", name: "Celestial Drift 1", url: "assets/music/Celestial Drift1.mp3" },
  { id: "celestial-drift2", name: "Celestial Drift 2", url: "assets/music/Celestial Drift2.mp3" },
  { id: "dark-chill", name: "Dark Chill", url: "assets/music/dark chill.mp3" },
  { id: "dark-chill1", name: "Dark Chill 1", url: "assets/music/dark chill1.mp3" },
  { id: "dark-chill2", name: "Dark Chill 2", url: "assets/music/dark chill2.mp3" },
  { id: "dark-chill3", name: "Dark Chill 3", url: "assets/music/dark chill3.mp3" },
  { id: "dark-space", name: "Dark Space", url: "assets/music/dark space.mp3" },
  { id: "dark-space2", name: "Dark Space 2", url: "assets/music/dark space2.mp3" }
];

const STORAGE_KEY = "neon_space_music_player_v1";

let currentTrackIndex = 0;
let isPlaying = false;
let isLooping = false;
let isShuffle = true;
let audioElement = null;
let setMusicVolumeRef = null;
let getMusicVolumeRef = null;
let showOverlayMessageRef = null;
let GameContextRef = null;
let updateMenuVisualsRef = null;
let getActiveMenuElementsRef = null;
let setMenuDebounceRef = null;

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (typeof data.currentTrackIndex === "number") {
        currentTrackIndex = Math.max(0, Math.min(MUSIC_TRACKS.length - 1, data.currentTrackIndex));
      }
      if (typeof data.isLooping === "boolean") isLooping = data.isLooping;
      if (typeof data.isShuffle === "boolean") isShuffle = data.isShuffle;
    }
  } catch (_e) {}
}

function saveSettings() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        currentTrackIndex,
        isLooping,
        isShuffle
      })
    );
  } catch (_e) {}
}

export function registerMusicPlayerDependencies(deps) {
  if (deps.setMusicVolume) setMusicVolumeRef = deps.setMusicVolume;
  if (deps.getMusicVolume) getMusicVolumeRef = deps.getMusicVolume;
  if (deps.showOverlayMessage) showOverlayMessageRef = deps.showOverlayMessage;
  if (deps.GameContext) GameContextRef = deps.GameContext;
  if (deps.updateMenuVisuals) updateMenuVisualsRef = deps.updateMenuVisuals;
  if (deps.getActiveMenuElements) getActiveMenuElementsRef = deps.getActiveMenuElements;
  if (deps.setMenuDebounce) setMenuDebounceRef = deps.setMenuDebounce;
}

function createAudioElement() {
  if (audioElement) return audioElement;
  audioElement = new Audio();
  audioElement.preload = "auto";
  audioElement.addEventListener("ended", onTrackEnded);
  return audioElement;
}

function onTrackEnded() {
  if (isLooping) {
    audioElement.currentTime = 0;
    audioElement.play().catch(() => {});
  } else if (isShuffle) {
    playRandomTrack();
  } else {
    playNextTrack();
  }
}

function playTrack(index) {
  if (index < 0 || index >= MUSIC_TRACKS.length) return;
  currentTrackIndex = index;

  const track = MUSIC_TRACKS[currentTrackIndex];
  if (!audioElement) createAudioElement();

  audioElement.src = track.url;
  audioElement.loop = isLooping;

  const volume = getMusicVolumeRef ? getMusicVolumeRef() : 0.5;
  audioElement.volume = volume * 0.5;

  audioElement
    .play()
    .then(() => {
      isPlaying = true;
      updateMusicMenuUI();
    })
    .catch(() => {
      isPlaying = false;
      updateMusicMenuUI();
    });

  saveSettings();
}

export function playCurrentTrack() {
  playTrack(currentTrackIndex);
}

export function pauseTrack() {
  if (audioElement) {
    audioElement.pause();
    isPlaying = false;
    updateMusicMenuUI();
  }
}

export function playNextTrack() {
  if (isShuffle) {
    playRandomTrack();
  } else {
    const nextIndex = (currentTrackIndex + 1) % MUSIC_TRACKS.length;
    playTrack(nextIndex);
  }
}

export function playPrevTrack() {
  if (isShuffle) {
    playRandomTrack();
  } else {
    const prevIndex = (currentTrackIndex - 1 + MUSIC_TRACKS.length) % MUSIC_TRACKS.length;
    playTrack(prevIndex);
  }
}

function playRandomTrack() {
  let randomIndex;
  do {
    randomIndex = Math.floor(Math.random() * MUSIC_TRACKS.length);
  } while (randomIndex === currentTrackIndex && MUSIC_TRACKS.length > 1);
  playTrack(randomIndex);
}

export function toggleLoop() {
  isLooping = !isLooping;
  if (audioElement) {
    audioElement.loop = isLooping;
  }
  updateMusicMenuUI();
  saveSettings();
  if (showOverlayMessageRef) {
    showOverlayMessageRef(isLooping ? "LOOP: ON" : "LOOP: OFF", "#ff0", 1000);
  }
}

export function toggleShuffle() {
  isShuffle = !isShuffle;
  updateMusicMenuUI();
  saveSettings();
  if (showOverlayMessageRef) {
    showOverlayMessageRef(isShuffle ? "SHUFFLE: ON" : "SHUFFLE: OFF", "#ff0", 1000);
  }
}

export function stopMusicPlayer() {
  if (audioElement) {
    audioElement.pause();
    audioElement.currentTime = 0;
  }
  isPlaying = false;
  updateMusicMenuUI();
}

export function getCurrentTrack() {
  return MUSIC_TRACKS[currentTrackIndex];
}

export function getIsPlaying() {
  return isPlaying;
}

export function getIsLooping() {
  return isLooping;
}

export function getIsShuffle() {
  return isShuffle;
}

export function getTracks() {
  return MUSIC_TRACKS;
}

function updateMusicMenuUI() {
  const playPauseBtn = document.getElementById("music-player-play-pause");
  const loopBtn = document.getElementById("music-player-loop");
  const shuffleBtn = document.getElementById("music-player-shuffle");
  const nowPlaying = document.getElementById("music-player-now-playing");

  if (playPauseBtn) {
    playPauseBtn.textContent = isPlaying ? "PAUSE" : "PLAY";
  }

  if (loopBtn) {
    loopBtn.classList.toggle("active", isLooping);
    loopBtn.style.background = isLooping ? "#0f0" : "transparent";
    loopBtn.style.color = isLooping ? "#000" : "#0f0";
  }

  if (shuffleBtn) {
    shuffleBtn.classList.toggle("active", isShuffle);
    shuffleBtn.style.background = isShuffle ? "#0f0" : "transparent";
    shuffleBtn.style.color = isShuffle ? "#000" : "#0f0";
  }

  if (nowPlaying) {
    const track = MUSIC_TRACKS[currentTrackIndex];
    nowPlaying.textContent = isPlaying ? `NOW PLAYING: ${track.name}` : "STOPPED";
  }

  document.querySelectorAll(".music-track-item").forEach((item, idx) => {
    item.classList.toggle("selected", idx === currentTrackIndex && isPlaying);
  });
}

export function showMusicPlayerMenu() {
  const menu = document.getElementById("music-player-menu");
  if (!menu) return;

  const trackList = document.getElementById("music-player-track-list");
  if (trackList) {
    trackList.innerHTML = "";
    MUSIC_TRACKS.forEach((track, idx) => {
      const trackItem = document.createElement("div");
      trackItem.className = "music-track-item";
      if (idx === currentTrackIndex && isPlaying) {
        trackItem.classList.add("selected");
      }
      trackItem.dataset.index = idx;
      trackItem.textContent = track.name;
      trackItem.addEventListener("click", () => {
        playTrack(idx);
      });
      trackList.appendChild(trackItem);
    });
  }

  updateMusicMenuUI();
  menu.style.display = "block";

  if (GameContextRef) {
    GameContextRef.menuSelectionIndex = 0;
  }

  requestAnimationFrame(() => {
    if (setMenuDebounceRef) setMenuDebounceRef(Date.now() + 300);
    const active = getActiveMenuElementsRef ? getActiveMenuElementsRef() : [];
    if (active.length > 0) {
      if (updateMenuVisualsRef) updateMenuVisualsRef(active);
      if (typeof active[0].focus === "function") {
        active[0].focus();
      }
    }
  });
}

export function hideMusicPlayerMenu() {
  const menu = document.getElementById("music-player-menu");
  if (menu) {
    menu.style.display = "none";
  }
}

export function initMusicPlayer() {
  loadSettings();
  createAudioElement();

  const closeBtn = document.getElementById("music-player-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", hideMusicPlayerMenu);
  }

  const playPauseBtn = document.getElementById("music-player-play-pause");
  if (playPauseBtn) {
    playPauseBtn.addEventListener("click", () => {
      if (isPlaying) {
        pauseTrack();
      } else {
        playCurrentTrack();
      }
    });
  }

  const prevBtn = document.getElementById("music-player-prev");
  if (prevBtn) {
    prevBtn.addEventListener("click", playPrevTrack);
  }

  const nextBtn = document.getElementById("music-player-next");
  if (nextBtn) {
    nextBtn.addEventListener("click", playNextTrack);
  }

  const loopBtn = document.getElementById("music-player-loop");
  if (loopBtn) {
    loopBtn.addEventListener("click", toggleLoop);
  }

  const shuffleBtn = document.getElementById("music-player-shuffle");
  if (shuffleBtn) {
    shuffleBtn.addEventListener("click", toggleShuffle);
  }

  const stopBtn = document.getElementById("music-player-stop");
  if (stopBtn) {
    stopBtn.addEventListener("click", stopMusicPlayer);
  }

  setTimeout(() => {
    playRandomTrack();
  }, 500);
}
