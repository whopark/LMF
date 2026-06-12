import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import './App.css';

import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import HistoryView from './components/HistoryView';
import RevisionListView from './components/RevisionListView';
import ItemModal from './components/ItemModal';
import LoginPage from './components/LoginPage';
import { API_BASE } from './utils/helpers.jsx';
import { FilterProvider, useFilterContext } from './contexts/FilterContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';

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
    totalPages,
    setTotalPages,
    classification,
    revisedOnly,
    searchField,
    historyArea,
    setItemNumbers,
    selectedHistoryNumber,
    setHistoryItems,
    historyItems,
    compareYear,
    compareArea,
    setChangesData,
    changesData,
    selectedItemObjects,
    setHistoryArea,
    setSelectedHistoryNumber,
  } = useFilterContext();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Handle browser back button for modal
  useEffect(() => {
    const handlePopState = (event) => {
      if (selectedItem && !event.state?.modalOpen) {
        setSelectedItem(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedItem]);

  // Push history state only when transitioning null → item (not item → item).
  // Prevents stacking duplicate entries that make back-button behavior unreliable.
  const prevItemRef = useRef(null);
  useEffect(() => {
    if (selectedItem && !prevItemRef.current) {
      window.history.pushState({ modalOpen: true }, '');
    }
    prevItemRef.current = selectedItem;
  }, [selectedItem]);

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
        search: searchTerm || undefined,
        classification: classification || undefined,
        revised_only: revisedOnly ? 'true' : undefined,
        search_field: searchField || undefined,
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
  }, [page, selectedYear, selectedArea, selectedSubCat, searchTerm, searchField, classification, revisedOnly, viewMode, setTotalCount, setTotalPages]);

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
        {viewMode === 'dashboard' && (
          <DashboardView items={items} loading={loading} setSelectedItem={setSelectedItem} />
        )}
        {viewMode === 'history' && (
          <HistoryView
            historySubMode={historySubMode}
            loading={loading}
            changesData={changesData}
            compareYear={compareYear}
            compareArea={compareArea}
            historyArea={historyArea}
            selectedHistoryNumber={selectedHistoryNumber}
            historyItems={historyItems}
            setSelectedItem={setSelectedItem}
          />
        )}
        {viewMode === 'revision' && (
          <RevisionListView
            selectedItems={selectedItemObjects}
            onNavigateToRevision={(item) => {
              setHistoryArea(item.area);
              setSelectedHistoryNumber(item.about_item.item_number);
            }}
          />
        )}
      </main>

      <ItemModal
        selectedItem={selectedItem}
        setSelectedItem={setSelectedItem}
        setItems={setItems}
        setHistoryItems={setHistoryItems}
      />
    </div>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#94a3b8' }}>로딩 중...</div>;
  if (!user) return <LoginPage />;
  return (
    <FilterProvider>
      <AppContent />
    </FilterProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

export default App;
