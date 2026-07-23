export const DIRECTIONS = {
  JA_TO_VI: "ja-vi",
  VI_TO_JA: "vi-ja",
  MIXED: "mixed",
};

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function normalizeInput(value) {
  return String(value ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("vi");
}

export function removeVietnameseTone(value) {
  return normalizeInput(value)
    .normalize("NFD")
    .replace(/[\u0300\u0301\u0303\u0309\u0323]/g, "")
    .normalize("NFC");
}

export function judgeVietnamese(answer, acceptedAnswers) {
  const normalized = normalizeInput(answer);
  const accepted = acceptedAnswers.map(normalizeInput);

  if (!normalized) {
    return { status: "empty", message: "答えを入力してください。" };
  }
  if (accepted.includes(normalized)) {
    return { status: "correct", message: "正解です。" };
  }
  const withoutTone = removeVietnameseTone(normalized);
  if (accepted.some((candidate) => removeVietnameseTone(candidate) === withoutTone)) {
    return {
      status: "tone",
      message: "声調記号を確認してください。",
    };
  }
  return { status: "incorrect", message: "不正解です。" };
}

export function buildSession(words, options, history = {}, random = Math.random) {
  const selected = words.filter(
    (word) => options.set === "all" || word.set === Number(options.set),
  );

  let ordered = options.order === "random" ? shuffle(selected, random) : [...selected];
  if (options.priorityMistakes) {
    const review = ordered.filter((word) => history[word.id]?.needsReview);
    const other = ordered.filter((word) => !history[word.id]?.needsReview);
    ordered = [...review, ...other];
  }

  const requestedCount =
    options.count === "all" ? ordered.length : Number(options.count);
  const chosen = ordered.slice(0, Math.min(requestedCount, ordered.length));

  const items = chosen.map((word) => ({
    word,
    direction:
      options.direction === DIRECTIONS.MIXED
        ? random() < 0.5
          ? DIRECTIONS.JA_TO_VI
          : DIRECTIONS.VI_TO_JA
        : options.direction,
    isRetry: false,
  }));

  return {
    options: { ...options },
    originalCount: items.length,
    queue: items,
    cursor: 0,
    firstResults: new Map(),
    retryResults: new Map(),
    missedIds: new Set(),
  };
}

export function currentItem(session) {
  return session.queue[session.cursor] ?? null;
}

export function recordAnswer(session, correct) {
  const item = currentItem(session);
  if (!item) {
    return null;
  }

  if (item.isRetry) {
    session.retryResults.set(item.word.id, correct);
  } else {
    session.firstResults.set(item.word.id, correct);
    if (!correct) {
      session.missedIds.add(item.word.id);
      session.queue.push({ ...item, isRetry: true });
    }
  }
  session.cursor += 1;
  return item;
}

export function sessionSummary(session) {
  const firstCorrect = [...session.firstResults.values()].filter(Boolean).length;
  const retryCorrect = [...session.retryResults.values()].filter(Boolean).length;
  const retryTotal = session.retryResults.size;
  return {
    total: session.originalCount,
    firstCorrect,
    firstRate:
      session.originalCount === 0
        ? 0
        : Math.round((firstCorrect / session.originalCount) * 100),
    missedIds: [...session.missedIds],
    retryCorrect,
    retryTotal,
  };
}
