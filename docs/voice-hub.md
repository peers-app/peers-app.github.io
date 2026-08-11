---
title: Voice Hub
sidebar_position: 8
---

# Voice Hub

Voice Hub adds push-to-talk, optional local wake-word activation, speech recognition, spoken
responses, and voice-triggered Peers actions. It is an official Peers package, so it can be
installed, updated, disabled, or removed independently of the desktop and PWA applications.

## Platform support

- **Desktop (Electron):** push-to-talk and optional wake listening while the Voice Hub screen is
  open.
- **PWA and other browsers:** push-to-talk and speech output. Wake listening is disabled because
  browsers cannot reliably keep microphone work running in the background.

Voice Hub does not run as a hidden background service. Closing its screen releases the microphone.

## Set up Voice Hub

1. Install or update the official Voice Hub package, then open **Voice Hub** from app navigation.
2. Open **Settings** in the Voice Hub header.
3. Add an OpenAI API key. Speech-to-text, voice-turn responses, and the default action assistant
   require it.
4. Leave **Browser** selected for free, device-provided speech output, or select **OpenAI** for
   cloud voices.
5. On desktop, enable wake listening if desired and allow microphone access when prompted.
6. Select the assistant that should receive actions such as “add milk to groceries.” The bundled
   **Voice Hub Agent** is the default.

The default wake phrase is **Sterling**. You can also select **Operator**, **Duchess**, **Hey
Duchess**, **Hey Operator**, or **Hey Woodhouse** for side-by-side testing. The detection threshold
controls the tradeoff between missed activations and false activations: raise it to be more
conservative, or lower it if your microphone frequently misses the phrase. Each model starts at its
own recommended real-device threshold; Hey Operator starts at `0.72`. While listening, Voice Hub
displays the live microphone level, wake-model score, inference time, and skipped frame count
beside the active threshold. Recording ends after about three-quarters of a second of silence. The
**Wake re-arm delay** starts after a turn and its completion tone finish. Its two-second default
prevents the assistant's own tones, spoken response, or room echo from immediately starting another
recording.

Wake listening continuously runs local audio processing while the Voice Hub screen is open, so a
steady CPU load is expected. Open Settings, disable wake listening, or leave Voice Hub to stop it.
Opening Settings pauses microphone capture until you return to the main Voice Hub screen.

Voice Hub uses a bundled Silero neural voice-activity model for wake gating and automatic
end-of-speech detection. While desktop wake listening is idle, it slowly adapts a bounded room-noise
estimate from high-confidence non-speech. Adaptation freezes during wake candidates, recording,
processing, speech output, and the wake re-arm delay. It does not change the wake-model threshold or
persist room conditions between sessions.

## Tune your device

Microphones and rooms differ, so acoustic values are stored on each device instead of syncing with
your other Peers installations. A new device starts with conservative benchmark defaults. During
upgrade, legacy device values bind to the first microphone identity the browser provides.

Open **Settings** and select **Tune this device**. Say the selected wake phrase three times in your
normal intentional activation voice—slightly raised over ordinary conversation, but not shouted.
Then record two ordinary commands in a normal voice and leave trailing silence. There is no separate
ambient recording or validation round; continuous room adaptation handles changing stationary
noise. Settings change only after you select **Apply successful tuning**.

The full wake flow is available on desktop. Browsers and the PWA tune speech endpointing only.
Wake and endpoint tuning can succeed independently, so a partial result can be applied while the
other dimension keeps its neural default. Changing the selected wake phrase makes wake tuning
stale. Changing microphones keeps the old profile marked as stale and activates defaults for the
new input. You can also use the advanced sliders for manual device-local changes or select **Reset
this device** to return to benchmark defaults.

Tuning audio is processed locally, kept only in memory, and discarded when the wizard closes. It is
not transcribed, uploaded, or added to conversation history. Voice Hub stores only the resulting
values, microphone/model identity, completion flags, date, and aggregate quality summary. The
rolling room-noise estimate and neural recurrent state are never persisted. Three positive wake
attempts are personal setup evidence, not a release-quality false-activation benchmark, and cannot
lower the model's benchmark safety threshold.

## Use voice input

Tap the microphone, speak, and either tap stop or pause for automatic endpoint detection. On the
desktop, you can instead say the selected wake phrase while Voice Hub is open.

Voice Hub handles three kinds of turns:

- Short conversational questions receive a concise response and optional spoken output.
- Acknowledgements can produce a quiet emoji response.
- Requests that change Peers data are delegated to the selected action assistant and linked to the
  resulting thread. The default **Voice Hub Agent** uses a package-owned OpenAI runner and includes
  grocery, timer, and task tools directly, so those actions do not require Peers Services.

The **Action assistant** selection includes that assistant's runner, prompts, and tool policy. To
use a different runner or tool set, create or import an assistant configured that way and select it
in Voice Hub. Custom assistants can have their own credential and service requirements.

Use **Cancel** to stop recording, an in-flight request, or speech playback.

## Providers and privacy

Wake-word inference, Silero neural voice activity detection, adaptive room-noise analysis, and
browser speech synthesis run on the device. The wake classifiers, VAD model, and ONNX runtime are
bundled with the package; they do not require an API key or a model download.

Recorded utterances are sent to OpenAI when you request transcription. Transcribed text and recent
Voice Hub context are sent to OpenAI for response and action classification. When the bundled Voice
Hub Agent executes an action, its instruction, fixed-tool definitions, and tool results are sent to
OpenAI for the tool-calling loop. OpenAI speech output also sends response text to OpenAI. The API
key is stored in Peers' existing encrypted secret persistent variable. Voice Hub performs these
requests in the trusted local host, so the decrypted key is not returned to the Electron renderer.

Conversation history is stored in a local-only package table. Existing history from the earlier
built-in voice implementation is copied into that table the first time the updated package opens.
Device tuning values are stored in a separate device-local persistent variable and do not sync.

## Troubleshooting

### The microphone does not start

Allow microphone access in the operating system and Electron/browser permission settings, then
reopen Voice Hub. Check that an input device is connected and not exclusively held by another
application.

### The wake phrase does not activate

Wake listening works only in the desktop app while Voice Hub is open and enabled. Try push-to-talk
first to verify microphone access. Speak the complete phrase, reduce the detection threshold in
small steps, or switch to another bundled phrase. The microphone percentage should rise when you
speak; compare the displayed wake score with the threshold to distinguish input problems from model
tuning. Run **Tune this device** after changing microphones or wake phrases.

### Tuning reports a partial result

Apply the successful dimension; the failed wake or endpoint dimension continues using its neural
default. For another attempt, speak the wake phrase intentionally and slightly louder than ordinary
conversation, then use a normal voice for commands.

### Television or family speech affects detection

The neural VAD distinguishes speech from non-speech, not your voice from another speaker. The wake
classifier still checks the selected phrase, but competing speech and television remain harder than
stationary appliance noise. A future personal verifier may be needed in rooms with persistent
competing speech.

### Voice Hub activates again after a response

Increase the **Wake re-arm delay** in small steps. Voice Hub resets wake-model history after each
turn and does not resume wake inference until this delay expires, allowing local tones and spoken
output to clear the room first.

### Transcription or OpenAI speech fails

Confirm that the OpenAI key is set, valid, and has available API usage. Voice Hub reports provider
errors in its control panel without including key material. If OpenAI rejects the key, replace it in
Voice Hub settings and save before using **Test speech**. Select the legacy `whisper-1`
transcription model only when the default `gpt-4o-mini-transcribe` path is unsuitable.

### A voice action fails

The bundled Voice Hub Agent uses the OpenAI key saved in Voice Hub settings and does not require
Peers Services. Confirm the key has available API usage and that the requested package tool is
installed in the active group. If you selected a custom action assistant, check that assistant's
runner, credentials, and tool policy.

### Browser speech is silent

Check the device output volume and operating-system speech voices. Some browsers require a direct
button interaction before audio playback; use **Test speech** from Voice Hub settings.

## Removing Voice Hub

Disable or remove the package through Peers package management to remove its voice UI and runtime
behavior. Base Peers components do not contain a second wake-word or speech service.
