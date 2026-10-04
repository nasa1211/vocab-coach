export type QuizResult = {
  slot: number;
  selected: number;
  correct: boolean;
};

export type DeviceProgress = {
  opened: Record<string, number[]>;
  quizzed: Record<string, number[]>;
  finished: Record<string, number[]>;
  quizResults: Record<string, QuizResult[]>;
};

export function emptyProgress(): DeviceProgress {
  return { opened: {}, quizzed: {}, finished: {}, quizResults: {} };
}

export function hasProgress(progress: DeviceProgress) {
  return [progress.opened, progress.quizzed, progress.finished, progress.quizResults].some(
    (days) => Object.keys(days).length > 0,
  );
}

export function claimLegacyProgress(
  devices: Record<string, DeviceProgress>,
  legacy: DeviceProgress,
  legacyClaimed: boolean,
  deviceId: string,
) {
  if (legacyClaimed) {
    if (devices[deviceId]) return { devices, legacy, legacyClaimed, changed: false };
    return {
      devices: { ...devices, [deviceId]: emptyProgress() },
      legacy,
      legacyClaimed,
      changed: true,
    };
  }

  const nextDevices = { ...devices };
  if (!nextDevices[deviceId]) {
    nextDevices[deviceId] = hasProgress(legacy) ? legacy : emptyProgress();
  }
  return {
    devices: nextDevices,
    legacy: emptyProgress(),
    legacyClaimed: true,
    changed: true,
  };
}

export function markDeviceSlot(
  progress: DeviceProgress,
  field: "opened" | "quizzed" | "finished",
  date: string,
  slot: number,
) {
  const marks = new Set(progress[field][date] ?? []);
  if (marks.has(slot)) return false;
  marks.add(slot);
  progress[field][date] = [...marks];
  return true;
}

export function saveDeviceQuiz(
  progress: DeviceProgress,
  date: string,
  slot: number,
  selected: number,
  optionCount: number,
  answerIndex: number,
) {
  if (!Number.isInteger(selected) || selected < 0 || selected >= optionCount) return null;
  const results = progress.quizResults[date] ?? [];
  const existing = results.find((item) => item.slot === slot);
  if (existing) return { result: existing, changed: false };
  const result = { slot, selected, correct: selected === answerIndex };
  progress.quizResults[date] = [...results, result];
  markDeviceSlot(progress, "quizzed", date, slot);
  return { result, changed: true };
}

export function slotOpened(progress: DeviceProgress, date: string, slot: number) {
  return (progress.opened[date] ?? []).includes(slot);
}

export function quizForSlot(progress: DeviceProgress, date: string, slot: number) {
  return (progress.quizResults[date] ?? []).find((item) => item.slot === slot) ?? null;
}
