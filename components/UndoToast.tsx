import React, { useEffect, useState } from 'react';
import { Button } from './ui';

interface UndoToastProps {
  isVisible: boolean;
  message: string;
  onUndo: () => void;
  onClose: () => void;
}

export const UndoToast: React.FC<UndoToastProps> = ({ isVisible, message, onUndo, onClose }) => {
  const [isAnimating, setIsAnimating] = useState(false);

  // FIX: Explicitly use `window.setTimeout` and `window.clearTimeout` to resolve a TypeScript type conflict
  // where the global `setTimeout` might be incorrectly typed as returning a Node.js `Timeout` object instead of a `number`.
  useEffect(() => {
    // Fix: `setTimeout` in a browser environment returns a `number`, not `NodeJS.Timeout`.
    let timer: number;
    // When the toast becomes visible, we want to reset the animation,
    // and then start it after a very brief delay. This ensures the
    // transition from 100% to 0% width is visually triggered.
    if (isVisible) {
      setIsAnimating(false); // Reset to full width
      timer = window.setTimeout(() => {
        setIsAnimating(true); // Start shrinking
      }, 50); // A small delay is crucial for the CSS transition to trigger
    } else {
      // If it's not visible, ensure the animation state is also reset.
      setIsAnimating(false);
    }
    
    // Cleanup the timer if the component unmounts or visibility changes
    return () => window.clearTimeout(timer);
  }, [isVisible]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-sm sm:max-w-md bg-slate-800 text-white rounded-lg shadow-2xl flex flex-col transition-all duration-300 ease-in-out z-50 overflow-hidden ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'
      }`}
    >
      {/* Main content with padding */}
      <div className="flex items-center justify-between gap-4 p-4">
        <p className="text-sm flex-grow">{message}</p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={onUndo} className="bg-transparent hover:bg-slate-700 text-primary-400 font-semibold">
            Deshacer
          </Button>
          <button onClick={onClose} aria-label="Cerrar notificación" className="p-1 rounded-full hover:bg-slate-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Progress Bar at the bottom */}
      <div className="h-1 w-full bg-slate-600/50">
        <div
          className={`h-full bg-primary-500 transition-all duration-[5000ms] ease-linear ${isAnimating ? 'w-0' : 'w-full'}`}
        />
      </div>
    </div>
  );
};
