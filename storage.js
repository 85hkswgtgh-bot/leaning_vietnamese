export const STORAGE_KEY = "viet-quick-history-v1";
export const SETTINGS_KEY = "viet-quick-settings-v1";
export const BACKUP_VERSION = 1;

const defaultStore = () => globalThis.localStorage;

export function emptyDirectionStats() {
  return { shown: 0, correct: 0, incorrect: 0 };
}

export function createEmptyRecord() {
  return {
    shown: 0,
    correct: 0,
    incorrect: 0,
    lastAnsweredAt: null,
    needsReview: false,
    directions: {
      "ja-vi": emptyDirectionStats(),
      "vi-ja": emptyDirectionStats(),
    },
  };
}

export function loadHistory(store = defaultStore()) {
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveHistory(history, store = defaultStore()) {
  store.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function recordHistoryAnswer(
  history,
  { wordId, direction, correct },
  store = defaultStore(),
) {
  const record = structuredClone(history[wordId] ?? createEmptyRecord());
  const directionStats = record.directions[direction] ?? emptyDirectionStats();
  record.shown += 1;
  record.correct += correct ? 1 : 0;
  record.incorrect += correct ? 0 : 1;
  record.lastAnsweredAt = new Date().toISOString();
  record.needsReview = !correct;
  directionStats.shown += 1;
  directionStats.correct += correct ? 1 : 0;
  directionStats.incorrect += correct ? 0 : 1;
  record.directions[direction] = directionStats;
  history[wordId] = record;
  saveHistory(history, store);
  return record;
}

export function clearHistory(store = defaultStore()) {
  store.removeItem(STORAGE_KEY);
}

export function exportHistory(history) {
  return JSON.stringify(
    {
      app: "ベト単",
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      history,
    },
    null,
    2,
  );
}

function isDirectionStats(value) {
  return (
    value &&
    Number.isInteger(value.shown) &&
    Number.isInteger(value.correct) &&
    Number.isInteger(value.incorrect) &&
    value.shown >= 0 &&
    value.correct >= 0 &&
    value.incorrect >= 0
  );
}

function isHistoryRecord(value) {
  return (
    value &&
    Number.isInteger(value.shown) &&
    Number.isInteger(value.correct) &&
    Number.isInteger(value.incorrect) &&
    typeof value.needsReview === "boolean" &&
    value.directions &&
    isDirectionStats(value.directions["ja-vi"]) &&
    isDirectionStats(value.directions["vi-ja"])
  );
}

export function importHistory(text, validWordIds, store = defaultStore()) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("JSONの形式が正しくありません。");
  }
  if (
    !parsed ||
    parsed.app !== "ベト単" ||
    parsed.version !== BACKUP_VERSION ||
    !parsed.history ||
    typeof parsed.history !== "object"
  ) {
    throw new Error("このアプリの履歴バックアップではありません。");
  }

  const clean = {};
  for (const [wordId, record] of Object.entries(parsed.history)) {
    if (!validWordIds.has(wordId)) continue;
    if (!isHistoryRecord(record)) {
      throw new Error(`履歴「${wordId}」の内容が正しくありません。`);
    }
    clean[wordId] = record;
  }
  saveHistory(clean, store);
  return clean;
}

export function loadSettings(store = defaultStore()) {
  try {
    return {
      inputMode: false,
      ...JSON.parse(store.getItem(SETTINGS_KEY) ?? "{}"),
    };
  } catch {
    return { inputMode: false };
  }
}

export function saveSettings(settings, store = defaultStore()) {
  store.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
