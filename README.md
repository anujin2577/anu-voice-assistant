# Anu Voice Assistant

Anu is a website-based, voice-first AI assistant demo for Mongolia. Users speak to Anu, the browser converts speech to text, the backend sends that text to a real AI model, and the backend returns generated speech audio for Anu to play back.

## Folder Structure

```text
anu-voice-assistant/
  public/
    index.html
    styles.css
    app.js
  .env.example
  package.json
  server.js
  README.md
```

## Install

```bash
npm install
```

## Environment

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Then set:

```text
OPENAI_API_KEY=sk-your_openai_api_key_here
DEMO_MODE=scripted
OPENAI_TEXT_MODEL=gpt-5-mini
TTS_PROVIDER=auto
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=marin
CHIMEGE_TTS_URL=https://your-chimege-tts-endpoint.example
CHIMEGE_API_KEY=your_chimege_api_key_here
CHIMEGE_VOICE=female
CHIMEGE_FORMAT=mp3
PORT=3000
```

The key stays on the backend. It is never sent to the browser.

If you do not have an OpenAI or Chimege key yet, use `DEMO_MODE=scripted`. Anu will preview the voice flow with prepared demo replies and browser speech synthesis. That mode is useful for showing the interface, but it is not a full AI model.

Good scripted demo questions:

```text
өнөөдрийн цаг агаарыг хэлнэ үү
одоо цаг хэд болж байна
чи хэн бэ
чи монголоор ярьж чадах уу
энэ demo юу хийдэг вэ
```

For real Mongolian voice output, set `CHIMEGE_TTS_URL` and `CHIMEGE_API_KEY` from your Chimege API account. With `TTS_PROVIDER=auto`, Anu uses Chimege for Mongolian answers when Chimege is configured, and OpenAI TTS as a fallback. With `TTS_PROVIDER=chimege`, Mongolian answers require Chimege and will fail loudly if it is not configured.

If Chimege gives you a different request shape, adjust these fields without changing the frontend:

```text
CHIMEGE_AUTH_HEADER=Authorization
CHIMEGE_AUTH_SCHEME=Bearer
CHIMEGE_TEXT_FIELD=text
CHIMEGE_VOICE_FIELD=voice
CHIMEGE_FORMAT_FIELD=format
```

## Run Locally

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Allow microphone access in the browser. Chrome is recommended for the MVP because it has the best Web Speech API support.

## How Wake Phrase Works

Wake Mode starts browser speech recognition in continuous mode. The frontend listens locally for phrases like:

```text
Hey Anu
Hi Anu
Хэй Ану
Сайн уу Ану
```

When one is heard, the app stops wake listening and starts one normal recognition session for the actual question. After Anu answers with voice, Wake Mode starts again and waits for the wake phrase.

This MVP wake phrase is browser-level speech recognition, not an always-on production wake word engine.

## Backend API

`POST /api/ask`

Request:

```json
{
  "text": "What is the weather like in Ulaanbaatar?",
  "language": "en"
}
```

Response:

```json
{
  "replyText": "I cannot check live weather in this demo, but I can help you plan for Ulaanbaatar conditions.",
  "audio": {
    "mimeType": "audio/mpeg",
    "base64": "..."
  }
}
```

The backend does two real API calls:

1. Sends the user's text to the OpenAI Responses API.
2. Sends Anu's short answer to Chimege TTS for Mongolian voice when configured, or OpenAI speech as fallback, then returns audio.

## Deploy

### Simple Demo Deployment

Deploy the whole Node app to a service that supports Node.js servers, such as Render, Railway, Fly.io, or a VPS.

1. Push the project to GitHub.
2. Create a new Node web service.
3. Set the build command:

```bash
npm install
```

4. Set the start command:

```bash
npm start
```

5. Add environment variables in the hosting dashboard:

```text
OPENAI_API_KEY
OPENAI_TEXT_MODEL
TTS_PROVIDER
OPENAI_TTS_MODEL
OPENAI_TTS_VOICE
CHIMEGE_TTS_URL
CHIMEGE_API_KEY
CHIMEGE_VOICE
CHIMEGE_FORMAT
```

The Express server serves both the frontend and backend, so this is the easiest deployment.

### Split Frontend and Backend

You can also deploy `public/` to a static host such as Netlify or Vercel and deploy `server.js` separately. In that case, update the frontend `fetch("/api/ask")` call in `public/app.js` to your backend URL and configure CORS carefully.

## Demo-Level Parts

- If no API key is configured, Anu runs in no-key demo mode with simple built-in replies.
- Browser speech recognition depends on the user's browser and internet connection.
- Wake Mode uses browser transcription, not a specialized wake-word model.
- The app does not store conversation history.
- Audio is returned as base64 JSON for simplicity, which is fine for a demo but less efficient than streaming.
- Wake Mode and question input still use browser speech recognition. Duudlaga Flow is a strong Mongolian speech-to-text product, but its public pages describe a desktop dictation app rather than a website TTS API.

## Production-Level Parts

- API keys are backend-only.
- The backend has one clear `/api/ask` endpoint.
- AI answer generation and TTS are separated, so you can swap the TTS provider later.
- Mongolian spoken output can use Chimege TTS from the backend, keeping Chimege credentials private.
- The assistant prompt keeps Anu formal, polite, calm, concise, and voice-friendly.
- The frontend is responsive and keeps voice as the primary interaction.

## Upgrade Ideas

- Use the OpenAI Realtime API for lower-latency speech-to-speech interaction.
- Add a production wake-word engine.
- Replace browser speech recognition with a Mongolian-specialized STT API if Duudlaga Flow or Chimege provides a web API for your account.
- Stream audio instead of returning base64.
- Add conversation memory with a database.
