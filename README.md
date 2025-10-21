# Ali Modular — Web Firmware Updater (flash/)

A branded WebUSB DFU flasher for Esu's Trifecta (Daisy Seed).

## How it works
- Chrome/Edge over HTTPS using WebUSB
- DFU protocol via the `webdfu` library (loaded from a CDN in `index.html`)
- Firmware list is driven by `manifest.json`

## Deploy
- Host the `flash/` folder at `https://alimodular.com/flash` (or `flash.alimodular.com`)
- Any static host works: Cloudflare Pages, Netlify, GitHub Pages
- HTTPS is required for WebUSB

## Add a new release
1. Build your `.bin` (e.g., `trifecta_fw_1.16.0.bin`) and copy it into `flash/`.
2. Compute SHA‑256 and size (optional but recommended):
   - macOS/Linux: `shasum -a 256 trifecta_fw_1.16.0.bin`
   - Windows (PowerShell): `Get-FileHash trifecta_fw_1.16.0.bin -Algorithm SHA256`
3. Add a new entry under `stable` or `beta` in `manifest.json` with `version`, `date`, `file`, `size_bytes`, `sha256`, and `notes`.
4. Deploy.

## Windows driver (Zadig)
If Windows can’t connect to “DFU in FS Mode”, install the WinUSB driver using Zadig:
- Download Zadig from https://zadig.akeo.ie/
- Choose the DFU device in the dropdown → Driver: **WinUSB** → **Install Driver**
- Reconnect on the flasher page

## Tips
- Use a direct USB port and a known good cable
- If stuck in DFU, power‑cycle the module
- Test on a clean Windows machine for driver edge cases

## Dev notes
- `index.html` loads `webdfu.min.js` from a CDN which provides a global `dfu` object
- `app.js` drives connect → select alt interface 0 → `download` → `manifest`
- The code picks the first DFU interface/alt; Daisy typically exposes a single DFU alt‑setting

## License
All code in this folder is MIT (see LICENSE.txt). Firmware binaries are owned by Ali Modular.
