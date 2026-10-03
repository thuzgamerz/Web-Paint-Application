/* ==========================================================================
   CanvasPro - History & Undo/Redo Engine
   ========================================================================== */

class HistoryManager {
  constructor(layerManager, viewport) {
    this.layerManager = layerManager;
    this.viewport = viewport;

    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 25;
    this.isApplyingState = false;

    this.onHistoryChange = null;
  }

  /**
   * Captures deep snapshot of all layers and canvas buffers
   */
  captureSnapshot(actionName = 'Edit') {
    const layerSnapshots = this.layerManager.layers.map(layer => {
      // Clone offscreen canvas
      const cloneCanvas = document.createElement('canvas');
      cloneCanvas.width = layer.canvas.width;
      cloneCanvas.height = layer.canvas.height;
      const cloneCtx = cloneCanvas.getContext('2d');
      cloneCtx.drawImage(layer.canvas, 0, 0);

      return {
        id: layer.id,
        name: layer.name,
        type: layer.type,
        visible: layer.visible,
        locked: layer.locked,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        filters: JSON.parse(JSON.stringify(layer.filters)),
        x: layer.x,
        y: layer.y,
        width: layer.width,
        height: layer.height,
        rotation: layer.rotation,
        flipX: layer.flipX,
        flipY: layer.flipY,
        image: layer.image,
        textData: layer.textData ? JSON.parse(JSON.stringify(layer.textData)) : null,
        stickerData: layer.stickerData ? JSON.parse(JSON.stringify(layer.stickerData)) : null,
        canvasBuffer: cloneCanvas
      };
    });

    return {
      action: actionName,
      timestamp: Date.now(),
      width: this.layerManager.width,
      height: this.layerManager.height,
      activeLayerId: this.layerManager.activeLayerId,
      layers: layerSnapshots
    };
  }

  /**
   * Pushes a new action state
   */
  pushState(actionName = 'Edit') {
    if (this.isApplyingState) return;

    const snapshot = this.captureSnapshot(actionName);
    this.undoStack.push(snapshot);

    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }

    // Clear redo stack on new action
    this.redoStack = [];

    if (this.onHistoryChange) this.onHistoryChange();
  }

  /**
   * Restores a state snapshot
   */
  restoreSnapshot(snapshot) {
    if (!snapshot) return;
    this.isApplyingState = true;

    this.layerManager.width = snapshot.width;
    this.layerManager.height = snapshot.height;

    // Reconstruct layers
    this.layerManager.layers = snapshot.layers.map(snap => {
      const layer = new CanvasLayer(snap.id, snap.name, snap.type, snapshot.width, snapshot.height);
      layer.visible = snap.visible;
      layer.locked = snap.locked;
      layer.opacity = snap.opacity;
      layer.blendMode = snap.blendMode;
      layer.filters = JSON.parse(JSON.stringify(snap.filters));
      layer.x = snap.x;
      layer.y = snap.y;
      layer.width = snap.width;
      layer.height = snap.height;
      layer.rotation = snap.rotation;
      layer.flipX = snap.flipX;
      layer.flipY = snap.flipY;
      layer.image = snap.image;
      layer.textData = snap.textData;
      layer.stickerData = snap.stickerData;

      // Restore canvas buffer
      layer.canvas.width = snap.canvasBuffer.width;
      layer.canvas.height = snap.canvasBuffer.height;
      layer.ctx = layer.canvas.getContext('2d');
      layer.ctx.drawImage(snap.canvasBuffer, 0, 0);

      return layer;
    });

    this.layerManager.activeLayerId = snapshot.activeLayerId;
    this.viewport.updateStageTransform();

    if (this.layerManager.onLayersChange) {
      this.layerManager.onLayersChange();
    }

    this.isApplyingState = false;
    if (this.onHistoryChange) this.onHistoryChange();
  }

  undo() {
    if (this.undoStack.length <= 1) return false;

    // Move current state to redo stack
    const current = this.undoStack.pop();
    this.redoStack.push(current);

    // Restore previous state
    const previous = this.undoStack[this.undoStack.length - 1];
    this.restoreSnapshot(previous);
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) return false;

    const next = this.redoStack.pop();
    this.undoStack.push(next);
    this.restoreSnapshot(next);
    return true;
  }

  canUndo() {
    return this.undoStack.length > 1;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }
}
