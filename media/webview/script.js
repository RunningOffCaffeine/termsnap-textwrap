// @ts-nocheck
/* TermSnap webview script — preview logic, theme switching, export */

const vscode = acquireVsCodeApi();

function initTermSnap(initialData) {
  const { config } = initialData;

  // DOM elements
  const captureArea = document.getElementById("capture-area");
  const terminalWindow = document.getElementById("terminal-window");
  const terminalBody = document.getElementById("terminal-body");
  const terminalText = document.getElementById("terminal-text");
  const titleBar = document.getElementById("title-bar");

  // Controls
  const themeSelect = document.getElementById("theme-select");
  const fontSizeSlider = document.getElementById("font-size");
  const fontSizeValue = document.getElementById("font-size-value");
  const paddingSlider = document.getElementById("padding");
  const paddingValue = document.getElementById("padding-value");
  const windowControlsCheckbox = document.getElementById("window-controls");
  const lineNumbersCheckbox = document.getElementById("line-numbers");
  const wrapTextCheckbox = document.getElementById("wrap-text");
  const wrapWidthInput = document.getElementById("wrap-width");
  const widthHandle = document.getElementById("width-handle");

  // Buttons
  const btnSave = document.getElementById("btn-save");
  const btnCopy = document.getElementById("btn-copy");
  const btnCopyText = document.getElementById("btn-copy-text");

  // Store the raw text (unescaped) for line-number toggling
  let rawText = terminalText.textContent;
  const MIN_WRAP_WIDTH = 240;
  const MAX_WRAP_WIDTH = 2400;
  let wrapWidth = clampWidth(config.wrapWidth);

  // ── Apply initial styles via JS (inline style attrs are blocked by CSP) ──
  captureArea.style.backgroundColor = config.backgroundColor;
  terminalBody.style.fontSize = config.fontSize + "px";
  terminalBody.style.padding = config.padding + "px";
  if (!config.showWindowControls) {
    titleBar.style.display = "none";
  }

  // ── Custom theme colors ────────────────────────────────
  function applyCustomColors() {
    terminalWindow.style.setProperty("--custom-bg", config.customBackground);
    terminalWindow.style.setProperty("--custom-text", config.customTextColor);
    terminalWindow.style.setProperty("--custom-titlebar", config.customTitleBarColor);
  }

  if (config.theme === "custom") {
    applyCustomColors();
  }

  // ── Theme switching ──────────────────────────────────
  themeSelect.addEventListener("change", () => {
    const theme = themeSelect.value;
    terminalWindow.className = "terminal-window theme-" + theme;
    if (theme === "custom") {
      applyCustomColors();
    }
    notifySettingsChanged("theme", theme);
  });

  // ── Font size ────────────────────────────────────────
  fontSizeSlider.addEventListener("input", () => {
    const size = fontSizeSlider.value;
    fontSizeValue.textContent = size;
    terminalBody.style.fontSize = size + "px";
    notifySettingsChanged("fontSize", Number(size));
  });

  // ── Padding ──────────────────────────────────────────
  paddingSlider.addEventListener("input", () => {
    const pad = paddingSlider.value;
    paddingValue.textContent = pad;
    terminalBody.style.padding = pad + "px";
    notifySettingsChanged("padding", Number(pad));
  });

  // ── Optional screenshot width / wrapping ────────────
  // The terminal window has a fixed width only in wrap mode. The capture
  // area is automatically sized around it (including its outer padding).
  function clampWidth(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 800;
    return Math.max(MIN_WRAP_WIDTH, Math.min(MAX_WRAP_WIDTH, Math.round(number)));
  }

  function setWrapWidth(value, persist = false, updateInput = true) {
    wrapWidth = clampWidth(value);
    if (updateInput) {
      wrapWidthInput.value = String(wrapWidth);
    }
    widthHandle.setAttribute("aria-valuenow", String(wrapWidth));
    if (wrapTextCheckbox.checked) {
      terminalWindow.style.width = wrapWidth + "px";
    }
    if (persist) {
      notifySettingsChanged("wrapWidth", wrapWidth);
    }
  }

  function applyWrapping() {
    const enabled = wrapTextCheckbox.checked;
    terminalText.classList.toggle("wrap-enabled", enabled);
    terminalWindow.style.width = enabled ? wrapWidth + "px" : "";
    terminalWindow.style.maxWidth = enabled ? "none" : "";
    wrapWidthInput.disabled = !enabled;
    widthHandle.hidden = !enabled;
    widthHandle.tabIndex = enabled ? 0 : -1;
  }

  setWrapWidth(wrapWidth);
  applyWrapping();

  wrapTextCheckbox.addEventListener("change", () => {
    applyWrapping();
    notifySettingsChanged("wrapText", wrapTextCheckbox.checked);
  });

  // Update the preview while typing; save only when the input is committed.
  wrapWidthInput.addEventListener("input", () => {
    const typedWidth = Number(wrapWidthInput.value);
    // Don't overwrite partial typing (e.g. "5" on the way to "500").
    if (wrapWidthInput.value !== "" && Number.isFinite(typedWidth) &&
        typedWidth >= MIN_WRAP_WIDTH && typedWidth <= MAX_WRAP_WIDTH) {
      setWrapWidth(typedWidth, false, false);
    }
  });
  wrapWidthInput.addEventListener("change", () => {
    setWrapWidth(wrapWidthInput.value || wrapWidth, true);
  });

  // The resize grip is NOT a descendant of the captured screenshot.
  let drag = null;
  widthHandle.addEventListener("pointerdown", (event) => {
    if (!wrapTextCheckbox.checked || event.button !== 0) return;
    drag = { pointerId: event.pointerId, startX: event.clientX, startWidth: wrapWidth };
    widthHandle.setPointerCapture(event.pointerId);
    widthHandle.classList.add("dragging");
    event.preventDefault();
  });
  widthHandle.addEventListener("pointermove", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    setWrapWidth(drag.startWidth + event.clientX - drag.startX);
  });
  function finishDrag(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag = null;
    widthHandle.classList.remove("dragging");
    if (widthHandle.hasPointerCapture(event.pointerId)) {
      widthHandle.releasePointerCapture(event.pointerId);
    }
    setWrapWidth(wrapWidth, true);
  }
  widthHandle.addEventListener("pointerup", finishDrag);
  widthHandle.addEventListener("pointercancel", finishDrag);
  widthHandle.addEventListener("keydown", (event) => {
    if (!wrapTextCheckbox.checked) return;
    const step = event.shiftKey ? 50 : 10;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      setWrapWidth(wrapWidth + (event.key === "ArrowRight" ? step : -step), true);
      event.preventDefault();
    }
  });

  // ── Window controls toggle ───────────────────────────
  windowControlsCheckbox.addEventListener("change", () => {
    const show = windowControlsCheckbox.checked;
    titleBar.style.display = show ? "" : "none";
    notifySettingsChanged("showWindowControls", show);
  });

  // ── Line numbers toggle ──────────────────────────────
  lineNumbersCheckbox.addEventListener("change", () => {
    renderText(lineNumbersCheckbox.checked);
    notifySettingsChanged("showLineNumbers", lineNumbersCheckbox.checked);
  });

  function renderText(showLineNumbers) {
    terminalText.classList.toggle("with-line-numbers", showLineNumbers);
    if (!showLineNumbers) {
      terminalText.textContent = rawText;
      return;
    }

    // Keep each line number in a fixed column. A wrapped continuation stays
    // aligned with its text rather than moving underneath its line number.
    const fragment = document.createDocumentFragment();
    rawText.split("\n").forEach((line, i) => {
      const row = document.createElement("span");
      row.className = "terminal-line";

      const lineNumber = document.createElement("span");
      lineNumber.className = "line-number";
      lineNumber.textContent = String(i + 1);

      const content = document.createElement("span");
      content.className = "line-content";
      content.textContent = line;

      row.append(lineNumber, content);
      fragment.appendChild(row);
    });
    terminalText.replaceChildren(fragment);
  }

  // Apply initial line numbers if configured
  if (config.showLineNumbers) {
    renderText(true);
  }

  // ── Save as PNG ──────────────────────────────────────
  btnSave.addEventListener("click", async () => {
    btnSave.disabled = true;
    btnSave.textContent = "Exporting...";
    try {
      const dataUrl = await htmlToImage.toPng(captureArea, {
        pixelRatio: 4,
      });
      vscode.postMessage({ type: "save", dataUrl });
    } catch (err) {
      console.error("TermSnap export error:", err);
    } finally {
      btnSave.disabled = false;
      btnSave.textContent = "Save as PNG";
    }
  });

  // ── Copy to clipboard ────────────────────────────────
  btnCopy.addEventListener("click", async () => {
    btnCopy.disabled = true;
    btnCopy.textContent = "Copying...";
    try {
      const dataUrl = await htmlToImage.toPng(captureArea, {
        pixelRatio: 4,
      });

      // Convert data URL to blob and use Clipboard API
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);

      vscode.postMessage({ type: "copy", dataUrl });
    } catch (err) {
      // Fallback: send to extension for handling
      console.error("TermSnap clipboard error:", err);
      try {
        const dataUrl = await htmlToImage.toPng(captureArea, {
          pixelRatio: 4,
        });
        vscode.postMessage({ type: "copy", dataUrl });
      } catch (e) {
        console.error("TermSnap fallback error:", e);
      }
    } finally {
      btnCopy.disabled = false;
      btnCopy.textContent = "Copy Image";
    }
  });

  // ── Copy text ────────────────────────────────────────
  btnCopyText.addEventListener("click", () => {
    vscode.postMessage({ type: "copyText", text: rawText });
    btnCopyText.textContent = "Copied!";
    setTimeout(() => { btnCopyText.textContent = "Copy Text"; }, 1500);
  });

  // ── Notify extension of settings changes ─────────────
  function notifySettingsChanged(key, value) {
    vscode.postMessage({ type: "settingsChanged", key, value });
  }

  // ── Listen for messages from extension ───────────────
  window.addEventListener("message", (event) => {
    const message = event.data;
    if (message.type === "updateText") {
      rawText = message.text;
      renderText(lineNumbersCheckbox.checked);
    }
  });
}
