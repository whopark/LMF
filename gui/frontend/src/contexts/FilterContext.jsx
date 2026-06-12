import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useFilters } from '../hooks/useFilters';

const FilterContext = createContext(null);

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

  // Stage 1 user identity (Phase 3) — no auth, just records who is editing
  const [selectedUser, setSelectedUser] = useState('');

  // Dashboard checkbox selection — item _id → true map (화면 A)
  const [selectedItemIds, setSelectedItemIds] = useState({});
  const [selectedItemObjects, setSelectedItemObjects] = useState([]);

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
