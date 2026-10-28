import React, { useEffect, useRef, useState } from 'react';
import '../styles/AISearch.css';
import { aiSearchApi } from '../services/api.js';

const suggestions = [
  'cheap phones',
  'under 1000',
  'best electronics',
  'top rated books',
  'fashion for women',
  'premium watches',
  'beauty products',
  'sports fitness',
  'kitchen appliances',
  'top discount',
];

function AISearch({ onResults }) {
  const [query, setQuery] = useState('');
  const [resultLabel, setResultLabel] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resultCount, setResultCount] = useState(0);

  const activeRequest = useRef(null);
  const requestVersion = useRef(0);

  useEffect(() => {
    return () => {
      requestVersion.current += 1;
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, []);

  const resetSearch = () => {
    requestVersion.current += 1;
    activeRequest.current?.abort();
    activeRequest.current = null;

    setLoading(false);
    setError('');
    setResultLabel('');
    setHasSearched(false);
    setResultCount(0);

    onResults?.(null, '');
  };

  const handleClear = () => {
    resetSearch();
    setQuery('');
  };

  const handleQueryChange = (event) => {
    const value = event.target.value;

    // Invalidate pending results when the user edits the query.
    // A late response must not overwrite the new input's state.
    resetSearch();
    setQuery(value);
  };

  const runSearch = async (rawQuery) => {
    // Prevent repeated clicks or Enter presses from spending quota.
    if (activeRequest.current) return;

    const searchQuery = rawQuery.trim();

    if (searchQuery.length < 2 || searchQuery.length > 400) {
      setError('Enter a product search between 2 and 400 characters.');
      setHasSearched(false);
      setResultLabel('');
      onResults?.(null, '');
      return;
    }

    const controller = new AbortController();
    const version = ++requestVersion.current;

    activeRequest.current = controller;

    setLoading(true);
    setError('');
    setHasSearched(false);
    setResultLabel('');
    setResultCount(0);
    onResults?.(null, '');

    try {
      const response = await aiSearchApi.search(searchQuery, {
        signal: controller.signal,
      });

      if (
        controller.signal.aborted ||
        version !== requestVersion.current
      ) {
        return;
      }

      const data = response?.data;

      if (
        !data ||
        !Array.isArray(data.products) ||
        typeof data.label !== 'string' ||
        !['ai', 'catalog'].includes(data.source) ||
        (data.source === 'catalog' && data.products.length !== 0)
      ) {
        throw new Error(
          'AI search returned an invalid response. Please try again.'
        );
      }

      setResultLabel(data.label);
      setResultCount(data.products.length);
      setHasSearched(true);

      onResults?.(data.products, data.label);
    } catch (err) {
      if (
        controller.signal.aborted ||
        version !== requestVersion.current
      ) {
        return;
      }

      setError(
        err?.message ||
          'AI search is unavailable. Please use the regular search.'
      );
      setHasSearched(false);
      setResultLabel('');
      setResultCount(0);

      // Restore the normal catalog. No keyword fallback is
      // presented as an AI result.
      onResults?.(null, '');
    } finally {
      if (version === requestVersion.current) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  };

  const handleSearch = () => {
    void runSearch(query);
  };

  const handleKeyDown = (event) => {
    if (
      event.key === 'Enter' &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      handleSearch();
    }
  };

  const handleChipClick = (suggestion) => {
    if (activeRequest.current) return;

    setQuery(suggestion);
    void runSearch(suggestion);
  };

  return (
    <div className="ai-search-section" aria-busy={loading}>
      <div className="ai-search-header">
        <span className="ai-search-badge">✨ AI Search</span>
        <span className="ai-search-title">
          Smart Product Search
        </span>
        <span className="ai-search-subtitle"></span>
      </div>

      <div className="ai-search-input-row">
        <div className="ai-search-input-wrapper">
          <span className="ai-search-icon">🤖</span>

          <input
            type="text"
            className="ai-search-input"
            placeholder='Try "cheap shoes" or "gaming products" or "under 2000"'
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
            maxLength={400}
            aria-label="AI product search"
          />

          {query && (
            <button
              className="ai-search-clear-btn"
              onClick={handleClear}
              type="button"
              aria-label="Clear"
            >
              ✕
            </button>
          )}
        </div>

        <button
          className="ai-search-btn"
          onClick={handleSearch}
          type="button"
          disabled={loading || query.trim().length < 2}
        >
          {loading ? '⏳ Searching...' : '🔍 Search'}
        </button>
      </div>

      <div className="ai-suggestions-row">
        <span className="ai-suggestions-label">Try:</span>

        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            className="ai-suggestion-chip"
            onClick={() => handleChipClick(suggestion)}
            type="button"
            disabled={loading}
          >
            {suggestion}
          </button>
        ))}
      </div>

      {error && (
        <div
          className="ai-result-label"
          role="alert"
          style={{
            color: '#e53935',
            background: '#ffebee',
            borderColor: '#ffcdd2',
          }}
        >
          ⚠️ {error}

          <button
            className="ai-result-clear"
            onClick={handleClear}
            type="button"
          >
            ✕ Clear
          </button>
        </div>
      )}

      {hasSearched && !error && (
        <div
          className="ai-result-label"
          role="status"
          aria-live="polite"
          style={
            resultCount === 0
              ? {
                  color: '#e53935',
                  background: '#ffebee',
                  borderColor: '#ffcdd2',
                }
              : undefined
          }
        >
          {resultCount > 0 ? '✅' : '😕'} {resultLabel}

          <button
            className="ai-result-clear"
            onClick={handleClear}
            type="button"
          >
            ✕ Clear
          </button>
        </div>
      )}
    </div>
  );
}

export default AISearch;