# Voice Input - Agent Context

Technical context for AI agents working on the voice input system.

## Architecture Overview

```
peers-electron/src/server/voice/
├── index.ts              # RPC handlers, initialization
├── wake-word-detector.ts # Picovoice Porcupine integration
├── audio-capture.ts      # Microphone recording with silence detection
├── stt-service.ts        # Speech-to-text (OpenAI Whisper)
├── tts-service.ts        # Text-to-speech (OpenAI TTS + browser fallback)
└── voice-service.ts      # Main coordinator, state machine

peers-ui/src/
├── components/voice-indicator.tsx    # Status UI component
└── screens/settings/voice-settings.tsx  # Settings panel
```

## Key Classes

### VoiceService (voice-service.ts)

Main coordinator. Singleton accessed via `getVoiceService()`.

**State Machine:**
```typescript
type VoiceState = 'disabled' | 'idle' | 'listening' | 'recording' | 'processing' | 'speaking';
```

**Key Methods:**
- `initialize()` - Load settings from pvars, auto-enable if previously enabled
- `enable()` / `disable()` - Start/stop wake word detection
- `startRecording()` / `stopRecording()` - Manual recording control
- `saveSettings(settings)` - Persist non-secret settings to pvar
- `reloadApiKeys()` - Refresh API keys from pvars after saving

**Settings Types:**
```typescript
interface VoiceSettingsNonSecret {
  enabled: boolean;
  wakeWord: BuiltinWakeWord;  // 'COMPUTER', 'JARVIS', 'ALEXA', etc.
  wakeWordSensitivity: number;
  sttProvider: 'auto' | 'cloud' | 'local';
  ttsProvider: 'browser' | 'cloud';
  ttsVoice?: string;
  ttsSpeed: number;
}

interface VoiceSettings extends VoiceSettingsNonSecret {
  picovoiceAccessKeySet?: boolean;  // Flag only, not actual value
  openaiApiKeySet?: boolean;
}
```

### WakeWordDetector (wake-word-detector.ts)

Picovoice Porcupine wrapper. Supports all built-in Picovoice wake words (COMPUTER is default).

**Available wake words:** ALEXA, AMERICANO, BLUEBERRY, BUMBLEBEE, COMPUTER, GRAPEFRUIT, GRASSHOPPER, HEY_GOOGLE, HEY_SIRI, JARVIS, OK_GOOGLE, PICOVOICE, PORCUPINE, TERMINATOR

**Important:** `pause()` and `resume()` are async - they release/re-acquire the microphone so AudioCapture can use it.

```typescript
await wakeWordDetector.pause();   // Releases mic
await audioCapture.start();       // Now can use mic
// ... recording ...
await audioCapture.stop();
await wakeWordDetector.resume();  // Re-acquires mic
```

### AudioCapture (audio-capture.ts)

Records audio with silence detection.

**Options:**
- `silenceThreshold: 0.01` - RMS threshold for silence
- `silenceDuration: 1500` - ms of silence to stop recording
- `maxDuration: 30000` - Maximum recording time

**Output:** WAV buffer (16kHz mono 16-bit PCM)

### STTService (stt-service.ts)

Speech-to-text transcription.

```typescript
const result = await sttService.transcribe(audioBuffer);
console.log(result.text);  // Transcribed text
```

### TTSService (tts-service.ts)

Text-to-speech output.

```typescript
await ttsService.speak("Hello world");  // Plays audio
await ttsService.stop();                 // Interrupt playback
```

## Settings Persistence

**Secure pvars (encrypted):**
- `PICOVOICE_ACCESS_KEY` - User-scoped
- `OPENAI_API_KEY` - User-scoped (shared with other features)

**Regular pvar:**
- `voiceSettings` - User-scoped, contains VoiceSettingsNonSecret

**Loading:**
```typescript
// In voice-service.ts initialize()
const pvar = getVoiceSettingsPvar();
await pvar.loadingPromise;
const settings = pvar();

// Secret keys via getVariable (handles decryption)
const key = await getVariable(groupId, 'PICOVOICE_ACCESS_KEY', 'voice-service');
```

**Saving:**
```typescript
// Non-secret settings
pvar(newSettings);  // Auto-persists

// Secret keys via RPC
await rpcServerCalls.voiceSaveSecretKey('PICOVOICE_ACCESS_KEY', value);
```

## RPC Endpoints

Defined in `peers-sdk/src/rpc-types.ts`:

```typescript
// State
voiceGetState(): Promise<{ state: VoiceState; settings: VoiceSettings }>
voiceSetEnabled(enabled: boolean): Promise<void>
voiceSetSettings(settings: Partial<VoiceSettingsNonSecret>): Promise<void>

// Secret keys
voiceSaveSecretKey(keyName: 'PICOVOICE_ACCESS_KEY' | 'OPENAI_API_KEY', value: string): Promise<void>

// Recording
voiceStartRecording(): Promise<void>
voiceStopRecording(): Promise<void>

// Configuration
voiceSetTargetChannel(channelId: string): Promise<void>
voiceGetAudioDevices(): Promise<string[]>
voiceGetTTSVoices(): Promise<{ id: string; name: string; description: string }[]>
voiceTestTTS(text: string): Promise<void>
```

## Events

Voice state changes emit events via `rpcClientCalls.emitEvent`:

- `voice:stateChanged` - `{ state: VoiceState }`
- `voice:transcription` - `{ text: string, isFinal: boolean }`
- `voice:volumeLevel` - `{ level: number }` (RMS 0-1)
- `voice:error` - `{ message: string }`

## Common Tasks

### Change the wake word

Users can select from built-in wake words in Settings > Voice Input. The `wakeWord` setting is stored in the `voiceSettings` pvar. Changing it triggers a restart of the wake word detector.

### Add a custom wake word

Picovoice requires custom wake words to be trained in their console. To add support for custom .ppn model files, extend `wake-word-detector.ts` to accept a model path in addition to built-in keywords.

### Add local STT

The `stt-service.ts` has placeholder for local Whisper. Implement using `whisper-node` or similar.

### Modify silence detection

Adjust `silenceThreshold` and `silenceDuration` in `audio-capture.ts` or make them configurable.

### Add voice indicator to main UI

Import `VoiceIndicator` from `peers-ui` and place it in the app layout. It subscribes to voice state events.

## Dependencies

```json
"@picovoice/porcupine-node": "^3.0.0",
"@picovoice/pvrecorder-node": "^1.2.0"
```

**Note:** These are native modules requiring rebuild for Electron. Run `npm run rebuild` if issues occur.

## Gotchas

1. **PvRecorder.read() is async** - Must await, returns Promise<Int16Array>

2. **Microphone exclusivity** - Only one PvRecorder can use the mic at a time. Wake word detector must release it for audio capture.

3. **Error accumulation** - Wake word detector stops after 5 consecutive errors to prevent spam.

4. **Settings save timing** - UI holds local state until user clicks Save to avoid auto-persisting incomplete changes.
