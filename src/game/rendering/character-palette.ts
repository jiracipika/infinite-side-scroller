/** Ansley's complexion is shared by the ink and pixel alternatives. The
 * painted figure carries the same warm brown complexion in its source art. */
export const ANSLEY_SKIN = '#93563d';

// Authored face regions in the six original 32px pixel poses. The paper-white
// socks, earbuds, parasol and outfit highlights keep their original colors.
const ANSLEY_PIXEL_FACES = [[16, 6, 21, 10], [19, 6, 24, 10], [15, 4, 20, 9],
  [22, 12, 27, 16], [17, 5, 22, 9], [16, 7, 21, 10]] as const;

export function applyCharacterSheetPalette(id: string, rgba: Uint8ClampedArray, width: number): void {
  if (id !== 'cherry' || width !== 192 || rgba.length !== 192 * 32 * 4) return;
  ANSLEY_PIXEL_FACES.forEach(([left, top, right, bottom], frame) => {
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
      const i = (y * width + frame * 32 + x) * 4;
      if (rgba[i] === 244 && rgba[i + 1] === 242 && rgba[i + 2] === 237 && rgba[i + 3] > 0) {
        rgba[i] = 147; rgba[i + 1] = 86; rgba[i + 2] = 61;
      }
    }
  });
}
