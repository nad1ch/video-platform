
export const NADRAW_TOOLBAR_COLORS = [
  '#000000',
  '#ffffff',
  '#0654b9',
  '#4e7406',
  '#a90202',
  '#a99602',
  '#7a02a9',
  '#653702',
  '#bf9361',
] as const

export const NADRAW_BRUSH_SIZES = [1, 2, 3, 5, 8, 12, 18, 28] as const

export type NadrawCanvasTool = 'pencil' | 'erase' | 'fill' | 'rect' | 'ellipse'
