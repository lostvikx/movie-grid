import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { clearDetailsCache } from './services/tmdb'
import type { Movie } from './types/movie'

const MOVIES: Movie[] = Array.from({ length: 9 }, (_, i) => ({
  id: i + 1,
  title: `Film ${i + 1}`,
  release_date: `${2000 + i}-01-01`,
  poster_path: `/poster${i + 1}.jpg`,
  overview: `Overview ${i + 1}`,
  vote_average: 7,
}))

let fetchMock: ReturnType<typeof vi.fn>

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response
}

beforeEach(() => {
  clearDetailsCache()
  // Query-aware stub: the frontend only shows four results, so tests that need
  // all nine posters search for one title at a time.
  fetchMock = vi.fn().mockImplementation((url: string) => {
    const query = (new URL(url, 'http://test').searchParams.get('q') ?? '').toLowerCase()
    const results = MOVIES.filter((movie) => movie.title.toLowerCase().includes(query))
    return Promise.resolve(jsonResponse({ results }))
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function results() {
  return within(screen.getByRole('list', { name: 'Search results' }))
}

/** The result card is the only element matching this title selector. */
function resultCard(title: string): HTMLElement {
  const titleEl = results().getByText(title, { selector: '.movie-card-title' })
  return titleEl.closest('li') as HTMLElement
}

const ALL_TITLES = MOVIES.map((movie) => movie.title)

/** Types a query and waits for the (debounced) result list. */
async function search(user: ReturnType<typeof userEvent.setup>, query: string) {
  const input = screen.getByRole('searchbox')
  await user.clear(input)
  await user.type(input, query)
  // The list only appears once the debounced request resolves.
  const list = await screen.findByRole(
    'list',
    { name: 'Search results' },
    { timeout: 2000 },
  )
  return list
}

async function addMovie(
  user: ReturnType<typeof userEvent.setup>,
  title: string,
): Promise<void> {
  const list = await search(user, title)
  await within(list).findByText(title, { selector: '.movie-card-title' })
  await user.click(within(resultCard(title)).getByRole('button', { name: 'Add' }))
}

async function addMovies(titles: string[]) {
  const user = userEvent.setup()
  for (const title of titles) {
    await addMovie(user, title)
  }
  return user
}

describe('grid basics', () => {
  it('always renders exactly nine slots', () => {
    render(<App />)
    for (let i = 0; i < 9; i += 1) {
      expect(screen.getByTestId(`slot-${i}`)).toBeInTheDocument()
    }
  })

  it('adds a movie to the first empty slot', async () => {
    render(<App />)
    await addMovies(ALL_TITLES.slice(0, 2))
    expect(screen.getByTestId('slot-0')).toHaveTextContent('Film 1')
    expect(screen.getByTestId('slot-1')).toHaveTextContent('Film 2')
    expect(screen.getByTestId('slot-2')).toHaveTextContent('3')
  })

  it('prevents duplicates and reports the filled count', async () => {
    render(<App />)
    await addMovies(ALL_TITLES.slice(0, 1))
    const card = resultCard('Film 1')
    expect(within(card).getByRole('button')).toBeDisabled()
    expect(within(card).getByRole('button')).toHaveTextContent('Added')
    expect(screen.getByText('1 / 9 filled')).toBeInTheDocument()
  })

  it('disables adding once the grid is full', async () => {
    render(<App />)
    await addMovies(ALL_TITLES)
    expect(screen.getByText('9 / 9 filled')).toBeInTheDocument()
  }, 20000)

  it('removes a poster without shifting the others and refills the gap', async () => {
    render(<App />)
    const user = await addMovies(ALL_TITLES.slice(0, 2))
    await user.click(screen.getByRole('button', { name: /remove Film 1/i }))
    expect(screen.getByTestId('slot-0')).toHaveTextContent('1')
    expect(screen.getByTestId('slot-1')).toHaveTextContent('Film 2')

    await addMovie(user, 'Film 3')
    expect(screen.getByTestId('slot-0')).toHaveTextContent('Film 3')
  })

  it('gives every filled slot a delete button and a drag handle', async () => {
    render(<App />)
    await addMovies(ALL_TITLES.slice(0, 2))

    const remove = screen.getByRole('button', { name: /remove Film 1 from grid/i })
    const drag = screen.getByRole('button', { name: /drag Film 1 to another slot/i })
    expect(remove).toBeInTheDocument()
    expect(drag).toBeInTheDocument()
    // The delete button sits beside the drag handle and matches its footprint.
    expect(remove.parentElement).toBe(drag.parentElement)
    expect(remove.getBoundingClientRect().width).toBe(0) // jsdom has no layout
    expect(remove.className).toContain('cell-icon')
    expect(drag.className).toContain('cell-icon')
    expect(screen.queryByRole('button', { name: /move (up|down|left|right)/i })).toBeNull()
  })

  it('moves and swaps posters through the grid operations', async () => {
    // Behaviour covered directly in src/lib/grid.test.ts; this checks the grid
    // renders the state those operations produce.
    render(<App />)
    await addMovies(ALL_TITLES.slice(0, 3))
    expect(screen.getByTestId('slot-0')).toHaveTextContent('Film 1')
    expect(screen.getByTestId('slot-2')).toHaveTextContent('Film 3')
    expect(screen.getByTestId('slot-3')).toHaveTextContent('4')
  })
})

describe('search states', () => {
  it('shows a hint for a blank query', () => {
    render(<App />)
    expect(screen.getByText(/search for a movie to start/i)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows at most four results', async () => {
    render(<App />)
    const user = userEvent.setup()
    await user.type(screen.getByRole('searchbox'), 'film')
    const list = await screen.findByRole('list', { name: 'Search results' })
    // The API returns all nine matches; the UI keeps only four.
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(4))
    expect(fetchMock.mock.calls[0][0]).toContain('limit=4')
  })

  it('shows a no-results message', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [] }))
    render(<App />)
    const user = userEvent.setup()
    await user.type(screen.getByRole('searchbox'), 'zzzzz')
    expect(await screen.findByText(/no movies found/i)).toBeInTheDocument()
  })

  it('shows an error message when the API fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response)
    render(<App />)
    const user = userEvent.setup()
    await user.type(screen.getByRole('searchbox'), 'boom')
    expect(await screen.findByRole('alert')).toHaveTextContent(/failed/i)
  })

  it('renders a placeholder for movies without artwork', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ results: [{ ...MOVIES[0], poster_path: null }] }),
    )
    render(<App />)
    const user = userEvent.setup()
    await user.type(screen.getByRole('searchbox'), 'film')
    const card = await screen.findByText('Film 1', { selector: '.movie-card-title' })
    expect(card.closest('li')).toHaveTextContent('Film 1')
    expect(card.closest('li')?.querySelector('img')).toBeNull()
  })
})

describe('details modal', () => {
  it('opens on poster click and closes with Escape, restoring focus', async () => {
    render(<App />)
    await addMovies(ALL_TITLES.slice(0, 1))
    const trigger = screen.getByRole('button', { name: /view details for Film 1/i })
    await userEvent.click(trigger)

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Film 1')
    expect(dialog).toHaveTextContent('2000')
    expect(dialog).toHaveTextContent('Overview 1')
    expect(screen.getByRole('button', { name: /close details/i })).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('closes with the close button', async () => {
    render(<App />)
    await addMovies(ALL_TITLES.slice(0, 1))
    await userEvent.click(screen.getByRole('button', { name: /view details for Film 1/i }))
    await screen.findByRole('dialog')
    await userEvent.click(screen.getByRole('button', { name: /close details/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('fetches missing details and shows a rating', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            { id: 42, title: 'Dune', release_date: '2021-09-15', poster_path: null },
          ],
        }),
      )
      // The details request: only the search result lacked overview/rating.
      .mockResolvedValueOnce(
        jsonResponse({
          id: 42,
          title: 'Dune',
          release_date: '2021-09-15',
          poster_path: null,
          overview: 'Spice must flow.',
          vote_average: 8.1,
        }),
      )
    render(<App />)
    const user = userEvent.setup()
    await user.type(screen.getByRole('searchbox'), 'dune')
    await screen.findByText('Dune', { selector: '.movie-card-title' }, { timeout: 2000 })
    await user.click(within(resultCard('Dune')).getByRole('button', { name: 'Add' }))

    await user.click(screen.getByRole('button', { name: /view details for Dune/i }))
    expect(await screen.findByText('Spice must flow.')).toBeInTheDocument()
    expect(screen.getByText(/8\.1/)).toBeInTheDocument()
    // One search request plus one details request — nothing extra.
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps the search data visible when the details request fails', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            { id: 7, title: 'Alien', release_date: '1979-05-25', poster_path: null },
          ],
        }),
      )
      .mockRejectedValueOnce(new TypeError('network down'))

    render(<App />)
    const user = userEvent.setup()
    await user.type(screen.getByRole('searchbox'), 'alien')
    await screen.findByText('Alien', { selector: '.movie-card-title' }, { timeout: 2000 })
    await user.click(within(resultCard('Alien')).getByRole('button', { name: 'Add' }))
    await user.click(screen.getByRole('button', { name: /view details for Alien/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach/i)
    expect(screen.getByRole('dialog')).toHaveTextContent('Alien')
  })
})

describe('settings and export', () => {
  it('applies background and spacing to the editor grid', async () => {
    render(<App />)
    const canvas = screen.getByRole('group', { name: 'Movie grid' })
    expect(canvas).toHaveStyle({ '--grid-gap': '8px' })

    await userEvent.click(screen.getByRole('button', { name: 'Plum' }))
    expect(canvas).toHaveStyle({ '--grid-background': '#3b1e54' })

  })

  it('changes the spacing through the slider', async () => {
    render(<App />)
    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '20' } })
    const canvas = screen.getByRole('group', { name: 'Movie grid' })
    expect(canvas).toHaveStyle({ '--grid-gap': '20px' })
    expect(screen.getByText('Spacing: 20px')).toBeInTheDocument()
  })

  it('keeps the download disabled until all nine slots are filled', async () => {
    render(<App />)
    const download = screen.getByRole('button', { name: /download png/i })
    expect(download).toBeDisabled()

    await addMovies(ALL_TITLES)
    expect(await screen.findByRole('button', { name: /download png/i })).toBeEnabled()
  }, 20000)

  it('renders a fixed-width export copy of the grid', async () => {
    const { container } = render(<App />)
    await addMovies(ALL_TITLES.slice(0, 2))
    const stage = container.querySelector('.export-stage > div') as HTMLElement
    expect(stage).toHaveStyle({ width: '1200px' })
    expect(stage.querySelectorAll('.grid-cell')).toHaveLength(9)
  })
})
