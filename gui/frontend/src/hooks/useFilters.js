import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../utils/helpers.jsx';

// Fetches filter options (years / areas / sub-categories) once on mount.
// Returns the option set and a loading flag. Initial selection is the
// caller's responsibility — see App.jsx for the one-shot default pattern.
export function useFilters() {
  const [filters, setFilters] = useState({ years: [], areas: [], subCategories: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API_BASE}/filters`)
      .then((res) => { if (!cancelled) setFilters(res.data); })
      .catch((err) => { if (!cancelled) console.error('Failed to fetch filters:', err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { filters, loading };
}

export default useFilters;
