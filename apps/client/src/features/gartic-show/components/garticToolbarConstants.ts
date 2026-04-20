/** Ten core swatches; custom color via color picker in toolbar. */
export const GARTIC_TOOLBAR_COLORS = [
  '#000000',
  '#ffffff',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#0891b2',
  '#2563eb',
  '#7c3aed',
  '#db2777',
] as const

export const GARTIC_BRUSH_SIZES = [1, 2, 3, 5, 8, 12, 18, 28] as const

export type GarticCanvasTool = 'pencil' | 'erase' | 'fill' | 'rect' | 'ellipse'
