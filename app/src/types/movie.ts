export type Movie = {
  id: number
  title: string
  release_date: string
  poster_path: string | null
  overview?: string
  vote_average?: number
}

/** A fixed 3x3 grid of slots; each slot holds a movie or is empty. */
export type Grid = (Movie | null)[]

export const GRID_SIZE = 9

/** Background presets offered in the settings panel. */
export const BACKGROUND_PRESETS = [
  { label: 'Charcoal', value: '#18181b' },
  { label: 'Midnight', value: '#0f172a' },
  { label: 'Plum', value: '#3b1e54' },
  { label: 'Forest', value: '#12352a' },
  { label: 'Sand', value: '#e7e2d4' },
  { label: 'White', value: '#ffffff' },
] as const

export const MIN_SPACING = 0
export const MAX_SPACING = 40
