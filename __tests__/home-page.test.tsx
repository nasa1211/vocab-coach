// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";
import { getKSTDateString } from "@/lib/kst";
import type { WordCardData } from "@/lib/word-card";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function card(word: string): WordCardData {
  return {
    word,
    phonetic: `/${word}/`,
    meaning: `${word} meaning`,
    category: "business",
    nuance: "neutral",
    example_sentence: `I like to ${word} every day.`,
    example_translation: `나는 매일 ${word} 한다.`,
    speaking_tip: "Stress the first syllable.",
    korean_pronunciation: word,
    quick_quiz: null,
  };
}

function studyResponse() {
  const words = ["alpha", "bravo", "charlie"];
  const slots = words.map((word, index) => ({
    slot: index + 1,
    label: ["아침", "낮", "저녁"][index],
    time: "00:00", // always due, so no push polling is involved
    word,
    opened: false,
    sent: true,
    card: card(word),
  }));
  return {
    studyDate: getKSTDateString(),
    currentSlot: 1,
    slots,
    card: slots[0].card,
    quizzed: [],
    finished: [],
    previousEvening: null,
  };
}

type Listener = (event: MessageEvent) => void;

let fetchMock: ReturnType<typeof vi.fn>;
let swListeners: Set<Listener>;
let errorSpy: ReturnType<typeof vi.spyOn>;

function studyCalls() {
  return fetchMock.mock.calls.filter(([url]) => String(url).split("?")[0] === "/api/study");
}

function json(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: async () => body });
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    const path = url.split("?")[0];
    if (path === "/api/study") return json(studyResponse());
    if (path === "/api/history") return json({ days: [] });
    return json({});
  });
  vi.stubGlobal("fetch", fetchMock);

  swListeners = new Set();
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      controller: {},
      getRegistration: vi.fn(async () => undefined),
      addEventListener: vi.fn((type: string, listener: Listener) => {
        if (type === "message") swListeners.add(listener);
      }),
      removeEventListener: vi.fn((type: string, listener: Listener) => {
        if (type === "message") swListeners.delete(listener);
      }),
    },
  });

  const cacheStore = {
    open: vi.fn(async () => ({
      match: vi.fn(async () => undefined),
      put: vi.fn(async () => undefined),
      delete: vi.fn(async () => false),
    })),
    match: vi.fn(async () => undefined),
    delete: vi.fn(async () => false),
  };
  Object.defineProperty(window, "caches", { configurable: true, value: cacheStore });

  window.matchMedia = vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;

  vi.stubGlobal(
    "Notification",
    Object.assign(vi.fn(), { permission: "default", requestPermission: vi.fn(async () => "default") }),
  );
  vi.stubGlobal("speechSynthesis", {
    speak: vi.fn(),
    cancel: vi.fn(),
    getVoices: vi.fn(() => []),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });

  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// The boot effect must subscribe once; re-subscribing means it re-ran on a render.
function messageSubscriptions() {
  const add = navigator.serviceWorker.addEventListener as unknown as ReturnType<typeof vi.fn>;
  return add.mock.calls.filter(([type]) => type === "message").length;
}

function depthErrors() {
  return errorSpy.mock.calls.filter((args: unknown[]) => args.some((arg) => String(arg).includes("Maximum update depth")));
}

describe("HomePage render", () => {
  it("does not refetch or loop when open-push messages arrive repeatedly", async () => {
    render(<HomePage />);

    await waitFor(() => expect(screen.getByText("alpha meaning")).toBeTruthy());
    await act(() => sleep(1000));
    expect(swListeners.size).toBeGreaterThan(0);

    for (let i = 0; i < 5; i += 1) {
      await act(async () => {
        const event = new MessageEvent("message", {
          data: { type: "open-push", date: getKSTDateString(), slot: 1 },
        });
        for (const listener of [...swListeners]) listener(event);
        await sleep(200);
      });
    }
    await act(() => sleep(500));

    expect(studyCalls().length).toBeLessThanOrEqual(3);
    expect(messageSubscriptions()).toBe(1);
    expect(depthErrors()).toHaveLength(0);
    expect(screen.getByText("alpha meaning")).toBeTruthy();
  });

  it("keeps the history tab active after selecting it", async () => {
    render(<HomePage />);
    await waitFor(() => expect(screen.getByText("alpha meaning")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /기록/ }));
    await act(() => sleep(500));

    expect(messageSubscriptions()).toBe(1);
    expect(window.location.search).toContain("tab=history");
    expect(screen.getByText("지난 단어가 없습니다")).toBeTruthy();
    expect(screen.queryByText("alpha meaning")).toBeNull();
    expect(screen.queryByText(/아침 00:00/)).toBeNull();
    expect(depthErrors()).toHaveLength(0);
  });
});
