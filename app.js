import {
  DIRECTIONS,
  buildSession,
  currentItem,
  judgeVietnamese,
  recordAnswer,
  sessionSummary,
} from "./quiz.js";
import {
  clearHistory,
  exportHistory,
  importHistory,
  loadHistory,
  loadSettings,
  recordHistoryAnswer,
  saveSettings,
} from "./storage.js";

const elements = Object.fromEntries(
  [...document.querySelectorAll("[id]")].map((element) => [element.id, element]),
);
const screens = [
  elements["home-screen"],
  elements["quiz-screen"],
  elements["results-screen"],
  elements["settings-screen"],
];

let words = [];
let history = loadHistory();
let settings = loadSettings();
let session = null;
let lastOptions = null;
let pendingInputResult = null;
let waitingWorker = null;

function showScreen(target) {
  screens.forEach((screen) => {
    screen.hidden = screen !== target;
  });
  window.scrollTo({ top: 0, behavior: "instant" });
  elements.app.focus({ preventScroll: true });
}

function showHome() {
  session = null;
  renderHomeStats();
  showScreen(elements["home-screen"]);
}

function renderHomeStats() {
  const records = Object.values(history);
  const shown = records.reduce((total, record) => total + (record.shown ?? 0), 0);
  const correct = records.reduce((total, record) => total + (record.correct ?? 0), 0);
  elements["stat-learned"].textContent = records.filter((record) => record.shown > 0).length;
  elements["stat-review"].textContent = records.filter((record) => record.needsReview).length;
  elements["stat-accuracy"].textContent = shown ? `${Math.round((correct / shown) * 100)}%` : "—";
}

function readStudyOptions() {
  const form = new FormData(elements["study-form"]);
  return {
    set: form.get("set"),
    direction: form.get("direction"),
    order: form.get("order"),
    count: form.get("count"),
    priorityMistakes: form.get("priorityMistakes") === "on",
  };
}

function startSession(options, sourceWords = words) {
  session = buildSession(sourceWords, options, history);
  lastOptions = { ...options };
  if (!session.originalCount) {
    window.alert("この条件で出題できる単語がありません。");
    return;
  }
  showScreen(elements["quiz-screen"]);
  renderQuestion();
}

function renderQuestion() {
  const item = currentItem(session);
  if (!item) {
    renderResults();
    return;
  }

  pendingInputResult = null;
  const isJaToVi = item.direction === DIRECTIONS.JA_TO_VI;
  const useInput = settings.inputMode && isJaToVi;
  const currentNumber = session.cursor + 1;
  const totalNow = session.queue.length;

  elements["quiz-progress-text"].textContent = `${currentNumber} / ${totalNow}`;
  elements["quiz-progress"].style.width = `${Math.min(100, (session.cursor / totalNow) * 100)}%`;
  elements["retry-label"].hidden = !item.isRetry;
  elements["direction-label"].textContent = isJaToVi
    ? "日本語をベトナム語に"
    : "ベトナム語を日本語に";
  elements["quiz-heading"].textContent = isJaToVi
    ? item.word.displayJapanese
    : item.word.displayVietnamese;
  elements["quiz-heading"].lang = isJaToVi ? "ja" : "vi";
  elements["question-note"].hidden = true;
  elements["answer-area"].hidden = true;
  elements["answer-note"].hidden = true;
  elements["judge-message"].hidden = true;
  elements["judge-message"].className = "judge-message";
  elements["grade-buttons"].hidden = true;
  elements["reveal-button"].hidden = false;

  elements["input-answer-form"].hidden = !useInput;
  elements["self-grade-actions"].hidden = useInput;
  elements["input-next-actions"].hidden = true;
  elements["answer-input"].value = "";
  elements["answer-input"].disabled = false;
  if (useInput) {
    requestAnimationFrame(() => elements["answer-input"].focus());
  }
}

function revealAnswer() {
  const item = currentItem(session);
  if (!item) return;
  const isJaToVi = item.direction === DIRECTIONS.JA_TO_VI;
  elements["answer-text"].textContent = isJaToVi
    ? item.word.displayVietnamese
    : item.word.displayJapanese;
  elements["answer-text"].lang = isJaToVi ? "vi" : "ja";
  elements["answer-area"].hidden = false;
  elements["reveal-button"].hidden = true;
  elements["grade-buttons"].hidden = false;
  if (item.word.note) {
    elements["answer-note"].textContent = item.word.note;
    elements["answer-note"].hidden = false;
  }
}

function commitAnswer(correct) {
  const item = currentItem(session);
  if (!item) return;
  recordHistoryAnswer(history, {
    wordId: item.word.id,
    direction: item.direction,
    correct,
  });
  recordAnswer(session, correct);
  renderQuestion();
}

function judgeTypedAnswer(event) {
  event.preventDefault();
  if (pendingInputResult) return;
  const item = currentItem(session);
  const result = judgeVietnamese(elements["answer-input"].value, item.word.acceptedVietnamese);
  elements["judge-message"].textContent = result.message;
  elements["judge-message"].className = `judge-message ${result.status}`;
  elements["judge-message"].hidden = false;
  if (result.status === "empty") return;

  pendingInputResult = result.status === "correct";
  elements["answer-input"].disabled = true;
  elements["answer-area"].hidden = false;
  elements["answer-text"].textContent = item.word.displayVietnamese;
  elements["answer-text"].lang = "vi";
  if (item.word.note) {
    elements["answer-note"].textContent = item.word.note;
    elements["answer-note"].hidden = false;
  }
  elements["input-next-actions"].hidden = false;
}

function commitTypedAnswer() {
  if (pendingInputResult === null) return;
  commitAnswer(pendingInputResult);
}

function renderResults() {
  const summary = sessionSummary(session);
  const missedWords = summary.missedIds
    .map((id) => words.find((word) => word.id === id))
    .filter(Boolean);
  elements["result-rate"].textContent = `${summary.firstRate}%`;
  elements["result-total"].textContent = `${summary.total}問`;
  elements["result-correct"].textContent = `${summary.firstCorrect}問`;
  elements["result-retry"].textContent = summary.retryTotal
    ? `${summary.retryCorrect} / ${summary.retryTotal}`
    : "なし";
  elements["missed-list"].replaceChildren(
    ...missedWords.map((word) => {
      const item = document.createElement("li");
      const vietnamese = document.createElement("span");
      vietnamese.lang = "vi";
      vietnamese.textContent = word.displayVietnamese;
      const japanese = document.createElement("span");
      japanese.lang = "ja";
      japanese.textContent = word.displayJapanese;
      item.append(vietnamese, japanese);
      return item;
    }),
  );
  elements["missed-card"].hidden = missedWords.length === 0;
  elements["review-button"].hidden = missedWords.length === 0;
  elements["review-button"].dataset.wordIds = summary.missedIds.join(",");
  renderHomeStats();
  showScreen(elements["results-screen"]);
}

function showSettings() {
  elements["input-mode-toggle"].checked = settings.inputMode;
  elements["settings-word-count"].textContent = words.length || "—";
  elements["settings-message"].hidden = true;
  showScreen(elements["settings-screen"]);
}

function showSettingsMessage(message, isError = false) {
  elements["settings-message"].textContent = message;
  elements["settings-message"].style.color = isError ? "var(--red)" : "";
  elements["settings-message"].hidden = false;
}

function downloadHistory() {
  const blob = new Blob([exportHistory(history)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `ベト単-学習履歴-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  showSettingsMessage("学習履歴を書き出しました。");
}

async function restoreHistory(event) {
  const [file] = event.target.files;
  if (!file) return;
  try {
    const text = await file.text();
    history = importHistory(text, new Set(words.map((word) => word.id)));
    renderHomeStats();
    showSettingsMessage("学習履歴を復元しました。");
  } catch (error) {
    showSettingsMessage(error.message, true);
  } finally {
    event.target.value = "";
  }
}

function updateNetworkStatus() {
  const online = navigator.onLine;
  elements["network-status"].textContent = online ? "オンライン" : "オフライン";
  elements["network-status"].classList.toggle("offline", !online);
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  const registration = await navigator.serviceWorker.register("./sw.js");
  if (registration.waiting) {
    waitingWorker = registration.waiting;
    elements["update-banner"].hidden = false;
  }
  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    worker?.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        waitingWorker = worker;
        elements["update-banner"].hidden = false;
      }
    });
  });
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  });
}

elements["study-form"].addEventListener("submit", (event) => {
  event.preventDefault();
  startSession(readStudyOptions());
});
elements["reveal-button"].addEventListener("click", revealAnswer);
elements["correct-button"].addEventListener("click", () => commitAnswer(true));
elements["wrong-button"].addEventListener("click", () => commitAnswer(false));
elements["input-answer-form"].addEventListener("submit", judgeTypedAnswer);
elements["input-next-button"].addEventListener("click", commitTypedAnswer);
elements["quit-button"].addEventListener("click", () => {
  if (window.confirm("学習を終了してホームへ戻りますか？")) showHome();
});
elements["home-button"].addEventListener("click", showHome);
elements["results-home-button"].addEventListener("click", showHome);
elements["settings-button"].addEventListener("click", showSettings);
elements["settings-close-button"].addEventListener("click", showHome);
elements["again-button"].addEventListener("click", () => startSession(lastOptions));
elements["review-button"].addEventListener("click", () => {
  const ids = new Set(elements["review-button"].dataset.wordIds.split(","));
  const reviewWords = words.filter((word) => ids.has(word.id));
  startSession(
    { ...lastOptions, set: "all", count: "all", priorityMistakes: false },
    reviewWords,
  );
});
elements["input-mode-toggle"].addEventListener("change", (event) => {
  settings.inputMode = event.target.checked;
  saveSettings(settings);
  showSettingsMessage(settings.inputMode ? "入力判定モードを有効にしました。" : "自己採点モードに戻しました。");
});
elements["export-button"].addEventListener("click", downloadHistory);
elements["import-input"].addEventListener("change", restoreHistory);
elements["reset-button"].addEventListener("click", () => elements["reset-dialog"].showModal());
elements["reset-dialog"].addEventListener("close", () => {
  if (elements["reset-dialog"].returnValue !== "confirm") return;
  clearHistory();
  history = {};
  renderHomeStats();
  showSettingsMessage("学習履歴を初期化しました。");
});
elements["update-button"].addEventListener("click", () => {
  waitingWorker?.postMessage({ type: "SKIP_WAITING" });
});
window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);

async function initialize() {
  updateNetworkStatus();
  try {
    const response = await fetch("./data/words.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    words = await response.json();
    elements["word-count"].textContent = `${words.length}枚のカードを収録`;
    elements["settings-word-count"].textContent = words.length;
    renderHomeStats();
  } catch {
    elements["word-count"].textContent =
      "単語データを読み込めませんでした。ページを再読み込みしてください。";
    elements["study-form"].querySelector('button[type="submit"]').disabled = true;
  }
  registerServiceWorker().catch(() => {
    // 学習機能は継続し、次回読み込み時に再登録する。
  });
}

initialize();
