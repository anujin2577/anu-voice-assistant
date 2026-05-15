import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createEdgeSpeech } from "./edgeTts.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-5-mini";
const TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const TTS_VOICE = process.env.OPENAI_TTS_VOICE || "marin";
const TTS_PROVIDER = process.env.TTS_PROVIDER || "auto";
const EDGE_TTS_MN_FEMALE_VOICE =
  process.env.EDGE_TTS_MN_FEMALE_VOICE ||
  process.env.EDGE_TTS_MN_VOICE ||
  process.env.EDGE_TTS_VOICE ||
  "mn-MN-YesuiNeural";
const EDGE_TTS_MN_MALE_VOICE = process.env.EDGE_TTS_MN_MALE_VOICE || "mn-MN-BataaNeural";
const EDGE_TTS_EN_FEMALE_VOICE =
  process.env.EDGE_TTS_EN_FEMALE_VOICE || process.env.EDGE_TTS_EN_VOICE || "en-US-JennyNeural";
const EDGE_TTS_EN_MALE_VOICE = process.env.EDGE_TTS_EN_MALE_VOICE || "en-US-GuyNeural";
const OPENAI_TTS_FEMALE_VOICE = process.env.OPENAI_TTS_FEMALE_VOICE || TTS_VOICE;
const OPENAI_TTS_MALE_VOICE = process.env.OPENAI_TTS_MALE_VOICE || "onyx";
const CHIMEGE_TTS_URL = process.env.CHIMEGE_TTS_URL;
const CHIMEGE_API_KEY = process.env.CHIMEGE_API_KEY;
const CHIMEGE_FEMALE_VOICE =
  process.env.CHIMEGE_FEMALE_VOICE || process.env.CHIMEGE_VOICE || "female";
const CHIMEGE_MALE_VOICE = process.env.CHIMEGE_MALE_VOICE || "male";
const CHIMEGE_FORMAT = process.env.CHIMEGE_FORMAT || "mp3";
const DEMO_MODE = (process.env.DEMO_MODE || "auto").toLowerCase();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, assistant: "Anu" });
});

app.post("/api/ask", async (req, res) => {
  try {
    const { text, language = "mn" } = req.body || {};
    const voiceGender = normalizeVoiceGender(req.body?.voiceGender);
    const userText = String(text || "").trim();

    if (!userText) {
      return res.status(400).json({ error: "Please send a non-empty text field." });
    }

    if (DEMO_MODE === "on" || DEMO_MODE === "scripted") {
      const replyText = createDemoAnswer(userText, language);
      const audio = await createSpeechForDemo(replyText, language, voiceGender);
      return res.json({ replyText, audio, demo: true });
    }

    if (!isRealConfigValue(OPENAI_API_KEY)) {
      if (DEMO_MODE === "off") {
        return res.status(500).json({
          error: "Set a real OPENAI_API_KEY in .env, then restart the server.",
        });
      }

      return res.json({
        replyText: createDemoAnswer(userText, language),
        audio: null,
        demo: true,
      });
    }

    let answer;
    let speech = null;
    let demo = false;

    try {
      answer = await askAnu(userText, language);
    } catch (error) {
      if (DEMO_MODE === "off") {
        throw error;
      }

      console.warn("OpenAI text request failed. Returning demo answer:", error.message);
      answer = createDemoAnswer(userText, language);
      demo = true;
    }

    try {
      speech = await createSpeech(answer, language, voiceGender);
    } catch (error) {
      if (DEMO_MODE === "off") {
        throw error;
      }

      console.warn("TTS request failed. Browser speech will be used:", error.message);
    }

    res.json({
      replyText: answer,
      audio: speech,
      demo,
    });
  } catch (error) {
    console.error("Anu API error:", error);
    res.status(500).json({
      error: error.publicMessage || "Anu could not answer right now. Check the server logs for details.",
    });
  }
});

app.post("/api/speak", async (req, res) => {
  try {
    const { text, language = "mn" } = req.body || {};
    const voiceGender = normalizeVoiceGender(req.body?.voiceGender);
    const speechText = String(text || "").trim();

    if (!speechText) {
      return res.status(400).json({ error: "Please send a non-empty text field." });
    }

    const audio = await createSpeechForDemo(speechText, language, voiceGender);
    if (!audio) {
      return res.status(500).json({ error: "Could not generate speech audio." });
    }

    res.json({ audio });
  } catch (error) {
    console.error("Anu speak API error:", error);
    res.status(500).json({ error: "Anu could not generate speech right now." });
  }
});

async function askAnu(userText, language) {
  const preferredLanguage =
    language === "en" ? "English" : "Mongolian. Use English only if the user asks in English.";

  const instructions = [
    "You are Anu, a website-based AI voice assistant for Mongolia.",
    "Your personality is formal, polite, calm, and helpful.",
    `Reply primarily in ${preferredLanguage}`,
    "Keep answers concise and natural for spoken conversation.",
    "Avoid long paragraphs, markdown tables, and unnecessary detail.",
    "If you do not know something current or location-specific, say so briefly.",
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      instructions,
      input: userText,
      max_output_tokens: 220,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI text request failed: ${response.status} ${details}`);
  }

  const data = await response.json();
  return extractText(data) || "Уучлаарай, би одоогоор хариулт бэлдэж чадсангүй.";
}

async function createSpeech(text, language, voiceGender = "female") {
  const wantsChimege =
    language === "mn" && (TTS_PROVIDER === "auto" || TTS_PROVIDER === "chimege");

  if (wantsChimege && isRealConfigValue(CHIMEGE_TTS_URL) && isRealConfigValue(CHIMEGE_API_KEY)) {
    try {
      return await createChimegeSpeech(text, voiceGender);
    } catch (error) {
      if (TTS_PROVIDER === "chimege") {
        throw error;
      }

      console.warn("Chimege TTS failed. Falling back to OpenAI TTS:", error.message);
    }
  }

  if (language === "mn" && TTS_PROVIDER === "chimege") {
    throw publicError("Chimege TTS is selected, but CHIMEGE_TTS_URL or CHIMEGE_API_KEY is missing.");
  }

  if ((language === "mn" || language === "en") && (TTS_PROVIDER === "auto" || TTS_PROVIDER === "edge")) {
    try {
      return await createEdgeTtsSpeech(text, language, voiceGender);
    } catch (error) {
      if (TTS_PROVIDER === "edge") {
        throw error;
      }

      console.warn("Edge TTS failed. Falling back to OpenAI TTS:", error.message);
    }
  }

  if (!isRealConfigValue(OPENAI_API_KEY)) {
    throw publicError("No backend TTS is configured.");
  }

  return createOpenAISpeech(text, language, voiceGender);
}

async function createSpeechForDemo(text, language, voiceGender = "female") {
  try {
    return await createSpeech(text, language, voiceGender);
  } catch (error) {
    console.warn("Demo TTS failed. Browser speech will be used:", error.message);
    return null;
  }
}

async function createEdgeTtsSpeech(text, language, voiceGender = "female") {
  const isEnglish = language === "en";
  const isMale = voiceGender === "male";
  const audioBuffer = await createEdgeSpeech(text, {
    voice: selectEdgeVoice(isEnglish, isMale),
    lang: isEnglish ? "en-US" : "mn-MN",
    rate: isEnglish ? "-4%" : "-6%",
  });

  return {
    provider: "edge-tts",
    mimeType: "audio/mpeg",
    base64: audioBuffer.toString("base64"),
  };
}

function selectEdgeVoice(isEnglish, isMale) {
  if (isEnglish) {
    return isMale ? EDGE_TTS_EN_MALE_VOICE : EDGE_TTS_EN_FEMALE_VOICE;
  }

  return isMale ? EDGE_TTS_MN_MALE_VOICE : EDGE_TTS_MN_FEMALE_VOICE;
}

async function createChimegeSpeech(text, voiceGender = "female") {
  const authHeader = process.env.CHIMEGE_AUTH_HEADER || "Authorization";
  const authScheme = process.env.CHIMEGE_AUTH_SCHEME || "Bearer";
  const textField = process.env.CHIMEGE_TEXT_FIELD || "text";
  const voiceField = process.env.CHIMEGE_VOICE_FIELD || "voice";
  const formatField = process.env.CHIMEGE_FORMAT_FIELD || "format";
  const headers = {
    "Content-Type": "application/json",
    Accept: "audio/mpeg, audio/wav, audio/*, application/json",
    [authHeader]: authScheme ? `${authScheme} ${CHIMEGE_API_KEY}` : CHIMEGE_API_KEY,
  };

  const response = await fetch(CHIMEGE_TTS_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      [textField]: text,
      [voiceField]: voiceGender === "male" ? CHIMEGE_MALE_VOICE : CHIMEGE_FEMALE_VOICE,
      [formatField]: CHIMEGE_FORMAT,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Chimege speech request failed: ${response.status} ${details}`);
  }

  return readSpeechResponse(response, "chimege");
}

async function createOpenAISpeech(text, language, voiceGender = "female") {
  const voiceInstructions =
    language === "en"
      ? `Speak in a formal, polite, calm ${voiceGender} assistant voice. Keep a steady pace.`
      : `Speak in a formal, polite, calm ${voiceGender} assistant voice for a Mongolian audience. Keep a steady pace.`;

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice: voiceGender === "male" ? OPENAI_TTS_MALE_VOICE : OPENAI_TTS_FEMALE_VOICE,
      input: text,
      instructions: voiceInstructions,
      response_format: "mp3",
      speed: 0.95,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI speech request failed: ${response.status} ${details}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  return {
    provider: "openai",
    mimeType: "audio/mpeg",
    base64: audioBuffer.toString("base64"),
  };
}

async function readSpeechResponse(response, provider) {
  const contentType = response.headers.get("content-type") || "audio/mpeg";

  if (contentType.includes("application/json")) {
    const data = await response.json();
    const base64 = data.audio || data.audioContent || data.audio_base64 || data.base64;

    if (base64) {
      return {
        provider,
        mimeType: data.mimeType || data.mime_type || guessMimeType(CHIMEGE_FORMAT),
        base64,
      };
    }

    const url = data.url || data.audioUrl || data.audio_url;
    if (url) {
      const audioResponse = await fetch(url);
      if (!audioResponse.ok) {
        throw new Error(`Could not download ${provider} audio URL: ${audioResponse.status}`);
      }

      const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
      return {
        provider,
        mimeType: audioResponse.headers.get("content-type") || guessMimeType(CHIMEGE_FORMAT),
        base64: audioBuffer.toString("base64"),
      };
    }

    throw new Error(`${provider} returned JSON without audio, base64, or URL fields.`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  return {
    provider,
    mimeType: contentType,
    base64: audioBuffer.toString("base64"),
  };
}

function guessMimeType(format) {
  const normalized = String(format || "").toLowerCase();
  if (normalized === "wav") return "audio/wav";
  if (normalized === "ogg") return "audio/ogg";
  if (normalized === "aac") return "audio/aac";
  return "audio/mpeg";
}

function normalizeVoiceGender(value) {
  return String(value || "").toLowerCase() === "male" ? "male" : "female";
}

function isRealConfigValue(value) {
  if (!value) return false;

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return false;

  return !(
    normalized.includes("your_") ||
    normalized.includes("your-") ||
    normalized.includes("placeholder") ||
    normalized.includes("example") ||
    normalized.startsWith("sk-your")
  );
}

function publicError(message) {
  const error = new Error(message);
  error.publicMessage = message;
  return error;
}

function createDemoAnswer(userText, language) {
  const normalized = normalizeText(userText);

  if (language === "en") {
    if (includesAny(normalized, ["weather", "temperature", "forecast"])) {
      return "For this demo, the weather in Ulaanbaatar is mostly clear, about 12 degrees Celsius, with a light wind. A light jacket is recommended in the evening.";
    }

    if (includesAny(normalized, ["time", "clock"])) {
      const time = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Ulaanbaatar",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date());

      return `The current time in Ulaanbaatar is about ${time}.`;
    }

    if (includesAny(normalized, ["who are you", "what are you", "your name", "anu"])) {
      return "I am Anu, a calm and polite voice assistant demo designed for users in Mongolia.";
    }

    if (includesAny(normalized, ["hello", "hi", "hey"])) {
      return "Hello. I am Anu. How may I help you today?";
    }

    if (includesAny(normalized, ["mongolian", "english", "language", "speak"])) {
      return "I can support Mongolian and English. This demo is optimized for short spoken answers.";
    }

    if (includesAny(normalized, ["manager", "demo", "show"])) {
      return "This is a voice-first assistant demo. It listens, understands a few prepared questions, and answers out loud.";
    }

    if (includesAny(normalized, ["thank", "thanks"])) {
      return "You are welcome.";
    }

    return "In this demo, I can answer about weather, time, my identity, supported languages, and the demo purpose.";
  }

  if (includesAny(normalized, ["цаг агаар", "цаг ага", "агаар", "температур", "хэдэн градус"])) {
    return "Өнөөдрийн демо мэдээллээр Улаанбаатарт ихэнхдээ цэлмэг, ойролцоогоор арван хоёр градус дулаан байна. Салхи зөөлөн, оройдоо сэрүүхэн тул нимгэн хүрэмтэй гарахад тохиромжтой.";
  }

  if (normalized.includes("цаг")) {
    const time = new Intl.DateTimeFormat("mn-MN", {
      timeZone: "Asia/Ulaanbaatar",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());

    return `Улаанбаатарын одоогийн цаг ойролцоогоор ${time}.`;
  }

  if (includesAny(normalized, ["хэн бүтээсэн", "хэн хийсэн", "хэн хөгжүүлсэн", "хэн зохиосон", "чамайг хэн", "ануг хэн", "бүтээсэн бэ", "бүтээгч"])) {
    return "Намайг Амжилт кибер Чингэлтэй сургуулийн AI and Smart Tech дугуйлангийн хүүхдүүд Анужин багшийн хамт бүтээсэн. Би дараа, дараагийн жилүүдэд хөгжүүлэгдэж илүү мундаг болно.";
  }

  if (includesAny(normalized, ["чи хэн", "та хэн", "хэн бэ", "нэр", "ану"])) {
    return "Би Ану. Таны дижитал туслахын демо хувилбар.";
  }

  if (includesAny(normalized, ["сайн уу", "сайн байна уу", "байна уу", "мэнд"])) {
    return "Таны дижитал туслах";
  }

  if (includesAny(normalized, ["амжилт гэж юу", "амжилт юу", "амжилт кибер", "амжилт сургууль"])) {
    return "Амжилт кибер сургууль нь франчайз сургууль бөгөөд үндсэн гурван салбарт нэг стандарт, нэг хөтөлбөр хэрэгжүүлэн ажиллаж байна.";
  }

  if (isLevelUpQuestion(normalized)) {
    return "Level Up гэдэг нь тухайн хичээлийн жилийн турш сурагч бүр ямар мэдлэг, чадвар, хандлага, өөртөө итгэх итгэлээр ахиснаа харуулах хаалтын үйл ажиллагаа юм. Энэ бол зүгээр нэг тайлан өдөр биш. Сурагчид сурсан зүйлээ эцэг эх, багш, найз нөхдийнхөө өмнө бодитоор харуулж, дараагийн түвшин рүү шилжиж буй өсөлтөө тэмдэглэдэг.";
  }

  if (isProjectSkillQuestion(normalized)) {
    return "Энэ төслийг хийхээс өмнө сурагчид AI-г ихэвчлэн бэлэн хариулт өгдөг, мэдээлэл хайхад тусалдаг, зураг эсвэл текст боловсруулдаг хэрэгсэл гэж ойлгодог байсан. Харин одоо тэд AI-г зөвхөн ашиглаад зогсохгүй, өөрсдийн санаанд суурилсан AI assistant бүтээж сурсан. Тэд prompt боловсруулах, хэрэглэгчийн хэрэгцээг тодорхойлох, хариултын tone, үүрэг, мэдээллийн бүтэц, ашиглах нөхцөлийг төлөвлөх чадвар эзэмшсэн.";
  }

  if (isAssistantPurposeQuestion(normalized)) {
    return "AI assistant нь хэнд зориулагдах, ямар асуудлыг шийдэх, хэрэглэгчид хэрхэн туслах, хариулт нь хэр ойлгомжтой байх ёстойг сурагчид өөрсдөө төлөвлөсөн. Ингэснээр тэд AI-г зүгээр хэрэглэгчийн байр сууринаас бус, AI-г зохион бүтээгч, чиглүүлэгч, хөгжүүлэгчийн байр сууринаас ойлгож эхэлсэн.";
  }

  if (includesAny(normalized, ["хаана байдаг", "байршил", "салбар хаана", "хаяг", "танай байгууллага"])) {
    return "Амжилт кибер сургууль гурван салбартай. Баянзүрх салбар нь Баянзүрх дүүрэгт, Нарны зам дагуу, S Outlets-ээс зүүн тийш ойролцоогоор хоёр зуун метрт байрладаг. Хан-Уул салбар нь Хан-Уул дүүргийн арван есдүгээр хороонд, БСБ Мегамоллын урд, Арван ес үйлчилгээний төв орчимд байрладаг. Чингэлтэй салбар нь Баруун дөрвөн зам орчим, хотын төвд ойр байрлалтай шинэ салбар юм. Би Амжилт кибер сургуулийн Чингэлтэй салбарын дижитал туслах.";
  }

  if (includesAny(normalized, ["ямар үйлчилгээ", "үйлчилгээ", "сургалт", "хөтөлбөр"])) {
    return "Манай сургууль хүүхдэд ерөнхий боловсрол олгохоос гадна программ хангамж, график дизайн, англи болон хятад хэл, математик, бүтээлч сэтгэлгээ болон манлайллын ур чадварыг хөгжүүлэх хөтөлбөрүүд хэрэгжүүлдэг.";
  }

  if (includesAny(normalized, ["монгол", "англи", "хэл"])) {
    return "Би монгол болон англи хэлээр богино, ойлгомжтой хариу өгөхөөр тохируулагдсан.";
  }

  if (includesAny(normalized, ["менежер", "захирал", "demo", "демо", "танилцуул"])) {
    return "Би бол Ану таны дижитал туслах. Та асуултаа хэлэхэд би сонсоод богино хариулт хэлдэг. Би хөгжүүлэгдэж улам мундаг болно.";
  }

  if (includesAny(normalized, ["баярлалаа", "талархлаа"])) {
    return "Танд баярлалаа. Дахин туслахад бэлэн байна.";
  }

  return "Энэ демо хувилбар дээр би цаг агаар, одоогийн цаг, Амжилт кибер сургууль, Level Up үйл ажиллагаа, AI assistant төслийн талаар богино хариулж чадна.";
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[.,!?;:"'“”‘’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text, phrases) {
  return phrases.some((phrase) => text.includes(phrase));
}

function isLevelUpQuestion(text) {
  const compact = text.replace(/\s+/g, "");

  return (
    includesAny(text, [
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
    includesAny(compact, [
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

function isProjectSkillQuestion(text) {
  const compact = text.replace(/\s+/g, "");

  return (
    includesAny(text, [
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
    includesAny(compact, [
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

function isAssistantPurposeQuestion(text) {
  const compact = text.replace(/\s+/g, "");

  return (
    includesAny(text, [
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
    includesAny(compact, [
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

function extractText(data) {
  if (data.output_text) {
    return data.output_text.trim();
  }

  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) {
        chunks.push(content.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

app.listen(PORT, () => {
  console.log(`Anu is listening at http://localhost:${PORT}`);
});
