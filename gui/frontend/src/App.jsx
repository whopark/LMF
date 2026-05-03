import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';

import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import HistoryView from './components/HistoryView';
import ItemModal from './components/ItemModal';
import { API_BASE } from './utils/helpers.jsx';
import { FilterProvider, useFilterContext } from './contexts/FilterContext';

function AppContent() {
  const {
    viewMode,
    historySubMode,
    selectedYear,
    selectedArea,
    selectedSubCat,
    searchTerm,
    page,
    setTotalCount,
    historyArea,
    setItemNumbers,
    selectedHistoryNumber,
    setHistoryItems,
    historyItems,
    compareYear,
    compareArea,
    setChangesData,
    changesData,
  } = useFilterContext();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch Dashboard Items
  const fetchItems = useCallback(async () => {
    if (viewMode !== 'dashboard') return;
    setLoading(true);
    try {
      const params = {
        page,
        limit: 50,
        year: selectedYear || undefined,
        area: selectedArea || undefined,
        sub_category: selectedSubCat || undefined,
        search: searchTerm || undefined
      };
      const res = await axios.get(`${API_BASE}/items`, { params });
      setItems(res.data.items);
      setTotalPages(res.data.totalPages);
      setTotalCount(res.data.total);
    } catch (err) {
      console.error('Failed to fetch items:', err);
    } finally {
      setLoading(false);
    }
  }, [page, selectedYear, selectedArea, selectedSubCat, searchTerm, viewMode, setTotalCount]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // History Mode: Fetch Item Numbers for a given Area
  useEffect(() => {
    if (viewMode === 'history' && historyArea) {
      const fetchItemNumbers = async () => {
        try {
          const res = await axios.get(`${API_BASE}/filters/item-numbers`, { params: { area: historyArea } });
          setItemNumbers(res.data);
        } catch (err) {
          console.error('Failed to fetch item numbers:', err);
        }
      };
      fetchItemNumbers();
    }
  }, [historyArea, viewMode, setItemNumbers]);

  // History Mode: Fetch all years for a selected Item Number
  useEffect(() => {
    if (viewMode === 'history' && historySubMode === 'track' && selectedHistoryNumber) {
      const fetchHistory = async () => {
        setLoading(true);
        try {
          const res = await axios.get(`${API_BASE}/items/${encodeURIComponent(selectedHistoryNumber)}`);
          const scoped = historyArea ? res.data.filter(i => i.area === historyArea) : res.data;
          setHistoryItems(scoped);
        } catch (err) {
          if (err.response && err.response.status === 404) {
            setHistoryItems([]);
          } else {
            console.error('Failed to fetch history:', err);
          }
        } finally {
          setLoading(false);
        }
      };
      fetchHistory();
    }
  }, [selectedHistoryNumber, historyArea, viewMode, historySubMode, setHistoryItems]);

  // Year Comparison Mode: Fetch year-over-year changes
  useEffect(() => {
    if (viewMode === 'history' && historySubMode === 'compare' && compareYear) {
      const fetchChanges = async () => {
        setLoading(true);
        try {
          const params = compareArea ? { area: compareArea } : {};
          const res = await axios.get(`${API_BASE}/changes/${compareYear}`, { params });
          setChangesData(res.data);
        } catch (err) {
          console.error('Failed to fetch changes:', err);
          setChangesData(null);
        } finally {
          setLoading(false);
        }
      };
      fetchChanges();
    }
  }, [compareYear, compareArea, viewMode, historySubMode, setChangesData]);

  return (
    <div className="app-container">
      <Sidebar />

      <main className="main-content">
        {viewMode === 'dashboard' ? (
          <DashboardView
            items={items}
            loading={loading}
            totalPages={totalPages}
            setSelectedItem={setSelectedItem}
          />
        ) : (
          <HistoryView
            loading={loading}
            setSelectedItem={setSelectedItem}
          />
        )}
      </main>

      <ItemModal
        selectedItem={selectedItem}
        setSelectedItem={setSelectedItem}
        setItems={setItems}
      />
    </div>
  );
}

function App() {
  return (
    <FilterProvider>
      <AppContent />
    </FilterProvider>
  );
}

export default App;
