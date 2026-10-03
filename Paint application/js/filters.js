/* ==========================================================================
   CanvasPro - Image Processing & Filter Engine
   ========================================================================== */

const FilterEngine = {
  defaultFilters() {
    return {
      brightness: 100,
      contrast: 100,
      saturation: 100,
      blur: 0,
      grayscale: 0,
      sepia: 0,
      invert: 0,
      sharpen: 0
    };
  },

  presets: {
    normal: {
      brightness: 100, contrast: 100, saturation: 100,
      blur: 0, grayscale: 0, sepia: 0, invert: 0, sharpen: 0
    },
    vivid: {
      brightness: 105, contrast: 120, saturation: 145,
      blur: 0, grayscale: 0, sepia: 0, invert: 0, sharpen: 10
    },
    warm: {
      brightness: 105, contrast: 105, saturation: 120,
      blur: 0, grayscale: 0, sepia: 25, invert: 0, sharpen: 0
    },
    cool: {
      brightness: 100, contrast: 110, saturation: 90,
      blur: 0, grayscale: 0, sepia: 0, invert: 0, sharpen: 0
    },
    vintage: {
      brightness: 95, contrast: 90, saturation: 80,
      blur: 0, grayscale: 0, sepia: 50, invert: 0, sharpen: 0
    },
    noir: {
      brightness: 95, contrast: 140, saturation: 0,
      blur: 0, grayscale: 100, sepia: 0, invert: 0, sharpen: 15
    },
    cyberpunk: {
      brightness: 110, contrast: 135, saturation: 175,
      blur: 0, grayscale: 0, sepia: 10, invert: 0, sharpen: 20
    },
    dramatic: {
      brightness: 90, contrast: 150, saturation: 115,
      blur: 0, grayscale: 0, sepia: 10, invert: 0, sharpen: 25
    },
    crisp: {
      brightness: 100, contrast: 110, saturation: 105,
      blur: 0, grayscale: 0, sepia: 0, invert: 0, sharpen: 70
    }
  },

  /**
   * Generates hardware-accelerated CSS filter string
   */
  getCSSFilterString(filters) {
    if (!filters) return 'none';
    const parts = [];
    if (filters.brightness !== 100) parts.push(`brightness(${filters.brightness}%)`);
    if (filters.contrast !== 100) parts.push(`contrast(${filters.contrast}%)`);
    if (filters.saturation !== 100) parts.push(`saturate(${filters.saturation}%)`);
    if (filters.blur > 0) parts.push(`blur(${filters.blur}px)`);
    if (filters.grayscale > 0) parts.push(`grayscale(${filters.grayscale}%)`);
    if (filters.sepia > 0) parts.push(`sepia(${filters.sepia}%)`);
    if (filters.invert > 0) parts.push(`invert(${filters.invert}%)`);
    
    return parts.length > 0 ? parts.join(' ') : 'none';
  },

  /**
   * Applies 3x3 convolution Sharpen kernel to Canvas ImageData
   * @param {ImageData} imageData 
   * @param {number} amount 0 to 100
   * @returns {ImageData}
   */
  applySharpen(imageData, amount) {
    if (!amount || amount <= 0) return imageData;
    const factor = (amount / 100) * 1.5;
    const weights = [
      0, -factor, 0,
      -factor, 1 + (4 * factor), -factor,
      0, -factor, 0
    ];

    const src = imageData.data;
    const w = imageData.width;
    const h = imageData.height;
    const output = new ImageData(new Uint8ClampedArray(src), w, h);
    const dst = output.data;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const dstIdx = (y * w + x) * 4;
        let r = 0, g = 0, b = 0;

        for (let cy = -1; cy <= 1; cy++) {
          for (let cx = -1; cx <= 1; cx++) {
            const weight = weights[(cy + 1) * 3 + (cx + 1)];
            const srcIdx = ((y + cy) * w + (x + cx)) * 4;
            r += src[srcIdx] * weight;
            g += src[srcIdx + 1] * weight;
            b += src[srcIdx + 2] * weight;
          }
        }

        dst[dstIdx] = r;
        dst[dstIdx + 1] = g;
        dst[dstIdx + 2] = b;
        dst[dstIdx + 3] = src[dstIdx + 3]; // Preserve alpha
      }
    }

    return output;
  },

  /**
   * Fully bakes all CSS & sharpen filters onto a target canvas
   * @param {HTMLCanvasElement} sourceCanvas 
   * @param {object} filters 
   * @returns {HTMLCanvasElement} Processed canvas
   */
  bakeFiltersToCanvas(sourceCanvas, filters) {
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');

    // 1. Draw with CSS filter applied
    const cssFilter = this.getCSSFilterString(filters);
    tempCtx.filter = cssFilter;
    tempCtx.drawImage(sourceCanvas, 0, 0);
    tempCtx.filter = 'none';

    // 2. Apply Sharpen convolution if enabled
    if (filters.sharpen && filters.sharpen > 0) {
      const imgData = tempCtx.getImageData(0, 0, w, h);
      const sharpened = this.applySharpen(imgData, filters.sharpen);
      tempCtx.putImageData(sharpened, 0, 0);
    }

    return tempCanvas;
  }
};
