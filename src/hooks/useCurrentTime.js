import { useEffect, useState } from 'react';
import { DEFAULT_CURRENT_TIME_INTERVAL_MS } from '../lib/constants';

export const useCurrentTime = (intervalMs = DEFAULT_CURRENT_TIME_INTERVAL_MS) => {
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(new Date());
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [intervalMs]);

  return currentTime;
};
