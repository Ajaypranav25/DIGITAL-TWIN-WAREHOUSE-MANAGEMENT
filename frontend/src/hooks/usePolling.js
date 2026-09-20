import { useEffect, useRef } from 'react';

export const usePolling = (callback, interval = 10000) => {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (!interval || interval <= 0) return;

    const tick = () => {
      try {
        const res = savedCallback.current();
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      } catch (e) {}
    };

    const timer = setInterval(tick, interval);
    return () => clearInterval(timer);
  }, [interval]);
};