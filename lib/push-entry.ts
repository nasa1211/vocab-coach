export type PushKey = {
  slot: number | null;
  word: string | null;
};

export type AcceptedPush = PushKey & { at: number };

export function isDuplicatePush(
  previous: AcceptedPush | null,
  entry: PushKey,
  now: number,
  windowMs = 5000,
): boolean {
  if (!previous) return false;
  return previous.slot === entry.slot && previous.word === entry.word && now - previous.at <= windowMs;
}

type QuizLike = {
  aboutSlot: number;
  destinationSlot: number;
  source?: string;
};

export function sameQuiz(a: QuizLike | null | undefined, b: QuizLike | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  return a.aboutSlot === b.aboutSlot && a.destinationSlot === b.destinationSlot && a.source === b.source;
}
