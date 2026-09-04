/*--------------------
    Coloring
    --------------------*/
export function hexToRgb(hex: string) {
  return hex.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i
    , (_m, r, g, b) => '#' + r + r + g + g + b + b)
    .substring(1).match(/.{2}/g)!
    .map(x => parseInt(x, 16));
}

export function generateRandomColor(Options?: 'rgb' | 'hex' | 'rgba', alpha?: number, ColorSets?: string[]) {
  const defaultColorSets = ColorSets ? ColorSets : [
    '#ff3700', '#ef9b26', '#fcf014', '#6cfc14', '#14f4fc',
    '#ac68ff', '#ff68d6', '#c9b7ff', '#2d8afc', '#f6b2ff'
  ];

  const randomColor = defaultColorSets[Math.floor(Math.random() * defaultColorSets.length)];

  if (!Options || Options === 'hex') {
    return randomColor;
  } else if (Options === 'rgb') {
    const rgb = hexToRgb(randomColor);
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  } else if (Options === 'rgba') {
    const rgb = hexToRgb(randomColor);
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha ? alpha : 0})`;
  }

}

export function hexToRgba(hex: string, alpha?: number) {
  const rgb = hex.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i
    , (_m, r, g, b) => '#' + r + r + g + g + b + b)
    .substring(1).match(/.{2}/g)!
    .map(x => parseInt(x, 16));

  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha ? alpha : 0})`;
}
