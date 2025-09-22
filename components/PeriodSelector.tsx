import React, { useState, useEffect } from 'react';
import { SegmentedControl } from './SegmentedControl';
import { DatePickerInput } from './TransactionForms';
import { motion, AnimatePresence } from 'framer-motion';

interface PeriodSelectorProps {
  onPeriodChange: (startDate: Date, endDate: Date) => void;
}

type Period = 'HOY' | 'ESTE_MES' | '1T' | '2T' | '3T' | '4T' | 'ANO_NATURAL' | 'PERSONALIZADO';

const getCurrentQuarterPeriod = (): Period => {
    const month = new Date().getMonth();
    if (month < 3) return '1T';
    if (month < 6) return '2T';
    if (month < 9) return '3T';
    return '4T';
};

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({ onPeriodChange }) => {
  const [activePeriod, setActivePeriod] = useState<Period>(getCurrentQuarterPeriod());
  const [customStartDate, setCustomStartDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(1);
    return date;
  });
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());
  
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
      case 'ANO_NATURAL':
        return { start: new Date(year, 0, 1), end: new Date(year, 11, 31, 23, 59, 59, 999) };
      default:
        return { start: new Date(), end: new Date() };
    }
  };

  useEffect(() => {
    if (activePeriod === 'PERSONALIZADO') {
        if (customStartDate && customEndDate) {
            const start = new Date(customStartDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(customEndDate);
            end.setHours(23, 59, 59, 999);
            if (start <= end) {
                onPeriodChange(start, end);
            }
        }
    } else {
        const { start, end } = getPeriodDates(activePeriod);
        onPeriodChange(start, end);
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePeriod, customStartDate, customEndDate]);

  const periods: { key: Period, label: string }[] = [
    { key: 'HOY', label: 'Hoy' },
    { key: 'ESTE_MES', label: 'Mes' },
    { key: '1T', label: '1T' },
    { key: '2T', label: '2T' },
    { key: '3T', label: '3T' },
    { key: '4T', label: '4T' },
    { key: 'ANO_NATURAL', label: 'Año Actual' },
    { key: 'PERSONALIZADO', label: 'Personalizado' },
  ];
  
  const periodLabels = periods.map(p => p.label);
  const selectedLabel = periods.find(p => p.key === activePeriod)?.label || '';

  const handleSelect = (label: string) => {
      const selectedPeriod = periods.find(p => p.label === label);
      if (selectedPeriod) {
          setActivePeriod(selectedPeriod.key);
      }
  };


  return (
    <div className="mb-6">
        <SegmentedControl
            options={periodLabels}
            selected={selectedLabel}
            onSelect={handleSelect}
            layoutId="period-selector-pill"
        />
        <AnimatePresence>
            {activePeriod === 'PERSONALIZADO' && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 bg-black/5 dark:bg-white/5 rounded-2xl">
                        <DatePickerInput 
                            label="Desde"
                            selectedDate={customStartDate.toISOString()}
                            onDateChange={setCustomStartDate}
                        />
                        <DatePickerInput 
                            label="Hasta"
                            selectedDate={customEndDate.toISOString()}
                            onDateChange={setCustomEndDate}
                        />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
  );
};