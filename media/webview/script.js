// @ts-nocheck
/* TermSnap-TextWrap webview script — preview logic, theme switching, export */

const vscode = acquireVsCodeApi();

window.initTermSnapTextWrap = (initialData) => {
  const { config, html } = initialData;

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
  const terminalColorsCheckbox = document.getElementById("terminal-colors");
  const wrapTextCheckbox = document.getElementById("wrap-text");
  const wrapWidthInput = document.getElementById("wrap-width");
  const widthHandle = document.getElementById("width-handle");

  // Buttons
  const btnSave = document.getElementById("btn-save");
  const btnCopy = document.getElementById("btn-copy");
  const btnCopyText = document.getElementById("btn-copy-text");

  // Store the raw text (unescaped) for line-number toggling
  let rawText = terminalText.textContent;
  // Parse xterm's clipboard HTML in an inert document, then reconstruct ONLY
  // plain text and allowlisted inline styles. Never insert raw clipboard HTML.
  const formattedLines = parseTerminalHtml(html);
  // Detect an unrelated/stale text/html clipboard flavor before applying it.
  // Terminal serialization can retain right-hand padding, so ignore trailing
  // spaces for this comparison but never change the copied plain text.
  const normalizeForMatch = (value) =>
    value
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+$/gm, "")
      .replace(/\n+$/, "");
  const formattedText =
    formattedLines ?
      formattedLines.map((line) => line.textContent).join("\n")
    : "";
  if (
    !formattedLines ||
    normalizeForMatch(formattedText) !== normalizeForMatch(rawText)
  ) {
    terminalColorsCheckbox.checked = false;
    terminalColorsCheckbox.disabled = true;
  }

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
    terminalWindow.style.setProperty(
      "--custom-titlebar",
      config.customTitleBarColor,
    );
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
    return Math.max(
      MIN_WRAP_WIDTH,
      Math.min(MAX_WRAP_WIDTH, Math.round(number)),
    );
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
    if (
      wrapWidthInput.value !== "" &&
      Number.isFinite(typedWidth) &&
      typedWidth >= MIN_WRAP_WIDTH &&
      typedWidth <= MAX_WRAP_WIDTH
    ) {
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
    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: wrapWidth,
    };
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
      setWrapWidth(
        wrapWidth + (event.key === "ArrowRight" ? step : -step),
        true,
      );
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

  // xterm's HTML serializer emits a global <div> with a hard-coded default
  // background and a child <div> per terminal line, containing styled spans.
  // Deliberately skip global styles so the selected TermSnap-TextWrap theme remains
  // the terminal background; only use explicit foreground/background runs.
  function parseTerminalHtml(markup) {
    if (typeof markup !== "string" || !markup) return null;
    const doc = new DOMParser().parseFromString(markup, "text/html");
    const pre = doc.querySelector("pre");
    if (!pre) return null;

    const outer = pre.firstElementChild;
    if (!outer || outer.tagName !== "DIV") return null;
    const rows = Array.from(outer.children).filter(
      (el) => el.tagName === "DIV",
    );
    if (!rows.length) return null;

    const safeColor = (value) => {
      const v = value.trim();
      return /^(?:#[\da-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(v) ? v : "";
    };

    function rebuildSafe(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return document.createTextNode(node.textContent || "");
      }
      // Terminal HTML should only have spans (no images, links or scripts).
      if (node.nodeType !== Node.ELEMENT_NODE || node.tagName !== "SPAN") {
        return null;
      }
      const span = document.createElement("span");
      // Reading element.style on a DOMParser result is blocked by the
      // webview's strict CSP. Read the attribute as text and parse only
      // allowlisted, non-executable CSS properties instead.
      const safeProperties = Object.create(null);
      const declarations = (node.getAttribute("style") || "").split(";");
      for (const declaration of declarations) {
        const separator = declaration.indexOf(":");
        if (separator < 0) continue;
        const name = declaration.slice(0, separator).trim().toLowerCase();
        const value = declaration.slice(separator + 1).trim();
        if (name) safeProperties[name] = value;
      }
      const css = (name) => safeProperties[name] || "";
      const color = safeColor(css("color"));
      const background = safeColor(css("background-color"));
      if (color) span.style.color = color;
      if (background) span.style.backgroundColor = background;
      if (/^(?:bold|[5-9]00)$/i.test(css("font-weight")))
        span.style.fontWeight = "bold";
      if (css("font-style") === "italic") span.style.fontStyle = "italic";
      const decoration = css("text-decoration-line");
      if (
        /^(?:underline|line-through|overline|underline line-through|line-through underline)$/.test(
          decoration,
        )
      ) {
        span.style.textDecorationLine = decoration;
      }
      const decorationColor = safeColor(css("text-decoration-color"));
      if (decorationColor) span.style.textDecorationColor = decorationColor;
      if (
        ["solid", "double", "dotted", "dashed", "wavy"].includes(
          css("text-decoration-style"),
        )
      ) {
        span.style.textDecorationStyle = css("text-decoration-style");
      }
      if (css("text-decoration").includes("underline"))
        span.style.textDecorationLine = "underline";
      const opacity = Number(css("opacity"));
      if (
        css("opacity") &&
        Number.isFinite(opacity) &&
        opacity >= 0 &&
        opacity < 1
      ) {
        span.style.opacity = String(opacity);
      }
      if (css("visibility") === "hidden") span.style.visibility = "hidden";
      for (const child of node.childNodes) {
        const safe = rebuildSafe(child);
        if (safe) span.appendChild(safe);
      }
      return span;
    }

    return rows.map((row) => {
      const fragment = document.createDocumentFragment();
      for (const child of row.childNodes) {
        const safe = rebuildSafe(child);
        if (safe) fragment.appendChild(safe);
      }
      return fragment;
    });
  }

  function renderText(showLineNumbers) {
    terminalText.classList.toggle("with-line-numbers", showLineNumbers);
    const colorsActive =
      !terminalColorsCheckbox.disabled && terminalColorsCheckbox.checked;
    if (!colorsActive && !showLineNumbers) {
      terminalText.textContent = rawText;
      return;
    }

    const fragment = document.createDocumentFragment();
    const textLines = colorsActive ? formattedLines : rawText.split("\n");
    textLines.forEach((line, i) => {
      const row = document.createElement("span");
      row.className =
        showLineNumbers ? "terminal-line" : "terminal-colored-line";

      if (showLineNumbers) {
        const lineNumber = document.createElement("span");
        lineNumber.className = "line-number";
        lineNumber.textContent = String(i + 1);
        row.appendChild(lineNumber);
      }

      const content = document.createElement("span");
      content.className = "line-content";
      if (colorsActive) {
        content.appendChild(line.cloneNode(true));
      } else {
        content.textContent = line;
      }
      row.appendChild(content);
      fragment.appendChild(row);
    });
    terminalText.replaceChildren(fragment);
  }

  terminalColorsCheckbox.addEventListener("change", () => {
    renderText(lineNumbersCheckbox.checked);
    notifySettingsChanged(
      "preserveTerminalColors",
      terminalColorsCheckbox.checked,
    );
  });

  // Apply initial line numbers if configured
  if (config.showLineNumbers || terminalColorsCheckbox.checked) {
    renderText(config.showLineNumbers);
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
      console.error("TermSnap-TextWrap export error:", err);
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
      console.error("TermSnap-TextWrap clipboard error:", err);
      try {
        const dataUrl = await htmlToImage.toPng(captureArea, {
          pixelRatio: 4,
        });
        vscode.postMessage({ type: "copy", dataUrl });
      } catch (e) {
        console.error("TermSnap-TextWrap fallback error:", e);
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
    setTimeout(() => {
      btnCopyText.textContent = "Copy Text";
    }, 1500);
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
      // A new plain-text payload doesn't correspond to the previous HTML.
      terminalColorsCheckbox.checked = false;
      terminalColorsCheckbox.disabled = true;
      renderText(lineNumbersCheckbox.checked);
    }
  });
};
