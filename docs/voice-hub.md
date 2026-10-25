---
title: Voice Hub
sidebar_position: 8
---

# Voice Hub

Voice Hub adds push-to-talk, optional local wake-word activation, speech recognition, spoken
responses, and voice-triggered Peers actions. Each device can use the **Standard** interface (one
request at a time) or the **Live** interface (a back-and-forth OpenAI GPT-Live conversation). It is
an official Peers package, so it can be installed, updated, disabled, or removed independently of
the desktop and PWA applications.

## Platform support

- **Desktop (Electron):** push-to-talk, optional wake listening while the Voice Hub screen is
  open, and the Live interface.
- **PWA and other browsers:** not supported yet. The PWA does not run isolated packages, so Voice
  Hub's provider (transcription, voice actions, OpenAI speech, and Live) is unavailable there.
  Browsers also cannot reliably keep wake listening running in the background.

Voice Hub does not run as a hidden background service. Closing its screen releases the microphone.

## Set up Voice Hub

1. Install or update the official Voice Hub package, then open **Voice Hub** from app navigation.
2. Open **Settings** in the bottom-right dock.
3. Add an OpenAI API key. Speech-to-text, voice-turn responses, and skill calls require it. The
   key is a package secret. Voice Hub's worker never receives it.
4. Leave **Browser** selected for free, device-provided speech output, or select **OpenAI** for
   cloud voices. The default cloud voice is Fable at 1.2x.
5. On desktop, enable wake listening if desired and allow microphone access when prompted.

The default wake phrase is **Sterling**. You can also select **Operator**, **Duchess**, **Hey
Duchess**, **Hey Operator**, or **Hey Woodhouse** for side-by-side testing. The detection threshold
controls the tradeoff between missed activations and false activations: raise it to be more
conservative, or lower it if your microphone frequently misses the phrase. Each model starts at its
own recommended real-device threshold; Hey Operator starts at `0.72`. The idle dock is quiet by
default. To show idle guidance and the live microphone level, wake-model score, inference time, and
skipped frame count beside the active threshold, enable **Show listening diagnostics** in Settings
and select **Save**. The preference persists across reopening and works in narrow layouts without
changing wake inference or device tuning. Active/error status and cancellation remain available
with diagnostics off. Idle guidance is also hidden during a manual session's re-arm gap.
The ear/hand dock toggle switches wake listening on or off.
Recording ends after about three-quarters of a second of silence. The
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

## Choose a voice interface

Open **Settings → Voice interface**. The choice applies to this device only, so a kitchen hub can
use Live while a laptop keeps Standard.

| | Standard | Live |
|---|---|---|
| How a turn works | You speak, Voice Hub detects the end, transcribes, acts, then replies | One open conversation; GPT-Live listens and speaks at the same time |
| Interrupting | Tap the mic or Cancel | Talk over it |
| Speech output | Browser speech (free) or OpenAI speech | GPT-Live's voice (choose it under **Live voice**) |
| Cost | Per request: transcription, the voice turn, optional OpenAI speech | GPT-Live per second ($0.05 a minute, at least 15 seconds per conversation), plus the voice-turn requests |

With **Live**, the wake phrase or a mic tap opens a conversation, and it stays open until about 15
seconds of quiet, or until you tap the mic or **Cancel**. It also ends when the conversation
sounds finished: the assistant decides when you're done (“Thanks, that's all”, “Perfect, thank
you”) and says a short goodbye, and the conversation closes once that goodbye finishes. A goodbye
on its own, such as **“goodbye”**, **“that's all”**, or a cancel phrase, always ends it, even with
fillers around it (“Okay, uh, goodbye for now”). Requests that need an app are handed back to
Voice Hub and run through the same voice skills and access checks as Standard, one at a time and
in order. Quiet successes still play Voice Hub's confirmation tone instead of a spoken reply.
Cancel stops in-flight requests but cannot undo actions that already ran. Timer and other alerts
are spoken inside the open conversation. Both sides of the conversation appear in history.

Live needs the desktop app and an OpenAI account with GPT-Live access; Free-tier accounts are
refused. If a conversation cannot start, Voice Hub shows the reason and offers **Use the standard
voice interface**. It never switches interface or repeats a request by itself.

## Use voice input

Tap the microphone, speak, and either tap stop or pause for automatic endpoint detection. On the
desktop, you can instead say the selected wake phrase while Voice Hub is open.

Voice Hub handles three kinds of turns:

- Short conversational questions receive a concise response and optional spoken output.
- Acknowledgements can produce a quiet emoji response.
- Requests that match an installed voice skill call that package on this device. Timers, Groceries,
  Tasks, Weather, and News are current examples. Voice Hub does not know those packages at build
  time. A skill can also contribute a contextual widget.

See [Voice skills](./Packages/voice-skills) for how a package registers itself.

Use **Cancel** to stop recording, an in-flight request, or speech playback.
While recording, you can also say **“never mind”**, **“nevermind”**, **“cancel listening”**, or
**“stop listening”** as the whole utterance. Add “please” at either end, or address the configured
wake phrase at either end, including “please Sterling, never mind” and “Sterling, please stop
listening”. Matching ignores case, punctuation, and extra whitespace; underscores in the wake
model name are treated as spaces. These end listening and any manual conversation
session without assistant dispatch or a history entry. Spoken cancellation is recognized after
endpointing and transcription, so the recorded audio still goes through STT. It does not listen for
interruption during assistant processing or playback, or undo dispatched skills. Bare “stop” and
“cancel”, “go back to sleep”, timer commands, and requests such as “add never mind to my list” or
“stop listening now” still reach the assistant.

Transcription, responses, skill-aware turns, synthesis, Live session creation, and cancellation
require Reader (20).
Clearing local voice history requires Owner (80). Anyone speaking acts as the signed-in user,
using the configured OpenAI credential and installed skills admitted by their own access checks.
The wake word is not a second login.

Voice Hub's entry tool is Reader and preserves the caller's authority for skill calls.
Ordinary skill tools cap subsequent calls at their own effective level.
A delegated Reader cannot dispatch a Writer action even for a Writer user; this path does not
use assistant approvals. Delegated remote-device action calls fail closed. Weather and news
voice answers use cached data only; refresh requires Writer. These checks cover the migrated
tool paths, not general table or observable writes.

## Adaptive workspace

Voice Hub opens on **Overview**, where populated skills show summary cards with a header and
content body: several grocery items, current weather conditions, or several news headlines.
Only empty skills use a single row with an icon, name, and quiet status; skills needing attention
keep their card layout. Cards pack beneath shorter neighbors without forcing equal heights.
Opening Weather refreshes a stale forecast; after that, Weather refreshes about once an hour in
the background on devices whose user is a Writer, and a Reader's device picks up those forecasts
within a few minutes. Weather shows the last good forecast with its age, **Stale** after an hour,
or **Last forecast (refresh failed)** after a failed refresh, and never shows another city's
forecast as the saved city's. **Update** fetches the typed city and saves it, keeping the unit; a
city that can't be found leaves the saved city unchanged. A typed city survives forecast and
unit updates, and only **Update** disables the controls. Asked about the weather, Voice Hub answers
from the cached forecast without fetching.

Tap a context such as **Groceries**, **Tasks**, **Timers**, **Weather**, or **News**
to open its complete touch
controls. After a successful voice skill action, Voice Hub opens the widget owned by the skill that
handled the request. About 60 seconds after the last voice turn or touch, that skill returns to
Overview. A voice turn, an open conversation, or an alert sound such as a timer chime keeps the
skill in front until it finishes. A skill alert, such as an expired timer, can also bring its widget forward and
mark it as needing attention. If the alert includes a detail sentence and voice output is enabled,
Voice Hub speaks it once. Alerts wait for an active voice turn and queue in order. Timer finish
speech plays before a short rising three-note pluck that repeats about every 3 seconds.
Say “stop” to dismiss all alarming timers, or use the widget's Dismiss control. Other running timers
continue. With voice output off, no spoken line delays the chime.
Successful changes that do not need an answer are a tone and an emoji, not a spoken confirmation.
The screen aims to minimize listening and searching: speech answers questions and announces
time-sensitive events, while completed actions use the done tone. A failed action uses the failed
tone and keeps its explanation in recent conversation context; ask “what happened?” for an answer.
Error messages have a single `Error:` prefix.
Voice Hub uses skill activity and alerts for this selection; it does
not guess from transcript text or hard-code package identities.

Tasks summary and voice results rank all matching tasks in the current personal/group context
before limiting results: In-Progress, Queued, Backlog, Done, then Canceled; earliest valid due
date first, followed by descending sort order and task ID. Undated tasks follow dated tasks.
Overview shows four unsnoozed actionable tasks; focus includes snoozed tasks, with up to 25 per
section and eight Done tasks ordered by most recent completion. Subtasks remain eligible and
summary/voice counts include all matching rows; focus badges count displayed rows. Voice defaults
to In-Progress/Queued. Tap a task title on Overview or in focus to open
that exact task in Tasks, with its detail view on phones. Complete/Reopen is a separate button.
After a successful quick create, the title field clears even if the task list refreshes again.
Failed creates keep the entered title. Focus shows action errors for the current context, but a
later refresh can clear them; these are not persistent notifications.
The main Tasks app retains its existing section ordering and All Groups preference.

The layout follows the space available to the Voice Hub tab:

- On phones, the context picker scrolls horizontally, one widget fills the workspace, and
  **Conversation** and **Settings** open as full-height panels.
- On tablets, including the primary 10-inch layout, the workspace and conversation remain visible
  together and Overview uses compact summary cards.
- On wide displays, contexts move to a side rail, the workspace width is capped for readable
  controls, and conversation remains beside it.

The microphone dock stays at the bottom in every layout. Its microphone, the cancel button beside
it, the wake/manual toggle, context buttons, and focused widget actions are designed for touch use
without a keyboard. Settings stays at the right end of the dock. Widget contents still belong to their packages, so installing or removing a Voice Skill
updates the workspace without a Voice Hub release.

## Providers and privacy

Wake-word inference, Silero neural voice activity detection, adaptive room-noise analysis, and
browser speech synthesis run on the device. The wake classifiers, VAD model, and ONNX runtime are
bundled with the package; they do not require an API key or a model download.

Recorded utterances are sent to OpenAI when you request transcription. Transcribed text, recent
Voice Hub context, and the catalogs of installed voice skills are sent to OpenAI for the voice
turn. OpenAI speech output also sends response text to OpenAI. The API key is a package secret.
System HTTP injects it on the host, so neither the renderer nor the isolated worker receives it.

With **Live**, microphone audio streams to OpenAI for as long as a conversation is open. Wake
detection still runs on the device and starts the conversation. Voice Hub's isolated worker creates
each session through System HTTP with the package key, sending recent history and the names of
installed skills. The UI can only end the session or add context on its channel to OpenAI; anything
that reads or changes your data goes through Voice Hub's skill dispatch.

Conversation history is stored in a device-local persistent variable. Existing history from the
earlier Voice Hub table is copied into that variable the first time the updated package opens.
Device tuning values are stored in a separate device-local persistent variable and do not sync.

## Troubleshooting

### The microphone does not start

Allow microphone access in the operating system and Electron/browser permission settings, then
reopen Voice Hub. Check that an input device is connected and not exclusively held by another
application.

### The wake phrase does not activate

Wake listening works only in the desktop app while Voice Hub is open and enabled. Try push-to-talk
first to verify microphone access. Speak the complete phrase, reduce the detection threshold in
small steps, or switch to another bundled phrase. Enable **Show listening diagnostics** in Settings
and select **Save** before reading the metrics. The microphone percentage should rise when you
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

### Live voice is unavailable

Confirm that the OpenAI key is saved and that the account has GPT-Live access (Free tier accounts
cannot use it), then try again, or select **Use the standard voice interface**. Live needs the
desktop app.

To compare the interfaces, run `peers logs -f | grep voice-timing`. Each turn logs how long
connecting, the first response, and the action took, and each Live conversation logs its end
reason and billed seconds.

### A voice action fails

Voice Hub calls a voice skill installed in the active group. Confirm that package is installed and
that the OpenAI key has available API usage. Skill calls stay on this device and do not require
Peers Services.

Groceries and Tasks voice writes run as the person signed in on this device. The package loader
supplies the isolate runtime with a host-only resolver for that user's identity and data context.
Grocery/task/timer writes and weather/news refresh require Writer (40); their reads are Reader. Voice Hub offers its model only the tools the person may run, and every call is checked again. The Groceries screen and widget, and the Tasks widget and list controls, use the same levels.
Without a known signed-in identity, calls still fail with
a missing-identity permission denial. Guest payloads and skill arguments
cannot supply trusted identity.

### Browser speech is silent

Check the device output volume and operating-system speech voices. Some browsers require a direct
button interaction before audio playback; use **Test speech** from Voice Hub settings.

## Removing Voice Hub

Disable or remove the package through Peers package management to remove its voice UI and runtime
behavior. Base Peers components do not contain a second wake-word or speech service.

## Turn completion and upgrades

Voice Hub can look up a task and then update it within the same request. The model receives each
tool's result and can continue with the required action before answering.
A turn permits four rounds of skill calls, followed by a response-only summary. If a later model
request fails after a skill succeeds, Voice Hub reports that the whole request was not completed.

Cancel stops further discovery, model requests, and skill calls, and aborts active Voice Hub HTTP.
An already-running skill may finish; cancellation does not undo changes it has made.

The isolation upgrade copies legacy preferences only when no package-scoped settings record exists.
If an earlier upgrade reset your preferences, open Settings, choose **Load pre-upgrade preferences**,
review the draft, and select **Save**. Existing device tuning and the API key are preserved by this
recovery action. The recovery button appears only while legacy preferences are available.

Legacy conversation history imports once per device, retaining the newest 200 entries. Clearing
history also records that migration is complete, so reopening Voice Hub cannot restore old turns.
A failed migration remains retryable and does not prevent microphone initialization.
The conversation panel scrolls within its available height and snaps to the newest entry on its
first visible layout and whenever it reopens. While you are within 48px of the bottom, it follows
history loading, new entries, in-place edits, replacements at the 200-entry retention cap, text
reflow, and resizing. Scrolling upward keeps your reading position through those updates until
you return near the bottom or reopen the panel. Hidden or zero-height panels defer scrolling
until layout is available. Long messages wrap inside the bounded panel so the microphone dock
remains reachable; reopening does not reset stored history.

Installing Voice Hub and a skill into a group is the trust decision; there is no separate approval
step for voice actions. Each call uses the person's current group role and inherited access limit.
A Reader tool upstream still limits subsequent calls to Reader (see
[Authority propagation and dynamic dispatch](./System/Tools.md#authority-propagation-and-dynamic-dispatch)).
