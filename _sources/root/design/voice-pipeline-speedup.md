# Voice Pipeline Speedup

## Overview

The Voice Hub pipeline is currently fully sequential — each stage waits for the previous one to complete before starting. This design doc captures two concrete optimizations that together should reduce perceived latency by ~2-3x.

**Current flow:**
```
record → STT (1-2s) → LLM full response (1-3s) → TTS full audio (1s) → play
```

**Target flow:**
```
record → STT/Groq (~300ms) → LLM stream → sentence 1 TTS → play
                                         → sentence 2 TTS → queue
                                         → sentence 3 TTS → queue
```

---

## Optimization 1 — Groq Whisper for faster STT

### Problem

The OpenAI Whisper API takes ~1-2 seconds for short utterances. This is the first bottleneck after the user stops speaking.

### Solution

Groq's Whisper endpoint (`https://api.groq.com/openai/v1/audio/transcriptions`) runs `whisper-large-v3-turbo` on their fast inference hardware. In practice ~300-500ms for typical voice queries — the same API shape as OpenAI, just a different base URL and model name.

### Implementation

**`peers-electron/src/server/voice/stt-service.ts`**
- Add `'groq'` to `STTProvider` type (currently `'auto' | 'cloud' | 'local'`)
- Add `transcribeWithGroq(audioBuffer, groqApiKey, language?)` — identical to `transcribeWithWhisperAPI` but posts to `https://api.groq.com/openai/v1/audio/transcriptions` with `model: 'whisper-large-v3-turbo'`
- Add `groqApiKey` field and `setGroqApiKey()` to `STTService`; route to Groq when provider is `'groq'`

**`peers-electron/src/server/voice/voice-service.ts`**
- Load `GROQ_API_KEY` secret pvar in `initialize()` and `reloadApiKeys()`, pass to `sttService.setGroqApiKey()`

No new RPC stubs needed — the existing `voiceSettings` pvar carries `sttProvider` to the UI settings panel.

---

## Optimization 2 — Custom Voice LLM Harness with Streaming

### Problem

The current path calls `invokeAgent()` from `agent-functional.ts`, which goes through LangChain. For voice, this adds:
- LangChain abstraction overhead
- A lazy `await import()` on every call
- No clean streaming interface
- `IChatEntry` conversion that doesn't match the OpenAI API format

The LLM waits for the full response before TTS can begin at all.

### Solution

A new dedicated module, `voice-llm.ts`, lives in the voice subsystem alongside `stt-service.ts` and `tts-service.ts`. It calls the OpenAI SDK directly and streams tokens, chunking them into sentences which are yielded via an `AsyncGenerator`. This is completely separate from `agent-functional.ts` — the existing LangChain path is untouched.

### Implementation

**NEW: `peers-electron/src/server/voice/voice-llm.ts`**

```typescript
export interface VoiceMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Streams the LLM response, yielding complete sentences as they arrive.
// Sentence boundary = ends with . ! ? followed by whitespace or end-of-stream,
// with a minimum chunk length (~15 chars) to avoid tiny fragments like "Okay."
export async function* streamVoiceResponse(
  userInput: string,
  history: VoiceMessage[],
  opts: { apiKey: string; model?: string; systemPrompt?: string }
): AsyncGenerator<string>
```

Key design decisions:
- **Direct OpenAI SDK** — `import OpenAI from 'openai'`, no LangChain
- **Sentence chunking** lives here; TTS service just plays what it receives
- **History format** is `VoiceMessage[]` matching the OpenAI messages API directly — no `IChatEntry` conversion
- **No tool/function-calling support** — intentional; keeps the path simple and fast
- Default model: `gpt-4o-mini`

---

## Optimization 3 — Sentence-Pipelined TTS

### Problem

TTS synthesis for the full response takes ~1s. Even with a streaming LLM, if we wait for all sentences before starting TTS, we lose the benefit of streaming.

### Solution

As sentences arrive from `streamVoiceResponse`, kick off TTS synthesis for each one immediately in the background. Maintain a play queue: buffers are queued in order and played sequentially. The first sentence starts playing as soon as its audio is ready, while sentences 2, 3, etc. are synthesizing concurrently.

```
sentence 1 → synthesize ──────────────► play immediately
sentence 2 →   synthesize ──────────► queue → play after 1
sentence 3 →     synthesize ────────► queue → play after 2
```

### Implementation

**`peers-electron/src/server/voice/tts-service.ts`**
- Add `speakStream(sentences: AsyncIterable<string>): Promise<void>`
- For each sentence: kick off `synthesize()` immediately (non-blocking)
- Maintain an ordered play queue; send `voice:playAudio` events to renderer sequentially
- Handle cancellation: if `stop()` is called, drain the queue

**`peers-electron/src/server/voice/voice-service.ts`**
- Replace `sendMessageToAssistant()` to use the new harness:
  1. Map `VoiceMessages` history to `VoiceMessage[]` directly (no `IChatEntry`)
  2. Call `streamVoiceResponse()` → get sentence `AsyncGenerator`
  3. Transition state from `'processing'` to `'speaking'` when first sentence arrives
  4. Pass generator to `ttsService.speakStream()`
  5. Accumulate full response text from sentences → save both turns to `VoiceMessages` at the end

---

## Expected Latency Improvement

| Stage | Before | After |
|---|---|---|
| STT | ~1-2s | ~300-500ms (with Groq key) |
| LLM to first audio | ~2-4s | ~0.5-1s (first sentence fast) |
| Overall perceived latency | baseline | ~2-3x faster |

Note: Groq STT requires the user to add a `GROQ_API_KEY` in voice settings. The OpenAI path remains as the default fallback.

---

## Files to Change

- `peers-electron/src/server/voice/stt-service.ts` — add Groq provider
- `peers-electron/src/server/voice/voice-service.ts` — load Groq key; use new harness + speakStream
- NEW `peers-electron/src/server/voice/voice-llm.ts` — custom streaming LLM harness for voice
- `peers-electron/src/server/voice/tts-service.ts` — add `speakStream()` for pipelined TTS
