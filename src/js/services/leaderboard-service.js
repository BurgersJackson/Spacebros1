/**
 * Leaderboard Service - Handles high score submission and retrieval
 * Supports both local (offline) and online (JSONBin.io) modes
 *
 * DEFAULT: Offline mode - scores saved locally only
 * ONLINE: Scores saved to JSONBin.io (free tier: 10K storage, unlimited bins)
 */

const LEADERBOARD_API_BASE = "https://api.jsonbin.io/v3";
const CACHE_DURATION_MS = 30000;

const HARDCODED_MASTER_KEY = "$2a$10$SmUD1DkzpIWPFBXO6REwMedbclZ2aufZgVr5t9J3WOK5rNCp.WaPW";
const HARDCODED_BIN_IDS = {
  1: "699e819743b1c97be99b8add",
  2: "699e822b43b1c97be99b8c74",
  3: "699e8242ae596e708f475a51"
};

const ONLINE_MODE_KEY = "spacebros_leaderboard_online_mode";

let _showNameEntryModal = null;
let _showLeaderboardScreen = null;

let onlineMode = false;
const leaderboardCache = {
  1: { data: null, timestamp: 0 },
  2: { data: null, timestamp: 0 },
  3: { data: null, timestamp: 0 }
};

export function registerLeaderboardDependencies(deps) {
  if (deps.showNameEntryModal) _showNameEntryModal = deps.showNameEntryModal;
  if (deps.showLeaderboardScreen) _showLeaderboardScreen = deps.showLeaderboardScreen;
  loadOnlineModeFromStorage();
}

function loadOnlineModeFromStorage() {
  try {
    const stored = localStorage.getItem(ONLINE_MODE_KEY);
    onlineMode = stored === "true";
  } catch (e) {
    onlineMode = false;
  }
}

export function isOnlineMode() {
  return onlineMode;
}

export async function toggleOnlineMode() {
  onlineMode = !onlineMode;
  try {
    localStorage.setItem(ONLINE_MODE_KEY, String(onlineMode));
  } catch (e) {}

  if (onlineMode) {
    console.log("[LEADERBOARD] Switched to ONLINE mode - syncing local scores...");
    await syncLocalScoresToOnline();
  } else {
    console.log("[LEADERBOARD] Switched to OFFLINE mode");
  }

  return onlineMode;
}

export async function syncLocalScoresToOnline() {
  for (let level = 1; level <= 3; level++) {
    try {
      const localScores = getLocalLeaderboardRaw(level);
      if (localScores.length === 0) continue;

      const onlineResult = await getOnlineLeaderboard(level);
      const onlineScores = onlineResult.data || [];

      const lowestOnlineScore =
        onlineScores.length > 0 ? onlineScores[onlineScores.length - 1].score : 0;

      for (const localEntry of localScores) {
        if (onlineScores.length < 100 || localEntry.score > lowestOnlineScore) {
          console.log(
            `[LEADERBOARD] Syncing score ${localEntry.score} by ${localEntry.name} (level ${level})`
          );
          await submitScoreOnline(level, localEntry.name, localEntry.score, true);
        }
      }

      clearLocalLeaderboard(level);
      leaderboardCache[level] = { data: null, timestamp: 0 };
    } catch (e) {
      console.error(`[LEADERBOARD] Failed to sync level ${level}:`, e);
    }
  }
}

function getBinId(level) {
  return HARDCODED_BIN_IDS[level];
}

export async function submitScore(level, playerName, score) {
  const sanitizedName = sanitizePlayerName(playerName);

  if (!sanitizedName || score <= 0) {
    console.warn("[LEADERBOARD] Invalid submission:", { name: sanitizedName, score });
    return { success: false, error: "Invalid data" };
  }

  if (!onlineMode) {
    console.log("[LEADERBOARD] Offline mode - saving locally");
    saveToLocalLeaderboard(level, sanitizedName, score);
    return { success: true, offline: true };
  }

  return submitScoreOnline(level, sanitizedName, score, false);
}

async function submitScoreOnline(level, playerName, score, isSync = false) {
  const binId = getBinId(level);

  try {
    const currentData = await getLeaderboardData(binId);

    let entries = currentData.entries || [];
    const existingIndex = entries.findIndex(e => e.name === playerName);
    if (existingIndex >= 0) {
      entries[existingIndex].score = Math.max(entries[existingIndex].score, Math.floor(score));
    } else {
      entries.push({
        name: playerName,
        score: Math.floor(score),
        timestamp: Date.now()
      });
    }

    entries.sort((a, b) => b.score - a.score);
    entries = entries.slice(0, 100);

    const response = await fetch(`${LEADERBOARD_API_BASE}/b/${binId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": HARDCODED_MASTER_KEY
      },
      body: JSON.stringify({ entries, level, game: "spacebros1" })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[LEADERBOARD] Submit failed:", response.status, errorText);
      if (!isSync) {
        saveToLocalLeaderboard(level, playerName, score);
      }
      return { success: false, error: errorText, offline: true };
    }

    leaderboardCache[level] = { data: null, timestamp: 0 };

    console.log("[LEADERBOARD] Score submitted to online successfully");
    return { success: true };
  } catch (error) {
    console.error("[LEADERBOARD] Network error:", error);
    if (!isSync) {
      saveToLocalLeaderboard(level, playerName, score);
    }
    return { success: false, error: error.message, offline: true };
  }
}

export async function getLeaderboard(level, forceRefresh = false) {
  const now = Date.now();

  if (
    !forceRefresh &&
    leaderboardCache[level].data &&
    now - leaderboardCache[level].timestamp < CACHE_DURATION_MS
  ) {
    return { success: true, data: leaderboardCache[level].data, cached: true, online: onlineMode };
  }

  if (!onlineMode) {
    const localData = getLocalLeaderboard(level);
    return { success: true, data: localData, cached: false, online: false };
  }

  return getOnlineLeaderboard(level, forceRefresh);
}

async function getOnlineLeaderboard(level, forceRefresh = false) {
  const binId = getBinId(level);
  const now = Date.now();

  try {
    const data = await getLeaderboardData(binId);

    const entries = (data.entries || []).map((entry, index) => ({
      rank: index + 1,
      name: entry.name || "Unknown",
      score: entry.score || 0
    }));

    leaderboardCache[level] = { data: entries, timestamp: now };

    return { success: true, data: entries, cached: false, online: true };
  } catch (error) {
    console.error("[LEADERBOARD] Network error:", error);
    const localData = getLocalLeaderboard(level);
    return { success: false, error: error.message, data: localData, offline: true, online: false };
  }
}

async function getLeaderboardData(binId) {
  const response = await fetch(`${LEADERBOARD_API_BASE}/b/${binId}/latest`, {
    method: "GET",
    headers: {
      "X-Master-Key": HARDCODED_MASTER_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard: ${response.status}`);
  }

  const result = await response.json();
  return result.record || result;
}

export async function checkTopTen(level, score) {
  try {
    const result = await getLeaderboard(level);
    const entries = result.data || [];

    if (entries.length < 10) {
      return { isTopTen: true, rank: entries.length + 1 };
    }

    const lowestScore = entries[entries.length - 1].score;
    if (score > lowestScore) {
      const rank = entries.findIndex(e => score > e.score) + 1;
      return { isTopTen: true, rank: Math.min(rank, 10) };
    }

    return { isTopTen: false, rank: null };
  } catch (error) {
    console.error("[LEADERBOARD] Error checking top 10:", error);
    return { isTopTen: true, rank: 1 };
  }
}

export function handleLevelComplete(level, score) {
  checkTopTen(level, score)
    .then(result => {
      if (result.isTopTen && _showNameEntryModal) {
        _showNameEntryModal(level, score, result.rank);
      } else if (_showLeaderboardScreen) {
        _showLeaderboardScreen(level);
      }
    })
    .catch(err => {
      console.error("[LEADERBOARD] Error in handleLevelComplete:", err);
      if (_showLeaderboardScreen) {
        _showLeaderboardScreen(level);
      }
    });
}

function sanitizePlayerName(name) {
  if (!name || typeof name !== "string") return "";
  return name
    .trim()
    .substring(0, 15)
    .replace(/[<>\"'&]/g, "");
}

const LOCAL_LEADERBOARD_KEY = "spacebros_local_leaderboard";

function saveToLocalLeaderboard(level, playerName, score) {
  try {
    const stored = localStorage.getItem(LOCAL_LEADERBOARD_KEY);
    const data = stored ? JSON.parse(stored) : { 1: [], 2: [], 3: [] };

    if (!data[level]) data[level] = [];

    const existingIndex = data[level].findIndex(e => e.name === playerName);
    if (existingIndex >= 0) {
      data[level][existingIndex].score = Math.max(
        data[level][existingIndex].score,
        Math.floor(score)
      );
    } else {
      data[level].push({ name: playerName, score: Math.floor(score), date: Date.now() });
    }

    data[level].sort((a, b) => b.score - a.score);
    data[level] = data[level].slice(0, 50);

    localStorage.setItem(LOCAL_LEADERBOARD_KEY, JSON.stringify(data));
    console.log("[LEADERBOARD] Saved to local storage");
  } catch (e) {
    console.warn("[LEADERBOARD] Failed to save local leaderboard:", e);
  }
}

function getLocalLeaderboardRaw(level) {
  try {
    const stored = localStorage.getItem(LOCAL_LEADERBOARD_KEY);
    if (!stored) return [];
    const data = JSON.parse(stored);
    return data[level] || [];
  } catch (e) {
    return [];
  }
}

function getLocalLeaderboard(level) {
  const raw = getLocalLeaderboardRaw(level);
  return raw.map((entry, index) => ({
    rank: index + 1,
    name: entry.name,
    score: entry.score
  }));
}

function clearLocalLeaderboard(level) {
  try {
    const stored = localStorage.getItem(LOCAL_LEADERBOARD_KEY);
    const data = stored ? JSON.parse(stored) : { 1: [], 2: [], 3: [] };
    data[level] = [];
    localStorage.setItem(LOCAL_LEADERBOARD_KEY, JSON.stringify(data));
  } catch (e) {}
}

export function clearLeaderboardCache() {
  leaderboardCache[1] = { data: null, timestamp: 0 };
  leaderboardCache[2] = { data: null, timestamp: 0 };
  leaderboardCache[3] = { data: null, timestamp: 0 };
}

const PLAYER_NAME_KEY = "spacebros_player_name";

export function getSavedPlayerName() {
  try {
    return localStorage.getItem(PLAYER_NAME_KEY) || "";
  } catch (e) {
    return "";
  }
}

export function savePlayerName(name) {
  try {
    localStorage.setItem(PLAYER_NAME_KEY, name);
  } catch (e) {
    console.warn("[LEADERBOARD] Failed to save player name:", e);
  }
}

export function configureLeaderboard(config) {
  console.log("[LEADERBOARD] configureLeaderboard() is deprecated - keys are now hardcoded");
  console.log("[LEADERBOARD] Use toggleOnlineMode() to switch between offline/online");
}
