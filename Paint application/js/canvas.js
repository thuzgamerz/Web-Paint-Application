/* ==========================================================================
   CanvasPro - Viewport, Stage, Zoom & Pan Controller
   ========================================================================== */

class CanvasViewport {
  constructor(viewportEl, stageEl, overlayCanvasEl, layerManager) {
    this.viewportEl = viewportEl;
    this.stageEl = stageEl;
    this.overlayCanvasEl = overlayCanvasEl;
    this.layerManager = layerManager;

    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;

    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
    this.spacePressed = false;

    this.onZoomChange = null;
    this.onCursorMove = null;

    this.initEvents();
  }

  initEvents() {
    // Wheel zoom & pan
    this.viewportEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey || !this.spacePressed) {
        // Zoom
        const zoomDelta = e.deltaY < 0 ? 1.15 : 0.85;
        this.setZoom(this.zoom * zoomDelta, e.clientX, e.clientY);
      } else {
        // Pan
        this.panX -= e.deltaX;
        this.panY -= e.deltaY;
        this.updateStageTransform();
      }
    }, { passive: false });

    // Track cursor coordinates
    window.addEventListener('mousemove', (e) => {
      if (this.onCursorMove) {
        const coords = this.screenToCanvas(e.clientX, e.clientY);
        this.onCursorMove(Math.round(coords.x), Math.round(coords.y));
      }

      if (this.isPanning) {
        this.panX = e.clientX - this.panStartX;
        this.panY = e.clientY - this.panStartY;
        this.updateStageTransform();
      }
    });

    // Panning start
    this.viewportEl.addEventListener('mousedown', (e) => {
      // Middle click or Space+LeftClick
      if (e.button === 1 || (e.button === 0 && this.spacePressed)) {
        e.preventDefault();
        this.startPan(e.clientX, e.clientY);
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isPanning) {
        this.stopPan();
      }
    });

    // Space key listener for Hand/Pan
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !this.spacePressed && !this.isEditingText(e)) {
        this.spacePressed = true;
        this.viewportEl.classList.add('panning');
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.spacePressed = false;
        if (!this.isPanning) {
          this.viewportEl.classList.remove('panning');
        }
      }
    });

    // Touch Pinch & Pan support
    let touchStartDist = 0;
    let touchStartZoom = 1;
    this.viewportEl.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        touchStartZoom = this.zoom;
      }
    }, { passive: false });

    this.viewportEl.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (touchStartDist > 0) {
          const factor = dist / touchStartDist;
          const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          this.setZoom(touchStartZoom * factor, midX, midY);
        }
      }
    }, { passive: false });

    // Window resize observer
    window.addEventListener('resize', () => {
      this.updateStageTransform();
    });
  }

  isEditingText(e) {
    const tag = (e.target && e.target.tagName) || '';
    return tag === 'INPUT' || tag === 'TEXTAREA';
  }

  startPan(clientX, clientY) {
    this.isPanning = true;
    this.panStartX = clientX - this.panX;
    this.panStartY = clientY - this.panY;
    this.viewportEl.classList.add('is-panning');
  }

  stopPan() {
    this.isPanning = false;
    this.viewportEl.classList.remove('is-panning');
    if (!this.spacePressed) {
      this.viewportEl.classList.remove('panning');
    }
  }

  /**
   * Sets zoom factor centered around specific screen coordinates
   */
  setZoom(newZoom, originClientX = null, originClientY = null) {
    const clampedZoom = Math.min(Math.max(newZoom, 0.1), 10.0);
    if (Math.abs(clampedZoom - this.zoom) < 0.001) return;

    if (originClientX !== null && originClientY !== null) {
      // Zoom toward cursor
      const vRect = this.viewportEl.getBoundingClientRect();
      const mouseX = originClientX - vRect.left;
      const mouseY = originClientY - vRect.top;

      const scaleChange = clampedZoom / this.zoom;
      this.panX = mouseX - (mouseX - this.panX) * scaleChange;
      this.panY = mouseY - (mouseY - this.panY) * scaleChange;
    }

    this.zoom = clampedZoom;
    this.updateStageTransform();

    if (this.onZoomChange) {
      this.onZoomChange(Math.round(this.zoom * 100));
    }
  }

  zoomIn() {
    const rect = this.viewportEl.getBoundingClientRect();
    this.setZoom(this.zoom * 1.25, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  zoomOut() {
    const rect = this.viewportEl.getBoundingClientRect();
    this.setZoom(this.zoom / 1.25, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  resetZoom() {
    const rect = this.viewportEl.getBoundingClientRect();
    this.setZoom(1.0, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  zoomFit() {
    const vRect = this.viewportEl.getBoundingClientRect();
    const margin = 48; // padding around artboard
    const availW = vRect.width - margin * 2;
    const availH = vRect.height - margin * 2;

    const scaleX = availW / this.layerManager.width;
    const scaleY = availH / this.layerManager.height;
    this.zoom = Math.min(scaleX, scaleY, 1.0); // Don't upscale past 100% on fit

    this.panX = (vRect.width - this.layerManager.width * this.zoom) / 2;
    this.panY = (vRect.height - this.layerManager.height * this.zoom) / 2;

    this.updateStageTransform();

    if (this.onZoomChange) {
      this.onZoomChange(Math.round(this.zoom * 100));
    }
  }

  /**
   * Applies CSS transform to stage
   */
  updateStageTransform() {
    this.stageEl.style.width = `${this.layerManager.width}px`;
    this.stageEl.style.height = `${this.layerManager.height}px`;
    this.stageEl.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;

    this.overlayCanvasEl.width = this.layerManager.width;
    this.overlayCanvasEl.height = this.layerManager.height;
  }

  /**
   * Converts screen (clientX, clientY) coordinates to artboard canvas coordinates
   */
  screenToCanvas(clientX, clientY) {
    const stageRect = this.stageEl.getBoundingClientRect();
    return {
      x: (clientX - stageRect.left) / this.zoom,
      y: (clientY - stageRect.top) / this.zoom
    };
  }

  /**
   * Converts artboard canvas coordinates to screen coordinates
   */
  canvasToScreen(cx, cy) {
    const stageRect = this.stageEl.getBoundingClientRect();
    return {
      x: stageRect.left + cx * this.zoom,
      y: stageRect.top + cy * this.zoom
    };
  }
}
