/* TermSnap TextWrap fast export: keep the page stylesheet rather than
 * computing and copying styles for every terminal span. The generated SVG
 * is self-contained, and Chromium paints it into a PNG canvas. */
(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const XHTML_NS = "http://www.w3.org/1999/xhtml";
  const MAX_FAST_SIDE = 16384;
  const MAX_FAST_PIXELS = 32 * 1024 * 1024;
  let cssTextPromise;

  async function stylesheetText() {
    if (cssTextPromise) return cssTextPromise;
    cssTextPromise = (async () => {
      const link = document.querySelector('link[href*="styles.css"]');
      const inline = document.getElementById("termsnap-test-style");
      const sheet = link?.sheet || inline?.sheet;
      if (sheet) {
        try {
          const css = Array.from(sheet.cssRules)
            .map((rule) => rule.cssText).join("\n");
          if (css.includes(".terminal-window")) return css;
        } catch {
          // VS Code's resource host can make CSSOM access cross-origin.
        }
      }
      if (!link) throw new Error("TermSnap stylesheet unavailable");
      const response = await fetch(link.href);
      if (!response.ok) throw new Error("Unable to load TermSnap styles");
      return response.text();
    })();
    try {
      return await cssTextPromise;
    } catch (error) {
      cssTextPromise = undefined;
      throw error;
    }
  }

  function snapshotSvg(element, width, height, css, cropY = 0, cropHeight = height) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("xmlns", SVG_NS);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(cropHeight));
    svg.setAttribute("viewBox", `0 ${cropY} ${width} ${cropHeight}`);

    const foreignObject = document.createElementNS(SVG_NS, "foreignObject");
    foreignObject.setAttribute("x", "0");
    foreignObject.setAttribute("y", "0");
    foreignObject.setAttribute("width", String(width));
    foreignObject.setAttribute("height", String(height));

    const wrapper = document.createElementNS(XHTML_NS, "div");
    wrapper.setAttribute("xmlns", XHTML_NS);
    wrapper.style.width = `${width}px`;
    wrapper.style.height = `${height}px`;
    wrapper.style.margin = "0";
    wrapper.style.padding = "0";

    const style = document.createElementNS(XHTML_NS, "style");
    style.textContent = css;
    wrapper.appendChild(style);
    wrapper.appendChild(element.cloneNode(true));
    foreignObject.appendChild(wrapper);
    svg.appendChild(foreignObject);
    return new XMLSerializer().serializeToString(svg);
  }

  function loadSvgImage(markup) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("SVG preview rasterization failed"));
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    });
  }

  function canvasBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob && blob.size) resolve(blob);
        else reject(new Error("PNG encoder returned an empty image"));
      }, "image/png");
    });
  }

  const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const CRC_TABLE = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    CRC_TABLE[n] = c >>> 0;
  }

  function setUint32(bytes, offset, value) {
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      .setUint32(offset, value >>> 0, false);
  }

  function pngChunk(type, bytes) {
    const data = bytes || new Uint8Array(0);
    const chunk = new Uint8Array(12 + data.length);
    setUint32(chunk, 0, data.length);
    for (let i = 0; i < 4; i++) chunk[i + 4] = type.charCodeAt(i);
    chunk.set(data, 8);
    let crc = 0xffffffff;
    for (let i = 4; i < 8 + data.length; i++) {
      crc = CRC_TABLE[(crc ^ chunk[i]) & 0xff] ^ (crc >>> 8);
    }
    setUint32(chunk, 8 + data.length, (crc ^ 0xffffffff) >>> 0);
    return chunk;
  }

  // Large captures are encoded as a single PNG zlib stream in bounded-height
  // tiles. This avoids browser canvas dimension limits without downscaling.
  async function renderTiledPng(element, width, height, pixelWidth, pixelHeight, ratio, css) {
    if (!window.CompressionStream) {
      throw new Error("Streaming PNG encoder not supported by this VS Code version");
    }
    const header = new Uint8Array(13);
    setUint32(header, 0, pixelWidth);
    setUint32(header, 4, pixelHeight);
    header[8] = 8; // 8 bits per channel
    header[9] = 6; // RGBA (alpha is needed for rounded corners)

    const parts = [PNG_SIGNATURE, pngChunk("IHDR", header)];
    const compression = new CompressionStream("deflate");
    const writer = compression.writable.getWriter();
    const collect = (async () => {
      const reader = compression.readable.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        parts.push(pngChunk("IDAT", value));
      }
    })();

    const TILE_HEIGHT = Math.max(1, Math.min(512, Math.floor(4_000_000 / pixelWidth)));
    const canvas = document.createElement("canvas");
    canvas.width = pixelWidth;
    canvas.height = TILE_HEIGHT;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Tile canvas unavailable");

    try {
      for (let y = 0; y < pixelHeight; y += TILE_HEIGHT) {
        const rows = Math.min(TILE_HEIGHT, pixelHeight - y);
        // viewBox crops the original full-height DOM to this tile's region.
        const markup = snapshotSvg(element, width, height, css, y / ratio, rows / ratio);
        const image = await loadSvgImage(markup);
        context.clearRect(0, 0, pixelWidth, TILE_HEIGHT);
        context.drawImage(image, 0, 0, pixelWidth, rows);
        const rgba = context.getImageData(0, 0, pixelWidth, rows).data;
        const stride = pixelWidth * 4;
        const scanlines = new Uint8Array(rows * (stride + 1));
        for (let row = 0; row < rows; row++) {
          // PNG filter 0: exact RGBA bytes, fastest encoding with zlib.
          scanlines.set(rgba.subarray(row * stride, (row + 1) * stride), row * (stride + 1) + 1);
        }
        await writer.write(scanlines);
        // Keep the preview responsive while large screenshots are rendered.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      await writer.close();
      await collect;
    } catch (error) {
      await writer.abort(error).catch(() => {});
      await collect.catch(() => {});
      throw error;
    }
    parts.push(pngChunk("IEND"));
    return new Blob(parts, { type: "image/png" });
  }

  async function renderPngBlob(element, scale) {
    await document.fonts.ready;
    const ratio = Number(scale);
    if (![1, 2, 3, 4].includes(ratio)) throw new Error("Invalid export scale");

    const rect = element.getBoundingClientRect();
    const width = Math.ceil(rect.width);
    const height = Math.ceil(rect.height);
    if (!width || !height) throw new Error("Screenshot is empty");
    const pixelWidth = Math.ceil(width * ratio);
    const pixelHeight = Math.ceil(height * ratio);
    if (pixelWidth > MAX_FAST_SIDE) {
      throw new Error(`Screenshot width ${pixelWidth}px exceeds the browser limit. Reduce PNG scale or preview width.`);
    }
    const css = await stylesheetText();

    if (
      pixelHeight > MAX_FAST_SIDE ||
      pixelWidth * pixelHeight > MAX_FAST_PIXELS
    ) {
      return renderTiledPng(element, width, height, pixelWidth, pixelHeight, ratio, css);
    }

    const markup = snapshotSvg(element, width, height, css);
    const image = await loadSvgImage(markup);
    const canvas = document.createElement("canvas");
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("Canvas 2D unavailable");
    context.drawImage(image, 0, 0, pixelWidth, pixelHeight);
    return canvasBlob(canvas);
  }

  window.TermSnapFastExport = { renderPngBlob };
})();
