/**
 * Color Utilities
 * Convert CSS colors to PixiJS hex format.
 */

/**
 * Convert a CSS color string or number to PixiJS hex format.
 * Supports: hex (#rgb, #rrggbb), 0xrrggbb, rgb(), rgba(), and named colors.
 * @param {string|number} c - Color to convert
 * @returns {number} PixiJS-compatible hex color
 */
export function colorToPixi(c) {
    if (typeof c === 'number' && Number.isFinite(c)) return (c >>> 0);
    if (typeof c !== 'string') return 0xffffff;

    const s = c.trim().toLowerCase();
    if (!s) return 0xffffff;

    // #rgb / #rgba / #rrggbb / #rrggbbaa
    if (s.startsWith('#')) {
        const hex = s.slice(1);
        if (hex.length === 3 || hex.length === 4) {
            const r = parseInt(hex[0] + hex[0], 16);
            const g = parseInt(hex[1] + hex[1], 16);
            const b = parseInt(hex[2] + hex[2], 16);
            if (![r, g, b].some(Number.isNaN)) return (r << 16) | (g << 8) | b;
        } else if (hex.length === 6 || hex.length === 8) {
            const v = parseInt(hex.slice(0, 6), 16);
            if (!Number.isNaN(v)) return v;
        }
    }

    // 0xrrggbb
    if (s.startsWith('0x')) {
        const v = parseInt(s.slice(2), 16);
        if (!Number.isNaN(v)) return v;
    }

    // rgb(...) / rgba(...)
    const m = s.match(/^rgba?\(\s*([0-9.]+%?)\s*,\s*([0-9.]+%?)\s*,\s*([0-9.]+%?)(?:\s*,\s*([0-9.]+)\s*)?\)$/);
    if (m) {
        const to255 = (v) => {
            if (v.endsWith('%')) return Math.max(0, Math.min(255, Math.round(parseFloat(v) * 2.55)));
            return Math.max(0, Math.min(255, Math.round(parseFloat(v))));
        };
        const r = to255(m[1]);
        const g = to255(m[2]);
        const b = to255(m[3]);
        return (r << 16) | (g << 8) | b;
    }

    // Named colors
    const named = {
        white: 0xffffff,
        black: 0x000000,
        red: 0xff0000,
        green: 0x00ff00,
        blue: 0x0000ff,
        yellow: 0xffff00,
        cyan: 0x00ffff,
        magenta: 0xff00ff,
        orange: 0xff8800
    };
    if (s in named) return named[s];

    return 0xffffff;
}

/**
 * Convert PixiJS hex to CSS color string.
 * @param {number} hex - PixiJS hex color
 * @returns {string} CSS hex color string
 */
export function pixiToCSS(hex) {
    return '#' + (hex & 0xffffff).toString(16).padStart(6, '0');
}

/**
 * Interpolate between two colors.
 * @param {number} c1 - Start color (hex)
 * @param {number} c2 - End color (hex)
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number} Interpolated hex color
 */
export function lerpColor(c1, c2, t) {
    const r1 = (c1 >> 16) & 0xff;
    const g1 = (c1 >> 8) & 0xff;
    const b1 = c1 & 0xff;

    const r2 = (c2 >> 16) & 0xff;
    const g2 = (c2 >> 8) & 0xff;
    const b2 = c2 & 0xff;

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return (r << 16) | (g << 8) | b;
}
