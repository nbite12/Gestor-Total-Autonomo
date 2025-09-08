import React, { useEffect, useState } from 'react';
import { Button } from './ui';

interface UndoToastProps {
  isVisible: boolean;
  message: string;
  onUndo: () => void;
  onClose: () => void;
}

export const UndoToast: React.FC<UndoToastProps> = ({ isVisible, message, onUndo, onClose }) => {
    // Controls the presence of the toast in the DOM for animations
    const [shouldRender, setShouldRender] = useState(false);
    // Controls the CSS classes for appear/disappear animations
    const [isShowing, setIsShowing] = useState(false);
    // Controls the progress bar animation
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        let renderTimer: number;
        let animationTimer: number;
        let progressTimer: number;

        if (isVisible) {
            setShouldRender(true);
            // Short delay to trigger the appear CSS transition
            animationTimer = window.setTimeout(() => {
                setIsShowing(true);
            }, 10);
            // Short delay to trigger the progress bar animation
            progressTimer = window.setTimeout(() => {
                setIsAnimating(true);
            }, 50);
        } else {
            // For hiding, first apply the 'hide' animation classes
            setIsShowing(false);
            setIsAnimating(false);
            // Then, after the transition duration, remove the component from the DOM
            renderTimer = window.setTimeout(() => {
                setShouldRender(false);
            }, 300); // This duration must match the CSS transition duration
        }

        return () => {
            window.clearTimeout(renderTimer);
            window.clearTimeout(animationTimer);
            window.clearTimeout(progressTimer);
        };
    }, [isVisible]);

    if (!shouldRender) {
        return null;
    }

    return (
        <div
            role="status"
            aria-live="polite"
            className={`fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-sm sm:max-w-md bg-slate-800 text-white rounded-lg shadow-2xl flex flex-col transition-all duration-300 ease-in-out z-50 overflow-hidden ${
                isShowing ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'
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
