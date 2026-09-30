import { useState } from 'react'
import { useMovieSearch } from '../hooks/useMovieSearch'
import type { Movie } from '../types/movie'
import { SearchResults } from './SearchResults'

type Props = {
  gridIds: number[]
  isGridFull: boolean
  onAdd: (movie: Movie) => void
}

export function MovieSearch({ gridIds, isGridFull, onAdd }: Props) {
  const [query, setQuery] = useState('')
  const { results, loading, error } = useMovieSearch(query)

  return (
    <section className="panel" aria-labelledby="search-heading">
      <h2 id="search-heading" className="panel-title">
        Find movies
      </h2>
      <label className="field">
        <span className="field-label">Movie title</span>
        <input
          className="input"
          type="search"
          value={query}
          placeholder="e.g. Interstellar"
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <SearchResults
        query={query}
        results={results}
        loading={loading}
        error={error}
        gridIds={gridIds}
        isGridFull={isGridFull}
        onAdd={onAdd}
      />
    </section>
  )
}
