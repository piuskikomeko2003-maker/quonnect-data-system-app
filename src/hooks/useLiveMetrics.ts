import { useState } from 'react';

interface UseLiveMetricsProps {
  initialVendorsCount: number;
  initialWalkinsCount: number;
}

export function useLiveMetrics({ initialVendorsCount, initialWalkinsCount }: UseLiveMetricsProps) {
  const [runningCount, setRunningCount] = useState(initialVendorsCount);
  const [runningWalkins, setRunningWalkins] = useState(initialWalkinsCount);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshMetrics = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 800);
  };

  const incrementVendorsCount = () => {
    setRunningCount(prev => prev + 1);
  };

  const incrementWalkinsCount = () => {
    setRunningWalkins(prev => prev + 1);
  };

  return {
    runningCount,
    runningWalkins,
    isRefreshing,
    setRunningCount,
    setRunningWalkins,
    setIsRefreshing,
    refreshMetrics,
    incrementVendorsCount,
    incrementWalkinsCount,
  };
}
