# Icarus Tame Manager

Client-side tool for organizing and managing `Mounts.json` from **ICARUS**.

Live tool: https://automationandy.github.io/Icarus-Tame-Manager/

## What It Does

- Import your local `Mounts.json`
- Browse and rename tames
- Soft-delete mounts before export
- Reorder orbital call-down order
- Decode mount breeding data from the UE4 blob
- Export back to `Mounts.json`
- Export roster data to CSV

## How To Use

1. Open the live tool.
2. Import your local `Mounts.json`.
3. Review your roster, breeding pairs, or orbital order.
4. Export the updated `Mounts.json` when you're done.

Typical file location:

```text
C:\Users\{Username}\AppData\Local\Icarus\Saved\PlayerData\{SteamID}\Mounts.json
```

## Notes

- This tool is designed to help organize tames, not create impossible animals or edit mount stats directly.
- The app is intended to run fully in the browser on your local file.
- Always keep a backup of your save before making changes.

## Credits

- Built with help from ChatGPT Codex.
- UE4 blob decoding work was informed by this reference project:
  - https://github.com/jodagreyhame/icarus-mount-editor

## Disclaimer

Use at your own risk. This project is not affiliated with RocketWerkz or the ICARUS development team.
