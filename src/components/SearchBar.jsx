import { useEffect, useRef, useState } from 'react'

/**
 * Location search with Enter-to-submit and a submit button.
 *
 * The hook already debounces requests, so this component's job is just to
 * capture intent. Submitting the form flushes immediately rather than waiting
 * out the debounce, which is what makes the button feel responsive.
 */
export function SearchBar({ onSearch, onSubmit, searching, disabled }) {
  const [value, setValue] = useState('')
  const inputRef = useRef(null)

  // Let the parent flush a pending debounced search when Enter is pressed.
  const latestOnSearch = useRef(onSearch)
  latestOnSearch.current = onSearch

  useEffect(() => {
    // Autofocus when we fall back to manual search, so the user can type at once.
    if (!disabled) inputRef.current?.focus()
  }, [disabled])

  const handleSubmit = (event) => {
    event.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onSubmit?.(trimmed)
  }

  const handleChange = (event) => {
    setValue(event.target.value)
    latestOnSearch.current?.(event.target.value)
  }

  return (
    <form className="search-bar" onSubmit={handleSubmit} role="search">
      <label className="visually-hidden" htmlFor="location-search">
        Search for a city, postcode or address
      </label>
      <div className="search-bar__field">
        <svg className="search-bar__icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6.4" fill="none" strokeWidth="2" />
          <line x1="15.8" y1="15.8" x2="20" y2="20" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          id="location-search"
          ref={inputRef}
          className="search-bar__input"
          type="text"
          inputMode="search"
          autoComplete="off"
          placeholder="Search for a city"
          value={value}
          onChange={handleChange}
          disabled={disabled}
        />
      </div>
      <button className="button button--primary" type="submit" disabled={disabled || !value.trim()}>
        {searching ? 'Searching…' : 'Search'}
      </button>
    </form>
  )
}
