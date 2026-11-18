## Install

| Platform | File |
|---|---|
| macOS (Apple Silicon) | `PPTD-<version>-mac-arm64.dmg` |
| Linux (x64) | `PPTD-<version>-linux-x86_64.AppImage`, or `PPTD-<version>-linux-amd64.deb` for Debian/Ubuntu |
| Windows (x64) | `PPTD-<version>-windows-x64-setup.exe` |

Each file has a `.sha256` next to it. The files without a version number are the same
build, with a link that always points at the latest release.

- **macOS:** open the DMG and drag PPTD to Applications. If this build isn't notarized, macOS
  says it can't check it for malicious software: open System Settings › Privacy & Security
  and choose **Open Anyway** (once), or run `xattr -dr com.apple.quarantine /Applications/PPTD.app`.
- **Windows:** the installer isn't signed yet, so SmartScreen may warn: choose
  **More info › Run anyway**. It installs for the current user, no admin rights needed.
- **Linux:** `chmod +x PPTD-*.AppImage` and run it, or `sudo apt install ./PPTD-*-linux-amd64.deb`.
