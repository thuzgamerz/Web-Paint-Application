/* ==========================================================================
   CanvasPro - Main Application Orchestrator
   COMPLETE & CORRECTED VERSION
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // =========================================================================
  // 1. Initialize Core Engines
  // =========================================================================
  const layerManager = new LayerManager(1280, 720);

  const viewportEl    = document.getElementById('viewport-container');
  const stageEl       = document.getElementById('canvas-stage');
  const overlayCanvasEl = document.getElementById('overlay-canvas');

  const viewport       = new CanvasViewport(viewportEl, stageEl, overlayCanvasEl, layerManager);
  const historyManager = new HistoryManager(layerManager, viewport);
  const toolManager    = new ToolManager(viewport, layerManager, historyManager);

  // =========================================================================
  // 2. Real-time Composite Render Pipeline (RAF loop)
  // =========================================================================

  // Single composite canvas that sits inside the stage — far more performant
  const compositeCanvas = document.createElement('canvas');
  compositeCanvas.className = 'layer-canvas';
  compositeCanvas.style.position = 'absolute';
  compositeCanvas.style.top = '0';
  compositeCanvas.style.left = '0';
  compositeCanvas.style.background = 'transparent';
  compositeCanvas.style.pointerEvents = 'none';

  const layersContainer = document.getElementById('layers-render-container');
  layersContainer.appendChild(compositeCanvas);

  let needsRender = true;
  let rafId = null;

  function renderComposite() {
    const w = layerManager.width;
    const h = layerManager.height;

    // Only resize canvas when dimensions actually change (cheap check)
    if (compositeCanvas.width !== w)  compositeCanvas.width  = w;
    if (compositeCanvas.height !== h) compositeCanvas.height = h;

    const compCtx = compositeCanvas.getContext('2d');
    compCtx.clearRect(0, 0, w, h);

    // Draw each layer
    layerManager.layers.forEach(layer => {
      if (!layer.visible) return;
      layer.render(compCtx);
    });

    // Sync status bar active layer
    const activeStatusEl = document.getElementById('status-active-layer');
    const activeLayer = layerManager.getActiveLayer();
    if (activeStatusEl && activeLayer) {
      activeStatusEl.textContent = `Active: ${activeLayer.name}`;
    }
  }

  function rafRender() {
    if (needsRender) {
      renderComposite();
      needsRender = false;
    }
    rafId = requestAnimationFrame(rafRender);
  }

  function scheduleRender() {
    needsRender = true;
  }

  // Hook layer manager changes into render schedule
  layerManager.onLayersChange = () => {
    scheduleRender();
    updateLayersPanel();
    updateFiltersUI();
    if (toolManager.activeTool === 'select') {
      toolManager.updateGizmo();
    }
  };

  // Wire tools render notification callback
  toolManager.onNeedsRender = () => scheduleRender();

  // Initial setup & start render loop
  viewport.updateStageTransform();
  viewport.zoomFit();
  scheduleRender();
  rafRender();
  historyManager.pushState('Initial Canvas');

  // =========================================================================
  // 3. UI Element References
  // =========================================================================
  const statusCanvasSize  = document.getElementById('status-canvas-size');
  const statusCursorCoords = document.getElementById('status-cursor-coords');
  const statusToolHint    = document.getElementById('status-tool-hint');
  const statusActiveLayer = document.getElementById('status-active-layer');
  const zoomText          = document.getElementById('zoom-percentage-text');
  const documentTitleInput = document.getElementById('document-title');

  statusCanvasSize.textContent = `${layerManager.width} × ${layerManager.height} px`;

  viewport.onZoomChange = (pct) => {
    zoomText.textContent = `${pct}%`;
  };

  viewport.onCursorMove = (cx, cy) => {
    statusCursorCoords.textContent = `X: ${cx} px, Y: ${cy} px`;
  };

  // =========================================================================
  // 4. Zoom Controls
  // =========================================================================
  document.getElementById('btn-zoom-in').addEventListener('click', () => viewport.zoomIn());
  document.getElementById('btn-zoom-out').addEventListener('click', () => viewport.zoomOut());
  document.getElementById('btn-zoom-fit').addEventListener('click', () => viewport.zoomFit());
  zoomText.addEventListener('click', () => viewport.resetZoom());

  // Quick Undo / Redo header buttons
  document.getElementById('btn-quick-undo').addEventListener('click', () => { historyManager.undo(); scheduleRender(); });
  document.getElementById('btn-quick-redo').addEventListener('click', () => { historyManager.redo(); scheduleRender(); });

  // =========================================================================
  // 5. Left Toolbar Tool Selection
  // =========================================================================
  const toolBtns = document.querySelectorAll('#left-toolbar .tool-btn');
  const toolHints = {
    select:     'Select & Move Tool (V) — Click an element to select, transform, or delete it',
    brush:      'Brush & Pencil (B) — Freehand drawing with custom styles and smooth curves',
    eraser:     'Eraser (E) — Erase strokes and pixels from the active layer',
    line:       'Line Tool (L) — Draw straight lines (Hold Shift to constrain angles)',
    shapes:     'Shapes Tool (U) — Draw rectangles, circles, stars, hearts, and polygons',
    bucket:     'Paint Bucket (G) — Flood fill enclosed regions with tolerance',
    text:       'Text Tool (T) — Click canvas to place editable text layers',
    eyedropper: 'Eyedropper (I) — Sample color directly from the artwork',
    crop:       'Crop Tool (C) — Interactively crop artwork dimensions',
    hand:       'Hand / Pan Tool (H) — Drag to navigate the canvas stage'
  };

  toolBtns.forEach(btn => {
    btn.addEventListener('click', () => selectTool(btn.dataset.tool));
  });

  function selectTool(toolName) {
    toolBtns.forEach(b => b.classList.toggle('active', b.dataset.tool === toolName));
    toolManager.setTool(toolName);
    statusToolHint.textContent = toolHints[toolName] || toolName;
    scheduleRender();

    // Show/hide props bar groups
    document.getElementById('props-brush').style.display   = (toolName === 'brush' || toolName === 'eraser') ? 'flex' : 'none';
    document.getElementById('props-shapes').style.display  = (toolName === 'shapes' || toolName === 'line') ? 'flex' : 'none';
    document.getElementById('props-text').style.display    = toolName === 'text' ? 'flex' : 'none';
    document.getElementById('props-select').style.display  = toolName === 'select' ? 'flex' : 'none';
    document.getElementById('props-bucket').style.display  = toolName === 'bucket' ? 'flex' : 'none';
  }

  // =========================================================================
  // 6. Properties Bar Controls
  // =========================================================================

  // --- Brush Props ---
  const propBrushType    = document.getElementById('prop-brush-type');
  const propSizeSlider   = document.getElementById('prop-size-slider');
  const propSizeVal      = document.getElementById('prop-size-val');
  const propOpacitySlider = document.getElementById('prop-opacity-slider');
  const propOpacityVal   = document.getElementById('prop-opacity-val');

  propBrushType.addEventListener('change', e => { toolManager.brushType = e.target.value; });

  propSizeSlider.addEventListener('input', e => {
    const val = parseInt(e.target.value, 10);
    toolManager.brushSize  = val;
    toolManager.eraserSize = val * 1.5;
    propSizeVal.textContent = `${val}px`;
  });

  propOpacitySlider.addEventListener('input', e => {
    const val = parseInt(e.target.value, 10);
    toolManager.brushOpacity = val / 100;
    propOpacityVal.textContent = `${val}%`;
  });

  // --- Shape Props ---
  const propShapeType      = document.getElementById('prop-shape-type');
  const propShapeMode      = document.getElementById('prop-shape-mode');
  const propShapeBorder    = document.getElementById('prop-shape-border');
  const propShapeBorderVal = document.getElementById('prop-shape-border-val');

  propShapeType.addEventListener('change', e => { toolManager.shapeType = e.target.value; });
  propShapeMode.addEventListener('change', e => { toolManager.shapeMode = e.target.value; });
  propShapeBorder.addEventListener('input', e => {
    const val = parseInt(e.target.value, 10);
    toolManager.shapeBorderWidth = val;
    propShapeBorderVal.textContent = `${val}px`;
  });

  // --- Text Props ---
  const propFontFamily  = document.getElementById('prop-font-family');
  const propFontSize    = document.getElementById('prop-font-size');
  const propFontSizeVal = document.getElementById('prop-font-size-val');
  const btnTextBold     = document.getElementById('btn-text-bold');
  const btnTextItalic   = document.getElementById('btn-text-italic');

  propFontFamily.addEventListener('change', e => {
    toolManager.textSettings.font = e.target.value;
    const l = layerManager.getActiveLayer();
    if (l && l.type === 'text') {
      l.textData.font = e.target.value;
      scheduleRender();
      historyManager.pushState('Change Font');
    }
  });

  propFontSize.addEventListener('input', e => {
    const val = parseInt(e.target.value, 10);
    toolManager.textSettings.size = val;
    propFontSizeVal.textContent = `${val}px`;
    const l = layerManager.getActiveLayer();
    if (l && l.type === 'text') {
      l.textData.size = val;
      l.height = Math.round(val * 1.5);
      scheduleRender();
      toolManager.updateGizmo();
    }
  });

  btnTextBold.addEventListener('click', () => {
    toolManager.textSettings.bold = !toolManager.textSettings.bold;
    btnTextBold.classList.toggle('active', toolManager.textSettings.bold);
    const l = layerManager.getActiveLayer();
    if (l && l.type === 'text') {
      l.textData.bold = toolManager.textSettings.bold;
      scheduleRender();
      historyManager.pushState('Toggle Bold');
    }
  });

  btnTextItalic.addEventListener('click', () => {
    toolManager.textSettings.italic = !toolManager.textSettings.italic;
    btnTextItalic.classList.toggle('active', toolManager.textSettings.italic);
    const l = layerManager.getActiveLayer();
    if (l && l.type === 'text') {
      l.textData.italic = toolManager.textSettings.italic;
      scheduleRender();
      historyManager.pushState('Toggle Italic');
    }
  });

  // --- Selection Element Actions ---
  document.getElementById('btn-sel-duplicate').addEventListener('click', () => {
    layerManager.duplicateLayer();
    historyManager.pushState('Duplicate Element');
    scheduleRender();
  });

  document.getElementById('btn-sel-flip-h').addEventListener('click', () => {
    const l = layerManager.getActiveLayer();
    if (l) { l.flipX = !l.flipX; scheduleRender(); historyManager.pushState('Flip H'); }
  });

  document.getElementById('btn-sel-flip-v').addEventListener('click', () => {
    const l = layerManager.getActiveLayer();
    if (l) { l.flipY = !l.flipY; scheduleRender(); historyManager.pushState('Flip V'); }
  });

  document.getElementById('btn-sel-rasterize').addEventListener('click', () => {
    layerManager.rasterizeLayer();
    toolManager.hideGizmo();
    scheduleRender();
    showToast('Layer rasterized to paint layer', 'info');
    historyManager.pushState('Rasterize Layer');
  });

  document.getElementById('btn-sel-delete').addEventListener('click', () => {
    layerManager.deleteLayer();
    toolManager.updateGizmo();
    scheduleRender();
    historyManager.pushState('Delete Element');
  });

  // --- Bucket Tolerance ---
  const propBucketTol    = document.getElementById('prop-bucket-tolerance');
  const propBucketTolVal = document.getElementById('prop-bucket-tolerance-val');
  propBucketTol.addEventListener('input', e => {
    const val = parseInt(e.target.value, 10);
    toolManager.bucketTolerance = val;
    propBucketTolVal.textContent = val;
  });

  // =========================================================================
  // 7. Color Management
  // =========================================================================
  const colorPrimaryChip   = document.getElementById('color-primary-chip');
  const colorSecondaryChip = document.getElementById('color-secondary-chip');
  const btnSwapColors      = document.getElementById('btn-swap-colors');
  const nativeColorPicker  = document.getElementById('native-color-picker');
  let colorPickerTarget = 'primary';

  function updateColorChips() {
    colorPrimaryChip.style.backgroundColor   = toolManager.primaryColor;
    colorSecondaryChip.style.backgroundColor = toolManager.secondaryColor;
    // Sync quick-palette active state
    document.querySelectorAll('#quick-swatches-container .swatch-btn').forEach(sw => {
      sw.classList.toggle('active', sw.dataset.color === toolManager.primaryColor);
    });
  }

  colorPrimaryChip.addEventListener('click', () => {
    colorPickerTarget = 'primary';
    nativeColorPicker.value = sanitizeHex(toolManager.primaryColor);
    nativeColorPicker.click();
  });

  colorSecondaryChip.addEventListener('click', () => {
    colorPickerTarget = 'secondary';
    nativeColorPicker.value = sanitizeHex(toolManager.secondaryColor);
    nativeColorPicker.click();
  });

  nativeColorPicker.addEventListener('input', e => {
    if (colorPickerTarget === 'primary') {
      toolManager.setPrimaryColor(e.target.value);
    } else {
      toolManager.setSecondaryColor(e.target.value);
    }
    updateColorChips();
    scheduleRender();
  });

  btnSwapColors.addEventListener('click', () => {
    toolManager.swapColors();
    updateColorChips();
  });

  toolManager.onColorPicked = (hex) => {
    updateColorChips();
    showToast(`Picked: ${hex}`, 'info');
  };

  function sanitizeHex(color) {
    // Ensure it's a valid 6-digit hex for input[type=color]
    if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
    return '#3b82f6';
  }

  // Curated quick-swatch palette in properties bar
  const curatedPalette = [
    '#000000', '#ffffff', '#64748b', '#ef4444',
    '#f97316', '#f59e0b', '#10b981', '#06b6d4',
    '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899'
  ];
  const quickSwatchesContainer = document.getElementById('quick-swatches-container');
  curatedPalette.forEach(color => {
    const sw = document.createElement('div');
    sw.className = 'swatch-btn';
    sw.style.backgroundColor = color;
    sw.dataset.color = color;
    sw.dataset.tooltip = color;
    sw.addEventListener('click', () => {
      toolManager.setPrimaryColor(color);
      updateColorChips();
    });
    quickSwatchesContainer.appendChild(sw);
  });

  updateColorChips();

  // =========================================================================
  // 8. Right Sidebar Tab Navigation
  // =========================================================================
  const sidebarTabBtns = document.querySelectorAll('.sidebar-tab-btn');
  const tabPanes       = document.querySelectorAll('.tab-pane');

  sidebarTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sidebarTabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const pane = document.getElementById(btn.dataset.tab);
      if (pane) pane.classList.add('active');
    });
  });

  // =========================================================================
  // 9. Layers Panel
  // =========================================================================
  const layersListContainer = document.getElementById('layers-list-container');
  const layerOpacitySlider  = document.getElementById('layer-opacity-slider');
  const layerOpacityBadge   = document.getElementById('layer-opacity-badge');
  const layerBlendMode      = document.getElementById('layer-blend-mode');

  function updateLayersPanel() {
    layersListContainer.innerHTML = '';
    const active = layerManager.getActiveLayer();

    if (active) {
      layerOpacitySlider.value = Math.round(active.opacity * 100);
      layerOpacityBadge.textContent = `${Math.round(active.opacity * 100)}%`;
      layerBlendMode.value = active.blendMode;
    }

    // Render from topmost to bottom in the sidebar list
    for (let i = layerManager.layers.length - 1; i >= 0; i--) {
      const layer = layerManager.layers[i];
      const isActive = layer.id === layerManager.activeLayerId;
      const card = document.createElement('div');
      card.className = `layer-card ${isActive ? 'active' : ''}`;

      // Thumbnail
      const thumb = document.createElement('div');
      thumb.className = 'layer-thumb-preview';
      const tc = document.createElement('canvas');
      tc.width  = 38;
      tc.height = 38;
      const tCtx = tc.getContext('2d');
      try {
        tCtx.drawImage(layer.canvas, 0, 0, 38, 38);
      } catch(e) { /* ignore cross-origin */ }
      thumb.appendChild(tc);

      // Info
      const info = document.createElement('div');
      info.className = 'layer-info';
      const nameEl = document.createElement('span');
      nameEl.className = 'layer-name';
      nameEl.textContent = layer.name;
      const detailsEl = document.createElement('span');
      detailsEl.className = 'layer-details';
      detailsEl.textContent = `${layer.type.toUpperCase()} • ${Math.round(layer.opacity * 100)}% ${layer.locked ? '🔒' : ''}`;
      info.appendChild(nameEl);
      info.appendChild(detailsEl);

      // Actions
      const actionsEl = document.createElement('div');
      actionsEl.className = 'layer-card-actions';

      const visBtn = document.createElement('button');
      visBtn.className = `layer-action-icon ${!layer.visible ? 'hidden-state' : ''}`;
      visBtn.title = layer.visible ? 'Hide layer' : 'Show layer';
      visBtn.innerHTML = layer.visible
        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`
        : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m2 2 20 20"/><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/></svg>`;
      visBtn.addEventListener('click', e => {
        e.stopPropagation();
        layer.visible = !layer.visible;
        scheduleRender();
        updateLayersPanel();
      });

      const lockBtn = document.createElement('button');
      lockBtn.className = 'layer-action-icon';
      lockBtn.title = layer.locked ? 'Unlock layer' : 'Lock layer';
      lockBtn.innerHTML = layer.locked
        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
        : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`;
      lockBtn.addEventListener('click', e => {
        e.stopPropagation();
        layer.locked = !layer.locked;
        updateLayersPanel();
      });

      actionsEl.appendChild(visBtn);
      actionsEl.appendChild(lockBtn);

      card.appendChild(thumb);
      card.appendChild(info);
      card.appendChild(actionsEl);

      card.addEventListener('click', () => {
        layerManager.setActiveLayer(layer.id);
        updateLayersPanel();
        updateFiltersUI();
      });

      layersListContainer.appendChild(card);
    }
  }

  // Layer control buttons
  document.getElementById('btn-layer-add').addEventListener('click', () => {
    layerManager.addLayer('paint');
    historyManager.pushState('Add Paint Layer');
    scheduleRender();
  });

  document.getElementById('btn-layer-duplicate').addEventListener('click', () => {
    layerManager.duplicateLayer();
    historyManager.pushState('Duplicate Layer');
    scheduleRender();
  });

  document.getElementById('btn-layer-merge').addEventListener('click', () => {
    if (layerManager.mergeDown()) {
      historyManager.pushState('Merge Layer Down');
      showToast('Layer merged down', 'success');
      scheduleRender();
    } else {
      showToast('Nothing to merge below', 'error');
    }
  });

  document.getElementById('btn-layer-delete').addEventListener('click', () => {
    if (layerManager.deleteLayer()) {
      historyManager.pushState('Delete Layer');
      scheduleRender();
    } else {
      showToast('Cannot delete the only layer', 'error');
    }
  });

  layerOpacitySlider.addEventListener('input', e => {
    const active = layerManager.getActiveLayer();
    if (active) {
      active.opacity = parseInt(e.target.value, 10) / 100;
      layerOpacityBadge.textContent = `${e.target.value}%`;
      scheduleRender();
    }
  });

  layerOpacitySlider.addEventListener('change', () => historyManager.pushState('Layer Opacity'));

  layerBlendMode.addEventListener('change', e => {
    const active = layerManager.getActiveLayer();
    if (active) {
      active.blendMode = e.target.value;
      scheduleRender();
      historyManager.pushState('Blend Mode');
    }
  });

  // =========================================================================
  // 10. Filters & Adjustments Panel
  // =========================================================================
  const filterDefs = {
    brightness: { el: document.getElementById('filter-brightness'), badge: document.getElementById('filter-val-brightness'), unit: '%' },
    contrast:   { el: document.getElementById('filter-contrast'),   badge: document.getElementById('filter-val-contrast'),   unit: '%' },
    saturation: { el: document.getElementById('filter-saturation'), badge: document.getElementById('filter-val-saturation'), unit: '%' },
    blur:       { el: document.getElementById('filter-blur'),       badge: document.getElementById('filter-val-blur'),       unit: 'px' },
    grayscale:  { el: document.getElementById('filter-grayscale'),  badge: document.getElementById('filter-val-grayscale'),  unit: '%' },
    sepia:      { el: document.getElementById('filter-sepia'),      badge: document.getElementById('filter-val-sepia'),      unit: '%' },
    invert:     { el: document.getElementById('filter-invert'),     badge: document.getElementById('filter-val-invert'),     unit: '%' },
    sharpen:    { el: document.getElementById('filter-sharpen'),    badge: document.getElementById('filter-val-sharpen'),    unit: '%' }
  };

  function updateFiltersUI() {
    const active = layerManager.getActiveLayer();
    if (!active) return;
    for (const [key, def] of Object.entries(filterDefs)) {
      const val = active.filters[key] !== undefined ? active.filters[key] : (
        (key === 'brightness' || key === 'contrast' || key === 'saturation') ? 100 : 0
      );
      def.el.value = val;
      def.badge.textContent = `${val}${def.unit}`;
    }
  }

  for (const [key, def] of Object.entries(filterDefs)) {
    def.el.addEventListener('input', e => {
      const active = layerManager.getActiveLayer();
      if (!active) return;
      const val = parseInt(e.target.value, 10);
      active.filters[key] = val;
      def.badge.textContent = `${val}${def.unit}`;
      scheduleRender();
    });
    def.el.addEventListener('change', () => historyManager.pushState(`Adjust ${key}`));
  }

  document.querySelectorAll('.preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const preset = FilterEngine.presets[chip.dataset.preset];
      const active = layerManager.getActiveLayer();
      if (active && preset) {
        active.filters = JSON.parse(JSON.stringify(preset));
        updateFiltersUI();
        scheduleRender();
        historyManager.pushState(`Preset: ${chip.textContent.trim()}`);
        showToast(`Applied: ${chip.textContent.trim()}`, 'info');
      }
    });
  });

  document.getElementById('btn-reset-filters').addEventListener('click', () => {
    const active = layerManager.getActiveLayer();
    if (active) {
      active.filters = FilterEngine.defaultFilters();
      updateFiltersUI();
      scheduleRender();
      historyManager.pushState('Reset Filters');
      showToast('Filters reset', 'info');
    }
  });

  // =========================================================================
  // 11. Stickers Library Panel
  // =========================================================================
  const stickersGrid       = document.getElementById('stickers-grid-container');
  const stickerCategoryPills = document.querySelectorAll('.category-pill');
  let currentStickerCategory = 'emojis';

  function renderStickersCategory(category) {
    stickersGrid.innerHTML = '';
    const items = StickersLibrary.categories[category] || [];

    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'sticker-item';

      if (typeof item === 'string') {
        div.textContent = item;
        div.title = item;
        div.addEventListener('click', () => addEmojiSticker(item));
      } else {
        div.innerHTML = item.svg;
        div.title = item.name;
        div.addEventListener('click', () => addSvgSticker(item.svg, item.name));
      }

      stickersGrid.appendChild(div);
    });
  }

  stickerCategoryPills.forEach(pill => {
    pill.addEventListener('click', () => {
      stickerCategoryPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentStickerCategory = pill.dataset.category;
      renderStickersCategory(currentStickerCategory);
    });
  });

  renderStickersCategory('emojis');

  function addEmojiSticker(emoji) {
    const layer = layerManager.addLayer('sticker', `Emoji ${emoji}`);
    layer.stickerData = { emoji, svgString: null };
    layer.width  = 120;
    layer.height = 120;
    layer.x = Math.round((layerManager.width  - layer.width)  / 2);
    layer.y = Math.round((layerManager.height - layer.height) / 2);
    selectTool('select');
    scheduleRender();
    historyManager.pushState(`Add Emoji`);
    showToast(`Added ${emoji} to canvas`, 'success');
  }

  function addSvgSticker(svgString, name) {
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();
    img.onload = () => {
      const layer = layerManager.addLayer('image', `Sticker: ${name}`, img);
      layer.width  = 140;
      layer.height = 140;
      layer.x = Math.round((layerManager.width  - layer.width)  / 2);
      layer.y = Math.round((layerManager.height - layer.height) / 2);
      selectTool('select');
      scheduleRender();
      historyManager.pushState(`Add Sticker`);
      showToast(`Added ${name} sticker`, 'success');
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { URL.revokeObjectURL(url); showToast('Sticker load failed', 'error'); };
    img.src = url;
  }

  // =========================================================================
  // 12. History Timeline Panel
  // =========================================================================
  const historyItemsContainer = document.getElementById('history-items-container');

  historyManager.onHistoryChange = () => {
    renderHistoryTimeline();
    updateLayersPanel();
  };

  function renderHistoryTimeline() {
    historyItemsContainer.innerHTML = '';
    const states = historyManager.undoStack;

    states.forEach((state, idx) => {
      const isCurrent = idx === states.length - 1;
      const item = document.createElement('div');
      item.className = `history-item ${isCurrent ? 'active' : idx > states.length - 1 ? 'undone' : ''}`;

      const timeAgo = Math.round((Date.now() - state.timestamp) / 1000);
      const timeStr = timeAgo < 60 ? `${timeAgo}s ago` : `${Math.round(timeAgo/60)}m ago`;

      item.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          ${isCurrent ? '<circle cx="12" cy="12" r="8" opacity="0.3"/>' : ''}
        </svg>
        <span style="flex:1">${state.action}</span>
        <span style="font-size:10px;color:var(--text-muted)">${timeStr}</span>
      `;
      historyItemsContainer.appendChild(item);
    });
    historyItemsContainer.scrollTop = historyItemsContainer.scrollHeight;
  }

  // =========================================================================
  // 13. Image Upload (File + Drag & Drop + Clipboard Paste)
  // =========================================================================
  const fileUploader = document.getElementById('file-uploader');

  document.getElementById('btn-add-image').addEventListener('click', () => fileUploader.click());
  document.getElementById('btn-menu-open').addEventListener('click',  () => fileUploader.click());

  fileUploader.addEventListener('change', e => {
    Array.from(e.target.files).forEach(f => loadUploadedFile(f));
    fileUploader.value = '';
  });

  function loadUploadedFile(file) {
    if (!file) return;
    if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
      showToast('Unsupported file. Please use PNG, JPG, or WebP.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const layerName = file.name ? `Image: ${file.name.slice(0, 18)}` : 'Image Layer';
        layerManager.addLayer('image', layerName, img);
        selectTool('select');
        scheduleRender();
        historyManager.pushState('Add Image');
        showToast(`Imported: ${file.name}`, 'success');
      };
      img.onerror = () => showToast('Failed to load image', 'error');
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  // Drag & Drop zone
  viewportEl.addEventListener('dragover', e => {
    e.preventDefault();
    stageEl.style.outline = '3px dashed var(--accent-primary)';
  });
  viewportEl.addEventListener('dragleave', () => { stageEl.style.outline = ''; });
  viewportEl.addEventListener('drop', e => {
    e.preventDefault();
    stageEl.style.outline = '';
    if (e.dataTransfer.files) {
      Array.from(e.dataTransfer.files).forEach(f => loadUploadedFile(f));
    }
  });

  // Clipboard paste
  window.addEventListener('paste', e => {
    const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        loadUploadedFile(item.getAsFile());
        e.preventDefault();
        break;
      }
    }
  });

  // =========================================================================
  // 14. Export & Download
  // =========================================================================
  const modalExport        = document.getElementById('modal-export');
  const exportFormatSelect = document.getElementById('export-format-select');
  const exportQualityGroup = document.getElementById('export-quality-group');
  const exportQualitySlider = document.getElementById('export-quality-slider');
  const exportQualityVal   = document.getElementById('export-quality-val');
  const exportScaleSelect  = document.getElementById('export-scale-select');

  document.getElementById('btn-export-main').addEventListener('click', () => openModal('modal-export'));
  document.getElementById('btn-menu-export-png').addEventListener('click', () => doDownload('image/png', 1.0, 1.0));
  document.getElementById('btn-menu-export-jpg').addEventListener('click', () => doDownload('image/jpeg', 0.92, 1.0));
  document.getElementById('btn-menu-copy-clipboard').addEventListener('click', () => doCopyClipboard());

  exportFormatSelect.addEventListener('change', e => {
    exportQualityGroup.style.display = e.target.value !== 'image/png' ? 'flex' : 'none';
  });
  exportQualitySlider.addEventListener('input', e => {
    exportQualityVal.textContent = `${e.target.value}%`;
  });

  document.getElementById('btn-export-download').addEventListener('click', () => {
    const format  = exportFormatSelect.value;
    const quality = parseInt(exportQualitySlider.value, 10) / 100;
    const scale   = parseFloat(exportScaleSelect.value);
    doDownload(format, quality, scale);
    closeModal('modal-export');
  });

  document.getElementById('btn-export-copy').addEventListener('click', () => {
    doCopyClipboard();
    closeModal('modal-export');
  });

  function buildExportCanvas(scale = 1.0) {
    const ew = Math.round(layerManager.width  * scale);
    const eh = Math.round(layerManager.height * scale);
    const expCanvas = document.createElement('canvas');
    expCanvas.width  = ew;
    expCanvas.height = eh;
    const expCtx = expCanvas.getContext('2d');
    if (scale !== 1.0) expCtx.scale(scale, scale);
    layerManager.renderAll(expCtx, true);
    return expCanvas;
  }

  function doDownload(format, quality, scale) {
    const canvas   = buildExportCanvas(scale);
    const ext      = format === 'image/jpeg' ? 'jpg' : format === 'image/webp' ? 'webp' : 'png';
    const filename = `${documentTitleInput.value.trim() || 'Artwork'}.${ext}`;
    canvas.toBlob(blob => {
      if (!blob) { showToast('Export failed — no image data', 'error'); return; }
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(`Exported: ${filename}`, 'success');
    }, format, quality);
  }

  async function doCopyClipboard() {
    try {
      const canvas = buildExportCanvas(1.0);
      canvas.toBlob(async blob => {
        if (!blob) return;
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showToast('Copied to clipboard!', 'success');
      }, 'image/png');
    } catch (err) {
      showToast('Clipboard failed — try Export instead', 'error');
    }
  }

  // =========================================================================
  // 15. Menubar Dropdown Logic
  // =========================================================================
  const menuItems = document.querySelectorAll('.menu-item');
  menuItems.forEach(item => {
    item.querySelector('.menu-btn').addEventListener('click', e => {
      e.stopPropagation();
      const wasActive = item.classList.contains('active');
      menuItems.forEach(m => m.classList.remove('active'));
      if (!wasActive) item.classList.add('active');
    });
  });
  window.addEventListener('click', () => menuItems.forEach(m => m.classList.remove('active')));

  // --- File Menu ---
  document.getElementById('btn-menu-new').addEventListener('click', () => openModal('modal-new-canvas'));
  document.getElementById('btn-menu-clear').addEventListener('click', () => {
    if (!confirm('Clear canvas? All unsaved work will be lost.')) return;
    const base = new CanvasLayer('layer_bg', 'Background', 'paint', layerManager.width, layerManager.height);
    base.ctx.fillStyle = '#ffffff';
    base.ctx.fillRect(0, 0, layerManager.width, layerManager.height);
    layerManager.layers = [base];
    layerManager.activeLayerId = base.id;
    scheduleRender();
    historyManager.pushState('Clear Canvas');
    showToast('Canvas cleared', 'info');
  });

  // --- New Canvas Modal ---
  const newPresetSelect = document.getElementById('new-preset-select');
  const newWidthInput   = document.getElementById('new-width-input');
  const newHeightInput  = document.getElementById('new-height-input');
  const newBgType       = document.getElementById('new-bg-type');

  newPresetSelect.addEventListener('change', e => {
    if (e.target.value !== 'custom') {
      const [w, h] = e.target.value.split('x').map(Number);
      newWidthInput.value  = w;
      newHeightInput.value = h;
    }
  });

  document.getElementById('btn-create-canvas-confirm').addEventListener('click', () => {
    const w  = parseInt(newWidthInput.value, 10);
    const h  = parseInt(newHeightInput.value, 10);
    const bg = newBgType.value;
    if (w < 50 || h < 50 || w > 8000 || h > 8000) {
      showToast('Canvas size must be between 50 and 8000 px', 'error');
      return;
    }
    layerManager.width  = w;
    layerManager.height = h;
    const base = new CanvasLayer('layer_bg', 'Background', 'paint', w, h);
    if (bg !== 'transparent') {
      base.ctx.fillStyle = bg;
      base.ctx.fillRect(0, 0, w, h);
    }
    layerManager.layers = [base];
    layerManager.activeLayerId = base.id;
    viewport.updateStageTransform();
    viewport.zoomFit();
    statusCanvasSize.textContent = `${w} × ${h} px`;
    scheduleRender();
    updateLayersPanel();
    historyManager.pushState('New Canvas');
    closeModal('modal-new-canvas');
    showToast('New canvas created', 'success');
  });

  // --- Image Menu ---
  document.getElementById('btn-menu-resize').addEventListener('click', () => {
    document.getElementById('resize-width-input').value  = layerManager.width;
    document.getElementById('resize-height-input').value = layerManager.height;
    openModal('modal-resize');
  });

  document.getElementById('btn-menu-crop').addEventListener('click', () => selectTool('crop'));

  const resizeWidthInput    = document.getElementById('resize-width-input');
  const resizeHeightInput   = document.getElementById('resize-height-input');
  const resizeMaintainAspect = document.getElementById('resize-maintain-aspect');
  let resizeAspect = layerManager.width / layerManager.height;

  resizeWidthInput.addEventListener('input', () => {
    if (resizeMaintainAspect.checked) {
      resizeHeightInput.value = Math.round(parseInt(resizeWidthInput.value, 10) / resizeAspect);
    }
  });
  resizeHeightInput.addEventListener('input', () => {
    if (resizeMaintainAspect.checked) {
      resizeWidthInput.value = Math.round(parseInt(resizeHeightInput.value, 10) * resizeAspect);
    }
  });

  document.getElementById('btn-resize-confirm').addEventListener('click', () => {
    const rw   = parseInt(resizeWidthInput.value, 10);
    const rh   = parseInt(resizeHeightInput.value, 10);
    const mode = document.getElementById('resize-mode-select').value;
    if (rw >= 50 && rh >= 50) {
      layerManager.resize(rw, rh, mode === 'scale');
      viewport.updateStageTransform();
      viewport.zoomFit();
      statusCanvasSize.textContent = `${rw} × ${rh} px`;
      scheduleRender();
      historyManager.pushState('Resize Canvas');
      closeModal('modal-resize');
      showToast('Canvas resized', 'success');
    }
  });

  document.getElementById('btn-menu-rot-cw').addEventListener('click', () => {
    layerManager.rotateArtwork(90);
    viewport.zoomFit();
    scheduleRender();
    historyManager.pushState('Rotate 90° CW');
    showToast('Rotated 90° clockwise', 'info');
  });

  document.getElementById('btn-menu-rot-ccw').addEventListener('click', () => {
    layerManager.rotateArtwork(-90);
    viewport.zoomFit();
    scheduleRender();
    historyManager.pushState('Rotate 90° CCW');
    showToast('Rotated 90° counter-clockwise', 'info');
  });

  document.getElementById('btn-menu-rot-180').addEventListener('click', () => {
    layerManager.rotateArtwork(180);
    viewport.zoomFit();
    scheduleRender();
    historyManager.pushState('Rotate 180°');
    showToast('Rotated 180°', 'info');
  });

  document.getElementById('btn-menu-flip-h').addEventListener('click', () => {
    layerManager.flipArtwork(true);
    scheduleRender();
    historyManager.pushState('Flip Horizontal');
    showToast('Flipped horizontally', 'info');
  });

  document.getElementById('btn-menu-flip-v').addEventListener('click', () => {
    layerManager.flipArtwork(false);
    scheduleRender();
    historyManager.pushState('Flip Vertical');
    showToast('Flipped vertically', 'info');
  });

  // --- Edit Menu ---
  document.getElementById('btn-menu-undo').addEventListener('click', () => { historyManager.undo(); scheduleRender(); });
  document.getElementById('btn-menu-redo').addEventListener('click', () => { historyManager.redo(); scheduleRender(); });
  document.getElementById('btn-menu-delete-selected').addEventListener('click', () => {
    layerManager.deleteLayer();
    toolManager.updateGizmo();
    scheduleRender();
    historyManager.pushState('Delete Element');
  });
  document.getElementById('btn-menu-duplicate-selected').addEventListener('click', () => {
    layerManager.duplicateLayer();
    scheduleRender();
    historyManager.pushState('Duplicate Element');
  });

  // --- Help Menu ---
  document.getElementById('btn-menu-shortcuts').addEventListener('click', () => openModal('modal-shortcuts'));
  document.getElementById('btn-menu-about').addEventListener('click', () => {
    showToast('CanvasPro Studio v2.0 — Modern HTML5 Paint & Image Editor', 'info');
  });

  // =========================================================================
  // 16. Theme Toggle
  // =========================================================================
  const themeToggleBtn = document.getElementById('btn-theme-toggle');
  const htmlEl = document.documentElement;
  const savedTheme = localStorage.getItem('canvaspro_theme') || 'dark';
  htmlEl.setAttribute('data-theme', savedTheme);

  themeToggleBtn.addEventListener('click', () => {
    const current = htmlEl.getAttribute('data-theme');
    const next    = current === 'dark' ? 'light' : 'dark';
    htmlEl.setAttribute('data-theme', next);
    localStorage.setItem('canvaspro_theme', next);
    showToast(`Switched to ${next} theme`, 'info');
  });

  // =========================================================================
  // 17. Modal Helpers
  // =========================================================================
  function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  }

  document.querySelectorAll('[data-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.modal));
  });

  document.querySelectorAll('.modal-backdrop').forEach(bd => {
    bd.addEventListener('click', e => {
      if (e.target === bd) bd.classList.remove('active');
    });
  });

  // Close modals on Escape key
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.active').forEach(m => m.classList.remove('active'));
    }
  });

  // =========================================================================
  // 18. Global Keyboard Shortcuts
  // =========================================================================
  window.addEventListener('keydown', e => {
    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
    if (isTyping) return;

    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && e.key === 'z') { e.preventDefault(); historyManager.undo(); scheduleRender(); }
    else if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); historyManager.redo(); scheduleRender(); }
    else if (ctrl && e.key === 's') { e.preventDefault(); openModal('modal-export'); }
    else if (ctrl && e.key === 'o') { e.preventDefault(); fileUploader.click(); }
    else if (ctrl && e.key === '0') { e.preventDefault(); viewport.zoomFit(); }
    else if (ctrl && e.key === '1') { e.preventDefault(); viewport.resetZoom(); }
    else if (ctrl && e.key === 'd') { e.preventDefault(); layerManager.duplicateLayer(); scheduleRender(); historyManager.pushState('Duplicate'); }
    else if (ctrl && e.key === 'n') { e.preventDefault(); openModal('modal-new-canvas'); }
    else if (e.key === 'v' || e.key === 'V') selectTool('select');
    else if (e.key === 'b' || e.key === 'B') selectTool('brush');
    else if (e.key === 'e' || e.key === 'E') selectTool('eraser');
    else if (e.key === 'l' || e.key === 'L') selectTool('line');
    else if (e.key === 'u' || e.key === 'U') selectTool('shapes');
    else if (e.key === 'g' || e.key === 'G') selectTool('bucket');
    else if (e.key === 't' || e.key === 'T') selectTool('text');
    else if (e.key === 'i' || e.key === 'I') selectTool('eyedropper');
    else if (e.key === 'c' || e.key === 'C') selectTool('crop');
    else if (e.key === 'h' || e.key === 'H') selectTool('hand');
    else if (e.key === 'x' || e.key === 'X') { toolManager.swapColors(); updateColorChips(); }
    else if (e.key === '[') {
      toolManager.brushSize = Math.max(1, toolManager.brushSize - 2);
      propSizeSlider.value = toolManager.brushSize;
      propSizeVal.textContent = `${toolManager.brushSize}px`;
    }
    else if (e.key === ']') {
      toolManager.brushSize = Math.min(150, toolManager.brushSize + 2);
      propSizeSlider.value = toolManager.brushSize;
      propSizeVal.textContent = `${toolManager.brushSize}px`;
    }
    else if (e.key === '?' || e.key === '/') openModal('modal-shortcuts');
    else if ((e.key === 'Delete' || e.key === 'Backspace') && toolManager.activeTool === 'select') {
      layerManager.deleteLayer();
      toolManager.updateGizmo();
      scheduleRender();
      historyManager.pushState('Delete Element');
    }
    else if (e.key === '+' || e.key === '=') viewport.zoomIn();
    else if (e.key === '-') viewport.zoomOut();
  });

  // =========================================================================
  // 19. Prevent Accidental Data Loss
  // =========================================================================
  window.addEventListener('beforeunload', e => {
    if (historyManager.undoStack.length > 1) {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Export your artwork before leaving.';
    }
  });

  // =========================================================================
  // 20. Toast Notification System
  // =========================================================================
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const iconMap = {
      success: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
      error:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
      info:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
    };

    toast.innerHTML = `${iconMap[type] || iconMap.info}<span>${message}</span>`;
    container.appendChild(toast);

    const hideTimer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      setTimeout(() => toast.remove(), 220);
    }, 3000);

    toast.addEventListener('click', () => {
      clearTimeout(hideTimer);
      toast.remove();
    });
  }

  // Welcome toast
  setTimeout(() => {
    showToast('Welcome to CanvasPro Studio! Press ? for shortcuts.', 'info');
  }, 400);

  // Initial UI sync
  updateLayersPanel();
  updateFiltersUI();
  selectTool('select');
});
