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
  const exportScaleSelect = document.getElementById("export-scale");

  // Reuse the PNG if the user exports the same preview more than once.
  // Every appearance or content change invalidates the cached image.
  let cachedExport = null;
  function invalidateExport() {
    cachedExport = null;
  }

  // Store the raw text (unescaped) for line-number toggling
  let rawText = terminalText.textContent;
  // Parse the terminal HTML without inserting unsafe clipboard HTML.
  const capturedLines = parseTerminalHtml(html);

  // VS Code may copy background-colored spaces in text/html but omit their
  // entire row from text/plain. Match the nonempty lines first, then restore
  // explicitly painted HTML-only rows between matched lines. Uncolored padding
  // remains plain text to avoid rendering the terminal's empty screen width.
  const plainLines = rawText.replace(/\r\n/g, "\n").split("\n");

  const matchKey = (value) =>
    value
      .normalize("NFC")
      .replace(/\u00a0/g, " ")
      .replace(/[\u200b-\u200d\ufeff]/g, "")
      .replace(/[ \t]+$/g, "");

  const plainKeys = plainLines.map(matchKey);
  const htmlKeys =
    capturedLines ?
      capturedLines.map((line) => matchKey(line.textContent || ""))
    : [];

  const alignedIndices = Array(plainLines.length).fill(-1);
  const anchors = [{ plain: -1, html: -1 }];
  let htmlCursor = 0;
  let matchedChars = 0;

  for (let i = 0; i < plainKeys.length; i++) {
    if (!plainKeys[i]) continue;
    // xterm can serialize extra padding rows or split a wrapped line.
    const next = Math.min(htmlKeys.length, htmlCursor + 16);
    for (let j = htmlCursor; j < next; j++) {
      if (htmlKeys[j] === plainKeys[i]) {
        alignedIndices[i] = j;
        anchors.push({ plain: i, html: j });
        matchedChars += plainKeys[i].length;
        htmlCursor = j + 1;
        break;
      }
    }
  }
  anchors.push({ plain: plainLines.length, html: htmlKeys.length });

  function hasColoredBackgroundSpaces(line) {
    if (!line || !/^[ \t\u00a0]*$/.test(line.textContent || "")) return false;
    return Array.from(line.querySelectorAll("span")).some(
      (span) =>
        Boolean(span.style.backgroundColor) &&
        /[ \t\u00a0]/.test(span.textContent || ""),
    );
  }

  // Extra HTML-only painted rows are inserted into the preview, not the raw
  // clipboard string. Nonempty text anchors on either side make the alignment
  // safe; the overall text-match threshold below still rejects stale HTML.
  const beforePlain = new Map();
  let matchedBackgroundRows = 0;
  if (capturedLines) {
    // Special case: the selected text itself contains only painted spaces.
    // This cannot use nonempty anchors, so require an exact row count.
    if (
      plainKeys.every((key) => !key) &&
      plainLines.length === htmlKeys.length
    ) {
      for (let i = 0; i < htmlKeys.length; i++) {
        if (hasColoredBackgroundSpaces(capturedLines[i])) {
          alignedIndices[i] = i;
          matchedBackgroundRows++;
        }
      }
    }
    for (let k = 1; k < anchors.length; k++) {
      const left = anchors[k - 1];
      const right = anchors[k];
      const blankPlain = [];
      const paintedHtml = [];
      for (let i = left.plain + 1; i < right.plain; i++) {
        if (!plainKeys[i]) blankPlain.push(i);
      }
      for (let j = left.html + 1; j < right.html; j++) {
        if (!htmlKeys[j] && hasColoredBackgroundSpaces(capturedLines[j])) {
          paintedHtml.push(j);
        }
      }

      // Avoid including arbitrary HTML from a different clipboard capture.
      // At least one neighboring nonempty line must be matched. A completely
      // whitespace-only selection is handled separately below.
      if (
        !paintedHtml.length ||
        (left.plain < 0 && right.plain >= plainLines.length)
      ) {
        continue;
      }

      const paired = Math.min(blankPlain.length, paintedHtml.length);
      for (let i = 0; i < paired; i++) {
        alignedIndices[blankPlain[i]] = paintedHtml[i];
        matchedBackgroundRows++;
      }

      // xterm may include one or more painted rows absent from text/plain.
      // Only restore those explicitly painted rows (never ordinary padding).
      if (paintedHtml.length > paired) {
        const extras = paintedHtml.slice(paired, paired + 32);
        beforePlain.set(right.plain, extras);
        matchedBackgroundRows += extras.length;
      }
    }
  }

  const alignedLines = [];
  for (let i = 0; i <= plainLines.length; i++) {
    if (capturedLines && beforePlain.has(i)) {
      for (const j of beforePlain.get(i)) alignedLines.push(capturedLines[j]);
    }
    if (i === plainLines.length) break;
    const index = alignedIndices[i];
    if (index >= 0 && capturedLines) {
      alignedLines.push(capturedLines[index]);
    } else {
      const fallback = document.createDocumentFragment();
      fallback.appendChild(document.createTextNode(plainLines[i]));
      alignedLines.push(fallback);
    }
  }

  const totalChars = plainKeys.reduce((sum, key) => sum + key.length, 0);
  const matchingText =
    totalChars > 0 && matchedChars > 0 && matchedChars >= totalChars * 0.5;
  const matchingBackgroundOnly =
    totalChars === 0 &&
    matchedBackgroundRows > 0 &&
    plainLines.length === htmlKeys.length;
  const formattedLines =
    capturedLines && (matchingText || matchingBackgroundOnly) ?
      alignedLines
    : null;

  if (!formattedLines) {
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
    invalidateExport();
    notifySettingsChanged("theme", theme);
  });

  // ── Font size ────────────────────────────────────────
  fontSizeSlider.addEventListener("input", () => {
    const size = fontSizeSlider.value;
    fontSizeValue.textContent = size;
    terminalBody.style.fontSize = size + "px";
    invalidateExport();
    notifySettingsChanged("fontSize", Number(size));
  });

  // ── Padding ──────────────────────────────────────────
  paddingSlider.addEventListener("input", () => {
    const pad = paddingSlider.value;
    paddingValue.textContent = pad;
    terminalBody.style.padding = pad + "px";
    invalidateExport();
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
    invalidateExport();
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
    invalidateExport();
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
    invalidateExport();
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
    invalidateExport();
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

  // ── Fast PNG export ───────────────────────────────────
  // A stylesheet-based SVG snapshot avoids per-span getComputedStyle calls.
  // html-to-image remains available if a renderer fails on a particular host.
  function getExportBlob() {
    const scale = Number(exportScaleSelect.value);
    if (cachedExport && cachedExport.scale === scale) {
      return cachedExport.promise;
    }
    const promise = window.TermSnapFastExport.renderPngBlob(
      captureArea,
      scale,
    ).catch(async (error) => {
      // Avoid browser auto-downscaling or allocating an enormous canvas.
      if (String(error).includes("too large for the fast canvas")) throw error;
      console.warn(
        "TermSnap: fast renderer unavailable; using fallback:",
        error,
      );
      const blob = await htmlToImage.toBlob(captureArea, {
        pixelRatio: scale,
        skipAutoScale: true,
      });
      if (!blob) throw new Error("PNG fallback returned no image");
      return blob;
    });
    cachedExport = { scale, promise };
    promise.catch(() => {
      if (cachedExport && cachedExport.promise === promise) cachedExport = null;
    });
    return promise;
  }

  function toDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  exportScaleSelect.addEventListener("change", () => {
    invalidateExport();
    notifySettingsChanged("exportScale", Number(exportScaleSelect.value));
  });

  // Begin the save dialog immediately, while the image renders in parallel.
  // A unique ID prevents stale save-dialog responses from saving the wrong PNG.
  let nextSaveId = 0;
  const saveDialogResponses = new Map();
  btnSave.addEventListener("click", async () => {
    btnSave.disabled = true;
    btnSave.textContent = "Exporting...";
    const requestId = `${Date.now()}-${++nextSaveId}`;
    const choice = new Promise((resolve) => {
      saveDialogResponses.set(requestId, resolve);
    });
    vscode.postMessage({ type: "requestSave", requestId });
    try {
      const [accepted, blob] = await Promise.all([choice, getExportBlob()]);
      if (accepted) {
        vscode.postMessage({
          type: "save",
          requestId,
          dataUrl: await toDataUrl(blob),
        });
      }
    } catch (error) {
      console.error("TermSnap export error:", error);
      vscode.postMessage({ type: "cancelSave", requestId });
      btnSave.title = String(error);
      vscode.postMessage({ type: "exportError", detail: String(error) });
    } finally {
      saveDialogResponses.delete(requestId);
      btnSave.disabled = false;
      btnSave.textContent = "Save as PNG";
    }
  });

  // Browser clipboard first; if denied, send the same PNG to the UI extension
  // host for wl-copy/xclip. Never rasterize the same screenshot twice.
  btnCopy.addEventListener("click", async () => {
    btnCopy.disabled = true;
    btnCopy.textContent = "Copying...";
    try {
      const blob = await getExportBlob();
      try {
        if (!navigator.clipboard?.write || !window.ClipboardItem) {
          throw new Error("Browser image clipboard API unavailable");
        }
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
      } catch (clipboardError) {
        console.info(
          "TermSnap: using native clipboard fallback:",
          clipboardError,
        );
        vscode.postMessage({ type: "copy", dataUrl: await toDataUrl(blob) });
      }
    } catch (error) {
      console.error("TermSnap copy image error:", error);
      btnCopy.title = String(error);
      vscode.postMessage({ type: "exportError", detail: String(error) });
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
    if (message.type === "saveDestination") {
      const respond = saveDialogResponses.get(message.requestId);
      if (respond) {
        saveDialogResponses.delete(message.requestId);
        respond(Boolean(message.accepted));
      }
    } else if (message.type === "updateText") {
      rawText = message.text;
      // A new plain-text payload doesn't correspond to the previous HTML.
      terminalColorsCheckbox.checked = false;
      terminalColorsCheckbox.disabled = true;
      renderText(lineNumbersCheckbox.checked);
    }
  });
};
