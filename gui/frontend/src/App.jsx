import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';

import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import HistoryView from './components/HistoryView';
import ItemModal from './components/ItemModal';
import { API_BASE } from './utils/helpers.jsx';

function App() {
  const [viewMode, setViewMode] = useState('dashboard');
  const [historySubMode, setHistorySubMode] = useState('compare');

  // Dashboard State
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ years: [], areas: [], subCategories: [] });
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedSubCat, setSelectedSubCat] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // History State - Item Tracking
  const [historyArea, setHistoryArea] = useState('');
  const [itemNumbers, setItemNumbers] = useState([]);
  const [selectedHistoryNumber, setSelectedHistoryNumber] = useState('');
  const [historyItems, setHistoryItems] = useState([]);

  // History State - Year Comparison
  const [compareYear, setCompareYear] = useState('');
  const [compareArea, setCompareArea] = useState('');
  const [changesData, setChangesData] = useState(null);

  // Load filter options
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const res = await axios.get(`${API_BASE}/filters`);
        setFilters(res.data);
        if (res.data.years && res.data.years.length > 0) {
          const sortedYears = [...res.data.years].sort((a, b) => b - a);
          setSelectedYear(sortedYears[0].toString());
        }
        if (res.data.areas && res.data.areas.length > 0) {
          setSelectedArea(res.data.areas[0]);
        }
      } catch (err) {
        console.error('Failed to fetch filters:', err);
      }
    };
    fetchFilters();
  }, []);

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
  }, [page, selectedYear, selectedArea, selectedSubCat, searchTerm, viewMode]);

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
          setSelectedHistoryNumber('');
          setHistoryItems([]);
        } catch (err) {
          console.error('Failed to fetch item numbers:', err);
        }
      };
      fetchItemNumbers();
    }
  }, [historyArea, viewMode]);

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
  }, [selectedHistoryNumber, historyArea, viewMode, historySubMode]);

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
  }, [compareYear, compareArea, viewMode, historySubMode]);

  return (
    <div className="app-container">
      <Sidebar
        viewMode={viewMode}
        setViewMode={setViewMode}
        historySubMode={historySubMode}
        setHistorySubMode={setHistorySubMode}
        filters={filters}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        selectedArea={selectedArea}
        setSelectedArea={setSelectedArea}
        selectedSubCat={selectedSubCat}
        setSelectedSubCat={setSelectedSubCat}
        historyArea={historyArea}
        setHistoryArea={setHistoryArea}
        itemNumbers={itemNumbers}
        selectedHistoryNumber={selectedHistoryNumber}
        setSelectedHistoryNumber={setSelectedHistoryNumber}
        compareYear={compareYear}
        setCompareYear={setCompareYear}
        compareArea={compareArea}
        setCompareArea={setCompareArea}
        changesData={changesData}
        totalCount={totalCount}
        setPage={setPage}
        setSearchTerm={setSearchTerm}
        setHistoryItems={setHistoryItems}
      />

      <main className="main-content">
        {viewMode === 'dashboard' ? (
          <DashboardView
            items={items}
            loading={loading}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            page={page}
            setPage={setPage}
            totalPages={totalPages}
            setSelectedItem={setSelectedItem}
          />
        ) : (
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

export default App;
