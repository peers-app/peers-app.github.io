# Voice Input

Peers supports hands-free voice interaction using wake word detection. Say the wake word, speak your message, and get a response.

## Setup

### 1. Get API Keys

**Picovoice Access Key** (required for wake word):
1. Go to [console.picovoice.ai](https://console.picovoice.ai)
2. Create a free account
3. Copy your Access Key

**OpenAI API Key** (required for cloud STT/TTS):
1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an API key
3. Copy the key

### 2. Configure in Settings

1. Open **Settings** → **Voice** tab
2. Enter your Picovoice Access Key
3. Enter your OpenAI API Key (if not already set)
4. Choose your preferred settings:
   - **STT Provider**: Auto (recommended), Cloud, or Local
   - **TTS Provider**: Cloud (OpenAI) or Browser
   - **TTS Voice**: Select from available voices
   - **TTS Speed**: Adjust playback speed
   - **Wake Word Sensitivity**: Lower = fewer false triggers, Higher = more responsive
5. Click **Save**
6. Toggle **Enable Voice Input** on

## Usage

### Wake Word

The default wake word is **"Porcupine"**. Say it clearly to activate voice input.

### Voice Flow

1. **Say the wake word** - "Porcupine"
2. **Wait for the listening indicator** - The app will show it's ready
3. **Speak your message** - Talk naturally
4. **Wait for silence detection** - Recording stops automatically after 1.5 seconds of silence
5. **Receive response** - The assistant will respond (with TTS if enabled)

### Manual Recording

You can also trigger recording manually without the wake word using the voice indicator (when available in the UI).

## Settings Reference

| Setting | Description | Default |
|---------|-------------|---------|
| Enable Voice Input | Turn voice features on/off | Off |
| Wake Word Sensitivity | Detection threshold (0.0-1.0) | 0.5 |
| STT Provider | Speech-to-text service | Auto |
| TTS Provider | Text-to-speech service | Browser |
| TTS Voice | Voice for speech output | Default |
| TTS Speed | Playback speed (0.25-4.0x) | 1.0 |

## Troubleshooting

### Wake word not detected
- Check that voice input is enabled
- Try increasing wake word sensitivity
- Ensure your microphone is working and has permission
- Speak the wake word clearly: "Porcupine"

### Recording doesn't start
- The microphone may be in use by another application
- Check system microphone permissions for Peers

### No transcription
- Verify your OpenAI API key is set correctly
- Check your internet connection
- Look at the app logs for errors

### TTS not working
- For cloud TTS, ensure OpenAI API key is set
- Try the "Test TTS" button in settings
- For browser TTS, check that your system has voices available

## Privacy Notes

- Wake word detection runs locally using Picovoice (audio is not sent to cloud for wake word)
- When using cloud STT (OpenAI Whisper), your recorded audio is sent to OpenAI for transcription
- When using cloud TTS (OpenAI), your assistant's responses are sent to OpenAI for speech synthesis
- API keys are stored encrypted in your local database
