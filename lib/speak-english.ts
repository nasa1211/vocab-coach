export function speakEnglish(text: string, rate = 0.9) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    alert("이 브라우저는 음성 재생을 지원하지 않습니다.");
    return;
  }

  const phrase = text.trim();
  if (!phrase) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(phrase);
  utterance.lang = "en-US";
  utterance.rate = rate;
  utterance.pitch = 1.05;

  const play = () => {
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (voice) =>
        voice.lang.startsWith("en") &&
        (voice.name.includes("Google") ||
          voice.name.includes("Samantha") ||
          voice.name.includes("Victoria") ||
          voice.name.includes("Natural") ||
          voice.name.includes("Female") ||
          voice.name.includes("Karen"))
    );
    if (preferred) utterance.voice = preferred;
    window.speechSynthesis.speak(utterance);
  };

  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      play();
      window.speechSynthesis.onvoiceschanged = null;
    };
    return;
  }
  play();
}
