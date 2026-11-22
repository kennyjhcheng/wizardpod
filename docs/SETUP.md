# Setup

WizardPod itself is only a web page — two blades, two inputs. What it does *not* do is turn AirPods
into a mouse, so one piece of software has to sit between the AirPods and the browser.

| | Player 1 (left blade) | Player 2 (right blade) |
| --- | --- | --- |
| Hardware | AirPods Pro in the charging case | Any webcam |
| Software | [AirPointer](https://github.com/oscarcreatess/airpointer) (self-built macOS app) | None — MediaPipe runs in the page |
| What the page sees | Ordinary `pointermove` events | `MediaStream` from the camera |
| Permission | macOS Accessibility + Bluetooth for AirPointer, camera for the page | Camera for the page |

Nothing is installed for player 2, and the game never talks to the AirPods directly. It only reads
the system cursor, which is why any tool that moves the macOS pointer can drive the left blade.

## Tested rig

| | |
| --- | --- |
| Computer | Apple silicon Mac (arm64) |
| OS | macOS 26 Tahoe (built and played on 26.5) |
| AirPods | AirPods Pro, 1st generation, paired to the same Mac |
| Pointer tool | AirPointer, built from source |
| Browser | Chrome or Safari, camera allowed |

AirPointer needs **macOS 26 on Apple silicon** and **Xcode** to build; there is no notarised download.
Upstream lists AirPods Pro 1 as *experimental — tested on one Mac with one pair*, so if pointing feels
rough on a first-generation pair, see [Other pointer tools](#other-pointer-tools) below.

## Player 1 — AirPods Pro → cursor

AirPointer moves the cursor by reading the motion sensors inside the AirPods while they sit in the
closed case: move the case, the pointer moves; tap the front of the case, it clicks. A game session
needs pointing only — no clicking — so leave tap, drag and twist-to-scroll at their defaults.

### Build it once

```bash
git clone https://github.com/oscarcreatess/airpointer
cd airpointer
zsh ./build.sh          # also runs the self-test and the tap check
open AirPointer.app
```

Do not build while a pointer session is running. If a rebuild leaves the app missing from the
Accessibility list, reset its permission and add it again:

```bash
tccutil reset Accessibility local.airpointer
```

### First-run setup (four steps in the app)

1. **Allow** — drag AirPointer into **System Settings › Privacy & Security › Accessibility**. macOS
   will also ask for Bluetooth; both are required, because the app moves the cursor and opens a
   link to the case.
2. **Connect** — open the lid, close it, set the case down flat for a moment, then turn it upright.
   The first connection takes a few seconds and the pointer stutters for ~20 seconds afterwards.
3. **Calibrate** — point the case at the three dots (centre, right edge, top edge) to teach it where
   the screen is. Hold still on each dot until it captures.
4. **Tap** — tap the front of the case three times. Only needed if you want clicks; harmless to skip
   for WizardPod.

### Each session

- Press **fn ⌃** to connect, and again to pause or resume.
- Make sure **Bluetooth on your iPhone is off** while playing — the phone grabs the AirPods and
  AirPointer cannot connect.
- Keep other apps off the AirPods as a microphone (video calls, OBS) or pointing gets laggy.
- A session ends about **30 minutes after the lid closes**; open and close the lid to start a new one.
  Ninety-second rounds fit comfortably inside that window.
- AirPointer moves Mac audio off the AirPods while it is connected and restores it afterwards.
  Don't connect during a call.

### Check it before the round

Open the game, press **Start**, and move the case. If the left wand follows the pointer, the input is
wired correctly. If the cursor moves but the wand does not, the pointer is outside the page.

## Player 2 — hand → blade

`MediaPipe HandLandmarker` loads with the page (model and WASM are served from `public/models` and
`public/mediapipe`, no CDN), so there is nothing to install.

- Allow camera access when the browser asks. The prompt appears on **Start**.
- One hand, palm toward the camera, about 40–80 cm away, with the whole hand in frame.
- The index fingertip (`landmark 8`) is the blade. It is mirrored, so moving right in the room moves
  right on screen.
- Even, front lighting helps; a bright window behind you does not.
- The hand is clamped to the right half of the arena, the cursor to the left half.

## The page

```bash
npm install
npm run dev
```

Open the printed localhost URL in a browser on the same Mac. No account, no network calls, no build
step beyond Vite. Use a recent Chrome, Edge or Safari; the game needs WebAudio, `canvas` and
`getUserMedia`.

Sound is generated with WebAudio, so the first click or key press unlocks it — press **Start** (or any
key) and the music and effects come up. Turn the system volume down before the first round; the
hazard sting is deliberately loud.

### No hardware?

Add `?demo` to the URL. Both blades are then driven by a scripted pilot (`src/demo.ts`), which is how
the screenshots and GIFs in [`docs/media`](media) were recorded. It chases its own recipe, dodges
hazards and restarts itself after the results card.

## Other pointer tools

The left blade follows the macOS cursor, so any of these work in place of AirPointer if you have
different AirPods or a newer macOS:

| Tool | Notes |
| --- | --- |
| [AirPointer](https://github.com/oscarcreatess/airpointer) | Closed case as the pointer. Pro 3 / AirPods 4 tested; **Pro 1 experimental**; Pro 2 recognised. |
| [AirCursor](https://github.com/m-afham/AirCursor) | Head tracking from ear-worn AirPods, macOS 15+. Pro 1 supported; signed releases. |
| [airpodmouse](https://github.com/systemsoftware/airpodmouse) | Minimal `CMHeadphoneMotionManager` → cursor demo, macOS + Accessibility. |

All of them need the same Accessibility permission, and none of them need changes to WizardPod.
