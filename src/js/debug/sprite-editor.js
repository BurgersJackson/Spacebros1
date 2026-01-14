/**
 * Sprite Editor - In-game sprite creation and editing tool
 *
 * Features:
 * - Draw sprites with brush, eraser, fill, eyedropper tools
 * - Upload PNG files
 * - Live preview with collision radius
 * - Generate texture loading code
 * - Save/load sprite data
 */

import { ZOOM_LEVEL } from '../core/constants.js';

// Tool types
export const TOOLS = {
    BRUSH: 'brush',
    ERASER: 'eraser',
    FILL: 'fill',
    EYEDROPPER: 'eyedropper',
    LINE: 'line',
    RECTANGLE: 'rectangle',
    ELLIPSE: 'ellipse'
};

// Default palette
export const DEFAULT_PALETTE = [
    '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
    '#ffff00', '#ff00ff', '#00ffff', '#ff8800', '#88ff00',
    '#0088ff', '#ff0088', '#88ff88', '#888888', '#444444',
    '#cccccc', '#ff4444', '#44ff44', '#4444ff', '#ffffcc'
];

export class SpriteEditor {
    constructor() {
        this.active = false;
        this.canvasSize = 512;
        this.brushSize = 4;
        this.currentTool = TOOLS.BRUSH;
        this.primaryColor = '#00ff00';
        this.secondaryColor = '#000000';
        this.showGrid = true;
        this.showTransparency = true;
        this.previewRadius = 64;
        this.spriteName = 'new_sprite';
        this.autoGenerateCode = true;
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 50;
        this.resolution = 256; // Changed from 64 to 256 (matches enemy sprite size)

        // DOM elements (created when activated)
        this.container = null;
        this.editorCanvas = null;
        this.editorCtx = null;
        this.previewCanvas = null;
        this.previewCtx = null;
        this.pixels = []; // 2D array of color strings

        this._initPixels();
        this._setupKeyBindings();
    }

    _initPixels() {
        // Initialize pixel array (transparent by default)
        this.pixels = [];
        for (let y = 0; y < this.resolution; y++) {
            this.pixels[y] = [];
            for (let x = 0; x < this.resolution; x++) {
                this.pixels[y][x] = null; // null = transparent
            }
        }
    }

    _setupKeyBindings() {
        this._keyHandler = (e) => {
            if (!this.active) return;

            // Tool shortcuts
            if (e.key === 'b') this.setTool(TOOLS.BRUSH);
            if (e.key === 'e') this.setTool(TOOLS.ERASER);
            if (e.key === 'f') this.setTool(TOOLS.FILL);
            if (e.key === 'i') this.setTool(TOOLS.EYEDROPPER);
            if (e.key === 'l') this.setTool(TOOLS.LINE);
            if (e.key === 'r') this.setTool(TOOLS.RECTANGLE);
            if (e.key === 'o') this.setTool(TOOLS.ELLIPSE);

            // Brush size
            if (e.key === '[') this.setBrushSize(Math.max(1, this.brushSize - 1));
            if (e.key === ']') this.setBrushSize(Math.min(64, this.brushSize + 1));

            // Undo/Redo
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                this.undo();
            }
            if (e.ctrlKey && e.key === 'y') {
                e.preventDefault();
                this.redo();
            }

            // Toggle grid
            if (e.key === 'g') this.toggleGrid();

            // Save
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.exportSprite();
            }

            // Primary color picker (left click on palette, handled elsewhere)
        };
    }

    toggle() {
        if (this.active) {
            this.deactivate();
        } else {
            this.activate();
        }
    }

    activate() {
        if (this.active) return;
        this.active = true;

        this._createUI();
        this._renderCanvas();
        this._updatePreview();
        document.addEventListener('keydown', this._keyHandler);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;

        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
        this.editorCanvas = null;
        this.editorCtx = null;
        this.previewCanvas = null;
        this.previewCtx = null;

        document.removeEventListener('keydown', this._keyHandler);
    }

    _createUI() {
        // Create main container
        this.container = document.createElement('div');
        this.container.id = 'sprite-editor-container';
        Object.assign(this.container.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            zIndex: '10000',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'monospace',
            color: '#fff',
            overflow: 'auto'
        });

        // Header
        const header = this._createHeader();
        this.container.appendChild(header);

        // Main content area
        const mainArea = document.createElement('div');
        Object.assign(mainArea.style, {
            display: 'flex',
            flex: '1',
            overflow: 'hidden'
        });

        // Left toolbar
        const leftToolbar = this._createLeftToolbar();
        mainArea.appendChild(leftToolbar);

        // Canvas area
        const canvasArea = this._createCanvasArea();
        mainArea.appendChild(canvasArea);

        // Right panel (preview + palette + code)
        const rightPanel = this._createRightPanel();
        mainArea.appendChild(rightPanel);

        this.container.appendChild(mainArea);

        // Footer
        const footer = this._createFooter();
        this.container.appendChild(footer);

        document.body.appendChild(this.container);
    }

    _createHeader() {
        const header = document.createElement('div');
        Object.assign(header.style, {
            backgroundColor: '#222',
            padding: '10px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #444'
        });

        const title = document.createElement('h2');
        title.textContent = '🎨 Sprite Editor';
        Object.assign(title.style, { margin: 0, fontSize: '20px' });

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕ Close (Esc)';
        Object.assign(closeBtn.style, {
            padding: '8px 16px',
            backgroundColor: '#c44',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
        });
        closeBtn.onclick = () => this.deactivate();

        header.appendChild(title);
        header.appendChild(closeBtn);

        // Handle ESC key
        this._escHandler = (e) => {
            if (e.key === 'Escape') this.deactivate();
        };
        setTimeout(() => document.addEventListener('keydown', this._escHandler), 0);

        return header;
    }

    _createLeftToolbar() {
        const toolbar = document.createElement('div');
        Object.assign(toolbar.style, {
            width: '200px',
            backgroundColor: '#1a1a1a',
            padding: '15px',
            borderRight: '1px solid #444',
            display: 'flex',
            flexDirection: 'column',
            gap: '15px',
            overflow: 'auto'
        });

        // Tools section
        const toolsSection = document.createElement('div');
        toolsSection.innerHTML = '<h3 style="margin:0 0 10px 0;font-size:14px;color:#888;">TOOLS</h3>';
        toolsSection.style.marginBottom = '15px';

        const toolButtons = [
            { tool: TOOLS.BRUSH, label: '🖌️ Brush (B)', key: 'B' },
            { tool: TOOLS.ERASER, label: '🧹 Eraser (E)', key: 'E' },
            { tool: TOOLS.FILL, label: '🪣 Fill (F)', key: 'F' },
            { tool: TOOLS.EYEDROPPER, label: '💉 Eyedropper (I)', key: 'I' },
            { tool: TOOLS.LINE, label: '📏 Line (L)', key: 'L' },
            { tool: TOOLS.RECTANGLE, label: '⬜ Rectangle (R)', key: 'R' },
            { tool: TOOLS.ELLIPSE, label: '⭕ Ellipse (O)', key: 'O' }
        ];

        toolButtons.forEach(({ tool, label }) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.dataset.tool = tool;
            Object.assign(btn.style, {
                width: '100%',
                padding: '10px',
                margin: '4px 0',
                backgroundColor: this.currentTool === tool ? '#4a4' : '#333',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: '4px',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '13px'
            });
            btn.onclick = () => this.setTool(tool);
            toolsSection.appendChild(btn);
        });

        toolbar.appendChild(toolsSection);

        // Brush size
        const brushSection = document.createElement('div');
        const brushSizeLabel = document.createElement('h3');
        brushSizeLabel.id = 'brush-size-label';
        Object.assign(brushSizeLabel.style, { margin: '0 0 10px 0', fontSize: '14px', color: '#888' });
        brushSizeLabel.textContent = `BRUSH SIZE [ ]: ${this.brushSize}`;
        brushSection.appendChild(brushSizeLabel);

        const sizeSlider = document.createElement('input');
        sizeSlider.id = 'brush-size-slider';
        sizeSlider.type = 'range';
        sizeSlider.min = '1';
        sizeSlider.max = '64'; // Increased for 256x256 resolution
        sizeSlider.value = this.brushSize;
        Object.assign(sizeSlider.style, { width: '100%', cursor: 'pointer' });
        sizeSlider.oninput = (e) => this.setBrushSize(parseInt(e.target.value));
        brushSection.appendChild(sizeSlider);

        toolbar.appendChild(brushSection);

        // Options
        const optionsSection = document.createElement('div');
        optionsSection.innerHTML = '<h3 style="margin:0 0 10px 0;font-size:14px;color:#888;">OPTIONS</h3>';

        const gridToggle = this._createCheckbox('Show Grid (G)', this.showGrid, (v) => this.toggleGrid(v));
        optionsSection.appendChild(gridToggle);

        const transToggle = this._createCheckbox('Show Transparency', this.showTransparency, (v) => {
            this.showTransparency = v;
            this._renderCanvas();
        });
        optionsSection.appendChild(transToggle);

        toolbar.appendChild(optionsSection);

        // File operations
        const fileSection = document.createElement('div');
        fileSection.innerHTML = '<h3 style="margin:0 0 10px 0;font-size:14px;color:#888;">FILE</h3>';

        const uploadBtn = document.createElement('button');
        uploadBtn.textContent = '📁 Upload PNG';
        Object.assign(uploadBtn.style, {
            width: '100%',
            padding: '10px',
            backgroundColor: '#555',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginBottom: '5px'
        });
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/png';
        fileInput.style.display = 'none';
        fileInput.onchange = (e) => this._handleFileUpload(e);
        uploadBtn.onclick = () => fileInput.click();
        fileSection.appendChild(uploadBtn);
        fileSection.appendChild(fileInput);

        const clearBtn = document.createElement('button');
        clearBtn.textContent = '🗑️ Clear Canvas';
        Object.assign(clearBtn.style, {
            width: '100%',
            padding: '10px',
            backgroundColor: '#555',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '5px'
        });
        clearBtn.onclick = () => this._clearCanvas();
        fileSection.appendChild(clearBtn);

        toolbar.appendChild(fileSection);

        return toolbar;
    }

    _createCanvasArea() {
        const area = document.createElement('div');
        Object.assign(area.style, {
            flex: '1',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            backgroundColor: '#0f0f0f'
        });

        const canvasContainer = document.createElement('div');
        Object.assign(canvasContainer.style, {
            position: 'relative',
            border: '2px solid #444',
            boxShadow: '0 0 20px rgba(0,0,0,0.5)'
        });

        this.editorCanvas = document.createElement('canvas');
        this.editorCanvas.width = this.canvasSize;
        this.editorCanvas.height = this.canvasSize;
        Object.assign(this.editorCanvas.style, {
            display: 'block',
            cursor: 'crosshair',
            imageRendering: 'pixelated'
        });

        this.editorCtx = this.editorCanvas.getContext('2d');
        this._setupCanvasEvents();

        canvasContainer.appendChild(this.editorCanvas);
        area.appendChild(canvasContainer);

        // Canvas info
        const info = document.createElement('div');
        info.textContent = `${this.resolution}×${this.resolution} | Left click: Primary color | Right click: Secondary color`;
        Object.assign(info.style, {
            marginTop: '10px',
            color: '#888',
            fontSize: '12px'
        });
        area.appendChild(info);

        return area;
    }

    _setupCanvasEvents() {
        const canvas = this.editorCanvas;
        const getPixelPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = Math.floor((e.clientX - rect.left) * scaleX / (this.canvasSize / this.resolution));
            const y = Math.floor((e.clientY - rect.top) * scaleY / (this.canvasSize / this.resolution));
            return { x: Math.max(0, Math.min(this.resolution - 1, x)), y: Math.max(0, Math.min(this.resolution - 1, y)) };
        };

        // Store backup pixels for shape preview
        let shapeStartPixels = null;

        canvas.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.isDrawing = true;
            const pos = getPixelPos(e);
            this.startX = pos.x;
            this.startY = pos.y;
            this.lastX = pos.x;
            this.lastY = pos.y;
            const color = e.button === 2 ? this.secondaryColor : this.primaryColor;

            if (this.currentTool === TOOLS.EYEDROPPER) {
                this._pickColor(pos.x, pos.y);
                this.isDrawing = false;
            } else if (this.currentTool === TOOLS.FILL) {
                this._saveState();
                this._floodFill(pos.x, pos.y, color);
                this._renderCanvas();
                this._updatePreview();
            } else if (this.currentTool === TOOLS.BRUSH || this.currentTool === TOOLS.ERASER) {
                this._saveState();
                this._drawPixel(pos.x, pos.y, this.currentTool === TOOLS.ERASER ? null : color);
                this._renderCanvas();
                this._updatePreview();
            } else if (this.currentTool === TOOLS.LINE || this.currentTool === TOOLS.RECTANGLE || this.currentTool === TOOLS.ELLIPSE) {
                // Save state for shape tools
                this._saveState();
                // Backup current pixels for preview
                shapeStartPixels = this.pixels.map(row => [...row]);
            }
        });

        canvas.addEventListener('mousemove', (e) => {
            if (!this.isDrawing) return;
            const pos = getPixelPos(e);
            const color = e.button === 2 ? this.secondaryColor : this.primaryColor;

            if (this.currentTool === TOOLS.BRUSH || this.currentTool === TOOLS.ERASER) {
                this._drawLine(this.lastX, this.lastY, pos.x, pos.y, this.currentTool === TOOLS.ERASER ? null : color);
                this.lastX = pos.x;
                this.lastY = pos.y;
                this._renderCanvas();
                this._updatePreview();
            } else if (this.currentTool === TOOLS.LINE && shapeStartPixels) {
                // Restore and draw preview
                this.pixels = shapeStartPixels.map(row => [...row]);
                this._drawShapeLine(this.startX, this.startY, pos.x, pos.y, color);
                this._renderCanvas();
                this._updatePreview();
            } else if (this.currentTool === TOOLS.RECTANGLE && shapeStartPixels) {
                // Restore and draw preview
                this.pixels = shapeStartPixels.map(row => [...row]);
                this._drawShapeRectangle(this.startX, this.startY, pos.x, pos.y, color);
                this._renderCanvas();
                this._updatePreview();
            } else if (this.currentTool === TOOLS.ELLIPSE && shapeStartPixels) {
                // Restore and draw preview
                this.pixels = shapeStartPixels.map(row => [...row]);
                this._drawShapeEllipse(this.startX, this.startY, pos.x, pos.y, color);
                this._renderCanvas();
                this._updatePreview();
            }
        });

        canvas.addEventListener('mouseup', () => {
            if (this.isDrawing) {
                // Finalize the drawing - save the final state
                if (this.currentTool === TOOLS.LINE || this.currentTool === TOOLS.RECTANGLE || this.currentTool === TOOLS.ELLIPSE) {
                    // The shape is already drawn, just update history
                    shapeStartPixels = null;
                }
            }
            this.isDrawing = false;
        });

        canvas.addEventListener('mouseleave', () => {
            if (this.isDrawing && (this.currentTool === TOOLS.LINE || this.currentTool === TOOLS.RECTANGLE || this.currentTool === TOOLS.ELLIPSE)) {
                // Cancel shape drawing if mouse leaves canvas
                if (shapeStartPixels) {
                    this.pixels = shapeStartPixels.map(row => [...row]);
                    this._renderCanvas();
                    this._updatePreview();
                    shapeStartPixels = null;
                }
            }
            this.isDrawing = false;
        });

        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    _createRightPanel() {
        const panel = document.createElement('div');
        Object.assign(panel.style, {
            width: '320px',
            backgroundColor: '#1a1a1a',
            borderLeft: '1px solid #444',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto'
        });

        // Preview section
        const previewSection = document.createElement('div');
        previewSection.style.padding = '15px';
        previewSection.style.borderBottom = '1px solid #333';

        previewSection.innerHTML = '<h3 style="margin:0 0 10px 0;font-size:14px;color:#888;">PREVIEW (In-Game Scale)</h3>';

        this.previewCanvas = document.createElement('canvas');
        this.previewCanvas.width = 200;
        this.previewCanvas.height = 200;
        Object.assign(this.previewCanvas.style, {
            backgroundColor: '#0a0a0a',
            border: '1px solid #444',
            display: 'block',
            margin: '0 auto'
        });
        this.previewCtx = this.previewCanvas.getContext('2d');

        previewSection.appendChild(this.previewCanvas);

        // Radius slider
        const radiusControl = document.createElement('div');
        radiusControl.innerHTML = '<label style="font-size:12px;color:#aaa;">Collision Radius: <span id="radius-value">64</span></label>';
        const radiusSlider = document.createElement('input');
        radiusSlider.type = 'range';
        radiusSlider.min = '16';
        radiusSlider.max = '200';
        radiusSlider.value = this.previewRadius;
        Object.assign(radiusSlider.style, { width: '100%', marginTop: '5px', cursor: 'pointer' });
        radiusSlider.oninput = (e) => {
            this.previewRadius = parseInt(e.target.value);
            document.getElementById('radius-value').textContent = this.previewRadius;
            this._updatePreview();
        };
        radiusControl.appendChild(radiusSlider);
        previewSection.appendChild(radiusControl);

        panel.appendChild(previewSection);

        // Colors section
        const colorSection = document.createElement('div');
        colorSection.style.padding = '15px';
        colorSection.style.borderBottom = '1px solid #333';

        colorSection.innerHTML = '<h3 style="margin:0 0 10px 0;font-size:14px;color:#888;">COLORS</h3>';

        // Current colors
        const currentColors = document.createElement('div');
        Object.assign(currentColors.style, {
            display: 'flex',
            gap: '10px',
            marginBottom: '10px'
        });

        const primaryColorBox = this._createColorBox(this.primaryColor, 'Primary (Left Click)', true);
        const secondaryColorBox = this._createColorBox(this.secondaryColor, 'Secondary (Right Click)', false);
        currentColors.appendChild(primaryColorBox);
        currentColors.appendChild(secondaryColorBox);
        colorSection.appendChild(currentColors);

        // Palette
        const paletteGrid = document.createElement('div');
        Object.assign(paletteGrid.style, {
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '4px'
        });

        DEFAULT_PALETTE.forEach(color => {
            const swatch = document.createElement('div');
            Object.assign(swatch.style, {
                width: '30px',
                height: '30px',
                backgroundColor: color,
                border: '2px solid #555',
                borderRadius: '3px',
                cursor: 'pointer'
            });
            swatch.onclick = () => this.primaryColor = color;
            swatch.oncontextmenu = (e) => {
                e.preventDefault();
                this.secondaryColor = color;
            };
            paletteGrid.appendChild(swatch);
        });

        colorSection.appendChild(paletteGrid);

        // Custom color picker
        const customColor = document.createElement('div');
        customColor.style.marginTop = '10px';
        const customPicker = document.createElement('input');
        customPicker.type = 'color';
        customPicker.value = this.primaryColor;
        customPicker.onchange = (e) => this.primaryColor = e.target.value;
        customColor.innerHTML = '<label style="font-size:12px;color:#aaa;">Custom: </label>';
        customColor.appendChild(customPicker);
        colorSection.appendChild(customColor);

        panel.appendChild(colorSection);

        // Export section
        const exportSection = document.createElement('div');
        exportSection.style.padding = '15px';
        exportSection.style.borderBottom = '1px solid #333';

        exportSection.innerHTML = '<h3 style="margin:0 0 10px 0;font-size:14px;color:#888;">EXPORT</h3>';

        // Sprite name input
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = this.spriteName;
        nameInput.placeholder = 'sprite_name';
        Object.assign(nameInput.style, {
            width: '100%',
            padding: '8px',
            backgroundColor: '#333',
            color: '#fff',
            border: '1px solid #555',
            borderRadius: '4px',
            boxSizing: 'border-box',
            fontFamily: 'monospace'
        });
        nameInput.onchange = (e) => {
            this.spriteName = e.target.value.replace(/[^a-z0-9_]/g, '_');
            nameInput.value = this.spriteName;
        };
        exportSection.appendChild(nameInput);

        // Export buttons
        const exportBtn = document.createElement('button');
        exportBtn.textContent = '📥 Download PNG (Ctrl+S)';
        Object.assign(exportBtn.style, {
            width: '100%',
            padding: '10px',
            backgroundColor: '#4a4',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '10px'
        });
        exportBtn.onclick = () => this.exportSprite();
        exportSection.appendChild(exportBtn);

        const codeBtn = document.createElement('button');
        codeBtn.textContent = '📋 Copy Texture Code';
        Object.assign(codeBtn.style, {
            width: '100%',
            padding: '10px',
            backgroundColor: '#44a',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '5px'
        });
        codeBtn.onclick = () => this.copyTextureCode();
        exportSection.appendChild(codeBtn);

        panel.appendChild(exportSection);

        // Code preview
        const codeSection = document.createElement('div');
        codeSection.style.padding = '15px';
        codeSection.style.flex = '1';

        codeSection.innerHTML = '<h3 style="margin:0 0 10px 0;font-size:14px;color:#888;">GENERATED CODE</h3>';

        this.codePreview = document.createElement('pre');
        Object.assign(this.codePreview.style, {
            backgroundColor: '#0a0a0a',
            color: '#8f8',
            padding: '10px',
            borderRadius: '4px',
            fontSize: '10px',
            overflow: 'auto',
            maxHeight: '300px',
            whiteSpace: 'pre-wrap'
        });
        this._updateCodePreview();

        codeSection.appendChild(this.codePreview);
        panel.appendChild(codeSection);

        return panel;
    }

    _createFooter() {
        const footer = document.createElement('div');
        Object.assign(footer.style, {
            backgroundColor: '#222',
            padding: '10px 20px',
            borderTop: '1px solid #444',
            fontSize: '12px',
            color: '#888',
            display: 'flex',
            justifyContent: 'space-between'
        });

        footer.innerHTML = `
            <span>Shortcuts: B=Brush | E=Eraser | F=Fill | I=Eyedropper | L=Line | R=Rect | O=Ellipse</span>
            <span>[ ] = Brush Size | G = Grid | Ctrl+Z = Undo | Ctrl+Y = Redo | Ctrl+S = Save</span>
        `;

        return footer;
    }

    _createColorBox(color, label, isPrimary) {
        const container = document.createElement('div');
        Object.assign(container.style, { display: 'flex', flexDirection: 'column', alignItems: 'center' });

        const box = document.createElement('div');
        Object.assign(box.style, {
            width: '50px',
            height: '50px',
            backgroundColor: color,
            border: isPrimary ? '3px solid #fff' : '3px solid #888',
            borderRadius: '4px',
            cursor: 'pointer'
        });

        const picker = document.createElement('input');
        picker.type = 'color';
        picker.value = color;
        picker.style.display = 'none';
        picker.onchange = (e) => {
            if (isPrimary) {
                this.primaryColor = e.target.value;
                box.style.backgroundColor = e.target.value;
            } else {
                this.secondaryColor = e.target.value;
                box.style.backgroundColor = e.target.value;
            }
        };

        box.onclick = () => picker.click();

        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        labelEl.style.fontSize = '10px';
        labelEl.style.color = '#aaa';
        labelEl.style.marginTop = '4px';

        container.appendChild(box);
        container.appendChild(picker);
        container.appendChild(labelEl);

        return container;
    }

    _createCheckbox(label, checked, onChange) {
        const container = document.createElement('div');
        Object.assign(container.style, {
            display: 'flex',
            alignItems: 'center',
            margin: '5px 0'
        });

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = checked;
        checkbox.onchange = (e) => onChange(e.target.checked);

        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        labelEl.style.marginLeft = '8px';
        labelEl.style.fontSize = '13px';
        labelEl.style.color = '#ccc';
        labelEl.style.cursor = 'pointer';
        labelEl.onclick = () => checkbox.click();

        container.appendChild(checkbox);
        container.appendChild(labelEl);

        return container;
    }

    // Drawing methods
    _drawPixel(x, y, color) {
        if (x >= 0 && x < this.resolution && y >= 0 && y < this.resolution) {
            this.pixels[y][x] = color;
        }
    }

    _drawLine(x0, y0, x1, y1, color) {
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        while (true) {
            this._drawBrush(x0, y0, color);

            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 < dx) { err += dx; y0 += sy; }
        }
    }

    _drawBrush(x, y, color) {
        const halfSize = Math.floor(this.brushSize / 2);
        for (let dy = -halfSize; dy <= halfSize; dy++) {
            for (let dx = -halfSize; dx <= halfSize; dx++) {
                if (dx * dx + dy * dy <= halfSize * halfSize) {
                    this._drawPixel(x + dx, y + dy, color);
                }
            }
        }
    }

    // Shape tools (for Line, Rectangle, Ellipse)
    _drawShapeLine(x0, y0, x1, y1, color) {
        // Bresenham's line algorithm
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        while (true) {
            this._drawPixel(x0, y0, color);
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 < dx) { err += dx; y0 += sy; }
        }
    }

    _drawShapeRectangle(x0, y0, x1, y1, color) {
        // Draw rectangle outline
        const minX = Math.min(x0, x1);
        const maxX = Math.max(x0, x1);
        const minY = Math.min(y0, y1);
        const maxY = Math.max(y0, y1);

        // Top and bottom edges
        for (let x = minX; x <= maxX; x++) {
            this._drawPixel(x, minY, color);
            this._drawPixel(x, maxY, color);
        }
        // Left and right edges
        for (let y = minY; y <= maxY; y++) {
            this._drawPixel(minX, y, color);
            this._drawPixel(maxX, y, color);
        }
    }

    _drawShapeEllipse(x0, y0, x1, y1, color) {
        // Draw ellipse outline using midpoint algorithm
        const centerX = Math.floor((x0 + x1) / 2);
        const centerY = Math.floor((y0 + y1) / 2);
        const radiusX = Math.abs(x1 - x0) / 2;
        const radiusY = Math.abs(y1 - y0) / 2;

        let x = radiusX;
        let y = 0;
        let err = 0;

        // Draw from 0 to 45 degrees
        while (y <= x) {
            // Draw 4 symmetric points
            this._drawPixel(Math.floor(centerX + x), Math.floor(centerY + y), color);
            this._drawPixel(Math.floor(centerX - x), Math.floor(centerY + y), color);
            this._drawPixel(Math.floor(centerX + x), Math.floor(centerY - y), color);
            this._drawPixel(Math.floor(centerX - x), Math.floor(centerY - y), color);

            y++;
            if (err <= 0) {
                err += 2 * y + 1;
            } else {
                x--;
                err += 2 * (y - x) + 1;
            }
        }

        // For non-circular ellipses, need additional points
        if (radiusX !== radiusY) {
            // Second pass for Y radius
            x = 0;
            y = radiusY;
            err = 0;

            while (x <= y) {
                this._drawPixel(Math.floor(centerX + x), Math.floor(centerY + y), color);
                this._drawPixel(Math.floor(centerX - x), Math.floor(centerY + y), color);
                this._drawPixel(Math.floor(centerX + x), Math.floor(centerY - y), color);
                this._drawPixel(Math.floor(centerX - x), Math.floor(centerY - y), color);

                x++;
                if (err <= 0) {
                    err += 2 * x + 1;
                } else {
                    y--;
                    err += 2 * (x - y) + 1;
                }
            }
        }
    }

    _floodFill(startX, startY, fillColor) {
        const targetColor = this.pixels[startY][startX];
        if (targetColor === fillColor) return;

        const stack = [[startX, startY]];
        const visited = new Set();

        while (stack.length > 0) {
            const [x, y] = stack.pop();
            const key = `${x},${y}`;

            if (visited.has(key)) continue;
            if (x < 0 || x >= this.resolution || y < 0 || y >= this.resolution) continue;
            if (this.pixels[y][x] !== targetColor) continue;

            visited.add(key);
            this.pixels[y][x] = fillColor;

            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
    }

    _pickColor(x, y) {
        const color = this.pixels[y][x];
        if (color) {
            this.primaryColor = color;
        }
    }

    _clearCanvas() {
        this._saveState();
        this._initPixels();
        this._renderCanvas();
        this._updatePreview();
    }

    // Render methods
    _renderCanvas() {
        const ctx = this.editorCtx;
        const pixelSize = this.canvasSize / this.resolution;

        // Clear canvas
        ctx.clearRect(0, 0, this.canvasSize, this.canvasSize);

        // Draw transparency checkerboard
        if (this.showTransparency) {
            const checkerSize = Math.max(4, Math.floor(this.resolution / 32));
            for (let y = 0; y < this.resolution; y++) {
                for (let x = 0; x < this.resolution; x++) {
                    const checker = ((Math.floor(x / checkerSize) + Math.floor(y / checkerSize)) % 2 === 0);
                    ctx.fillStyle = checker ? '#2a2a2a' : '#1a1a1a';
                    ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
                }
            }
        }

        // Draw pixels
        for (let y = 0; y < this.resolution; y++) {
            for (let x = 0; x < this.resolution; x++) {
                if (this.pixels[y][x]) {
                    ctx.fillStyle = this.pixels[y][x];
                    ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
                }
            }
        }

        // Draw grid
        if (this.showGrid) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1;
            // Scale grid spacing based on resolution (every 8 pixels for 64x64, every 16 pixels for 128x128, etc.)
            const gridSpacing = Math.max(4, Math.floor(this.resolution / 16));
            for (let i = 0; i <= this.resolution; i += gridSpacing) {
                ctx.beginPath();
                ctx.moveTo(i * pixelSize, 0);
                ctx.lineTo(i * pixelSize, this.canvasSize);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, i * pixelSize);
                ctx.lineTo(this.canvasSize, i * pixelSize);
                ctx.stroke();
            }
        }
    }

    _updatePreview() {
        const ctx = this.previewCtx;
        const centerX = 100;
        const centerY = 100;
        const scale = (this.previewRadius * 2) / this.resolution;

        // Clear
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, 200, 200);

        // Draw sprite
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(scale, scale);
        ctx.translate(-this.resolution / 2, -this.resolution / 2);

        const pixelSize = 1;
        for (let y = 0; y < this.resolution; y++) {
            for (let x = 0; x < this.resolution; x++) {
                if (this.pixels[y][x]) {
                    ctx.fillStyle = this.pixels[y][x];
                    ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
                }
            }
        }
        ctx.restore();

        // Draw collision radius
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(centerX, centerY, this.previewRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    _updateCodePreview() {
        this.codePreview.textContent = this.generateTextureCode();
    }

    // History
    _saveState() {
        // Remove any redo states
        this.history = this.history.slice(0, this.historyIndex + 1);

        // Deep copy pixels
        const state = this.pixels.map(row => [...row]);
        this.history.push(state);

        // Limit history size
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.pixels = this.history[this.historyIndex].map(row => [...row]);
            this._renderCanvas();
            this._updatePreview();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.pixels = this.history[this.historyIndex].map(row => [...row]);
            this._renderCanvas();
            this._updatePreview();
        }
    }

    // Tool setters
    setTool(tool) {
        this.currentTool = tool;
        // Update button styles
        if (this.container) {
            const buttons = this.container.querySelectorAll('[data-tool]');
            buttons.forEach(btn => {
                if (btn.dataset.tool === tool) {
                    btn.style.backgroundColor = '#4a4';
                } else {
                    btn.style.backgroundColor = '#333';
                }
            });
        }
    }

    setBrushSize(size) {
        this.brushSize = size;
        if (this.container) {
            const label = document.getElementById('brush-size-label');
            if (label) {
                label.textContent = `BRUSH SIZE [ ]: ${size}`;
            }
            const slider = document.getElementById('brush-size-slider');
            if (slider) {
                slider.value = size;
            }
        }
    }

    toggleGrid(value) {
        if (value !== undefined) {
            this.showGrid = value;
        } else {
            this.showGrid = !this.showGrid;
        }
        this._renderCanvas();
    }

    // File handling
    _handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this._saveState();
                this._loadImageToPixels(img);
                this._renderCanvas();
                this._updatePreview();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
        event.target.value = ''; // Reset input
    }

    _loadImageToPixels(img) {
        // Create temp canvas to read pixels
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.resolution;
        tempCanvas.height = this.resolution;
        const tempCtx = tempCanvas.getContext('2d');

        // Draw image scaled to resolution
        tempCtx.drawImage(img, 0, 0, this.resolution, this.resolution);

        // Read pixels
        const imageData = tempCtx.getImageData(0, 0, this.resolution, this.resolution);
        const data = imageData.data;

        for (let y = 0; y < this.resolution; y++) {
            for (let x = 0; x < this.resolution; x++) {
                const i = (y * this.resolution + x) * 4;
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const a = data[i + 3];

                if (a > 128) {
                    this.pixels[y][x] = `rgb(${r},${g},${b})`;
                } else {
                    this.pixels[y][x] = null;
                }
            }
        }
    }

    // Export methods
    exportSprite() {
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = this.resolution;
        exportCanvas.height = this.resolution;
        const ctx = exportCanvas.getContext('2d');

        for (let y = 0; y < this.resolution; y++) {
            for (let x = 0; x < this.resolution; x++) {
                if (this.pixels[y][x]) {
                    ctx.fillStyle = this.pixels[y][x];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }

        // Download
        const link = document.createElement('a');
        link.download = `${this.spriteName}.png`;
        link.href = exportCanvas.toDataURL('image/png');
        link.click();
    }

    generateTextureCode() {
        const key = this.spriteName.replace(/[^a-z0-9_]/g, '_');
        const url = `assets/${this.spriteName}.png`;

        return `
// In src/js/rendering/texture-loader.js:

// 1. Add to pixiTextures object (line ~5):
export const pixiTextures = {
    // ...
    ${key}: null,
};

// 2. Add image loader (after existing loaders):
const ${key}_URL = '${url}';
const ${key}Image = new Image();
${key}Image.decoding = 'async';
${key}Image.src = ${key}_URL;
let ${key}Loaded = false;

// 3. Add apply function:
export function apply${this._toPascalCase(key)}Texture() {
    if (!${key}Loaded || pixiTextures.${key} || !window.PIXI) return;
    try {
        const tex = PIXI.Texture.from(${key}Image);
        try { tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; } catch (e) { }
        try { tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON; } catch (e) { }

        pixiTextures.${key} = tex;
        pixiTextureAnchors.${key} = 0.5;
        pixiTextureRotOffsets.${key} = Math.PI / 2; // Adjust if needed
        pixiTextureScaleToRadius.${key} = true;
        pixiTextureBaseScales.${key} = 1;
    } catch (e) {
        console.error('Error loading ${key} texture:', e);
    }
}

// 4. Add event listeners:
${key}Image.addEventListener('load', () => {
    ${key}Loaded = true;
    apply${this._toPascalCase(key)}Texture();
});
${key}Image.addEventListener('error', () => {
    ${key}Loaded = false;
});

// 5. Add to loadAllTextures():
export function loadAllTextures() {
    // ...
    apply${this._toPascalCase(key)}Texture();
}

// Usage in entity:
// In constructor, after sprite creation:
// if (pixiTextures.${key}) {
//     this.sprite = new PIXI.Sprite(pixiTextures.${key});
//     this.sprite.anchor.set(0.5);
//     pixiEnemyLayer.addChild(this.sprite);
// }
`.trim();
    }

    _toPascalCase(str) {
        return str.replace(/(?:^|_)([a-z])/g, (_, c) => c.toUpperCase());
    }

    copyTextureCode() {
        const code = this.generateTextureCode();
        navigator.clipboard.writeText(code).then(() => {
            alert('Texture code copied to clipboard!');
        }).catch(() => {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = code;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            alert('Texture code copied to clipboard!');
        });
    }
}

// Global singleton
let spriteEditorInstance = null;

export function getSpriteEditor() {
    if (!spriteEditorInstance) {
        spriteEditorInstance = new SpriteEditor();
    }
    return spriteEditorInstance;
}

export function toggleSpriteEditor() {
    getSpriteEditor().toggle();
}
