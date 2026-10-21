import React, { useState, useRef, useId, useCallback } from 'react';
import './GlobalSearchBar.css';

/**
 * GlobalSearchBar — accessible combobox search component.
 *
 * ARIA pattern: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
 *
 * Keyboard navigation:
 *   ArrowDown  — move focus to next result (wraps)
 *   ArrowUp    — move focus to previous result (wraps)
 *   Enter      — select the highlighted result
 *   Escape     — clear query and close results
 *   Home       — jump to first result
 *   End        — jump to last result
 *
 * @param {{
 *   onSearch: (query: string) => Promise<Array<{id:string, label:string, sublabel?:string}>>,
 *   onSelect: (item: {id:string, label:string}) => void,
 *   placeholder?: string
 * }} props
 */
export default function GlobalSearchBar({
  onSearch,
  onSelect,
  placeholder = 'Search payments, merchants, orders…',
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Stable IDs for ARIA associations
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const getOptionId = (index) => `${baseId}-option-${index}`;

  // Close the dropdown and reset active item
  const close = useCallback(() => {
    setIsOpen(false);
    setActiveIndex(-1);
  }, []);

  // Run search, debounced by the caller if needed
  const handleChange = useCallback(
    async (e) => {
      const value = e.target.value;
      setQuery(value);
      setActiveIndex(-1);

      if (!value.trim()) {
        setResults([]);
        setIsOpen(false);
        setStatusMsg('');
        return;
      }

      setIsLoading(true);
      try {
        const items = await onSearch(value);
        setResults(items);
        setIsOpen(true);
        setStatusMsg(
          items.length === 0
            ? 'No results found.'
            : `${items.length} result${items.length === 1 ? '' : 's'} available.`
        );
      } catch {
        setResults([]);
        setIsOpen(false);
        setStatusMsg('Search failed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [onSearch]
  );

  const selectItem = useCallback(
    (item) => {
      setQuery(item.label);
      close();
      setStatusMsg(`Selected: ${item.label}`);
      onSelect(item);
    },
    [close, onSelect]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen && e.key !== 'ArrowDown') return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (!isOpen && results.length > 0) {
            setIsOpen(true);
            setActiveIndex(0);
          } else {
            setActiveIndex((prev) =>
              prev < results.length - 1 ? prev + 1 : 0
            );
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) =>
            prev > 0 ? prev - 1 : results.length - 1
          );
          break;

        case 'Home':
          e.preventDefault();
          setActiveIndex(0);
          break;

        case 'End':
          e.preventDefault();
          setActiveIndex(results.length - 1);
          break;

        case 'Enter':
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < results.length) {
            selectItem(results[activeIndex]);
          }
          break;

        case 'Escape':
          e.preventDefault();
          setQuery('');
          setResults([]);
          close();
          setStatusMsg('');
          inputRef.current?.focus();
          break;

        default:
          break;
      }
    },
    [isOpen, results, activeIndex, selectItem, close]
  );

  // Scroll the active option into view
  React.useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const option = listRef.current.querySelector(
      `[id="${getOptionId(activeIndex)}"]`
    );
    option?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="gsb" role="search">
      {/* Hidden live region — announces result count to screen readers */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="gsb__sr-only"
      >
        {statusMsg}
      </div>

      <div className="gsb__input-wrap">
        <input
          ref={inputRef}
          id={`${baseId}-input`}
          className="gsb__input"
          type="search"
          autoComplete="off"
          spellCheck="false"
          placeholder={placeholder}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={(e) => {
            // Delay close so a mouse click on an option fires first
            if (!e.currentTarget.closest('.gsb')?.contains(e.relatedTarget)) {
              setTimeout(close, 150);
            }
          }}
          /* ── ARIA combobox attributes ── */
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={
            activeIndex >= 0 ? getOptionId(activeIndex) : undefined
          }
          aria-label="Global search"
          aria-busy={isLoading}
        />
        {isLoading && (
          <span className="gsb__spinner" aria-hidden="true" />
        )}
      </div>

      {isOpen && results.length > 0 && (
        <ul
          ref={listRef}
          id={listboxId}
          className="gsb__listbox"
          role="listbox"
          aria-label="Search results"
        >
          {results.map((item, index) => (
            <li
              key={item.id}
              id={getOptionId(index)}
              role="option"
              aria-selected={index === activeIndex}
              className={`gsb__option${index === activeIndex ? ' gsb__option--active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault(); // keep input focused
                selectItem(item);
              }}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <span className="gsb__option-label">{item.label}</span>
              {item.sublabel && (
                <span className="gsb__option-sublabel">{item.sublabel}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
