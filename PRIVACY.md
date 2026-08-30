# Privacy

Osmolog Companion runs locally on Windows and listens only on loopback
(`127.0.0.1`, ports 47823–47827). It accepts WebSocket connections only from
the paired Osmolog Chrome extension Origin.

## Data read from mpv

- playback, pause, seeking, buffering, mute, volume, speed, and focus state;
- media title/filename and executable directory;
- selected audio/subtitle language metadata and subtitle visibility;
- whether the file contains video or audio only.

## Data sent to Osmolog

- active and passive duration;
- cleaned title, unless `recordTitles` is disabled;
- resolved language and limited track-language metadata;
- playback-speed measurements and video/audio classification;
- anonymous local event/session identifiers used for duplicate protection.

The full media path is never sent to the extension and is not written to the
default log. The companion does not contact Osmolog's cloud services itself.
Once the extension accepts a segment, that segment follows the extension's
normal local storage, export, and optional sync behavior.

The installed edition checks this project's public GitHub Releases feed over
HTTPS and downloads a newer installer when available. These requests disclose
ordinary network information such as the device's IP address and user agent to
GitHub, but they do not include media titles, paths, playback activity,
languages, settings, or Osmolog history. The portable edition does not perform
automatic update checks.

## Local files

The companion stores configuration and crash-recovery data under
`%APPDATA%\Osmolog`:

- `companion.json`: settings and the paired extension ID;
- `pending.jsonl`: completed segments waiting for extension acknowledgement;
- the current draft checkpoint used after an unexpected stop.

Removing the portable executable or uninstalling the installed edition does
not automatically remove this data. Delete `%APPDATA%\Osmolog` manually if you
also want to remove companion data.
