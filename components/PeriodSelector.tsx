import React, { useState, useEffect } from 'react';
import { Button, Input } from './ui';

interface PeriodSelectorProps {
  onPeriodChange: (startDate: Date, endDate: Date) => void;
}

type Period = 'HOY' | 'ESTE_MES' | '1T' | '2T' | '3T' | '4T' | 'YTD' | 'ANO_COMPLETO' | 'CUSTOM';

const getCurrentQuarterPeriod = (): Period => {
    const month = new Date().getMonth();
    if (month < 3) return '1T';
    if (month < 6) return '2T';
    if (month < 9) return '3T';
    return '4T';
};


export const PeriodSelector: React.FC<PeriodSelectorProps> = ({ onPeriodChange }) => {
  const [activePeriod, setActivePeriod] = useState<Period>(getCurrentQuarterPeriod());
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
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
      case 'YTD':
        return { start: new Date(year, 0, 1), end: endOfToday };
      case 'ANO_COMPLETO':
        return { start: new Date(year, 0, 1), end: new Date(year, 11, 31, 23, 59, 59, 999) };
      default:
        return { start: new Date(), end: new Date() };
    }
  };

  useEffect(() => {
    if (activePeriod !== 'CUSTOM') {
      const { start, end } = getPeriodDates(activePeriod);
      onPeriodChange(start, end);
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePeriod]);

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      const start = new Date(customStart);
      const end = new Date(customEnd);
      end.setHours(23, 59, 59, 999); // Include the whole end day
      onPeriodChange(start, end);
    }
  };

  const periods: { key: Period, label: string }[] = [
    { key: 'HOY', label: 'Hoy' },
    { key: 'ESTE_MES', label: 'Este Mes' },
    { key: '1T', label: '1T' },
    { key: '2T', label: '2T' },
    { key: '3T', label: '3T' },
    { key: '4T', label: '4T' },
    { key: 'YTD', label: 'Año (YTD)' },
    { key: 'ANO_COMPLETO', label: 'Año Completo' },
    { key: 'CUSTOM', label: 'Personalizado' },
  ];

  return (
    <div className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-md mb-6">
      <div className="flex flex-wrap items-center gap-2">
        {periods.map((p) => (
          <Button
            key={p.key}
            variant={activePeriod === p.key ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActivePeriod(p.key)}
          >
            {p.label}
          </Button>
        ))}
      </div>
      {activePeriod === 'CUSTOM' && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <Input
            label="Fecha Inicio"
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
          />
          <Input
            label="Fecha Fin"
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
          />
          <Button onClick={handleCustomApply} className="w-full sm:w-auto">
            Aplicar
          </Button>
        </div>
      )}
    </div>
  );
};