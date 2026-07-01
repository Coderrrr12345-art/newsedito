/* NewsFrame — Main Editor Script */

(function () {
  'use strict';

  /* ── Canvas Setup ─────────────────────────────────────── */
  const CANVAS_W = 800;
  const CANVAS_H = 600;

  const fabricCanvas = new fabric.Canvas('mainCanvas', {
    width: CANVAS_W,
    height: CANVAS_H,
    selection: true,
    preserveObjectStacking: true,
    renderOnAddRemove: true,
  });

  // Scale canvas responsively
  function scaleCanvas() {
    const wrap = document.querySelector('.canvas-wrap');
    if (!wrap) return;
    const available = wrap.clientWidth - 48;
    if (available <= 0) return;
    const scale = Math.min(available / CANVAS_W, 1);
    const container = document.getElementById('canvas-container');
    container.style.transform = `scale(${scale})`;
    container.style.transformOrigin = 'top left';
    // Compensate layout so wrapper shrinks to scaled size
    const scaledH = CANVAS_H * scale;
    const scaledW = CANVAS_W * scale;
    container.style.marginBottom = (scaledH - CANVAS_H) + 'px';
    container.style.marginRight = (scaledW - CANVAS_W) + 'px';
    wrap.style.minHeight = (scaledH + 48) + 'px';
    document.getElementById('canvasDimensions').textContent = CANVAS_W + ' \u00d7 ' + CANVAS_H + 'px';
  }

  window.addEventListener('resize', scaleCanvas);
  setTimeout(scaleCanvas, 100);

  /* ── History (Undo/Redo) ──────────────────────────────── */
  const history = [];
  let historyIndex = -1;
  let isSavingState = false;

  function saveState() {
    if (isSavingState) return;
    const json = fabricCanvas.toJSON(['selectable', 'evented', 'name', 'id']);
    // Remove any states after current index
    history.splice(historyIndex + 1);
    history.push(JSON.stringify(json));
    if (history.length > 50) history.shift();
    else historyIndex++;
    updateHistoryButtons();
  }

  function loadState(json) {
    isSavingState = true;
    fabricCanvas.loadFromJSON(JSON.parse(json), () => {
      fabricCanvas.renderAll();
      isSavingState = false;
      updateHistoryButtons();
    });
  }

  function undo() {
    if (historyIndex <= 0) return;
    historyIndex--;
    loadState(history[historyIndex]);
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    loadState(history[historyIndex]);
  }

  function updateHistoryButtons() {
    document.getElementById('undoBtn').disabled = historyIndex <= 0;
    document.getElementById('redoBtn').disabled = historyIndex >= history.length - 1;
  }

  fabricCanvas.on('object:added', saveState);
  fabricCanvas.on('object:modified', saveState);
  fabricCanvas.on('object:removed', saveState);

  /* ── Globals ──────────────────────────────────────────── */
  let bgImage = null;
  let logoObj = null;
  let borderRect = null;
  let logoVisible = true;

  /* ── Upload ───────────────────────────────────────────── */
  const uploadZone = document.getElementById('uploadZone');
  const fileInput = document.getElementById('fileInput');
  const chooseFileBtn = document.getElementById('chooseFileBtn');

  chooseFileBtn.addEventListener('click', () => fileInput.click());
  uploadZone.addEventListener('click', () => fileInput.click());

  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) loadImageFile(file);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) loadImageFile(fileInput.files[0]);
  });

  function loadImageFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      fabric.Image.fromURL(e.target.result, (img) => {
        // Remove old bg
        if (bgImage) fabricCanvas.remove(bgImage);
        if (borderRect) { fabricCanvas.remove(borderRect); borderRect = null; }

        const scaleX = CANVAS_W / img.width;
        const scaleY = CANVAS_H / img.height;
        const scale = Math.min(scaleX, scaleY);

        img.set({
          left: 0,
          top: 0,
          scaleX: scaleX,
          scaleY: scaleY,
          selectable: true,
          evented: true,
          name: 'background',
          id: 'background',
        });

        fabricCanvas.insertAt(img, 0);
        bgImage = img;
        fabricCanvas.renderAll();
        setStatus('Image loaded. Logo placed automatically.');
        placeLogo();
        applyBorderIfEnabled();
      }, { crossOrigin: 'anonymous' });
    };
    reader.readAsDataURL(file);
  }

  /* ── Logo ─────────────────────────────────────────────── */
  const LOGO_SRC = '/image copy.png';
  const LOGO_W = 110;

  function placeLogo() {
    if (logoObj) fabricCanvas.remove(logoObj);
    fabric.Image.fromURL(LOGO_SRC, (img) => {
      if (!img.width) return;
      const scale = LOGO_W / img.width;
      img.set({
        left: 12,
        top: 12,
        scaleX: scale,
        scaleY: scale,
        selectable: true,
        evented: true,
        name: 'logo',
        id: 'logo',
        opacity: parseInt(document.getElementById('logoOpacity').value) / 100,
        hasControls: true,
        hasBorders: true,
      });
      fabricCanvas.add(img);
      fabricCanvas.bringToFront(img);
      fabricCanvas.setActiveObject(img);
      fabricCanvas.renderAll();
      logoObj = img;
      logoVisible = true;
      document.getElementById('toggleLogoBtn').textContent = 'Hide Logo';
    }, { crossOrigin: 'anonymous' });
  }

  document.getElementById('resetLogoBtn').addEventListener('click', () => {
    if (!logoObj) return;
    const scale = LOGO_W / (logoObj.width);
    logoObj.set({ left: 12, top: 12, scaleX: scale, scaleY: scale, angle: 0 });
    fabricCanvas.renderAll();
    saveState();
  });

  document.getElementById('toggleLogoBtn').addEventListener('click', () => {
    if (!logoObj) return;
    logoVisible = !logoVisible;
    logoObj.set('visible', logoVisible);
    fabricCanvas.renderAll();
    document.getElementById('toggleLogoBtn').textContent = logoVisible ? 'Hide Logo' : 'Show Logo';
    saveState();
  });

  document.getElementById('logoOpacity').addEventListener('input', function () {
    if (!logoObj) return;
    logoObj.set('opacity', this.value / 100);
    fabricCanvas.renderAll();
  });
  document.getElementById('logoOpacity').addEventListener('change', saveState);

  /* ── Border ───────────────────────────────────────────── */
  const borderToggle = document.getElementById('borderToggle');
  const borderControlsWrapper = document.getElementById('borderControlsWrapper');

  borderToggle.addEventListener('change', () => {
    borderControlsWrapper.style.display = borderToggle.checked ? 'flex' : 'none';
    borderControlsWrapper.style.flexDirection = 'column';
    borderControlsWrapper.style.gap = '12px';
    applyBorderIfEnabled();
  });

  ['borderColor2', 'borderThickness2', 'borderStyle2'].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener('input', applyBorderIfEnabled);
    el.addEventListener('change', () => { applyBorderIfEnabled(); saveState(); });
  });

  document.getElementById('borderThickness2').addEventListener('input', function () {
    document.getElementById('borderThicknessVal2').textContent = this.value;
  });

  function applyBorderIfEnabled() {
    if (borderRect) { fabricCanvas.remove(borderRect); borderRect = null; }
    if (!borderToggle.checked || !bgImage) return;

    const color = document.getElementById('borderColor2').value;
    const thickness = parseInt(document.getElementById('borderThickness2').value);
    const style = document.getElementById('borderStyle2').value;

    const half = thickness / 2;
    const rect = new fabric.Rect({
      left: bgImage.left + half,
      top: bgImage.top + half,
      width: bgImage.getScaledWidth() - thickness,
      height: bgImage.getScaledHeight() - thickness,
      fill: 'transparent',
      stroke: color,
      strokeWidth: thickness,
      strokeDashArray: style === 'dashed' ? [12, 6] : style === 'dotted' ? [2, 6] : null,
      selectable: false,
      evented: false,
      name: 'border',
      id: 'border',
    });

    fabricCanvas.add(rect);
    fabricCanvas.bringToFront(rect);
    if (logoObj) fabricCanvas.bringToFront(logoObj);
    fabricCanvas.renderAll();
    borderRect = rect;
  }

  /* ── Add Text ─────────────────────────────────────────── */
  document.getElementById('addTextBtn').addEventListener('click', () => {
    const txt = new fabric.Textbox('Type here…', {
      left: CANVAS_W / 2,
      top: CANVAS_H / 2,
      originX: 'center',
      originY: 'center',
      width: CANVAS_W * 0.7,
      fontFamily: document.getElementById('fontFamily').value,
      fontSize: parseInt(document.getElementById('fontSize').value),
      fill: document.getElementById('textColor').value,
      fontWeight: document.getElementById('boldBtn').classList.contains('active') ? 'bold' : 'normal',
      fontStyle: document.getElementById('italicBtn').classList.contains('active') ? 'italic' : 'normal',
      underline: document.getElementById('underlineBtn').classList.contains('active'),
      textAlign: getActiveAlign(),
      lineHeight: parseFloat(document.getElementById('lineHeight').value),
      charSpacing: parseInt(document.getElementById('charSpacing').value),
      opacity: parseInt(document.getElementById('textOpacity').value) / 100,
      selectable: true,
      editable: true,
      name: 'text',
    });

    fabricCanvas.add(txt);
    fabricCanvas.setActiveObject(txt);
    fabricCanvas.bringToFront(txt);
    if (borderRect) fabricCanvas.bringToFront(borderRect);
    if (logoObj) fabricCanvas.bringToFront(logoObj);
    fabricCanvas.renderAll();
    txt.enterEditing();
    setStatus('Text box added. Double-click to edit.');
  });

  function getActiveAlign() {
    if (document.getElementById('alignCenter').classList.contains('active')) return 'center';
    if (document.getElementById('alignRight').classList.contains('active')) return 'right';
    return 'left';
  }

  /* ── Text Formatting (applies to selected text object) ── */
  function getActiveText() {
    const obj = fabricCanvas.getActiveObject();
    return obj && (obj.type === 'i-text' || obj.type === 'textbox') ? obj : null;
  }

  function applyTextProp(prop, value) {
    const txt = getActiveText();
    if (!txt) return;
    txt.set(prop, value);
    fabricCanvas.renderAll();
  }

  // Bold
  document.getElementById('boldBtn').addEventListener('click', function () {
    this.classList.toggle('active');
    applyTextProp('fontWeight', this.classList.contains('active') ? 'bold' : 'normal');
    saveState();
  });

  // Italic
  document.getElementById('italicBtn').addEventListener('click', function () {
    this.classList.toggle('active');
    applyTextProp('fontStyle', this.classList.contains('active') ? 'italic' : 'normal');
    saveState();
  });

  // Underline
  document.getElementById('underlineBtn').addEventListener('click', function () {
    this.classList.toggle('active');
    applyTextProp('underline', this.classList.contains('active'));
    saveState();
  });

  // Font size
  document.getElementById('fontSize').addEventListener('input', function () {
    applyTextProp('fontSize', Math.max(8, parseInt(this.value) || 36));
  });
  document.getElementById('fontSize').addEventListener('change', saveState);

  document.getElementById('fontSizeUp').addEventListener('click', () => {
    const el = document.getElementById('fontSize');
    el.value = Math.min(200, parseInt(el.value) + 2);
    applyTextProp('fontSize', parseInt(el.value));
    saveState();
  });
  document.getElementById('fontSizeDown').addEventListener('click', () => {
    const el = document.getElementById('fontSize');
    el.value = Math.max(8, parseInt(el.value) - 2);
    applyTextProp('fontSize', parseInt(el.value));
    saveState();
  });

  // Font family
  document.getElementById('fontFamily').addEventListener('change', function () {
    applyTextProp('fontFamily', this.value);
    saveState();
  });

  // Text color
  document.getElementById('textColor').addEventListener('input', function () {
    applyTextProp('fill', this.value);
  });
  document.getElementById('textColor').addEventListener('change', saveState);

  // Text background
  document.getElementById('textBgColor').addEventListener('input', function () {
    const txt = getActiveText();
    if (!txt) return;
    if (document.getElementById('textBgToggle').checked) {
      txt.set('backgroundColor', this.value);
      fabricCanvas.renderAll();
    }
  });
  document.getElementById('textBgColor').addEventListener('change', saveState);

  document.getElementById('textBgToggle').addEventListener('change', function () {
    const txt = getActiveText();
    if (!txt) return;
    txt.set('backgroundColor', this.checked ? document.getElementById('textBgColor').value : '');
    fabricCanvas.renderAll();
    saveState();
  });

  // Alignment
  ['alignLeft', 'alignCenter', 'alignRight'].forEach((id) => {
    document.getElementById(id).addEventListener('click', function () {
      ['alignLeft', 'alignCenter', 'alignRight'].forEach((i) => document.getElementById(i).classList.remove('active'));
      this.classList.add('active');
      const map = { alignLeft: 'left', alignCenter: 'center', alignRight: 'right' };
      applyTextProp('textAlign', map[id]);
      saveState();
    });
  });
  document.getElementById('alignLeft').classList.add('active');

  // Line height
  document.getElementById('lineHeight').addEventListener('input', function () {
    document.getElementById('lineHeightVal').textContent = parseFloat(this.value).toFixed(1);
    applyTextProp('lineHeight', parseFloat(this.value));
  });
  document.getElementById('lineHeight').addEventListener('change', saveState);

  // Char spacing
  document.getElementById('charSpacing').addEventListener('input', function () {
    document.getElementById('charSpacingVal').textContent = this.value;
    applyTextProp('charSpacing', parseInt(this.value));
  });
  document.getElementById('charSpacing').addEventListener('change', saveState);

  // Text opacity
  document.getElementById('textOpacity').addEventListener('input', function () {
    document.getElementById('textOpacityVal').textContent = this.value;
    applyTextProp('opacity', parseInt(this.value) / 100);
  });
  document.getElementById('textOpacity').addEventListener('change', saveState);

  // Direction (LTR/RTL)
  document.getElementById('dirLtr').addEventListener('click', function () {
    this.classList.add('active');
    document.getElementById('dirRtl').classList.remove('active');
    applyTextProp('direction', 'ltr');
    saveState();
  });
  document.getElementById('dirRtl').addEventListener('click', function () {
    this.classList.add('active');
    document.getElementById('dirLtr').classList.remove('active');
    const txt = getActiveText();
    if (txt) {
      txt.set({ direction: 'rtl', textAlign: 'right' });
      document.getElementById('alignRight').click();
      fabricCanvas.renderAll();
    }
    saveState();
  });

  /* ── Sync toolbar to selected object ─────────────────── */
  fabricCanvas.on('selection:created', syncToolbar);
  fabricCanvas.on('selection:updated', syncToolbar);
  fabricCanvas.on('selection:cleared', clearObjectControls);

  function syncToolbar() {
    const obj = fabricCanvas.getActiveObject();
    const objControls = document.getElementById('objectControls');
    objControls.style.display = 'flex';

    if (!obj) return;
    if (obj.type === 'i-text' || obj.type === 'textbox') {
      document.getElementById('fontSize').value = Math.round(obj.fontSize) || 36;
      document.getElementById('fontFamily').value = obj.fontFamily || 'Inter, Arial, sans-serif';
      document.getElementById('textColor').value = obj.fill || '#ffffff';
      document.getElementById('textOpacity').value = Math.round((obj.opacity || 1) * 100);
      document.getElementById('textOpacityVal').textContent = Math.round((obj.opacity || 1) * 100);
      document.getElementById('lineHeight').value = obj.lineHeight || 1.2;
      document.getElementById('lineHeightVal').textContent = (obj.lineHeight || 1.2).toFixed(1);
      document.getElementById('charSpacing').value = obj.charSpacing || 0;
      document.getElementById('charSpacingVal').textContent = obj.charSpacing || 0;
      document.getElementById('boldBtn').classList.toggle('active', obj.fontWeight === 'bold');
      document.getElementById('italicBtn').classList.toggle('active', obj.fontStyle === 'italic');
      document.getElementById('underlineBtn').classList.toggle('active', !!obj.underline);
      ['alignLeft', 'alignCenter', 'alignRight'].forEach((id) => document.getElementById(id).classList.remove('active'));
      const alignMap = { left: 'alignLeft', center: 'alignCenter', right: 'alignRight' };
      if (alignMap[obj.textAlign]) document.getElementById(alignMap[obj.textAlign]).classList.add('active');
      if (obj.backgroundColor) {
        document.getElementById('textBgToggle').checked = true;
        document.getElementById('textBgColor').value = rgbToHex(obj.backgroundColor) || '#000000';
      } else {
        document.getElementById('textBgToggle').checked = false;
      }
    }
  }

  function clearObjectControls() {
    document.getElementById('objectControls').style.display = 'none';
  }

  /* ── Object Controls (bring front / back / delete) ───── */
  document.getElementById('bringFrontBtn').addEventListener('click', () => {
    const obj = fabricCanvas.getActiveObject();
    if (obj) { fabricCanvas.bringToFront(obj); fabricCanvas.renderAll(); saveState(); }
  });
  document.getElementById('sendBackBtn').addEventListener('click', () => {
    const obj = fabricCanvas.getActiveObject();
    if (obj) { fabricCanvas.sendToBack(obj); fabricCanvas.renderAll(); saveState(); }
  });
  document.getElementById('deleteObjBtn').addEventListener('click', () => {
    const obj = fabricCanvas.getActiveObject();
    if (!obj) return;
    if (obj.id === 'background') { setStatus('Cannot delete the background image.'); return; }
    if (obj.id === 'logo') { logoObj = null; }
    if (obj.id === 'border') { borderRect = null; borderToggle.checked = false; borderControlsWrapper.style.display = 'none'; }
    fabricCanvas.remove(obj);
    fabricCanvas.renderAll();
    setStatus('Object deleted.');
  });

  /* ── Clear All ────────────────────────────────────────── */
  document.getElementById('clearAllBtn').addEventListener('click', () => {
    if (!confirm('Clear the canvas? This will remove all objects.')) return;
    fabricCanvas.clear();
    bgImage = null;
    logoObj = null;
    borderRect = null;
    borderToggle.checked = false;
    borderControlsWrapper.style.display = 'none';
    saveState();
    setStatus('Canvas cleared.');
  });

  /* ── Undo / Redo ──────────────────────────────────────── */
  document.getElementById('undoBtn').addEventListener('click', undo);
  document.getElementById('redoBtn').addEventListener('click', redo);

  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
    if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) { e.preventDefault(); redo(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && fabricCanvas.getActiveObject()) {
      const obj = fabricCanvas.getActiveObject();
      if (obj && obj.type !== 'i-text' && obj.type !== 'textbox') {
        fabricCanvas.remove(obj);
        fabricCanvas.renderAll();
      }
    }
  });

  /* ── Download ─────────────────────────────────────────── */
  document.getElementById('downloadBtn').addEventListener('click', () => {
    const format = document.getElementById('exportFormat').value;
    const quality = format === 'jpeg' ? 0.92 : 1;

    // Deselect all objects before export
    fabricCanvas.discardActiveObject();
    fabricCanvas.renderAll();

    const dataURL = fabricCanvas.toDataURL({
      format: format,
      quality: quality,
      multiplier: 1,
    });

    const link = document.createElement('a');
    link.href = dataURL;
    link.download = 'newsframe-thumbnail.' + (format === 'jpeg' ? 'jpg' : 'png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setStatus('Image downloaded as ' + link.download);
  });

  /* ── Helpers ──────────────────────────────────────────── */
  function setStatus(msg) {
    document.getElementById('statusMsg').textContent = msg;
  }

  function rgbToHex(color) {
    if (!color) return '#000000';
    if (color.startsWith('#')) return color;
    const m = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!m) return '#000000';
    return '#' + [m[1], m[2], m[3]].map((x) => parseInt(x).toString(16).padStart(2, '0')).join('');
  }

  /* ── Navbar Toggle ────────────────────────────────────── */
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  navToggle.addEventListener('click', () => {
    navToggle.classList.toggle('open');
    navLinks.classList.toggle('open');
  });

  /* ── Initial state ────────────────────────────────────── */
  updateHistoryButtons();
  saveState();
  scaleCanvas();

})();
