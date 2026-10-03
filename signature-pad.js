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

  initCanvas() {
    // Set actual resolution equal to display resolution for high DPI displays
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    this.canvas.width = (rect.width || 500) * dpr;
    this.canvas.height = (rect.height || 260) * dpr;
    
    this.ctx.scale(dpr, dpr);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = this.penColor;
    this.ctx.lineWidth = this.lineWidth;

    // Fill white background
    this.clear();
  }

  resize() {
    const tempImage = this.toDataURL();
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    this.canvas.width = (rect.width || 500) * dpr;
    this.canvas.height = 260 * dpr;
    
    this.ctx.scale(dpr, dpr);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = this.penColor;
    this.ctx.lineWidth = this.lineWidth;

    if (tempImage && !this.isEmpty()) {
      const img = new Image();
      img.onload = () => {
        this.ctx.drawImage(img, 0, 0, rect.width, 260);
      };
      img.src = tempImage;
    } else {
      this.clear();
    }
  }

  bindEvents() {
    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
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
    };

    const moveDraw = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      const currentPoint = getPos(e);
      
      // Smooth curve interpolation
      const midPoint = {
        x: (this.lastPoint.x + currentPoint.x) / 2,
        y: (this.lastPoint.y + currentPoint.y) / 2
      };

      this.ctx.quadraticCurveTo(this.lastPoint.x, this.lastPoint.y, midPoint.x, midPoint.y);
      this.ctx.stroke();

      this.lastPoint = currentPoint;
    };

    const endDraw = (e) => {
      if (this.isDrawing) {
        this.isDrawing = false;
        this.ctx.closePath();
      }
    };

    // Pointer Events for Stylus & Touch
    this.canvas.addEventListener('pointerdown', startDraw);
    this.canvas.addEventListener('pointermove', moveDraw);
    this.canvas.addEventListener('pointerup', endDraw);
    this.canvas.addEventListener('pointerleave', endDraw);

    // Fallback Touch Events
    this.canvas.addEventListener('touchstart', startDraw, { passive: false });
    this.canvas.addEventListener('touchmove', moveDraw, { passive: false });
    this.canvas.addEventListener('touchend', endDraw);
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

  toDataURL(type = 'image/png') {
    return this.canvas.toDataURL(type);
  }

  fromDataURL(dataUrl) {
    const img = new Image();
    img.onload = () => {
      this.clear();
      const rect = this.canvas.getBoundingClientRect();
      this.ctx.drawImage(img, 0, 0, rect.width || 500, 260);
    };
    img.src = dataUrl;
  }
}

window.TouchSignaturePad = TouchSignaturePad;
