import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useFilters } from '../hooks/useFilters';

const FilterContext = createContext(null);

// G3: persist 화면 A selection across reloads (Plan SC-8).
const SELECTION_IDS_KEY = 'lmf_selectedItemIds';
const SELECTION_OBJS_KEY = 'lmf_selectedItemObjects';

function loadSelection(key, fallback) {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function FilterProvider({ children }) {
  const { filters } = useFilters();

  // View mode
  const [viewMode, setViewMode] = useState('dashboard');
  const [historySubMode, setHistorySubMode] = useState('compare');

  // Dashboard filters
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedSubCat, setSelectedSubCat] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Extended dashboard filters (Phase 3)
  const [classification, setClassification] = useState('');
  const [revisedOnly, setRevisedOnly] = useState(false);
  // Search field restriction: '' = all, 'item_number', 'question', 'description'
  const [searchField, setSearchField] = useState('');
  // G5 Fix: score filter — '' = all, 'null' = 핵심(필수), or numeric string exact match
  const [scoreFilter, setScoreFilter] = useState('');
  // Date range filter for last_modified.at (ISO date string or '')
  const [modifiedAfter, setModifiedAfter] = useState('');
  const [modifiedBefore, setModifiedBefore] = useState('');

  // Stage 1 user identity (Phase 3) — no auth, just records who is editing
  const [selectedUser, setSelectedUser] = useState('');

  // Dashboard checkbox selection — item _id → true map (화면 A)
  // G3: lazy-init from localStorage so the selection survives reloads (Plan SC-8).
  const [selectedItemIds, setSelectedItemIds] = useState(() => loadSelection(SELECTION_IDS_KEY, {}));
  const [selectedItemObjects, setSelectedItemObjects] = useState(() => loadSelection(SELECTION_OBJS_KEY, []));

  // G3: persist selection on every change so 화면 A is restored after a page reload.
  useEffect(() => {
    try { localStorage.setItem(SELECTION_IDS_KEY, JSON.stringify(selectedItemIds)); } catch { /* ignore storage errors */ }
  }, [selectedItemIds]);
  useEffect(() => {
    try { localStorage.setItem(SELECTION_OBJS_KEY, JSON.stringify(selectedItemObjects)); } catch { /* ignore storage errors */ }
  }, [selectedItemObjects]);

  const toggleItemSelection = (item) => {
    setSelectedItemIds(prev => {
      const next = { ...prev };
      if (next[item._id]) {
        delete next[item._id];
        setSelectedItemObjects(o => o.filter(i => i._id !== item._id));
      } else {
        next[item._id] = true;
        setSelectedItemObjects(o => [...o, item]);
      }
      return next;
    });
  };
  const clearSelection = () => { setSelectedItemIds({}); setSelectedItemObjects([]); };

  // History - Item Tracking
  const [historyArea, setHistoryArea] = useState('');
  const [itemNumbers, setItemNumbers] = useState([]);
  const [selectedHistoryNumber, setSelectedHistoryNumber] = useState('');
  const [historyItems, setHistoryItems] = useState([]);

  // History - Year Comparison
  const [compareYear, setCompareYear] = useState('');
  const [compareArea, setCompareArea] = useState('');
  const [changesData, setChangesData] = useState(null);

  // One-shot initialization for default year/area
  const filtersInitialized = useRef(false);
  useEffect(() => {
    if (filtersInitialized.current) return;
    if (filters.years.length === 0 && filters.areas.length === 0) return;
    filtersInitialized.current = true;
    if (filters.years.length > 0) {
      const sortedYears = [...filters.years].sort((a, b) => b - a);
      setSelectedYear(sortedYears[0].toString());
    }
    if (filters.areas.length > 0) {
      setSelectedArea(filters.areas[0].code);
    }
  }, [filters]);

  const resetFilters = () => {
    setSelectedArea('');
    setSelectedYear('');
    setSelectedSubCat('');
    setSearchTerm('');
    setClassification('');
    setRevisedOnly(false);
    setSearchField('');
    setScoreFilter('');
    setModifiedAfter('');
    setModifiedBefore('');
    setPage(1);
    clearSelection();
    setHistoryArea('');
    setSelectedHistoryNumber('');
    setHistoryItems([]);
  };

  const value = {
    // Filter options
    filters,
    // View mode
    viewMode, setViewMode,
    historySubMode, setHistorySubMode,
    // Dashboard
    selectedYear, setSelectedYear,
    selectedArea, setSelectedArea,
    selectedSubCat, setSelectedSubCat,
    searchTerm, setSearchTerm,
    page, setPage,
    totalCount, setTotalCount,
    totalPages, setTotalPages,
    // Extended filters
    classification, setClassification,
    revisedOnly, setRevisedOnly,
    searchField, setSearchField,
    scoreFilter, setScoreFilter,
    modifiedAfter, setModifiedAfter,
    modifiedBefore, setModifiedBefore,
    // User identity
    selectedUser, setSelectedUser,
    // History - Tracking
    historyArea, setHistoryArea,
    itemNumbers, setItemNumbers,
    selectedHistoryNumber, setSelectedHistoryNumber,
    historyItems, setHistoryItems,
    // History - Compare
    compareYear, setCompareYear,
    compareArea, setCompareArea,
    changesData, setChangesData,
    // Selection (화면 A)
    selectedItemIds, selectedItemObjects,
    toggleItemSelection, clearSelection,
    // Actions
    resetFilters,
  };

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilterContext() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilterContext must be used within a FilterProvider');
  }
  return context;
}

export default FilterContext;
