/* ==========================================================================
   CanvasPro - Tools Controller & Drawing Engines
   ========================================================================== */

class ToolManager {
  constructor(viewport, layerManager, historyManager) {
    this.viewport = viewport;
    this.layerManager = layerManager;
    this.historyManager = historyManager;

    this.activeTool = 'select'; // default tool
    this.primaryColor = '#3b82f6';
    this.secondaryColor = '#ffffff';

    // Tool settings
    this.brushSize = 12;
    this.brushOpacity = 1.0;
    this.brushType = 'solid'; // 'solid', 'soft', 'marker', 'calligraphy', 'spray'

    this.eraserSize = 24;

    this.shapeType = 'rect'; // 'rect', 'rounded-rect', 'circle', 'star', 'heart', 'arrow', 'polygon'
    this.shapeMode = 'outline'; // 'outline', 'fill', 'both'
    this.shapeBorderWidth = 4;

    this.textSettings = {
      font: 'Inter, sans-serif',
      size: 40,
      bold: false,
      italic: false
    };

    this.bucketTolerance = 32;

    // Interaction state
    this.isDrawing = false;
    this.lastX = 0;
    this.lastY = 0;
    this.startX = 0;
    this.startY = 0;
    this.points = []; // for smoothing

    // Transform Gizmo state
    this.gizmoEl = document.getElementById('transform-gizmo');
    this.isTransforming = false;
    this.transformMode = null; // 'move' | 'tl' | 'tr' | 'bl' | 'br' | 'tc' | 'bc' | 'ml' | 'mr' | 'rot'
    this.transformStartBounds = null;
    this.transformStartMouse = null;

    // Crop Tool state
    this.cropOverlayEl = document.getElementById('crop-overlay');
    this.cropBoxEl = document.getElementById('crop-box-element');
    this.cropRect = { x: 50, y: 50, width: 400, height: 300 };
    this.isCropDragging = false;
    this.cropDragHandle = null;

    // Callbacks
    this.onColorPicked  = null;
    this.onToolChanged  = null;
    this.onNeedsRender  = null; // fires whenever a layer buffer changes

    this.initEvents();
  }

  setTool(toolName) {
    this.activeTool = toolName;
    this.clearOverlay();

    // Hide/show gizmo depending on tool
    if (toolName === 'select') {
      this.updateGizmo();
    } else {
      this.hideGizmo();
    }

    // Toggle crop overlay
    if (toolName === 'crop') {
      this.initCropBox();
    } else {
      this.cropOverlayEl.classList.remove('active');
    }

    if (this.onToolChanged) this.onToolChanged(toolName);
  }

  setPrimaryColor(color) {
    this.primaryColor = color;
    const activeLayer = this.layerManager.getActiveLayer();
    if (activeLayer && activeLayer.type === 'text') {
      activeLayer.textData.color = color;
      this.viewport.updateStageTransform();
      this.historyManager.pushState('Change Text Color');
    }
  }

  setSecondaryColor(color) {
    this.secondaryColor = color;
  }

  swapColors() {
    const temp = this.primaryColor;
    this.primaryColor = this.secondaryColor;
    this.secondaryColor = temp;
  }

  getOverlayCtx() {
    return this.viewport.overlayCanvasEl.getContext('2d');
  }

  clearOverlay() {
    const ctx = this.getOverlayCtx();
    ctx.clearRect(0, 0, this.layerManager.width, this.layerManager.height);
  }

  initEvents() {
    const overlay = this.viewport.overlayCanvasEl;

    // Pointer events on overlay canvas
    overlay.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
    window.addEventListener('pointermove', (e) => this.handlePointerMove(e));
    window.addEventListener('pointerup', (e) => this.handlePointerUp(e));

    // Gizmo handles interaction
    this.initGizmoEvents();

    // Crop box interaction
    this.initCropEvents();

    // Keyboard nudge & shortcuts
    window.addEventListener('keydown', (e) => {
      if (this.viewport.isEditingText(e)) return;

      const layer = this.layerManager.getActiveLayer();
      if (this.activeTool === 'select' && layer && layer.type !== 'paint') {
        const step = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowLeft')  { layer.x -= step; this.updateGizmo(); e.preventDefault(); if (this.onNeedsRender) this.onNeedsRender(); }
        if (e.key === 'ArrowRight') { layer.x += step; this.updateGizmo(); e.preventDefault(); if (this.onNeedsRender) this.onNeedsRender(); }
        if (e.key === 'ArrowUp')    { layer.y -= step; this.updateGizmo(); e.preventDefault(); if (this.onNeedsRender) this.onNeedsRender(); }
        if (e.key === 'ArrowDown')  { layer.y += step; this.updateGizmo(); e.preventDefault(); if (this.onNeedsRender) this.onNeedsRender(); }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          this.layerManager.deleteLayer(layer.id);
          this.updateGizmo();
          this.historyManager.pushState('Delete Element');
          if (this.onNeedsRender) this.onNeedsRender();
        }
      }
    });
  }

  /* ==========================================================================
     Pointer Handlers
     ========================================================================== */
  handlePointerDown(e) {
    if (e.button !== 0 || this.viewport.spacePressed || this.viewport.isPanning) return;

    const coords = this.viewport.screenToCanvas(e.clientX, e.clientY);
    this.startX = coords.x;
    this.startY = coords.y;
    this.lastX = coords.x;
    this.lastY = coords.y;
    this.isDrawing = true;
    this.points = [{ x: coords.x, y: coords.y }];

    if (this.activeTool === 'select') {
      this.handleSelectPointerDown(coords.x, coords.y);
    } else if (this.activeTool === 'bucket') {
      this.handleBucketFill(coords.x, coords.y);
      this.isDrawing = false;
    } else if (this.activeTool === 'eyedropper') {
      this.sampleColor(coords.x, coords.y);
    } else if (this.activeTool === 'text') {
      this.handleTextPlacement(coords.x, coords.y);
      this.isDrawing = false;
    } else if (this.activeTool === 'hand') {
      this.viewport.startPan(e.clientX, e.clientY);
    } else if (this.activeTool === 'brush' || this.activeTool === 'eraser') {
      const layer = this.ensureActivePaintLayer();
      this.drawBrushPoint(layer.ctx, coords.x, coords.y);
      if (this.onNeedsRender) this.onNeedsRender();
    }
  }

  handlePointerMove(e) {
    if (!this.isDrawing) {
      if (this.activeTool === 'eyedropper') {
        const coords = this.viewport.screenToCanvas(e.clientX, e.clientY);
        this.renderEyedropperLoupe(coords.x, coords.y, e.clientX, e.clientY);
      }
      return;
    }

    const coords = this.viewport.screenToCanvas(e.clientX, e.clientY);

    if (this.activeTool === 'brush' || this.activeTool === 'eraser') {
      const layer = this.ensureActivePaintLayer();
      this.points.push({ x: coords.x, y: coords.y });
      this.drawBrushStroke(layer.ctx);
      this.lastX = coords.x;
      this.lastY = coords.y;
      if (this.onNeedsRender) this.onNeedsRender();
    } else if (this.activeTool === 'line') {
      this.renderLinePreview(this.startX, this.startY, coords.x, coords.y, e.shiftKey);
    } else if (this.activeTool === 'shapes') {
      this.renderShapePreview(this.startX, this.startY, coords.x, coords.y, e.shiftKey);
    } else if (this.activeTool === 'eyedropper') {
      this.sampleColor(coords.x, coords.y);
      this.renderEyedropperLoupe(coords.x, coords.y, e.clientX, e.clientY);
    }
  }

  handlePointerUp(e) {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    const coords = this.viewport.screenToCanvas(e.clientX, e.clientY);

    if (this.activeTool === 'brush') {
      this.historyManager.pushState('Brush Stroke');
      if (this.onNeedsRender) this.onNeedsRender();
    } else if (this.activeTool === 'eraser') {
      this.historyManager.pushState('Erase');
      if (this.onNeedsRender) this.onNeedsRender();
    } else if (this.activeTool === 'line') {
      this.commitLine(this.startX, this.startY, coords.x, coords.y, e.shiftKey);
      this.clearOverlay();
      this.historyManager.pushState('Draw Line');
      if (this.onNeedsRender) this.onNeedsRender();
    } else if (this.activeTool === 'shapes') {
      this.commitShape(this.startX, this.startY, coords.x, coords.y, e.shiftKey);
      this.clearOverlay();
      this.historyManager.pushState(`Draw ${this.shapeType}`);
      if (this.onNeedsRender) this.onNeedsRender();
    } else if (this.activeTool === 'eyedropper') {
      this.clearOverlay();
    }

    this.points = [];
  }

  ensureActivePaintLayer() {
    let layer = this.layerManager.getActiveLayer();
    // If active layer is an image or text, create a new paint layer on top so user can draw freely!
    if (!layer || layer.type !== 'paint' || layer.locked || !layer.visible) {
      layer = this.layerManager.addLayer('paint', 'Paint Layer');
    }
    return layer;
  }

  /* ==========================================================================
     Brush & Eraser Engine
     ========================================================================== */
  drawBrushPoint(ctx, x, y) {
    ctx.save();
    if (this.activeTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, this.eraserSize / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.globalAlpha = this.brushOpacity;
      ctx.fillStyle = this.primaryColor;
      ctx.beginPath();
      ctx.arc(x, y, this.brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawBrushStroke(ctx) {
    ctx.save();
    const isEraser = this.activeTool === 'eraser';
    const size = isEraser ? this.eraserSize : this.brushSize;

    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(this.lastX, this.lastY);
      ctx.lineTo(this.points[this.points.length - 1].x, this.points[this.points.length - 1].y);
      ctx.stroke();
    } else {
      ctx.globalAlpha = this.brushOpacity;
      ctx.strokeStyle = this.primaryColor;
      ctx.fillStyle = this.primaryColor;

      if (this.brushType === 'solid') {
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Smooth Bézier curve interpolation
        if (this.points.length > 2) {
          const xc = (this.points[this.points.length - 2].x + this.points[this.points.length - 1].x) / 2;
          const yc = (this.points[this.points.length - 2].y + this.points[this.points.length - 1].y) / 2;
          ctx.beginPath();
          ctx.moveTo(this.points[this.points.length - 3].x, this.points[this.points.length - 3].y);
          ctx.quadraticCurveTo(this.points[this.points.length - 2].x, this.points[this.points.length - 2].y, xc, yc);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(this.lastX, this.lastY);
          ctx.lineTo(this.points[this.points.length - 1].x, this.points[this.points.length - 1].y);
          ctx.stroke();
        }
      } else if (this.brushType === 'soft') {
        // Soft Airbrush
        ctx.shadowBlur = size * 0.7;
        ctx.shadowColor = this.primaryColor;
        ctx.lineWidth = size * 0.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(this.lastX, this.lastY);
        ctx.lineTo(this.points[this.points.length - 1].x, this.points[this.points.length - 1].y);
        ctx.stroke();
      } else if (this.brushType === 'marker') {
        // Semi-transparent chisel marker
        ctx.globalAlpha = Math.min(this.brushOpacity, 0.45);
        ctx.lineWidth = size * 1.5;
        ctx.lineCap = 'square';
        ctx.beginPath();
        ctx.moveTo(this.lastX, this.lastY);
        ctx.lineTo(this.points[this.points.length - 1].x, this.points[this.points.length - 1].y);
        ctx.stroke();
      } else if (this.brushType === 'calligraphy') {
        // Angled Calligraphy pen
        const current = this.points[this.points.length - 1];
        ctx.lineWidth = 1;
        const angle = Math.PI / 4;
        const dx = (size / 2) * Math.cos(angle);
        const dy = (size / 2) * Math.sin(angle);
        ctx.beginPath();
        ctx.moveTo(this.lastX - dx, this.lastY - dy);
        ctx.lineTo(this.lastX + dx, this.lastY + dy);
        ctx.lineTo(current.x + dx, current.y + dy);
        ctx.lineTo(current.x - dx, current.y - dy);
        ctx.closePath();
        ctx.fill();
      } else if (this.brushType === 'spray') {
        // Spray Paint Particle Dispersion
        const current = this.points[this.points.length - 1];
        const density = Math.max(15, Math.floor(size * 1.2));
        for (let i = 0; i < density; i++) {
          const offsetRadius = Math.random() * (size / 2);
          const offsetAngle = Math.random() * Math.PI * 2;
          const px = current.x + offsetRadius * Math.cos(offsetAngle);
          const py = current.y + offsetRadius * Math.sin(offsetAngle);
          ctx.beginPath();
          ctx.arc(px, py, Math.random() * 1.5 + 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  /* ==========================================================================
     Line & Shapes Engine
     ========================================================================== */
  renderLinePreview(x1, y1, x2, y2, shiftKey) {
    if (shiftKey) {
      // Snap to 0, 45, 90 deg
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
      const dist = Math.hypot(x2 - x1, y2 - y1);
      x2 = x1 + dist * Math.cos(snapped);
      y2 = y1 + dist * Math.sin(snapped);
    }

    const ctx = this.getOverlayCtx();
    this.clearOverlay();
    ctx.save();
    ctx.strokeStyle = this.primaryColor;
    ctx.lineWidth = this.shapeBorderWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  commitLine(x1, y1, x2, y2, shiftKey) {
    if (shiftKey) {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
      const dist = Math.hypot(x2 - x1, y2 - y1);
      x2 = x1 + dist * Math.cos(snapped);
      y2 = y1 + dist * Math.sin(snapped);
    }

    const layer = this.ensureActivePaintLayer();
    const ctx = layer.ctx;
    ctx.save();
    ctx.strokeStyle = this.primaryColor;
    ctx.lineWidth = this.shapeBorderWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  renderShapePreview(x1, y1, x2, y2, shiftKey) {
    const ctx = this.getOverlayCtx();
    this.clearOverlay();
    this.drawShape(ctx, x1, y1, x2, y2, shiftKey);
  }

  commitShape(x1, y1, x2, y2, shiftKey) {
    const layer = this.ensureActivePaintLayer();
    this.drawShape(layer.ctx, x1, y1, x2, y2, shiftKey);
  }

  drawShape(ctx, x1, y1, x2, y2, shiftKey) {
    let w = x2 - x1;
    let h = y2 - y1;

    if (shiftKey) {
      const size = Math.max(Math.abs(w), Math.abs(h));
      w = w < 0 ? -size : size;
      h = h < 0 ? -size : size;
    }

    const x = w < 0 ? x1 + w : x1;
    const y = h < 0 ? y1 + h : y1;
    const absW = Math.abs(w);
    const absH = Math.abs(h);

    ctx.save();
    ctx.strokeStyle = this.primaryColor;
    ctx.fillStyle = this.secondaryColor;
    ctx.lineWidth = this.shapeBorderWidth;

    ctx.beginPath();

    if (this.shapeType === 'rect') {
      ctx.rect(x, y, absW, absH);
    } else if (this.shapeType === 'rounded-rect') {
      const radius = Math.min(20, absW / 4, absH / 4);
      if (ctx.roundRect) {
        ctx.roundRect(x, y, absW, absH, radius);
      } else {
        // Fallback for older browsers
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + absW - radius, y);
        ctx.arcTo(x + absW, y, x + absW, y + radius, radius);
        ctx.lineTo(x + absW, y + absH - radius);
        ctx.arcTo(x + absW, y + absH, x + absW - radius, y + absH, radius);
        ctx.lineTo(x + radius, y + absH);
        ctx.arcTo(x, y + absH, x, y + absH - radius, radius);
        ctx.lineTo(x, y + radius);
        ctx.arcTo(x, y, x + radius, y, radius);
        ctx.closePath();
      }
    } else if (this.shapeType === 'circle') {
      ctx.ellipse(x + absW / 2, y + absH / 2, absW / 2, absH / 2, 0, 0, Math.PI * 2);
    } else if (this.shapeType === 'star') {
      this.drawStarPath(ctx, x + absW / 2, y + absH / 2, 5, absW / 2, (absW / 2) * 0.45);
    } else if (this.shapeType === 'heart') {
      this.drawHeartPath(ctx, x, y, absW, absH);
    } else if (this.shapeType === 'arrow') {
      this.drawArrowPath(ctx, x1, y1, x2, y2);
    } else if (this.shapeType === 'polygon') {
      this.drawPolygonPath(ctx, x + absW / 2, y + absH / 2, 6, absW / 2);
    }

    if (this.shapeMode === 'fill' || this.shapeMode === 'both') {
      ctx.fill();
    }
    if (this.shapeMode === 'outline' || this.shapeMode === 'both') {
      ctx.stroke();
    }

    ctx.restore();
  }

  drawStarPath(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
  }

  drawHeartPath(ctx, x, y, w, h) {
    const topCurveHeight = h * 0.3;
    ctx.moveTo(x + w / 2, y + h);
    ctx.bezierCurveTo(x, y + h * 0.6, x, y, x + w / 2, y + topCurveHeight);
    ctx.bezierCurveTo(x + w, y, x + w, y + h * 0.6, x + w / 2, y + h);
    ctx.closePath();
  }

  drawArrowPath(ctx, x1, y1, x2, y2) {
    const headlen = Math.max(15, this.shapeBorderWidth * 3);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
  }

  drawPolygonPath(ctx, cx, cy, sides, radius) {
    const angle = (Math.PI * 2) / sides;
    ctx.moveTo(cx + radius, cy);
    for (let i = 1; i < sides; i++) {
      ctx.lineTo(cx + radius * Math.cos(angle * i), cy + radius * Math.sin(angle * i));
    }
    ctx.closePath();
  }

  /* ==========================================================================
     Paint Bucket / Flood Fill Engine (Scanline BFS)
     ========================================================================== */
  handleBucketFill(startX, startY) {
    const layer = this.ensureActivePaintLayer();
    const ctx = layer.ctx;
    const w = this.layerManager.width;
    const h = this.layerManager.height;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const sx = Math.floor(startX);
    const sy = Math.floor(startY);
    if (sx < 0 || sx >= w || sy < 0 || sy >= h) return;

    const targetIdx = (sy * w + sx) * 4;
    const targetR = data[targetIdx];
    const targetG = data[targetIdx + 1];
    const targetB = data[targetIdx + 2];
    const targetA = data[targetIdx + 3];

    // Convert hex primary color to RGBA
    const fillRgba = this.hexToRgba(this.primaryColor);
    if (
      Math.abs(targetR - fillRgba.r) < 5 &&
      Math.abs(targetG - fillRgba.g) < 5 &&
      Math.abs(targetB - fillRgba.b) < 5 &&
      Math.abs(targetA - 255) < 5
    ) {
      return; // Already this color
    }

    const tolerance = this.bucketTolerance * 3;
    const match = (idx) => {
      const dr = Math.abs(data[idx] - targetR);
      const dg = Math.abs(data[idx + 1] - targetG);
      const db = Math.abs(data[idx + 2] - targetB);
      const da = Math.abs(data[idx + 3] - targetA);
      return (dr + dg + db + da) <= tolerance;
    };

    // BFS queue
    const queue = [sx, sy];
    const visited = new Uint8Array(w * h);

    while (queue.length > 0) {
      const curY = queue.pop();
      const curX = queue.pop();
      const pos = curY * w + curX;

      if (visited[pos]) continue;
      visited[pos] = 1;

      const idx = pos * 4;
      if (!match(idx)) continue;

      // Color pixel
      data[idx] = fillRgba.r;
      data[idx + 1] = fillRgba.g;
      data[idx + 2] = fillRgba.b;
      data[idx + 3] = 255;

      if (curX > 0 && !visited[pos - 1]) queue.push(curX - 1, curY);
      if (curX < w - 1 && !visited[pos + 1]) queue.push(curX + 1, curY);
      if (curY > 0 && !visited[pos - w]) queue.push(curX, curY - 1);
      if (curY < h - 1 && !visited[pos + w]) queue.push(curX, curY + 1);
    }

    ctx.putImageData(imgData, 0, 0);
    this.historyManager.pushState('Flood Fill');
    if (this.onNeedsRender) this.onNeedsRender();
  }

  hexToRgba(hex) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    const num = parseInt(c, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  /* ==========================================================================
     Eyedropper Engine
     ========================================================================== */
  sampleColor(x, y) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.layerManager.width;
    tempCanvas.height = this.layerManager.height;
    const tCtx = tempCanvas.getContext('2d');
    this.layerManager.renderAll(tCtx);

    const px = Math.floor(x);
    const py = Math.floor(y);
    if (px < 0 || px >= this.layerManager.width || py < 0 || py >= this.layerManager.height) return;

    const p = tCtx.getImageData(px, py, 1, 1).data;
    const hex = '#' + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1);

    this.primaryColor = hex;
    if (this.onColorPicked) this.onColorPicked(hex);
  }

  renderEyedropperLoupe(cx, cy, screenX, screenY) {
    const ctx = this.getOverlayCtx();
    this.clearOverlay();

    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = this.primaryColor;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ==========================================================================
     Text Tool Engine
     ========================================================================== */
  handleTextPlacement(x, y) {
    const promptText = prompt('Enter text to place on canvas:', 'Your Text Here');
    if (!promptText || promptText.trim() === '') return;

    const layer = this.layerManager.addLayer('text', `Text: ${promptText.slice(0, 10)}`);
    layer.textData = {
      text: promptText,
      font: this.textSettings.font,
      size: this.textSettings.size,
      color: this.primaryColor,
      bold: this.textSettings.bold,
      italic: this.textSettings.italic
    };

    // Calculate approximate text width/height
    const tempCtx = document.createElement('canvas').getContext('2d');
    tempCtx.font = `${layer.textData.size}px ${layer.textData.font}`;
    const metrics = tempCtx.measureText(promptText);
    layer.width = Math.max(100, Math.round(metrics.width + 20));
    layer.height = Math.round(layer.textData.size * 1.5);
    layer.x = Math.round(x);
    layer.y = Math.round(y);

    this.setTool('select');
    this.historyManager.pushState('Add Text');
  }

  /* ==========================================================================
     Select / Move / Transform Gizmo Engine
     ========================================================================== */
  handleSelectPointerDown(x, y) {
    // Check if clicked an existing layer
    const layers = this.layerManager.layers;
    let hitLayer = null;

    // Hit test top to bottom
    for (let i = layers.length - 1; i >= 0; i--) {
      if (layers[i].hitTest(x, y)) {
        hitLayer = layers[i];
        break;
      }
    }

    if (hitLayer) {
      this.layerManager.setActiveLayer(hitLayer.id);
      this.updateGizmo();
      // Start moving
      this.isTransforming = true;
      this.transformMode = 'move';
      this.transformStartBounds = { ...hitLayer.getBounds() };
      this.transformStartMouse = { x, y };
    } else {
      this.hideGizmo();
    }
  }

  updateGizmo() {
    const layer = this.layerManager.getActiveLayer();
    if (!layer || this.activeTool !== 'select') {
      this.hideGizmo();
      return;
    }

    this.gizmoEl.classList.add('active');
    this.gizmoEl.style.left = `${layer.x}px`;
    this.gizmoEl.style.top = `${layer.y}px`;
    this.gizmoEl.style.width = `${layer.width}px`;
    this.gizmoEl.style.height = `${layer.height}px`;
    this.gizmoEl.style.transform = `rotate(${layer.rotation}deg)`;
  }

  hideGizmo() {
    this.gizmoEl.classList.remove('active');
  }

  initGizmoEvents() {
    const handles = this.gizmoEl.querySelectorAll('.gizmo-handle');
    handles.forEach(handle => {
      handle.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        const mode = handle.dataset.handle;
        const layer = this.layerManager.getActiveLayer();
        if (!layer) return;

        const coords = this.viewport.screenToCanvas(e.clientX, e.clientY);
        this.isTransforming = true;
        this.transformMode = mode;
        this.transformStartBounds = { ...layer.getBounds() };
        this.transformStartMouse = { x: coords.x, y: coords.y };
      });
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isTransforming) return;
      const layer = this.layerManager.getActiveLayer();
      if (!layer) return;

      const coords = this.viewport.screenToCanvas(e.clientX, e.clientY);
      const dx = coords.x - this.transformStartMouse.x;
      const dy = coords.y - this.transformStartMouse.y;
      const b = this.transformStartBounds;

      if (this.transformMode === 'move') {
        layer.x = Math.round(b.x + dx);
        layer.y = Math.round(b.y + dy);
      } else if (this.transformMode === 'rot') {
        const cx = b.x + b.width / 2;
        const cy = b.y + b.height / 2;
        const angle = Math.atan2(coords.y - cy, coords.x - cx) * (180 / Math.PI) + 90;
        layer.rotation = Math.round(angle % 360);
      } else if (this.transformMode === 'br') {
        layer.width = Math.max(20, Math.round(b.width + dx));
        layer.height = Math.max(20, Math.round(b.height + dy));
      } else if (this.transformMode === 'bl') {
        const newW = Math.max(20, Math.round(b.width - dx));
        layer.x = b.x + (b.width - newW);
        layer.width = newW;
        layer.height = Math.max(20, Math.round(b.height + dy));
      } else if (this.transformMode === 'tr') {
        layer.width = Math.max(20, Math.round(b.width + dx));
        const newH = Math.max(20, Math.round(b.height - dy));
        layer.y = b.y + (b.height - newH);
        layer.height = newH;
      } else if (this.transformMode === 'tl') {
        const newW = Math.max(20, Math.round(b.width - dx));
        const newH = Math.max(20, Math.round(b.height - dy));
        layer.x = b.x + (b.width - newW);
        layer.y = b.y + (b.height - newH);
        layer.width = newW;
        layer.height = newH;
      } else if (this.transformMode === 'mr') {
        layer.width = Math.max(20, Math.round(b.width + dx));
      } else if (this.transformMode === 'bc') {
        layer.height = Math.max(20, Math.round(b.height + dy));
      }

      this.updateGizmo();
      if (this.onNeedsRender) this.onNeedsRender();
    });

    window.addEventListener('pointerup', () => {
      if (this.isTransforming) {
        this.isTransforming = false;
        this.transformMode = null;
        this.historyManager.pushState('Transform Element');
        if (this.onNeedsRender) this.onNeedsRender();
      }
    });
  }

  /* ==========================================================================
     Crop Interactive Box Engine
     ========================================================================== */
  initCropBox() {
    this.cropOverlayEl.classList.add('active');
    const margin = 40;
    this.cropRect = {
      x: margin,
      y: margin,
      width: Math.max(100, this.layerManager.width - margin * 2),
      height: Math.max(100, this.layerManager.height - margin * 2)
    };
    this.updateCropBoxUI();
  }

  updateCropBoxUI() {
    this.cropBoxEl.style.left = `${this.cropRect.x}px`;
    this.cropBoxEl.style.top = `${this.cropRect.y}px`;
    this.cropBoxEl.style.width = `${this.cropRect.width}px`;
    this.cropBoxEl.style.height = `${this.cropRect.height}px`;
  }

  initCropEvents() {
    let startMouse = null;
    let startRect = null;

    this.cropBoxEl.addEventListener('pointerdown', (e) => {
      if (e.target.dataset.crophandle) {
        this.cropDragHandle = e.target.dataset.crophandle;
      } else {
        this.cropDragHandle = 'move';
      }
      this.isCropDragging = true;
      const coords = this.viewport.screenToCanvas(e.clientX, e.clientY);
      startMouse = coords;
      startRect = { ...this.cropRect };
      e.stopPropagation();
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isCropDragging) return;
      const coords = this.viewport.screenToCanvas(e.clientX, e.clientY);
      const dx = coords.x - startMouse.x;
      const dy = coords.y - startMouse.y;

      if (this.cropDragHandle === 'move') {
        this.cropRect.x = Math.max(0, Math.min(this.layerManager.width - startRect.width, startRect.x + dx));
        this.cropRect.y = Math.max(0, Math.min(this.layerManager.height - startRect.height, startRect.y + dy));
      } else if (this.cropDragHandle === 'br') {
        this.cropRect.width = Math.max(40, startRect.width + dx);
        this.cropRect.height = Math.max(40, startRect.height + dy);
      } else if (this.cropDragHandle === 'tl') {
        const newW = Math.max(40, startRect.width - dx);
        const newH = Math.max(40, startRect.height - dy);
        this.cropRect.x = startRect.x + (startRect.width - newW);
        this.cropRect.y = startRect.y + (startRect.height - newH);
        this.cropRect.width = newW;
        this.cropRect.height = newH;
      }
      this.updateCropBoxUI();
    });

    window.addEventListener('pointerup', () => {
      this.isCropDragging = false;
      this.cropDragHandle = null;
    });

    document.getElementById('btn-crop-apply').addEventListener('click', () => {
      this.applyCrop();
    });

    document.getElementById('btn-crop-cancel').addEventListener('click', () => {
      this.setTool('select');
    });
  }

  applyCrop() {
    const rx = Math.round(this.cropRect.x);
    const ry = Math.round(this.cropRect.y);
    const rw = Math.round(this.cropRect.width);
    const rh = Math.round(this.cropRect.height);

    if (rw <= 10 || rh <= 10) return;

    this.layerManager.crop(rx, ry, rw, rh);
    this.cropOverlayEl.classList.remove('active');
    this.viewport.zoomFit();
    this.setTool('select');
    this.historyManager.pushState('Crop Canvas');
  }
}
