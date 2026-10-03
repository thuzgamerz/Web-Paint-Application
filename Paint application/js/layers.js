/* ==========================================================================
   CanvasPro - Layers Engine & Scene Graph
   ========================================================================== */

class CanvasLayer {
  constructor(id, name, type = 'paint', width = 1280, height = 720) {
    this.id = id || 'layer_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    this.name = name || 'New Layer';
    this.type = type; // 'paint' | 'image' | 'text' | 'sticker'
    this.visible = true;
    this.locked = false;
    this.opacity = 1.0;
    this.blendMode = 'source-over';

    // Filters per layer
    this.filters = FilterEngine.defaultFilters();

    // Canvas buffer for raster data
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

    // Transform properties (for movable images, text, stickers)
    this.x = 0;
    this.y = 0;
    this.width = width;
    this.height = height;
    this.rotation = 0; // in degrees
    this.flipX = false;
    this.flipY = false;

    // Type-specific payload
    this.image = null; // HTMLImageElement
    this.textData = {
      text: 'Double click to edit',
      font: 'Inter, sans-serif',
      size: 40,
      color: '#000000',
      bold: false,
      italic: false
    };
    this.stickerData = {
      svgString: null,
      emoji: null
    };
  }

  /**
   * Returns transformed bounding box for hit-testing
   */
  getBounds() {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      rotation: this.rotation
    };
  }

  /**
   * Checks if canvas coordinates (px, py) hit this layer
   */
  hitTest(px, py) {
    if (!this.visible || this.locked) return false;

    if (this.type === 'paint') {
      // Check if pixel at (px, py) has opacity > 0
      if (px < 0 || px >= this.canvas.width || py < 0 || py >= this.canvas.height) return false;
      try {
        const pixel = this.ctx.getImageData(Math.floor(px), Math.floor(py), 1, 1).data;
        return pixel[3] > 10;
      } catch (e) {
        return false;
      }
    }

    // For image, text, sticker: check oriented bounding box
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const rad = -this.rotation * (Math.PI / 180);

    // Rotate point back around center
    const dx = px - cx;
    const dy = py - cy;
    const rx = dx * Math.cos(rad) - dy * Math.sin(rad) + cx;
    const ry = dx * Math.sin(rad) + dy * Math.cos(rad) + cy;

    return (
      rx >= this.x &&
      rx <= this.x + this.width &&
      ry >= this.y &&
      ry <= this.y + this.height
    );
  }

  /**
   * Renders this layer onto a target context
   */
  render(targetCtx, renderForExport = false) {
    if (!this.visible) return;

    targetCtx.save();
    targetCtx.globalAlpha = this.opacity;
    targetCtx.globalCompositeOperation = this.blendMode;

    const cssFilter = FilterEngine.getCSSFilterString(this.filters);
    if (cssFilter !== 'none') {
      targetCtx.filter = cssFilter;
    }

    if (this.type === 'paint') {
      // Paint layer spans full canvas
      if (this.filters.sharpen && this.filters.sharpen > 0 && renderForExport) {
        const baked = FilterEngine.bakeFiltersToCanvas(this.canvas, this.filters);
        targetCtx.filter = 'none';
        targetCtx.drawImage(baked, 0, 0);
      } else {
        targetCtx.drawImage(this.canvas, 0, 0);
      }
    } else {
      // Transformable element (Image, Text, Sticker)
      const cx = this.x + this.width / 2;
      const cy = this.y + this.height / 2;

      targetCtx.translate(cx, cy);
      targetCtx.rotate((this.rotation * Math.PI) / 180);
      targetCtx.scale(this.flipX ? -1 : 1, this.flipY ? -1 : 1);

      const drawX = -this.width / 2;
      const drawY = -this.height / 2;

      if (this.type === 'image' && this.image) {
        targetCtx.drawImage(this.image, drawX, drawY, this.width, this.height);
      } else if (this.type === 'text') {
        this.renderText(targetCtx, drawX, drawY);
      } else if (this.type === 'sticker') {
        this.renderSticker(targetCtx, drawX, drawY);
      }

      // If raster buffer has additional painting
      targetCtx.drawImage(this.canvas, -cx, -cy);
    }

    targetCtx.restore();
  }

  renderText(ctx, x, y) {
    const t = this.textData;
    ctx.font = `${t.italic ? 'italic ' : ''}${t.bold ? 'bold ' : ''}${t.size}px ${t.font}`;
    ctx.fillStyle = t.color;
    ctx.textBaseline = 'top';
    
    // Split by newlines
    const lines = (t.text || '').split('\n');
    const lineHeight = t.size * 1.25;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x, y + (i * lineHeight));
    }
  }

  renderSticker(ctx, x, y) {
    if (this.stickerData.emoji) {
      ctx.font = `${Math.min(this.width, this.height) * 0.8}px 'Segoe UI Emoji', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.stickerData.emoji, x + this.width / 2, y + this.height / 2);
    } else if (this.image) {
      ctx.drawImage(this.image, x, y, this.width, this.height);
    }
  }

  /**
   * Resizes internal buffer when canvas is resized
   */
  resizeBuffer(newWidth, newHeight, resample = false) {
    const oldCanvas = this.canvas;
    this.canvas = document.createElement('canvas');
    this.canvas.width = newWidth;
    this.canvas.height = newHeight;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

    if (resample) {
      this.ctx.drawImage(oldCanvas, 0, 0, newWidth, newHeight);
      this.x = (this.x / oldCanvas.width) * newWidth;
      this.y = (this.y / oldCanvas.height) * newHeight;
      this.width = (this.width / oldCanvas.width) * newWidth;
      this.height = (this.height / oldCanvas.height) * newHeight;
    } else {
      this.ctx.drawImage(oldCanvas, 0, 0);
    }
  }

  /**
   * Crops the layer buffer and transform properties to a sub-rectangle
   */
  crop(cropX, cropY, cropW, cropH) {
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropW;
    croppedCanvas.height = cropH;
    const cCtx = croppedCanvas.getContext('2d');
    cCtx.drawImage(this.canvas, -cropX, -cropY);

    this.canvas = croppedCanvas;
    this.ctx = cCtx;

    // Adjust position of transformable elements
    this.x -= cropX;
    this.y -= cropY;
  }
}

class LayerManager {
  constructor(width = 1280, height = 720) {
    this.width = width;
    this.height = height;
    this.layers = [];
    this.activeLayerId = null;
    this.onLayersChange = null; // callback

    // Create initial Background paint layer
    const baseLayer = new CanvasLayer('layer_bg', 'Background', 'paint', width, height);
    baseLayer.ctx.fillStyle = '#ffffff';
    baseLayer.ctx.fillRect(0, 0, width, height);
    this.layers.push(baseLayer);
    this.activeLayerId = baseLayer.id;
  }

  getActiveLayer() {
    return this.layers.find(l => l.id === this.activeLayerId) || this.layers[0] || null;
  }

  getLayerById(id) {
    return this.layers.find(l => l.id === id);
  }

  setActiveLayer(id) {
    this.activeLayerId = id;
    if (this.onLayersChange) this.onLayersChange();
  }

  addLayer(type = 'paint', name = null, initialImage = null) {
    const count = this.layers.length + 1;
    const layerName = name || (type === 'image' ? `Image ${count}` : type === 'text' ? `Text ${count}` : `Layer ${count}`);
    const layer = new CanvasLayer(null, layerName, type, this.width, this.height);

    if (type === 'image' && initialImage) {
      layer.image = initialImage;
      // Center image and fit nicely within canvas bounds if huge
      let w = initialImage.naturalWidth || initialImage.width;
      let h = initialImage.naturalHeight || initialImage.height;
      const maxDim = Math.min(this.width, this.height) * 0.8;

      if (w > maxDim || h > maxDim) {
        const scale = maxDim / Math.max(w, h);
        w *= scale;
        h *= scale;
      }
      layer.width = Math.round(w);
      layer.height = Math.round(h);
      layer.x = Math.round((this.width - layer.width) / 2);
      layer.y = Math.round((this.height - layer.height) / 2);
    }

    this.layers.push(layer);
    this.activeLayerId = layer.id;

    if (this.onLayersChange) this.onLayersChange();
    return layer;
  }

  duplicateLayer(id) {
    const src = this.getLayerById(id || this.activeLayerId);
    if (!src) return null;

    const copy = new CanvasLayer(null, `${src.name} (Copy)`, src.type, this.width, this.height);
    copy.visible = src.visible;
    copy.opacity = src.opacity;
    copy.blendMode = src.blendMode;
    copy.filters = JSON.parse(JSON.stringify(src.filters));
    copy.x = src.x + 20;
    copy.y = src.y + 20;
    copy.width = src.width;
    copy.height = src.height;
    copy.rotation = src.rotation;
    copy.flipX = src.flipX;
    copy.flipY = src.flipY;
    copy.image = src.image;
    copy.textData = JSON.parse(JSON.stringify(src.textData));
    copy.stickerData = JSON.parse(JSON.stringify(src.stickerData));

    // Copy canvas pixels
    copy.ctx.drawImage(src.canvas, 0, 0);

    const index = this.layers.indexOf(src);
    this.layers.splice(index + 1, 0, copy);
    this.activeLayerId = copy.id;

    if (this.onLayersChange) this.onLayersChange();
    return copy;
  }

  deleteLayer(id) {
    if (this.layers.length <= 1) return false; // Always keep at least 1 layer
    const targetId = id || this.activeLayerId;
    const index = this.layers.findIndex(l => l.id === targetId);
    if (index === -1) return false;

    this.layers.splice(index, 1);
    const newActive = this.layers[Math.max(0, index - 1)];
    this.activeLayerId = newActive.id;

    if (this.onLayersChange) this.onLayersChange();
    return true;
  }

  mergeDown(id) {
    const targetId = id || this.activeLayerId;
    const index = this.layers.findIndex(l => l.id === targetId);
    if (index <= 0) return false; // Cannot merge bottom-most layer

    const topLayer = this.layers[index];
    const bottomLayer = this.layers[index - 1];

    // Bake top layer onto bottom layer
    topLayer.render(bottomLayer.ctx, true);

    // Remove top layer
    this.layers.splice(index, 1);
    this.activeLayerId = bottomLayer.id;

    if (this.onLayersChange) this.onLayersChange();
    return true;
  }

  rasterizeLayer(id) {
    const layer = this.getLayerById(id || this.activeLayerId);
    if (!layer || layer.type === 'paint') return;

    // Create a temporary canvas with layer rendered
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.width;
    tempCanvas.height = this.height;
    const tCtx = tempCanvas.getContext('2d');
    layer.render(tCtx, true);

    // Convert layer to paint
    layer.type = 'paint';
    layer.image = null;
    layer.textData = null;
    layer.stickerData = null;
    layer.x = 0;
    layer.y = 0;
    layer.width = this.width;
    layer.height = this.height;
    layer.rotation = 0;
    layer.canvas.width = this.width;
    layer.canvas.height = this.height;
    layer.ctx.clearRect(0, 0, this.width, this.height);
    layer.ctx.drawImage(tempCanvas, 0, 0);

    if (this.onLayersChange) this.onLayersChange();
  }

  reorderLayer(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.layers.length || toIndex < 0 || toIndex >= this.layers.length) return;
    const [moved] = this.layers.splice(fromIndex, 1);
    this.layers.splice(toIndex, 0, moved);
    if (this.onLayersChange) this.onLayersChange();
  }

  /**
   * Composites all visible layers onto target context
   */
  renderAll(targetCtx, renderForExport = false) {
    targetCtx.clearRect(0, 0, this.width, this.height);
    for (let i = 0; i < this.layers.length; i++) {
      this.layers[i].render(targetCtx, renderForExport);
    }
  }

  /**
   * Resizes all layers
   */
  resize(newWidth, newHeight, resample = false) {
    this.width = newWidth;
    this.height = newHeight;
    for (let layer of this.layers) {
      layer.resizeBuffer(newWidth, newHeight, resample);
    }
    if (this.onLayersChange) this.onLayersChange();
  }

  /**
   * Crops all layers
   */
  crop(cropX, cropY, cropW, cropH) {
    this.width = cropW;
    this.height = cropH;
    for (let layer of this.layers) {
      layer.crop(cropX, cropY, cropW, cropH);
    }
    if (this.onLayersChange) this.onLayersChange();
  }

  /**
   * Rotates entire artwork 90 degrees
   */
  rotateArtwork(degrees) {
    // 90, -90, or 180
    const rad = (degrees * Math.PI) / 180;
    const isOrthogonal = Math.abs(degrees) === 90 || Math.abs(degrees) === 270;
    const newW = isOrthogonal ? this.height : this.width;
    const newH = isOrthogonal ? this.width : this.height;

    for (let layer of this.layers) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = newW;
      tempCanvas.height = newH;
      const tCtx = tempCanvas.getContext('2d');

      tCtx.translate(newW / 2, newH / 2);
      tCtx.rotate(rad);
      tCtx.drawImage(layer.canvas, -layer.canvas.width / 2, -layer.canvas.height / 2);

      layer.canvas.width = newW;
      layer.canvas.height = newH;
      layer.ctx = layer.canvas.getContext('2d');
      layer.ctx.drawImage(tempCanvas, 0, 0);

      // Rotate movable objects
      if (layer.type !== 'paint') {
        layer.rotation = (layer.rotation + degrees) % 360;
        const cx = layer.x + layer.width / 2;
        const cy = layer.y + layer.height / 2;
        const relX = cx - this.width / 2;
        const relY = cy - this.height / 2;
        const rotX = relX * Math.cos(rad) - relY * Math.sin(rad) + newW / 2;
        const rotY = relX * Math.sin(rad) + relY * Math.cos(rad) + newH / 2;
        layer.x = rotX - layer.width / 2;
        layer.y = rotY - layer.height / 2;
      }
    }

    this.width = newW;
    this.height = newH;
    if (this.onLayersChange) this.onLayersChange();
  }

  /**
   * Flips entire artwork horizontally or vertically
   */
  flipArtwork(horizontal = true) {
    for (let layer of this.layers) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = this.width;
      tempCanvas.height = this.height;
      const tCtx = tempCanvas.getContext('2d');

      tCtx.translate(horizontal ? this.width : 0, horizontal ? 0 : this.height);
      tCtx.scale(horizontal ? -1 : 1, horizontal ? 1 : -1);
      tCtx.drawImage(layer.canvas, 0, 0);

      layer.ctx.clearRect(0, 0, this.width, this.height);
      layer.ctx.drawImage(tempCanvas, 0, 0);

      if (layer.type !== 'paint') {
        if (horizontal) {
          layer.x = this.width - (layer.x + layer.width);
          layer.flipX = !layer.flipX;
        } else {
          layer.y = this.height - (layer.y + layer.height);
          layer.flipY = !layer.flipY;
        }
      }
    }
    if (this.onLayersChange) this.onLayersChange();
  }
}
