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
      setSelectedArea(filters.areas[0]);
    }
  }, [filters]);

  const resetFilters = () => {
    setSelectedArea('');
    setSelectedYear('');
    setSelectedSubCat('');
    setSearchTerm('');
    setPage(1);
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
    // History - Tracking
    historyArea, setHistoryArea,
    itemNumbers, setItemNumbers,
    selectedHistoryNumber, setSelectedHistoryNumber,
    historyItems, setHistoryItems,
    // History - Compare
    compareYear, setCompareYear,
    compareArea, setCompareArea,
    changesData, setChangesData,
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
