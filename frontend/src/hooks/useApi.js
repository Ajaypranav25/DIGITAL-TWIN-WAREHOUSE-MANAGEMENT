import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

export const useApi = (apiFunc, immediate = true) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  const apiFuncRef = useRef(apiFunc);
  apiFuncRef.current = apiFunc;

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFuncRef.current(...args);
      setData(response.data);
      return response.data;
    } catch (err) {
      setError(err.message);
      if (immediate) {
        toast.error(err.message);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [immediate]);

  useEffect(() => {
    if (immediate) {
      execute().catch(() => {});
    }
  }, [execute, immediate]);

  return { data, loading, error, refetch: execute, setData };
};