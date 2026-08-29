# Osmolog MPV Companion

Osmolog Companion counts video and audio played in [mpv](https://mpv.io/) and
sends the resulting sessions to the Osmolog Chrome extension. It runs as a
small Windows utility; the existing Osmolog dashboard remains the place for
history, goals, Sources, and analytics.

The companion shows only what is useful while watching: connection state,
current title, language, file time, total Osmolog time today, playback speed,
and the Active/Passive split. Minimize it to the same compact timer badge used
by the extension, or close it to the system tray.

## Download

Download the latest `Osmolog-Companion-*-x64.exe` from
[GitHub Releases](https://github.com/melismehmeti94-blip/osmolog-mpv-companion/releases).
It is a portable Windows application: place it somewhere permanent and run it.

The current builds are unsigned. Windows SmartScreen may therefore show an
Unknown publisher warning. Verify that the download came from this repository
and compare its SHA-256 checksum with the release notes before running it.

Requirements:

- Windows 10 or 11, 64-bit
- mpv
- the Osmolog Chrome extension

## Set up mpv once

Create `mpv.conf` if it does not exist and add this exact line:

```ini
input-ipc-server=\\.\pipe\osmolog-mpv
```

Common locations:

- Standard mpv: `%APPDATA%\mpv\mpv.conf`
- Portable mpv: `portable_config\mpv.conf` beside `mpv.exe`

Restart mpv after saving the file, then start Osmolog Companion.

## Connect Osmolog once

1. Start the companion and mpv.
2. Open Osmolog in Chrome.
3. Open **Settings → MPV Companion** and select **Connect MPV**.
4. Approve Chrome's one-time local access prompt if it appears.

After that first permission, the dashboard does **not** need to be open. The
extension reconnects to the companion in the background. The trusted extension
installation is remembered automatically; users never need to copy an
extension ID.

If Osmolog is reinstalled and Chrome gives it a different ID, start pairing in
the companion and open Osmolog once to trust the new installation.

## Everyday behavior

- Focused, audible, unpaused mpv playback counts as **Active**.
- Unfocused, audible, unpaused playback counts as **Passive**.
- Pause, mute, volume zero, buffering, seeking, EOF, and no loaded file do not
  count.
- Audio-only playback counts normally.
- Playback speed is credited as real time multiplied by speed, clamped to
  1×–2× by default.
- Changing Language in the companion updates the current file and becomes the
  default for the next session.
- **−** switches to the movable compact timer.
- **×** keeps tracking in the Windows tray.
- The companion hides automatically while mpv is fullscreen.

On first successful contact with mpv, the companion installs its managed
`osmolog-companion.lua` script. Later, opening mpv starts the companion if it is
not already running. If you move the portable companion executable, run it once
manually while mpv is open so the launcher can update to the new path.

## Reliability and privacy

Completed segments are journaled before delivery. Chrome may be closed:
unacknowledged time remains in `%APPDATA%\Osmolog\pending.jsonl` and is replayed
when the extension reconnects. An in-progress segment is checkpointed for crash
recovery.

The full media path stays inside the companion. Osmolog receives only the
resolved language, cleaned title, timing, selected track-language tags,
subtitle visibility, and video/audio classification. Set `recordTitles` to
`false` in `%APPDATA%\Osmolog\companion.json` to omit titles.

See [PRIVACY.md](PRIVACY.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
for the complete local data and transport design.

## Troubleshooting

### Companion says “Waiting for MPV”

Confirm that `mpv.conf` contains the named-pipe line exactly, save it, and
fully restart mpv. Only one mpv instance can own the fixed pipe.

### Companion says “Reconnecting to Osmolog”

Wait up to 30 seconds. If it remains disconnected, reload Osmolog from
`chrome://extensions`, then leave the companion open. The dashboard does not
need to remain open.

### Time is queued

Queued segments are intentional when Chrome or Osmolog is unavailable. Do not
delete `%APPDATA%\Osmolog\pending.jsonl`; it drains after reconnection.

## Development

Requires Node.js 20 or newer.

```powershell
npm install
npm test
npm start
```

Build the portable executable locally:

```powershell
npm run dist
```

Artifacts are written to `dist/`. Pushing a tag such as `v1.0.0` runs the
Windows release workflow and attaches the executable and its SHA-256 checksum to a
GitHub Release.

## Current scope

Version 1 supports Windows and mpv. VLC, macOS, Linux, native messaging, a
traditional installer, and code signing are not included yet.

## License

No open-source license has been selected yet. The repository is public for
transparency and distribution, but public availability alone does not grant
permission to copy, modify, or redistribute the source. A formal license should
be selected before accepting outside code contributions.
