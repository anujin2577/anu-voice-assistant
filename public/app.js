const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

const statusEl = document.querySelector("#status");
const hintEl = document.querySelector("#hint");
const orbEl = document.querySelector("#orb");
const orbButton = document.querySelector("#orbButton");
const talkButton = document.querySelector("#talkButton");
const wakeMode = document.querySelector("#wakeMode");
const wakeToggleButton = document.querySelector("#wakeToggleButton");
const wakeLabel = document.querySelector("#wakeLabel");
const themeToggleButton = document.querySelector("#themeToggleButton");
const themeLabel = document.querySelector("#themeLabel");
const headerLogo = document.querySelector("#headerLogo");
const languageToggle = document.querySelector("#languageToggle");
const languageLabel = document.querySelector("#languageLabel");
const languageSelect = document.querySelector("#language");
const voiceToggleButton = document.querySelector("#voiceToggleButton");
const voiceLabel = document.querySelector("#voiceLabel");
const voiceGenderSelect = document.querySelector("#voiceGender");
const userTextEl = document.querySelector("#userText");
const anuTextEl = document.querySelector("#anuText");

let recognition = null;
let mode = "idle";
let currentAudio = null;
let voicesReady = null;
let wakeEnabled = false;
let wakeLanguageIndex = 0;
let darkModeEnabled = getSavedTheme() === "dark";
let browserSpeechUnlocked = false;

const copy = {
  mn: {
    ready: "\u0422\u0430\u043d\u044b\u0433 \u0441\u043e\u043d\u0441\u043e\u0445\u043e\u0434 \u0431\u044d\u043b\u044d\u043d \u0431\u0430\u0439\u043d\u0430",
    waitingWake:
      'Wake-up \u0438\u0434\u044d\u0432\u0445\u0442\u044d\u0439. "Hey Anu" \u044d\u0441\u0432\u044d\u043b "\u0425\u04e9\u04e9\u0435 \u0410\u043d\u0443" \u0433\u044d\u0436 \u0445\u044d\u043b\u043d\u044d \u04af\u04af.',
    listening: "\u0421\u043e\u043d\u0441\u043e\u0436 \u0431\u0430\u0439\u043d\u0430",
    thinking: "\u0411\u043e\u0434\u043e\u0436 \u0431\u0430\u0439\u043d\u0430",
    speaking: "\u042f\u0440\u044c\u0436 \u0431\u0430\u0439\u043d\u0430",
    unsupported:
      "\u042d\u043d\u044d browser speech recognition \u0434\u044d\u043c\u0436\u0438\u0445\u0433\u04af\u0439 \u0431\u0430\u0439\u043d\u0430. Chrome \u044d\u0441\u0432\u044d\u043b Edge \u0430\u0448\u0438\u0433\u043b\u0430\u0430\u0434 \u04af\u0437\u043d\u044d \u04af\u04af.",
    blocked:
      "\u041c\u0438\u043a\u0440\u043e\u0444\u043e\u043d \u0437\u04e9\u0432\u0448\u04e9\u04e9\u0440\u04e9\u043b \u0445\u0430\u0430\u0433\u0434\u0441\u0430\u043d \u0431\u0430\u0439\u043d\u0430. Browser-\u0438\u0439\u043d microphone access-\u0438\u0439\u0433 Allow \u0431\u043e\u043b\u0433\u043e\u043d\u043e \u0443\u0443.",
    noQuestion:
      "\u0410\u0441\u0443\u0443\u043b\u0442 \u0441\u043e\u043d\u0441\u043e\u0433\u0434\u0441\u043e\u043d\u0433\u04af\u0439. \u0414\u0430\u0445\u0438\u043d \u043e\u0440\u043e\u043b\u0434\u043e\u043d\u043e \u0443\u0443.",
    hint:
      'Talk \u0442\u043e\u0432\u0447 \u0434\u0430\u0440\u043d\u0430 \u0443\u0443, \u044d\u0441\u0432\u044d\u043b Wake-up \u0430\u0441\u0430\u0430\u0433\u0430\u0430\u0434 "Hey Anu" \u044d\u0441\u0432\u044d\u043b "\u0425\u04e9\u04e9\u0435 \u0410\u043d\u0443" \u0433\u044d\u0436 \u0445\u044d\u043b\u043d\u044d \u04af\u04af.',
  },
  en: {
    ready: "Ready to listen",
    waitingWake: 'Wake-up is on. Say "Hey Anu" or "\u0425\u04e9\u04e9\u0435 \u0410\u043d\u0443".',
    listening: "Listening",
    thinking: "Thinking",
    speaking: "Speaking",
    unsupported: "This browser does not support speech recognition. Please try Chrome or Edge.",
    blocked: "Microphone permission is blocked. Please allow microphone access in the browser.",
    noQuestion: "I did not hear a question. Please try again.",
    hint: 'Click Talk, or enable Wake-up and say "Hey Anu" or "\u0425\u04e9\u04e9\u0435 \u0410\u043d\u0443".',
  },
};

const wakeInstruction =
  '"Hey Anu", "\u0425\u04e9\u04e9\u0435 \u0410\u043d\u0443", \u044d\u0441\u0432\u044d\u043b "\u0410\u043d\u0443" \u0433\u044d\u0436 \u0445\u044d\u043b\u043d\u044d \u04af\u04af.';

function selectedLanguage() {
  return languageSelect.value;
}

function selectedVoiceGender() {
  return voiceGenderSelect.value === "male" ? "male" : "female";
}

function recognitionLanguage() {
  return selectedLanguage() === "en" ? "en-US" : "mn-MN";
}

function wakeRecognitionLanguage() {
  const languages = selectedLanguage() === "mn" ? ["mn-MN", "en-US"] : ["en-US", "mn-MN"];
  const language = languages[wakeLanguageIndex % languages.length];
  wakeLanguageIndex += 1;
  return language;
}

function setState(nextMode, message) {
  mode = nextMode;
  const lang = selectedLanguage();

  orbEl.className = `orb ${nextMode}`;
  statusEl.textContent = message || copy[lang].ready;
  hintEl.textContent = wakeEnabled ? copy[lang].waitingWake : copy[lang].hint;
  talkButton.disabled = nextMode === "thinking" || nextMode === "speaking";
}

function createRecognition({ continuous = false, interimResults = false, lang = recognitionLanguage() } = {}) {
  if (!SpeechRecognition) {
    setState("error", copy[selectedLanguage()].unsupported);
    anuTextEl.textContent = copy[selectedLanguage()].unsupported;
    return null;
  }

  const instance = new SpeechRecognition();
  instance.lang = lang;
  instance.continuous = continuous;
  instance.interimResults = interimResults;
  instance.maxAlternatives = 3;
  return instance;
}

function stopRecognition() {
  if (!recognition) return;

  recognition.onend = null;
  recognition.onerror = null;
  recognition.onresult = null;
  recognition.stop();
  recognition = null;
}

function startRecognitionSafely(instance) {
  try {
    instance.start();
    return true;
  } catch (_error) {
    if (wakeEnabled && mode === "wake") {
      window.setTimeout(startWakeCycle, 350);
    } else {
      setState("ready", copy[selectedLanguage()].ready);
    }
    return false;
  }
}

function startQuestionListening() {
  stopRecognition();
  recognition = createRecognition({ lang: recognitionLanguage() });
  if (!recognition) return;

  setState("listening", copy[selectedLanguage()].listening);
  anuTextEl.textContent = selectedLanguage() === "en" ? "I am listening." : "\u0422\u0430\u043d\u044b\u0433 \u0441\u043e\u043d\u0441\u043e\u0436 \u0431\u0430\u0439\u043d\u0430.";

  recognition.onresult = (event) => {
    const text = getTranscript(event);
    stopRecognition();
    handleQuestion(text);
  };

  recognition.onerror = (event) => {
    stopRecognition();

    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      setState("error", copy[selectedLanguage()].blocked);
      anuTextEl.textContent = copy[selectedLanguage()].blocked;
      return;
    }

    setState("ready", copy[selectedLanguage()].noQuestion);
    anuTextEl.textContent = copy[selectedLanguage()].noQuestion;
    if (wakeEnabled) startWakeListening();
  };

  recognition.onend = () => {
    if (mode === "listening") {
      setState("ready", copy[selectedLanguage()].ready);
      if (wakeEnabled) startWakeListening();
    }
  };

  startRecognitionSafely(recognition);
}

function startWakeListening() {
  stopRecognition();
  wakeLanguageIndex = 0;
  startWakeCycle();
}

function startWakeCycle() {
  if (!wakeEnabled) return;

  stopRecognition();
  recognition = createRecognition({
    continuous: false,
    interimResults: true,
    lang: wakeRecognitionLanguage(),
  });
  if (!recognition) return;

  setState("wake", copy[selectedLanguage()].waitingWake);
  anuTextEl.textContent = wakeInstruction;

  recognition.onresult = (event) => {
    const text = getTranscript(event);
    const wake = getWakeMatch(text);
    if (!wake) return;

    const question = removeWakePhrase(text, wake).trim();
    stopRecognition();

    if (question) {
      handleQuestion(question);
    } else {
      acknowledgeWakeThenListen();
    }
  };

  recognition.onerror = (event) => {
    stopRecognition();

    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      wakeEnabled = false;
      updateWakeToggle();
      setState("error", copy[selectedLanguage()].blocked);
      anuTextEl.textContent = copy[selectedLanguage()].blocked;
      return;
    }

    if (wakeEnabled) {
      window.setTimeout(startWakeCycle, 500);
    }
  };

  recognition.onend = () => {
    if (wakeEnabled && mode === "wake") {
      window.setTimeout(startWakeCycle, 250);
    }
  };

  startRecognitionSafely(recognition);
}

function getTranscript(event) {
  const parts = [];

  for (let index = event.resultIndex; index < event.results.length; index += 1) {
    const result = event.results[index];

    for (let altIndex = 0; altIndex < result.length; altIndex += 1) {
      if (result[altIndex]?.transcript) {
        parts.push(result[altIndex].transcript);
      }
    }
  }

  return parts.join(" ").trim();
}

function normalizeWakeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[.,!?;:"'\u201c\u201d\u2018\u2019]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getWakeMatch(text) {
  const normalized = normalizeWakeText(text);
  const compact = normalized.replace(/\s+/g, "");

  const phrases = [
    "hey anu",
    "hey annu",
    "hey anoo",
    "hey ana",
    "hey anna",
    "hi anu",
    "hi anna",
    "hey and you",
    "anu",
    "anoo",
    "anna",
    "\u0430\u043d\u0443",
    "\u0430\u043d\u0443\u0443",
    "\u0445\u044d\u0439 \u0430\u043d\u0443",
    "\u0445\u04e9\u04e9\u0435 \u0430\u043d\u0443",
    "\u0445\u04e9\u0435 \u0430\u043d\u0443",
    "\u0445\u04af\u04af\u0435 \u0430\u043d\u0443",
    "\u0441\u0430\u0439\u043d \u0443\u0443 \u0430\u043d\u0443",
  ];

  const directMatch = phrases.find(
    (phrase) => normalized.includes(phrase) || compact.includes(phrase.replace(/\s+/g, ""))
  );

  if (directMatch) return directMatch;

  if (
    normalized.includes("hey") &&
    (normalized.includes("anu") ||
      normalized.includes("ano") ||
      normalized.includes("anna") ||
      normalized.includes("and you"))
  ) {
    return "hey";
  }

  if (
    (normalized.includes("\u0445\u04e9\u04e9\u0435") ||
      normalized.includes("\u0445\u04e9\u0435") ||
      normalized.includes("\u0445\u04af\u04af\u0435")) &&
    normalized.includes("\u0430\u043d\u0443")
  ) {
    return "\u0430\u043d\u0443";
  }

  return null;
}

function removeWakePhrase(text, wakePhrase) {
  if (!wakePhrase) return text;

  const normalized = normalizeWakeText(text);
  const index = normalized.indexOf(wakePhrase);
  if (index === -1) return "";

  return normalized.slice(index + wakePhrase.length);
}

async function handleQuestion(text) {
  const lang = selectedLanguage();

  if (!text) {
    setState("ready", copy[lang].noQuestion);
    anuTextEl.textContent = copy[lang].noQuestion;
    return;
  }

  userTextEl.textContent = text;
  anuTextEl.textContent = "...";
  setState("thinking", copy[lang].thinking);

  try {
    const localReply = createLocalDemoAnswer(text, lang);

    if (!isGenericLocalDemoReply(localReply, lang)) {
      anuTextEl.textContent = localReply;
      await speakAnuReply(localReply, null);
      return;
    }

    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language: lang, voiceGender: selectedVoiceGender() }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Request failed.");
    }

    anuTextEl.textContent = data.replyText;
    await speakAnuReply(data.replyText, data.audio);
  } catch (error) {
    const fallbackReply = createLocalDemoAnswer(text, lang);
    anuTextEl.textContent = fallbackReply;
    await speakAnuReply(fallbackReply, null);
  } finally {
    if (wakeEnabled) {
      startWakeListening();
    } else if (mode !== "error") {
      setState("ready", copy[selectedLanguage()].ready);
    }
  }
}

async function acknowledgeWakeThenListen() {
  const acknowledgement =
    selectedLanguage() === "en"
      ? "Yes, I am listening."
      : "\u0417\u0430, \u0442\u0430\u043d\u044b\u0433 \u0441\u043e\u043d\u0441\u043e\u0436 \u0431\u0430\u0439\u043d\u0430.";

  anuTextEl.textContent = acknowledgement;
  await speakAnuReply(acknowledgement, null);

  if (wakeEnabled) {
    startQuestionListening();
  }
}

async function speakAnuReply(text, audio) {
  if (audio?.base64 && (await playAnuAudio(audio))) {
    return;
  }

  const generatedAudio = await requestSpeechAudio(text);
  if (generatedAudio?.base64 && (await playAnuAudio(generatedAudio))) {
    return;
  }

  if (await playMatchingDemoAudio(text)) {
    return;
  }

  await speakWithBrowser(text);
}

async function requestSpeechAudio(text) {
  try {
    setState("speaking", copy[selectedLanguage()].speaking);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 18000);

    const response = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        text,
        language: selectedLanguage(),
        voiceGender: selectedVoiceGender(),
      }),
    });
    window.clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();
    return data.audio || null;
  } catch (_error) {
    return null;
  }
}

async function playAnuAudio(audio) {
  if (!audio?.base64) return false;

  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  setState("speaking", copy[selectedLanguage()].speaking);
  currentAudio = new Audio(`data:${audio.mimeType};base64,${audio.base64}`);

  return new Promise((resolve) => {
    currentAudio.onended = () => resolve(true);
    currentAudio.onerror = () => resolve(false);
    currentAudio.play().catch(() => resolve(false));
  });
}

async function playMatchingDemoAudio(text) {
  const normalized = String(text || "").toLowerCase();

  if (
    normalized.includes("\u0441\u0430\u0439\u043d \u0431\u0430\u0439\u043d\u0430 \u0443\u0443") ||
    normalized.includes("\u043d\u0430\u043c\u0430\u0439\u0433 \u0430\u043d\u0443")
  ) {
    return playLocalAudioIfExists("/assets/anu-greeting.mp3");
  }

  if (
    normalized.includes("\u0446\u0430\u0433 \u0430\u0433\u0430\u0430\u0440") ||
    normalized.includes("\u0443\u043b\u0430\u0430\u043d\u0431\u0430\u0430\u0442\u0430\u0440\u0442")
  ) {
    return playLocalAudioIfExists("/assets/weather-demo.mp3");
  }

  return false;
}

async function playLocalAudioIfExists(url) {
  try {
    const response = await fetch(url, { method: "HEAD" });
    if (!response.ok) return false;

    return playUrlAudio(url);
  } catch (_error) {
    return false;
  }
}

async function playUrlAudio(url) {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  setState("speaking", copy[selectedLanguage()].speaking);
  currentAudio = new Audio(url);

  return new Promise((resolve) => {
    currentAudio.onended = () => resolve(true);
    currentAudio.onerror = () => resolve(false);
    currentAudio.play().catch(() => resolve(false));
  });
}

async function speakWithBrowser(text) {
  if (!("speechSynthesis" in window) || !text) return;

  window.speechSynthesis.cancel();
  window.speechSynthesis.resume();
  setState("speaking", copy[selectedLanguage()].speaking);

  const voices = await getBrowserVoices();
  const voice = chooseVoice(voices);
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = voice?.lang || (selectedLanguage() === "en" ? "en-US" : "mn-MN");
  utterance.voice = voice || null;
  utterance.volume = 1;
  utterance.rate = 0.92;
  utterance.pitch = 1;

  await new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearInterval(resumeTimer);
      resolve();
    };

    const resumeTimer = window.setInterval(() => {
      window.speechSynthesis.resume();
    }, 250);

    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.speak(utterance);
    window.speechSynthesis.resume();
    window.setTimeout(finish, Math.max(5000, text.length * 90));
  });
}

function getBrowserVoices() {
  if (voicesReady) return voicesReady;

  voicesReady = new Promise((resolve) => {
    const existingVoices = window.speechSynthesis.getVoices();
    if (existingVoices.length) {
      resolve(existingVoices);
      return;
    }

    window.speechSynthesis.onvoiceschanged = () => {
      resolve(window.speechSynthesis.getVoices());
    };

    window.setTimeout(() => {
      resolve(window.speechSynthesis.getVoices());
    }, 1000);
  });

  return voicesReady;
}

function chooseVoice(voices) {
  const lang = selectedLanguage();
  const preferredPrefix = lang === "en" ? "en" : "mn";
  const gender = selectedVoiceGender();

  if (lang === "en") {
    const femaleNames = ["jenny", "aria", "ava", "emma", "samantha", "zira", "sonia", "susan", "female"];
    const maleNames = ["guy", "david", "mark", "george", "ryan", "daniel", "male"];
    const genderNames = gender === "male" ? maleNames : femaleNames;
    const genderedEnglish = voices.find((voice) => {
      const name = `${voice.name} ${voice.voiceURI}`.toLowerCase();
      return voice.lang.toLowerCase().startsWith("en") && genderNames.some((item) => name.includes(item));
    });

    if (genderedEnglish) return genderedEnglish;
  }

  const preferred = voices.find((voice) => voice.lang.toLowerCase().startsWith(preferredPrefix));

  if (preferred) return preferred;

  const englishFallback = voices.find((voice) => voice.lang.toLowerCase().startsWith("en"));
  return englishFallback || voices[0] || null;
}

async function speakMongolianGreeting() {
  const greeting =
    "\u0421\u0430\u0439\u043d \u0431\u0430\u0439\u043d\u0430 \u0443\u0443. \u041d\u0430\u043c\u0430\u0439\u0433 \u0410\u043d\u0443 \u0433\u044d\u0434\u044d\u0433. \u0411\u0438 \u041c\u043e\u043d\u0433\u043e\u043b \u0445\u044d\u0440\u044d\u0433\u043b\u044d\u0433\u0447\u0434\u044d\u0434 \u0437\u043e\u0440\u0438\u0443\u043b\u0441\u0430\u043d \u0434\u0443\u0443\u0442 \u0442\u0443\u0441\u043b\u0430\u0445\u044b\u043d \u0434\u0435\u043c\u043e \u0445\u0443\u0432\u0438\u043b\u0431\u0430\u0440.";

  anuTextEl.textContent = greeting;

  if (await playLocalAudioIfExists("/assets/anu-greeting.mp3")) {
    setState("ready", copy[selectedLanguage()].ready);
    return;
  }

  await speakAnuReply(greeting, null);
  setState("ready", copy[selectedLanguage()].ready);
}

function createLocalDemoAnswer(userText, language) {
  const normalized = normalizeDemoText(userText);

  if (language === "en") {
    if (demoIncludesAny(normalized, ["weather", "temperature", "forecast"])) {
      return "For this demo, the weather in Ulaanbaatar is mostly clear, about 12 degrees Celsius, with a light wind.";
    }

    if (demoIncludesAny(normalized, ["time", "clock"])) {
      const time = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Ulaanbaatar",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date());

      return `The current time in Ulaanbaatar is about ${time}.`;
    }

    if (demoIncludesAny(normalized, ["who are you", "what are you", "your name", "anu"])) {
      return "I am Anu, your digital voice assistant demo.";
    }

    if (demoIncludesAny(normalized, ["amjilt", "school"])) {
      return "Amjilt Cyber School is a franchise school with one standard program across three branches.";
    }

    return "This demo can answer about weather, time, Anu, Amjilt Cyber School, locations, and services.";
  }

  if (demoIncludesAny(normalized, ["цаг агаар", "агаар", "температур", "хэдэн градус"])) {
    return "Өнөөдрийн демо мэдээллээр Улаанбаатарт ихэнхдээ цэлмэг, ойролцоогоор арван хоёр градус дулаан байна. Салхи зөөлөн, оройдоо нимгэн хүрэмтэй гарахад тохиромжтой.";
  }

  if (normalized.includes("цаг")) {
    const time = new Intl.DateTimeFormat("mn-MN", {
      timeZone: "Asia/Ulaanbaatar",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());

    return `Улаанбаатарын одоогийн цаг ойролцоогоор ${time}.`;
  }

  if (demoIncludesAny(normalized, ["хэн бүтээсэн", "хэн хийсэн", "хэн хөгжүүлсэн", "хэн зохиосон", "чамайг хэн", "ануг хэн", "бүтээсэн бэ", "бүтээгч"])) {
    return "Намайг Амжилт кибер Чингэлтэй сургуулийн AI and Smart Tech дугуйлангийн хүүхдүүд Анужин багшийн хамт бүтээсэн. Би дараа, дараагийн жилүүдэд хөгжүүлэгдэж илүү мундаг болно.";
  }

  if (demoIncludesAny(normalized, ["чи хэн", "та хэн", "хэн бэ", "нэр", "ану"])) {
    return "Би Ану. Таны дижитал туслахын демо хувилбар.";
  }

  if (demoIncludesAny(normalized, ["амжилт гэж юу", "амжилт юу", "амжилт кибер", "амжилт сургууль"])) {
    return "Амжилт кибер сургууль нь франчайз сургууль бөгөөд үндсэн гурван салбарт нэг стандарт, нэг хөтөлбөр хэрэгжүүлэн ажиллаж байна.";
  }

  if (isLocalLevelUpQuestion(normalized)) {
    return "Level Up гэдэг нь тухайн хичээлийн жилийн турш сурагч бүр ямар мэдлэг, чадвар, хандлага, өөртөө итгэх итгэлээр ахиснаа харуулах хаалтын үйл ажиллагаа юм. Энэ бол зүгээр нэг тайлан өдөр биш. Сурагчид сурсан зүйлээ эцэг эх, багш, найз нөхдийнхөө өмнө бодитоор харуулж, дараагийн түвшин рүү шилжиж буй өсөлтөө тэмдэглэдэг.";
  }

  if (isLocalProjectSkillQuestion(normalized)) {
    return "Энэ төслийг хийхээс өмнө сурагчид AI-г ихэвчлэн бэлэн хариулт өгдөг, мэдээлэл хайхад тусалдаг, зураг эсвэл текст боловсруулдаг хэрэгсэл гэж ойлгодог байсан. Харин одоо тэд AI-г зөвхөн ашиглаад зогсохгүй, өөрсдийн санаанд суурилсан AI assistant бүтээж сурсан. Тэд prompt боловсруулах, хэрэглэгчийн хэрэгцээг тодорхойлох, хариултын tone, үүрэг, мэдээллийн бүтэц, ашиглах нөхцөлийг төлөвлөх чадвар эзэмшсэн.";
  }

  if (isLocalAssistantPurposeQuestion(normalized)) {
    return "AI assistant нь хэнд зориулагдах, ямар асуудлыг шийдэх, хэрэглэгчид хэрхэн туслах, хариулт нь хэр ойлгомжтой байх ёстойг сурагчид өөрсдөө төлөвлөсөн. Ингэснээр тэд AI-г зүгээр хэрэглэгчийн байр сууринаас бус, AI-г зохион бүтээгч, чиглүүлэгч, хөгжүүлэгчийн байр сууринаас ойлгож эхэлсэн.";
  }

  if (demoIncludesAny(normalized, ["хаана байдаг", "байршил", "салбар хаана", "хаяг", "танай байгууллага"])) {
    return "Амжилт кибер сургууль Баянзүрх, Хан-Уул, Чингэлтэй гэсэн гурван салбартай. Би Амжилт кибер сургуулийн Чингэлтэй салбарын дижитал туслах.";
  }

  if (demoIncludesAny(normalized, ["ямар үйлчилгээ", "үйлчилгээ", "сургалт", "хөтөлбөр"])) {
    return "Манай сургууль хүүхдэд ерөнхий боловсрол олгохоос гадна программ хангамж, график дизайн, англи болон хятад хэл, математик, бүтээлч сэтгэлгээ болон манлайллын ур чадварыг хөгжүүлэх хөтөлбөрүүд хэрэгжүүлдэг.";
  }

  if (demoIncludesAny(normalized, ["сайн уу", "сайн байна уу", "мэнд"])) {
    return "Сайн байна уу. Би Ану, таны дижитал туслах.";
  }

  if (demoIncludesAny(normalized, ["монгол", "англи", "хэл"])) {
    return "Би монгол болон англи хэлээр богино, ойлгомжтой хариу өгөхөөр тохируулагдсан.";
  }

  if (demoIncludesAny(normalized, ["менежер", "захирал", "demo", "демо", "танилцуул"])) {
    return "Би бол Ану таны дижитал туслах. Та асуултаа хэлэхэд би сонсоод богино хариулт хэлдэг. Би хөгжүүлэгдэж улам мундаг болно.";
  }

  if (demoIncludesAny(normalized, ["баярлалаа", "талархлаа"])) {
    return "Танд баярлалаа. Дахин туслахад бэлэн байна.";
  }

  return "Энэ демо хувилбар дээр би цаг агаар, одоогийн цаг, Амжилт кибер сургууль, Level Up үйл ажиллагаа, AI assistant төслийн талаар хариулж чадна.";
}

function isGenericLocalDemoReply(reply, language) {
  if (language === "en") {
    return reply.startsWith("This demo can answer");
  }

  return reply.startsWith("Энэ демо хувилбар дээр");
}

function normalizeDemoText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[.,!?;:"'\u201c\u201d\u2018\u2019]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function demoIncludesAny(text, phrases) {
  return phrases.some((phrase) => text.includes(phrase));
}

function isLocalLevelUpQuestion(text) {
  const compact = text.replace(/\s+/g, "");

  return (
    demoIncludesAny(text, [
      "level up",
      "level app",
      "level ап",
      "level апп",
      "level гэж юу",
      "level",
      "левел ап",
      "левел апп",
      "левел гэж юу",
      "левел",
      "левэл ап",
      "левэл апп",
      "левэл гэж юу",
      "левэл",
      "лэвэл ап",
      "лэвэл апп",
      "лэвэл гэж юу",
      "лэвэл",
      "түвшин ахих",
    ]) ||
    demoIncludesAny(compact, [
      "levelup",
      "levelapp",
      "levelап",
      "levelапп",
      "левелап",
      "левелапп",
      "левэлап",
      "левэлапп",
      "лэвэлап",
      "лэвэлапп",
      "түвшинахих",
    ])
  );
}

function isLocalProjectSkillQuestion(text) {
  const compact = text.replace(/\s+/g, "");

  return (
    demoIncludesAny(text, [
      "төслийг хийхээс өмнө",
      "төсөл хийхээс өмнө",
      "төслийн өмнө",
      "өмнө сурагч",
      "өмнө нь юу мэддэг",
      "юу мэддэг байсан",
      "одоо ямар шинэ чадвар",
      "шинэ чадвар",
      "шинэ чадварууд",
      "ямар чадвар сурсан",
      "ямар шинэ чадвар",
      "чадвар эзэмшсэн",
      "юу чаддаг болсон",
      "юу сурсан",
      "ai г",
      "ai-г",
      "ai-аас",
      "prompt боловсруулах",
      "промпт боловсруулах",
      "хэрэглэгчийн хэрэгцээ",
      "хариултын tone",
      "мэдээллийн бүтэц",
    ]) ||
    demoIncludesAny(compact, [
      "төслийгхийхээсөмнө",
      "төсөлхийхээсөмнө",
      "төслийнөмнө",
      "өмнөюумэддэг",
      "юумэддэгбайсан",
      "шинэчадвар",
      "ямарчадварсурсан",
      "юусурсан",
      "promptболовсруулах",
      "промптболовсруулах",
      "хэрэглэгчийнхэрэгцээ",
    ])
  );
}

function isLocalAssistantPurposeQuestion(text) {
  const compact = text.replace(/\s+/g, "");

  return (
    demoIncludesAny(text, [
      "хэнд зориулагдах",
      "хэнд зориул",
      "хэнд зориулсан",
      "хэнд зориулах",
      "хэнд хэрэгтэй",
      "хэнд зориулагдсан",
      "ямар асуудлыг шийдэх",
      "ямар асуудал шийдэх",
      "ямар асуудлыг шийдвэрлэх",
      "ямар асуудал шийдвэрлэх",
      "ямар асуудлыг шийд",
      "ямар асуудал шийд",
      "асуудлыг шийдэх",
      "асуудал шийдэх",
      "асуудал шийд",
      "хэрэглэгчид ямар байдлаар туслах",
      "хэрэглэгчид хэрхэн туслах",
      "хэрэглэгчид яаж туслах",
      "хэрэглэгчдэд хэрхэн туслах",
      "хэрэглэгчдэд яаж туслах",
      "хэрэглэгчид туслах",
      "хэрэглэгчдэд туслах",
      "яаж туслах",
      "хэрхэн туслах",
      "хариулт нь хэр ойлгомжтой",
      "хариулт ойлгомжтой",
      "хэр ойлгомжтой",
      "ai assistant нь хэнд",
      "ai assistant хэнд",
      "ai туслах хэнд",
      "дижитал туслах хэнд",
      "дуут туслах хэнд",
      "ассистант хэнд",
      "ассистент хэнд",
      "зохион бүтээгч",
      "чиглүүлэгч",
      "хөгжүүлэгч",
    ]) ||
    demoIncludesAny(compact, [
      "хэндзориулагдах",
      "хэндзориулсан",
      "хэндхэрэгтэй",
      "ямарасуудалшийдэх",
      "ямарасуудлыгшийдэх",
      "асуудалшийдэх",
      "асуудлыгшийдэх",
      "хэрэглэгчидтуслах",
      "яажтуслах",
      "хэрхэнтуслах",
      "хариултойлгомжтой",
      "aiassistantхэнд",
      "aiтуслаххэнд",
      "дижиталтуслаххэнд",
      "дууттуслаххэнд",
    ])
  );
}

function primeSpeechSynthesis() {
  if (!("speechSynthesis" in window) || browserSpeechUnlocked) return;

  browserSpeechUnlocked = true;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance("Anu");
  utterance.volume = 0.01;
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
  window.speechSynthesis.resume();
}

talkButton.addEventListener("click", () => {
  primeSpeechSynthesis();
  startQuestionListening();
});

orbButton.addEventListener("click", () => {
  primeSpeechSynthesis();
  speakMongolianGreeting();
});

wakeToggleButton.addEventListener("click", () => {
  primeSpeechSynthesis();
  setWakeEnabled(!wakeEnabled);
});

themeToggleButton.addEventListener("click", () => {
  darkModeEnabled = !darkModeEnabled;
  updateThemeToggle();
});

languageSelect.addEventListener("change", () => {
  updateLanguageToggle();
  if (wakeEnabled) {
    startWakeListening();
  } else {
    setState("ready", copy[selectedLanguage()].ready);
  }
});

languageToggle.addEventListener("click", () => {
  languageSelect.value = selectedLanguage() === "mn" ? "en" : "mn";
  languageSelect.dispatchEvent(new Event("change"));
});

voiceToggleButton.addEventListener("click", () => {
  voiceGenderSelect.value = selectedVoiceGender() === "female" ? "male" : "female";
  voiceGenderSelect.dispatchEvent(new Event("change"));
});

voiceGenderSelect.addEventListener("change", () => {
  updateVoiceToggle();
});

function updateLanguageToggle() {
  const isEnglish = selectedLanguage() === "en";

  languageLabel.textContent = isEnglish ? "English" : "\u041c\u043e\u043d\u0433\u043e\u043b";
  languageToggle.classList.toggle("english", isEnglish);
  headerLogo.src = "/assets/anu-logo-share.png";
  headerLogo.alt =
    "ANU - \u0422\u0430\u043d\u044b \u0434\u0438\u0436\u0438\u0442\u0430\u043b \u0442\u0443\u0441\u043b\u0430\u0445 - Your AI Assistant";
  updateVoiceToggle();
}

function updateVoiceToggle() {
  const gender = selectedVoiceGender();
  const isMongolian = selectedLanguage() === "mn";

  if (isMongolian) {
    voiceLabel.textContent =
      gender === "male"
        ? "\u042d\u0440\u044d\u0433\u0442\u044d\u0439"
        : "\u042d\u043c\u044d\u0433\u0442\u044d\u0439";
  } else {
    voiceLabel.textContent = gender === "male" ? "Male" : "Female";
  }

  voiceToggleButton.classList.toggle("male", gender === "male");
  voiceToggleButton.setAttribute("aria-pressed", String(gender === "male"));
}

function updateWakeToggle() {
  wakeMode.checked = wakeEnabled;
  wakeToggleButton.classList.toggle("active", wakeEnabled);
  wakeToggleButton.setAttribute("aria-pressed", String(wakeEnabled));
  wakeLabel.textContent = wakeEnabled ? "Wake-up On" : "Wake-up";
}

function updateThemeToggle() {
  document.body.classList.toggle("dark-theme", darkModeEnabled);
  themeToggleButton.classList.toggle("dark", darkModeEnabled);
  themeToggleButton.setAttribute("aria-pressed", String(darkModeEnabled));
  themeLabel.textContent = darkModeEnabled ? "Light" : "Dark";
  saveTheme(darkModeEnabled ? "dark" : "light");
}

function getSavedTheme() {
  try {
    return localStorage.getItem("anuTheme");
  } catch (_error) {
    return "light";
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem("anuTheme", theme);
  } catch (_error) {
    // The demo still works if browser storage is blocked.
  }
}

function setWakeEnabled(enabled) {
  if (enabled && !SpeechRecognition) {
    setState("error", copy[selectedLanguage()].unsupported);
    return;
  }

  wakeEnabled = enabled;
  wakeLanguageIndex = 0;
  updateWakeToggle();

  if (wakeEnabled) {
    setState("wake", copy[selectedLanguage()].waitingWake);
    anuTextEl.textContent = wakeInstruction;
    startWakeListening();
  } else {
    stopRecognition();
    setState("ready", copy[selectedLanguage()].ready);
  }
}

updateThemeToggle();

if (!SpeechRecognition) {
  setState("error", copy[selectedLanguage()].unsupported);
} else {
  updateWakeToggle();
  updateLanguageToggle();
  updateVoiceToggle();
  setState("ready", copy[selectedLanguage()].ready);
}
