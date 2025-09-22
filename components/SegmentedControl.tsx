import { motion } from 'framer-motion';
import React from 'react';

interface SegmentedControlProps {
  options: (string | { key: string; label: string })[];
  selected: string; // This should be the key
  onSelect: (selectedKey: string) => void;
  layoutId?: string;
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({ options, selected, onSelect, layoutId = "active-pill" }) => {
    const isObjectArray = options.length > 0 && typeof options[0] === 'object';
    
    return (
        <div className="w-full overflow-x-auto pb-2">
            <div className="flex w-max space-x-1 rounded-full bg-black/5 dark:bg-white/5 p-1">
                {options.map((opt, index) => {
                    const key = isObjectArray ? (opt as { key: string }).key : (opt as string);
                    const label = isObjectArray ? (opt as { label: string }).label : (opt as string);
                    const isSelected = selected === key;

                    return (
                        <button
                            key={key}
                            onClick={() => onSelect(key)}
                            className={`relative rounded-full px-4 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors focus:outline-none`}
                        >
                            {isSelected && (
                                <motion.div
                                    layoutId={layoutId}
                                    className="absolute inset-0 bg-white dark:bg-black/20 rounded-full shadow-md"
                                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                />
                            )}
                            <span className="relative z-10">{label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
