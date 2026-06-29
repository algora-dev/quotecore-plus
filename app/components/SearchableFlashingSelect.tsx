'use client';

/**
 * Searchable dropdown for picking a flashing/drawing from the library.
 *
 * Replaces the plain <select> that listed every flashing with no filtering.
 * When a user has many drawings, scrolling a native dropdown is painful.
 * This component renders a text input that filters the list as you type,
 * with grouped results (linked component flashings first, then all others).
 *
 * The onSelect callback receives the flashing id (or undefined for "None"),
 * matching the old <select> onChange contract so call sites stay simple.
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import type { FlashingLibraryRow } from '@/app/lib/types';

interface Props {
  /** All flashings available to the company. */
  flashings: FlashingLibraryRow[];
  /** Currently selected flashing id, or undefined for "None". */
  value?: string;
  /** Called when the user picks a flashing (or clears it). */
  onChange: (flashingId: string | undefined) => void;
  /** Optional: flashings that are linked to the current component.
   *  When provided, these are shown in a separate "Component Flashings" group
   *  at the top of the list. */
  linkedFlashingIds?: string[];
  /** Label text for the field. */
  label?: string;
  /** Size variant: "sm" for inline editors, "md" for modals. */
  size?: 'sm' | 'md';
  /** Optional placeholder for the search input. */
  placeholder?: string;
}

export function SearchableFlashingSelect({
  flashings,
  value,
  onChange,
  linkedFlashingIds,
  label,
  size = 'sm',
  placeholder = 'Search drawings & images...',
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = value ? flashings.find((f) => f.id === value) : undefined;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Filter by search term
  const filtered = useMemo(() => {
    if (!search.trim()) return flashings;
    const q = search.toLowerCase();
    return flashings.filter((f) => f.name.toLowerCase().includes(q));
  }, [flashings, search]);

  // Split into groups
  const { linked, others } = useMemo(() => {
    if (!linkedFlashingIds || linkedFlashingIds.length === 0) {
      return { linked: [], others: filtered };
    }
    return {
      linked: filtered.filter((f) => linkedFlashingIds.includes(f.id)),
      others: filtered.filter((f) => !linkedFlashingIds.includes(f.id)),
    };
  }, [filtered, linkedFlashingIds]);

  function handleSelect(id: string | undefined) {
    onChange(id);
    setOpen(false);
    setSearch('');
  }

  const isSm = size === 'sm';
  const inputClasses = isSm
    ? 'w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500 cursor-pointer'
    : 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 cursor-pointer';
  const itemClasses = isSm
    ? 'px-2 py-1.5 text-xs cursor-pointer hover:bg-orange-50'
    : 'px-3 py-2 text-sm cursor-pointer hover:bg-orange-50';

  return (
    <div className="relative" ref={containerRef}>
      {label && (
        <label className={`block ${isSm ? 'text-xs' : 'text-sm'} text-slate-600 mb-1`}>{label}</label>
      )}
      {/* Click-to-open display */}
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className={`${inputClasses} flex items-center justify-between bg-white`}
      >
        <span className={selected ? 'text-slate-900 truncate' : 'text-slate-400'}>
          {selected ? selected.name : 'None'}
        </span>
        <svg
          className={`flex-shrink-0 ml-1 text-slate-400 ${isSm ? 'w-3 h-3' : 'w-4 h-4'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-hidden flex flex-col">
          {/* Search input */}
          <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={placeholder}
              className={`w-full ${isSm ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'} border border-slate-200 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500 focus:outline-none`}
            />
          </div>

          {/* Results */}
          <div className="overflow-y-auto flex-1">
            {/* None option */}
            <div
              onClick={() => handleSelect(undefined)}
              className={`${itemClasses} text-slate-500 italic ${!value ? 'bg-orange-50' : ''}`}
            >
              None
            </div>

            {linked.length > 0 && (
              <>
                <div className={`px-2 py-1 ${isSm ? 'text-[10px]' : 'text-xs'} font-semibold text-slate-400 uppercase tracking-wide bg-slate-50`}>
                  Component Flashings
                </div>
                {linked.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => handleSelect(f.id)}
                    className={`${itemClasses} ${value === f.id ? 'bg-orange-50 text-orange-900 font-medium' : 'text-slate-700'}`}
                  >
                    {f.name}
                  </div>
                ))}
              </>
            )}

            {others.length > 0 && (
              <>
                {linked.length > 0 && (
                  <div className={`px-2 py-1 ${isSm ? 'text-[10px]' : 'text-xs'} font-semibold text-slate-400 uppercase tracking-wide bg-slate-50`}>
                    All Other Flashings
                  </div>
                )}
                {others.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => handleSelect(f.id)}
                    className={`${itemClasses} ${value === f.id ? 'bg-orange-50 text-orange-900 font-medium' : 'text-slate-700'}`}
                  >
                    {f.name}
                  </div>
                ))}
              </>
            )}

            {filtered.length === 0 && (
              <div className={`${itemClasses} text-slate-400 italic`}>No drawings found.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
