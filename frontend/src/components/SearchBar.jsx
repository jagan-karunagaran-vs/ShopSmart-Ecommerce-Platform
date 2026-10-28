import React, { useState, useEffect } from 'react';
import '../styles/SearchBar.css';

function SearchBar({ value = '', onChange, placeholder }) {

  const [localValue, setLocalValue] = useState(value);

  // ── Sync when parent resets value (e.g. Clear Filters button) ──
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // ── Fire onChange on every single keystroke (live search) ──
  const handleChange = (e) => {
    const query = e.target.value;
    setLocalValue(query);
    if (onChange) onChange(query);
  };

  // ── Escape key clears the search ─────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setLocalValue('');
      if (onChange) onChange('');
    }
  };

  // ── Clear (✕) button click ────────────────────────────────
  const handleClear = () => {
    setLocalValue('');
    if (onChange) onChange('');
  };

  return (
    <div className="searchbar-wrapper">

      {/* Search icon on the left */}
      <span className="searchbar-icon">🔍</span>

      {/* Text input */}
      <input
        type="text"
        className="searchbar-input"
        placeholder={placeholder || 'Search products, categories...'}
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        spellCheck={false}
      />

      {/* Clear button — only shows when there is text */}
      {localValue && (
        <button
          className="searchbar-clear-btn"
          onClick={handleClear}
          aria-label="Clear search"
          type="button"
        >
          ✕
        </button>
      )}

    </div>
  );
}

export default SearchBar;