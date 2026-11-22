/**
 * Nalbuphine 止痛評估電子化系統 - 高精度觸控手寫簽名引擎 (Signature Pad)
 */
class TouchSignaturePad {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.isDrawing = false;
    this.penColor = options.penColor || '#0B2545';
    this.lineWidth = options.lineWidth || 3;
    this.history = [];
    this.lastPoint = null;

    this.initCanvas();
    this.bindEvents();
  }

  getCanvasDisplaySize() {
    const target = this.canvas.parentElement || this.canvas;
    const rect = target.getBoundingClientRect();
    return {
      width: Math.max(Math.floor(rect.width), 300),
      height: Math.max(Math.floor(rect.height), 180)
    };
  }

  applyContextSettings(dpr) {
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = this.penColor;
    this.ctx.lineWidth = this.lineWidth;
  }

  initCanvas() {
    const { width, height } = this.getCanvasDisplaySize();
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;

    this.applyContextSettings(dpr);
    this.clear();
  }

  resize() {
    const wasEmpty = this.isEmpty();
    const tempImage = wasEmpty ? null : this.canvas.toDataURL('image/png');
    const { width, height } = this.getCanvasDisplaySize();
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;

    this.applyContextSettings(dpr);

    if (tempImage) {
      this.drawImageFitted(tempImage, width, height);
    } else {
      this.clear();
    }
  }

  drawImageFitted(dataUrl, width, height) {
    const img = new Image();
    img.onload = () => {
      this.clear();
      const scale = Math.min(width / img.width, height / img.height);
      const drawWidth = img.width * scale;
      const drawHeight = img.height * scale;
      const offsetX = (width - drawWidth) / 2;
      const offsetY = (height - drawHeight) / 2;
      this.ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    };
    img.src = dataUrl;
  }

  bindEvents() {
    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches && e.touches.length ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches && e.touches.length ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    const startDraw = (e) => {
      e.preventDefault();
      this.saveState();
      this.isDrawing = true;
      this.lastPoint = getPos(e);

      this.ctx.beginPath();
      this.ctx.moveTo(this.lastPoint.x, this.lastPoint.y);
      this.ctx.lineTo(this.lastPoint.x + 0.01, this.lastPoint.y + 0.01);
      this.ctx.stroke();
    };

    const moveDraw = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      const currentPoint = getPos(e);

      const midPoint = {
        x: (this.lastPoint.x + currentPoint.x) / 2,
        y: (this.lastPoint.y + currentPoint.y) / 2
      };

      this.ctx.quadraticCurveTo(this.lastPoint.x, this.lastPoint.y, midPoint.x, midPoint.y);
      this.ctx.stroke();

      this.lastPoint = currentPoint;
    };

    const endDraw = () => {
      if (this.isDrawing) {
        this.isDrawing = false;
        this.ctx.closePath();
      }
    };

    if (window.PointerEvent) {
      this.canvas.addEventListener('pointerdown', startDraw);
      this.canvas.addEventListener('pointermove', moveDraw);
      this.canvas.addEventListener('pointerup', endDraw);
      this.canvas.addEventListener('pointercancel', endDraw);
      this.canvas.addEventListener('pointerleave', endDraw);

      // iOS WKWebView / LINE 內建瀏覽器必須在非 passive 的 touch 事件中 preventDefault 才能徹底鎖住頁面捲動
      const blockScroll = (e) => { if (e.cancelable) e.preventDefault(); };
      this.canvas.addEventListener('touchstart', blockScroll, { passive: false });
      this.canvas.addEventListener('touchmove', blockScroll, { passive: false });
    } else {
      this.canvas.addEventListener('touchstart', startDraw, { passive: false });
      this.canvas.addEventListener('touchmove', moveDraw, { passive: false });
      this.canvas.addEventListener('touchend', endDraw);
      this.canvas.addEventListener('mousedown', startDraw);
      this.canvas.addEventListener('mousemove', moveDraw);
      this.canvas.addEventListener('mouseup', endDraw);
    }
  }

  setPenColor(color) {
    this.penColor = color;
    this.ctx.strokeStyle = color;
  }

  setLineWidth(width) {
    this.lineWidth = width;
    this.ctx.lineWidth = width;
  }

  saveState() {
    if (this.history.length > 20) this.history.shift();
    this.history.push(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height));
  }

  undo() {
    if (this.history.length > 0) {
      const previousState = this.history.pop();
      this.ctx.putImageData(previousState, 0, 0);
    }
  }

  clear() {
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.history = [];
  }

  isEmpty() {
    // Check if canvas is purely white
    const pixelBuffer = new Uint32Array(
      this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data.buffer
    );
    return !pixelBuffer.some(color => color !== 0xffffffff);
  }

  toDataURL(type = 'image/jpeg', watermarkText = '') {
    const renderExport = (maxDim, mime, quality) => {
      const w = this.canvas.width;
      const h = this.canvas.height;
      const scale = (w <= maxDim && h <= maxDim) ? 1 : Math.min(maxDim / w, maxDim / h);

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = Math.max(1, Math.round(w * scale));
      exportCanvas.height = Math.max(1, Math.round(h * scale));
      const exportCtx = exportCanvas.getContext('2d');
      exportCtx.fillStyle = '#FFFFFF';
      exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      exportCtx.drawImage(this.canvas, 0, 0, exportCanvas.width, exportCanvas.height);

      if (watermarkText) {
        this.applyWatermark(exportCtx, exportCanvas.width, exportCanvas.height, watermarkText);
      }
      return exportCanvas.toDataURL(mime, quality);
    };

    // 使用白底 JPEG 壓縮並加上尺寸保護，確保含浮水印也遠低於 Google 試算表 50,000 字元上限
    let result = renderExport(500, 'image/jpeg', 0.82);
    if (result.length > 38000) {
      result = renderExport(420, 'image/jpeg', 0.68);
    }
    if (result.length > 38000) {
      result = renderExport(340, 'image/jpeg', 0.55);
    }
    return result;
  }

  applyWatermark(ctx, width, height, text) {
    ctx.save();
    const fontSize = Math.max(11, Math.min(16, Math.round(width / 34)));
    ctx.font = `bold ${fontSize}px "Noto Sans TC", "Microsoft JhengHei", sans-serif`;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.translate(width / 2, height / 2);
    ctx.rotate(-16 * Math.PI / 180);

    const stepY = Math.max(46, Math.round(height / 3));
    for (let y = -height; y <= height; y += stepY) {
      ctx.fillText(text, 0, y);
    }
    ctx.restore();
  }

  fromDataURL(dataUrl) {
    const { width, height } = this.getCanvasDisplaySize();
    this.drawImageFitted(dataUrl, width, height);
  }
}

window.TouchSignaturePad = TouchSignaturePad;
