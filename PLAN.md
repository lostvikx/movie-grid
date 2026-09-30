# Movie 3×3 Grid — Implementation Plan

## Objective

Build a responsive, static React website where users can search for movies, add up to nine posters to a 3×3 grid, rearrange posters by dragging, customize the grid background and spacing, view movie details, and download the grid as a PNG.

The site must be deployable to GitHub Pages without a backend.

## Product requirements

### Layout
- Desktop: movie search and grid settings on the left; 3×3 grid on the right.
- Mobile: stack the search/settings above the grid.
- Keep the grid at exactly three columns and three rows.
- Movie posters use a consistent portrait aspect ratio (2:3) and fill their slots with `object-fit: cover`.

### Movie search
- Use TMDB for movie search and details.
- Search by title and show a manageable number of results (for example, 5–10).
- Each result displays poster (or placeholder), title, release year, and an Add action.
- Debounce search input (approximately 300 ms).
- Ignore or cancel stale requests so older responses cannot overwrite newer results.
- Handle empty queries, loading, no results, API errors, and missing posters.
- Prevent duplicate movies in the grid.
- Disable adding when all nine slots are occupied.

### Grid editing
- Represent the grid as a fixed array of nine entries, each either a movie or `null`.
- Add a movie to the first empty slot.
- Removing a movie leaves that slot empty; do not shift other posters.
- Dragging a poster to an empty slot moves it.
- Dragging a poster to an occupied slot swaps the two posters.
- Dropping on the same slot or outside the grid makes no change.
- Empty slots are not draggable.
- Provide accessible alternatives to dragging where practical, such as move controls or keyboard support.

### Movie details
- Clicking a poster opens a modal with poster, title, release year, overview, and rating when available.
- Fetch full details by TMDB movie ID if the search result lacks required details.
- Cache fetched details in memory to avoid redundant requests during the session.
- Modal supports close button and Escape; manage focus appropriately.

### Customization
- Provide a background color picker with a few presets.
- Provide a spacing slider.
- Use shared CSS variables or equivalent so editor and export use the same settings.
- Keep the grid dimensions and poster ratio fixed.

### PNG export
- Export only the grid, not the search panel or controls.
- Include the selected background and spacing.
- Download as `movie-grid.png`.
- Disable download until all nine slots are filled.
- Show a loading state while generating and a useful error if export fails.
- Use a dedicated export container with a consistent width (for example, 1200 px) so output dimensions do not depend on viewport size.
- Verify poster images can be captured from TMDB's image CDN; handle cross-origin failures explicitly.

### Persistence
- Do not add accounts, a database, cloud storage, or automatic grid persistence.
- The grid only needs to exist for the current browser session.

## Recommended stack

- React + TypeScript
- Vite
- Plain CSS (avoid adding a UI framework unless necessary)
- TMDB API for search, posters, and details
- `@dnd-kit/core` and `@dnd-kit/sortable` for drag-and-drop
- `html-to-image` for PNG export
- Vitest, React Testing Library, `@testing-library/user-event`, `@testing-library/jest-dom`, and `jsdom` for tests

Use React state/hooks; Redux or another global state library is unnecessary for this scope.

## Suggested project structure

Adapt to the repository if it already has a structure. Do not overwrite existing project conventions without inspecting them first.

```text
src/
  components/
    MovieSearch.tsx
    SearchResults.tsx
    MovieCard.tsx
    MovieDetailsModal.tsx
    MovieGrid.tsx
    GridSlot.tsx
    GridSettings.tsx
    DownloadButton.tsx
  hooks/
    useMovieSearch.ts
  services/
    tmdb.ts
  types/
    movie.ts
  App.tsx
  main.tsx
  styles.css
```

Keep the implementation compact. Combine components if splitting them would add unnecessary complexity.

## Data model and state

Use a movie type similar to:

```ts
type Movie = {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  overview?: string;
  vote_average?: number;
};

type GridState = (Movie | null)[];
```

Initialize the grid with nine empty entries. Keep the main grid, background, spacing, and selected movie state in `App` or a small custom hook. Keep search query/results/loading/error local to the search feature.

All grid updates must be immutable.

Implement and test small pure functions for:
- Adding a movie to the first empty slot, while rejecting duplicates and a full grid.
- Removing a movie by slot index.
- Moving a movie to an empty slot.
- Swapping movies between occupied slots.

## TMDB integration

Create a small service module with functions such as:
- `searchMovies(query)`
- `getMovieDetails(id)`
- `getPosterUrl(path)`

Use TMDB's documented search and movie-details endpoints. Use a suitable poster size such as `w500`. Build URLs safely and handle `null` poster paths.

Configuration:
- Read the API key from `import.meta.env.VITE_TMDB_API_KEY`.
- Provide `.env.example` with a placeholder.
- Ensure `.env` is ignored by Git.
- Never commit a real API key.

Important: Vite client environment variables are embedded in the public bundle. A key used by a GitHub Pages site is visible to visitors; do not treat it as secret. Use a key intended for browser use, follow TMDB's current terms and attribution requirements, and document this limitation. If key secrecy is required, GitHub Pages alone is insufficient; a backend or serverless proxy would be needed.

## Implementation sequence

### Phase 1 — Inspect and scaffold
1. Inspect the existing repository and its conventions before changing files.
2. Create or adapt a Vite React TypeScript application.
3. Add only the required dependencies.
4. Set up the basic responsive two-column layout.
5. Add global styles and CSS variables.

**Acceptance:** The app starts locally and displays the intended desktop/mobile layout.

### Phase 2 — Movie search
1. Implement typed TMDB response models and API service functions.
2. Implement debounced search.
3. Handle stale requests and all loading/empty/error states.
4. Render results with poster placeholders and Add controls.

**Acceptance:** Searching returns current results; stale responses do not replace newer results; failures are understandable.

### Phase 3 — Grid operations
1. Render exactly nine slots.
2. Implement add-to-first-empty-slot and removal.
3. Prevent duplicates and enforce the nine-movie limit.
4. Add empty-slot and missing-poster placeholders.

**Acceptance:** Users can fill, remove, and refill slots without unexpected reordering.

### Phase 4 — Drag-and-drop
1. Integrate dnd-kit with each slot as a drop target.
2. Implement move-to-empty and swap-with-occupied behavior.
3. Handle same-slot and cancelled/outside drops safely.
4. Add drag feedback and keyboard/touch accessibility.

**Acceptance:** All specified move and swap behaviors work reliably.

### Phase 5 — Details and settings
1. Implement the movie details modal.
2. Fetch missing details and cache them in memory.
3. Add background presets/color picker and spacing slider.
4. Verify responsive layout and modal accessibility.

**Acceptance:** Clicking a poster opens the correct details; settings update the grid immediately.

### Phase 6 — PNG export
1. Create a dedicated export target independent of the editor layout.
2. Render the grid at a consistent export width.
3. Use `html-to-image` to generate a PNG.
4. Trigger a browser download with filename `movie-grid.png`.
5. Add loading, disabled, and error states.
6. Test with real TMDB poster URLs and verify all posters/background/spacing appear.

**Acceptance:** A full grid downloads as a correctly rendered PNG at a consistent size.

### Phase 7 — Tests and deployment
1. Add unit tests for grid operations.
2. Add component tests for search, add/remove, modal, settings, and export states where practical.
3. Test desktop and mobile layouts.
4. Configure Vite's `base` for the GitHub Pages repository path (unless using a custom domain/user site).
5. Add a GitHub Actions workflow to build and deploy `dist` to GitHub Pages.
6. Verify the deployed site, API requests, poster loading, and PNG export.

**Acceptance:** Tests pass, production build succeeds, and the deployed static site works.

## Testing checklist

- Search: valid query, blank query, no results, API failure, stale response.
- Posters: missing poster and failed image load.
- Grid: add, remove, refill, duplicate prevention, full grid.
- Dragging: move to empty, swap occupied, same slot, cancelled drag, touch/keyboard behavior.
- Details: correct movie, loading/error state, close button, Escape, focus handling.
- Settings: background and spacing update the editor and export.
- Export: disabled until full, correct 3×3 composition, consistent dimensions, correct filename, failure feedback, cross-origin image behavior.
- Deployment: correct base path, production build, API and CDN requests on GitHub Pages.

## Scope control

Do not add features outside the requirements unless they are necessary for correctness or accessibility. In particular, omit:
- User accounts or authentication
- Database or cloud storage
- Persistent grid saving/importing
- Multiple grid sizes
- Social sharing
- Unrequested frameworks or state-management libraries

## Coding-agent instructions

- First inspect the repository, existing files, package manager, and current implementation.
- Follow existing conventions where reasonable; do not replace working code unnecessarily.
- Implement in small, reviewable steps, following the phases above.
- Keep code concise and avoid unnecessary abstractions or dependencies.
- Do not invent API fields or assume API behavior; consult current TMDB documentation when needed.
- Add tests for grid operations and important user-facing behavior.
- Run the relevant tests and production build; fix failures before declaring completion.
- Do not claim deployment is complete unless the GitHub Pages workflow and deployed site have been verified.
- Document required setup, including TMDB key configuration, public-key exposure, local development, testing, and deployment.
- If a requirement is ambiguous or blocked by missing credentials, explain the issue and ask only for the information needed to proceed.
