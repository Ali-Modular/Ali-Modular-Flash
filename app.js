
// Ali Modular Web Flasher
// Uses WebUSB + webdfu library (dfu.*)

const $ = (sel) => document.querySelector(sel);
const logEl = $("#log");
function log(msg) {
  const ts = new Date().toLocaleTimeString();
  logEl.textContent += `[${ts}] ${msg}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

// Elements
const envEl = $("#env");
const connectBtn = $("#connectBtn");
const deviceInfo = $("#deviceInfo");
const channelSel = $("#channel");
const versionSel = $("#version");
const refreshBtn = $("#refreshBtn");
const notesBox = $("#notesBox");
const notesUl = $("#notes");
const flashBtn = $("#flashBtn");
const fileInput = $("#fileInput");
const flashFileBtn = $("#flashFileBtn");
const progressText = $("#progressText");

const supportsWebUSB = !!navigator.usb;
envEl.textContent = supportsWebUSB
  ? "✅ WebUSB available (Chrome or Edge over HTTPS)."
  : "⚠️ WebUSB not available. Use Chrome/Edge on desktop over HTTPS.";

let manifest = null;
let device = null;
let dfuDevice = null;

// Load manifest
async function loadManifest() {
  const res = await fetch("./manifest.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`manifest.json not found (${res.status})`);
  manifest = await res.json();

  // Fill channels
  channelSel.innerHTML = "";
  const chNames = Object.keys(manifest.channels);
  for (const ch of chNames) {
    const opt = document.createElement("option");
    opt.value = ch;
    opt.textContent = ch;
    if (ch === (manifest.default_channel || "stable")) opt.selected = true;
    channelSel.appendChild(opt);
  }
  populateVersions();
}

function populateVersions() {
  versionSel.innerHTML = "";
  const ch = channelSel.value;
  const list = manifest.channels[ch] || [];
  list.forEach((fw, idx) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = `${fw.version} — ${fw.notes?.[0] || ""}`;
    versionSel.appendChild(opt);
  });
  updateNotes();
}

function updateNotes() {
  notesUl.innerHTML = "";
  const ch = channelSel.value;
  const idx = parseInt(versionSel.value, 10) || 0;
  const fw = (manifest.channels[ch] || [])[idx];
  if (!fw) return;
  (fw.notes || []).forEach(n => {
    const li = document.createElement("li");
    li.textContent = n;
    notesUl.appendChild(li);
  });
}

// Button states
versionSel.addEventListener("change", updateNotes);
channelSel.addEventListener("change", () => { populateVersions(); });
refreshBtn.addEventListener("click", () => { loadManifest().catch(e => log(`ERROR: ${e.message}`)); });

fileInput.addEventListener("change", () => {
  flashFileBtn.disabled = !fileInput.files?.length || !dfuDevice;
});

// Connect
connectBtn.addEventListener("click", async () => {
  try {
    // Filter to ST DFU devices (optional): vendorId 0x0483 (STMicro), productId 0xDF11 is common.
    const filters = [{ vendorId: 0x0483 }];
    device = await navigator.usb.requestDevice({ filters });
    await device.open();

    // The webdfu library wants a USBDevice; create dfu.Device wrapper
    dfuDevice = await dfu.findDevice(device);
    if (!dfuDevice) throw new Error("DFU interface not found. Is the device in DFU mode?");
    await dfuDevice.open();

    const info = await dfuDevice.getInfo();
    deviceInfo.textContent = `Connected: ${device.productName || "USB Device"} (Transfer Size ${info.transferSize} bytes)`;
    log(`Connected ${device.productName || ""} — DFU alt settings: ${dfuDevice.interfaces.map(i => i.name).join(", ")}`);
    flashBtn.disabled = false;
    flashFileBtn.disabled = !fileInput.files?.length ? true : false;
  } catch (e) {
    log("ERROR connecting: " + e.message);
  }
});

// Core flashing helpers
async function flashArrayBuffer(buf) {
  if (!dfuDevice) throw new Error("No DFU device");
  progressText.textContent = "Preparing...";
  const data = new Uint8Array(buf);

  // Pick first interface/alt (common for Daisy DFU)
  const intf = dfuDevice.interfaces[0];
  await dfuDevice.claimInterface(intf.interfaceNumber);
  await dfuDevice.selectAlternate(intf.interfaceNumber, 0);

  const xfer = (written, total) => {
    const pct = Math.floor((written/total) * 100);
    progressText.textContent = `Writing ${pct}% (${written}/${total})`;
  };

  try {
    await dfuDevice.download(0, data, xfer);
    progressText.textContent = "Finalizing...";
    await dfuDevice.manifest();
    progressText.textContent = "Done. If the device doesn't reboot, power‑cycle it.";
    log("Flash complete.");
  } catch (e) {
    progressText.textContent = "";
    throw e;
  }
}

// Flash selected from manifest
flashBtn.addEventListener("click", async () => {
  try {
    const ch = channelSel.value;
    const idx = parseInt(versionSel.value, 10) || 0;
    const fw = (manifest.channels[ch] || [])[idx];
    if (!fw) throw new Error("No firmware selected");
    log(`Downloading ${fw.file} ...`);
    const res = await fetch(`./${fw.file}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Firmware file not found (${res.status})`);
    const buf = await res.arrayBuffer();

    // Optional SHA‑256 check
    if (fw.sha256) {
      const hash = await crypto.subtle.digest("SHA-256", buf);
      // convert to hex
      const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,"0")).join("");
      if (hex.toLowerCase() !== fw.sha256.toLowerCase()) {
        throw new Error("Checksum mismatch. Download may be corrupted.");
      }
      log("Checksum OK.");
    }

    await flashArrayBuffer(buf);
  } catch (e) {
    log("ERROR flashing: " + e.message);
  }
});

// Flash local file
flashFileBtn.addEventListener("click", async () => {
  try {
    const f = fileInput.files?.[0];
    if (!f) return;
    log(`Reading ${f.name} ...`);
    const buf = await f.arrayBuffer();
    await flashArrayBuffer(buf);
  } catch (e) {
    log("ERROR flashing file: " + e.message);
  }
});

// init
loadManifest().catch(e => log(`ERROR: ${e.message}`));
