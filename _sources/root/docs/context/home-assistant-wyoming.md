# Home Assistant Wyoming Voice Assistant

A local, privacy-focused voice assistant to replace Alexa using Home Assistant's Wyoming protocol.

## Overview

**Wyoming** is Home Assistant's protocol for local voice processing—wake word detection, speech-to-text (STT), text-to-speech (TTS), and voice satellites. All processing happens locally without cloud dependencies.

### Key Components

| Component | Purpose | Add-on/Service |
|-----------|---------|----------------|
| Wake Word | Listens for trigger phrase | openWakeWord, microWakeWord |
| STT | Converts speech → text | Whisper (local) |
| TTS | Converts text → speech | Piper (local) |
| Assist | Intent processing | Built into Home Assistant |
| Satellites | Remote mic/speaker devices | wyoming-satellite, ESP32 devices |

---

## Installation

### Server Requirements

- **Minimum**: 2 CPU cores, 2 GB RAM, 32 GB storage
- **Recommended**: 4+ GB RAM for Whisper STT
- **Platforms**: Linux (native), Mac/Windows (via VM)

### Platform-Specific Setup

#### macOS
```bash
# Use UTM (Apple Silicon) or VirtualBox (Intel)
# Download HA OS image from: https://www.home-assistant.io/installation/macos

# VM Settings:
# - 2+ vCPUs, 4 GB RAM, 32 GB disk
# - Bridged networking (gets own IP)
# - EFI/UEFI boot
```

#### Windows
```powershell
# Use Hyper-V (Pro/Enterprise) or VirtualBox (Home)
# Enable Hyper-V:
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All

# Download HA OS: https://www.home-assistant.io/installation/windows
```

#### Linux (Best Performance)
```bash
# Option A: Dedicated hardware - flash HA OS to SSD/USB
# Option B: Docker container
docker run -d \
  --name homeassistant \
  --privileged \
  --restart=unless-stopped \
  -e TZ=America/New_York \
  -v /path/to/config:/config \
  -v /run/dbus:/run/dbus:ro \
  --network=host \
  ghcr.io/home-assistant/home-assistant:stable
```

### Voice Add-ons Setup

1. Access Home Assistant at `http://homeassistant.local:8123`
2. Go to **Settings → Add-ons → Add-on Store**
3. Install:
   - **Whisper** - Speech-to-text (choose model: tiny/small/medium)
   - **Piper** - Text-to-speech (download voices for your language)
   - **openWakeWord** - Wake word detection

4. Configure Wyoming integration:
   - **Settings → Devices & Services → Add Integration → Wyoming Protocol**
   - Auto-discovers local add-ons; manual: `localhost:10400`

5. Create voice pipeline:
   - **Settings → Voice Assistants → Add Assistant**
   - Set STT: Whisper, TTS: Piper, Wake Word: openWakeWord

---

## Voice Satellite Hardware

### Budget Options
| Device | Price | Notes |
|--------|-------|-------|
| M5Stack Atom Echo | ~$13 | Streams audio to server |
| ESP32-S3-BOX-3 | ~$45 | Runs microWakeWord locally |
| Raspberry Pi Zero 2 W + ReSpeaker | ~$40 | Good balance |

### Recommended
| Device | Price | Notes |
|--------|-------|-------|
| Raspberry Pi 4 + USB mic | ~$60+ | Most reliable |
| Home Assistant Voice PE | ~$59 | Official, best integration |

### Satellite Software Setup (Raspberry Pi)
```bash
pip3 install wyoming-satellite

wyoming-satellite \
  --name 'Living Room' \
  --uri 'tcp://0.0.0.0:10700' \
  --mic-command 'arecord -r 16000 -c 1 -f S16_LE -t raw' \
  --snd-command 'aplay -r 22050 -c 1 -f S16_LE -t raw'
```

---

## API Reference

### REST API

**Base URL**: `http://<ha-ip>:8123/api/`

**Authentication**: Long-lived access token (create in HA profile settings)

```typescript
const headers = {
  'Authorization': 'Bearer <LONG_LIVED_ACCESS_TOKEN>',
  'Content-Type': 'application/json'
};
```

#### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/` | GET | API health check |
| `/api/states` | GET | All entity states |
| `/api/states/<entity_id>` | GET | Single entity state |
| `/api/states/<entity_id>` | POST | Update entity state |
| `/api/services/<domain>/<service>` | POST | Call service |
| `/api/events/<event_type>` | POST | Fire event |
| `/api/config` | GET | HA configuration |

#### Example: Call a Service
```typescript
// Turn on a light
await fetch('http://homeassistant.local:8123/api/services/light/turn_on', {
  method: 'POST',
  headers,
  body: JSON.stringify({ entity_id: 'light.living_room' })
});
```

#### Example: Get Entity State
```typescript
const response = await fetch('http://homeassistant.local:8123/api/states/light.living_room', {
  headers
});
const state = await response.json();
// { entity_id: 'light.living_room', state: 'on', attributes: {...} }
```

### WebSocket API

**URL**: `ws://<ha-ip>:8123/api/websocket`

```typescript
const ws = new WebSocket('ws://homeassistant.local:8123/api/websocket');

// Authenticate after connection
ws.send(JSON.stringify({
  type: 'auth',
  access_token: '<TOKEN>'
}));

// Subscribe to state changes
ws.send(JSON.stringify({
  id: 1,
  type: 'subscribe_events',
  event_type: 'state_changed'
}));

// Call a service
ws.send(JSON.stringify({
  id: 2,
  type: 'call_service',
  domain: 'light',
  service: 'turn_on',
  service_data: { entity_id: 'light.living_room' }
}));
```

### Wyoming Protocol

**Purpose**: Voice/audio streaming for satellites and custom TTS/STT

**Port**: 10400 (default)

**Format**: JSONL metadata + PCM audio over TCP

```typescript
// Message types
type WyomingMessageType = 
  | 'audio-chunk'    // Raw audio data
  | 'audio-start'    // Begin audio stream
  | 'audio-stop'     // End audio stream
  | 'transcribe'     // Request STT
  | 'transcript'     // STT result
  | 'synthesize'     // Request TTS
  | 'detect'         // Wake word detection
  | 'detection';     // Wake word detected

interface AudioInfo {
  rate: number;      // Sample rate (16000 for STT)
  width: number;     // Bytes per sample (2)
  channels: number;  // 1 for mono
}
```

---

## Integration Patterns for Peers

### Option 1: REST API Client
Simple HTTP calls for controlling devices and reading state. Best for basic integration.

### Option 2: WebSocket Real-time
Subscribe to state changes for live updates in Peers UI.

### Option 3: Voice Satellite
Make Peers app act as a mobile voice satellite using Wyoming protocol (requires TCP socket library for React Native).

### Option 4: Webhooks (HA → Peers)
Configure HA automations to POST to Peers when events occur.

---

## References

### Official Documentation
- Home Assistant Installation: https://www.home-assistant.io/installation/
- Wyoming Integration: https://www.home-assistant.io/integrations/wyoming/
- Wake Word Info: https://www.home-assistant.io/voice_control/about_wake_word/
- REST API: https://developers.home-assistant.io/docs/api/rest
- WebSocket API: https://developers.home-assistant.io/docs/api/websocket

### Add-ons & Tools
- Whisper Add-on: https://github.com/home-assistant/addons/tree/master/whisper
- Piper Add-on: https://github.com/home-assistant/addons/tree/master/piper
- openWakeWord: https://github.com/home-assistant/addons/tree/master/openwakeword
- wyoming-satellite: https://github.com/rhasspy/wyoming-satellite

### Wyoming Protocol
- Protocol Spec: https://github.com/rhasspy/wyoming
- Python Package: https://pypi.org/project/wyoming/

### Hardware
- ESP32-S3-BOX-3: https://www.espressif.com/en/news/ESP32-S3-BOX-3
- ReSpeaker 2-Mic HAT: https://wiki.seeedstudio.com/ReSpeaker_2_Mics_Pi_HAT/
- Home Assistant Voice PE: https://www.home-assistant.io/voice-pe/

---

## Known Limitations

| Feature | Status |
|---------|--------|
| Multi-room audio | Requires Snapcast add-on |
| Timers/Alarms | Basic functionality |
| Speaker identification | Not available |
| Music streaming | Use Music Assistant add-on |

## Tuning Tips

- **Reduce false wake words**: Increase threshold from 0.5 → 0.7-0.9 in openWakeWord settings
- **Faster responses**: Use `whisper-tiny` model
- **Better accuracy**: Use `whisper-small` or `whisper-medium` (needs more RAM)

---

# AI Context

Notes from setup session on 2026-01-18.

## Current Installation (Mark's MacBook M3)

### VM Details
- **Virtualization**: UTM (installed via `brew install --cask utm`)
- **VM Name**: "Home Assistant"
- **Disk Image**: `~/VMs/HomeAssistant/haos.qcow2` (original download location)
- **Actual VM Location**: `~/Library/Containers/com.utmapp.UTM/Data/Documents/Home Assistant.utm/`
- **Disk Size**: Expanded from 6GB → 32GB using `qemu-img resize`
- **Network**: Bridged networking
- **IP Address**: `192.168.64.2` (also accessible via `homeassistant.local`)

### VM Management Commands
```bash
# List VMs
utmctl list

# Start/Stop/Status
utmctl start "Home Assistant"
utmctl stop "Home Assistant"
utmctl status "Home Assistant"

# Get IP address
utmctl ip-address "Home Assistant"

# Resize disk (VM must be stopped first)
qemu-img resize "/path/to/haos.qcow2" 32G
```

### Access URLs
- Web UI: http://homeassistant.local:8123
- Direct IP: http://192.168.64.2:8123

## Wyoming Integration Setup

### Add-on Internal Hostnames & Ports
When manually adding Wyoming Protocol integrations, use these container hostnames:

| Add-on | Host | Port |
|--------|------|------|
| Whisper (STT) | `core-whisper` | `10300` |
| Piper (TTS) | `core-piper` | `10200` |
| openWakeWord | `core-openwakeword` | `10400` |

**Fallback hosts** if container names don't work: `localhost`, `127.0.0.1`, `homeassistant.local`

### Entity IDs After Setup
- STT: `stt.faster_whisper`
- TTS: `tts.piper`
- Wake Word: `wake_word.openwakeword`

## Troubleshooting Notes

### "[object Object]" Error in Assist
This indicates the STT (Whisper) integration is not properly connected. Check:
1. Whisper add-on is running (Settings → Add-ons → Whisper → should show "Running")
2. Wyoming integration is configured with correct host/port
3. Delete and re-add Wyoming integration if state shows "unknown"

### STT Entity Shows "unknown" State
The Wyoming integration can't connect to the add-on. Solutions:
1. Verify add-on is running
2. Try different host values: `core-whisper`, `localhost`, `127.0.0.1`
3. Check add-on logs for errors (Add-on page → Logs tab)

### Supervisor API Returns 401 Unauthorized
Long-lived access tokens work for the main HA API but NOT for the Supervisor/Hassio API (`/api/hassio/*`). Add-on installation must be done through the UI.

### Wake Word Only Works with Satellites
The browser microphone is push-to-talk only. For hands-free "Hey Jarvis" wake word:
- Need a dedicated voice satellite device (Raspberry Pi, ESP32, etc.)
- Or set up Mac as a satellite using `wyoming-satellite`

## API Access Token
A long-lived access token was created for CLI/Peers integration. Create new tokens at:
Profile (bottom left) → Long-Lived Access Tokens → Create Token

## Next Steps
- [ ] Complete Wyoming integration troubleshooting (Whisper/openWakeWord connectivity)
- [ ] Test voice commands via browser Assist
- [ ] Add smart home devices to control
- [ ] Consider setting up a physical voice satellite for wake word
- [ ] Build Peers integration using REST API

