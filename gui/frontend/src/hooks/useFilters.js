import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = '/api';

/**
 * Custom hook for fetching and managing filter options
 * @returns {Object} filters, loading state, and default setters
 */
export function useFilters() {
  const [filters, setFilters] = useState({ years: [], areas: [], subCategories: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const res = await axios.get(`${API_BASE}/filters`);
        setFilters(res.data);
      } catch (err) {
        console.error('Failed to fetch filters:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFilters();
  }, []);

  return { filters, loading };
}

export default useFilters;
