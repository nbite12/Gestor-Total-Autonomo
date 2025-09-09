import React, { useState, useEffect } from 'react';
// @ts-ignore
import { motion } from 'framer-motion';

interface PeriodSelectorProps {
  onPeriodChange: (startDate: Date, endDate: Date) => void;
}

type Period = 'HOY' | 'ESTE_MES' | '1T' | '2T' | '3T' | '4T';

const getCurrentQuarterPeriod = (): Period => {
    const month = new Date().getMonth();
    if (month < 3) return '1T';
    if (month < 6) return '2T';
    if (month < 9) return '3T';
    return '4T';
};


export const PeriodSelector: React.FC<PeriodSelectorProps> = ({ onPeriodChange }) => {
  const [activePeriod, setActivePeriod] = useState<Period>(getCurrentQuarterPeriod());
  
  const getPeriodDates = (period: Period, year = new Date().getFullYear()) => {
    const today = new Date();
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    
    switch (period) {
      case 'HOY':
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        return { start: startOfToday, end: endOfToday };
      case 'ESTE_MES':
        return { start: new Date(year, today.getMonth(), 1), end: new Date(year, today.getMonth() + 1, 0, 23, 59, 59, 999) };
      case '1T':
        return { start: new Date(year, 0, 1), end: new Date(year, 2, 31, 23, 59, 59, 999) };
      case '2T':
        return { start: new Date(year, 3, 1), end: new Date(year, 5, 30, 23, 59, 59, 999) };
      case '3T':
        return { start: new Date(year, 6, 1), end: new Date(year, 8, 30, 23, 59, 59, 999) };
      case '4T':
        return { start: new Date(year, 9, 1), end: new Date(year, 11, 31, 23, 59, 59, 999) };
      default:
        return { start: new Date(), end: new Date() };
    }
  };

  useEffect(() => {
    const { start, end } = getPeriodDates(activePeriod);
    onPeriodChange(start, end);
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePeriod]);

  const periods: { key: Period, label: string }[] = [
    { key: 'HOY', label: 'Hoy' },
    { key: 'ESTE_MES', label: 'Mes' },
    { key: '1T', label: '1T' },
    { key: '2T', label: '2T' },
    { key: '3T', label: '3T' },
    { key: '4T', label: '4T' },
  ];

  return (
    <div className="w-full p-1 space-x-1 list-none rounded-xl bg-black/10 dark:bg-white/10 flex mb-6">
      {periods.map(p => (
        <button
          key={p.key}
          onClick={() => setActivePeriod(p.key)}
          className={`relative flex-1 rounded-lg py-1.5 text-sm font-medium transition focus:outline-none ${
            activePeriod === p.key ? 'text-gray-900 dark:text-gray-900' : 'text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          {activePeriod === p.key && (
            <motion.div
              layoutId="active-period-pill"
              className="absolute inset-0 bg-white rounded-lg shadow-md"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          )}
          <span className="relative z-10">{p.label}</span>
        </button>
      ))}
    </div>
  );
};