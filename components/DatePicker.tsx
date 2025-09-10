import React from 'react';
import { DayPicker, SelectSingleEventHandler } from 'react-day-picker';

interface DatePickerProps {
    selected: Date | undefined;
    onSelect: SelectSingleEventHandler;
}

export function DatePicker({ selected, onSelect }: DatePickerProps) {
  // Styles for the date picker to match the Apple "liquid glass" aesthetic
  const css = `
    .rdp {
      --rdp-cell-size: 40px;
      --rdp-accent-color: #007AFF;
      --rdp-background-color: rgba(255, 255, 255, 0.1);
      border-radius: 1.5rem;
      padding: 1rem;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .rdp-caption_label, .rdp-head_cell, .rdp-day {
      color: #1D1D1F; /* Apple's dark text for contrast */
    }
    .rdp-day_today {
        color: #007AFF;
        font-weight: bold;
    }
    .rdp-day_selected {
        font-weight: bold;
    }
    /* Dark mode styles */
    .dark .rdp {
        --rdp-background-color: rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .dark .rdp-caption_label, .dark .rdp-head_cell, .dark .rdp-day {
        color: #F5F5F7;
    }
    .dark .rdp-day_today {
        color: #0A84FF;
    }
    .dark .rdp-day_selected {
        color: white !important;
    }
    .dark .rdp-day_outside {
        color: #6E6E73;
    }
    .dark .rdp-nav_button {
        color: #F5F5F7;
    }
  `;

  return (
    <>
      <style>{css}</style>
      <DayPicker 
        mode="single" 
        selected={selected} 
        onSelect={onSelect} 
        showOutsideDays 
        fixedWeeks
      />
    </>
  );
}
