import React from 'react';
import { Button } from './ui';
// @ts-ignore
import { motion, AnimatePresence } from 'framer-motion';

interface UndoToastProps {
  isVisible: boolean;
  message: string;
  onUndo: () => void;
  onClose: () => void;
}

export const UndoToast: React.FC<UndoToastProps> = ({ isVisible, message, onUndo, onClose }) => {
    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: -50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -50, scale: 0.9, transition: { duration: 0.2 } }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    role="status"
                    aria-live="polite"
                    className="fixed top-4 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 w-full max-w-md bg-white/40 dark:bg-black/20 backdrop-blur-xl saturate-150 border border-white/20 text-slate-800 dark:text-slate-100 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden"
                >
                    {/* Main content with padding */}
                    <div className="flex items-center justify-between gap-4 p-4">
                        <p className="text-sm flex-grow">{message}</p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <Button variant="ghost" size="sm" onClick={onUndo} className="bg-transparent hover:bg-black/10 dark:hover:bg-white/10 text-primary-600 dark:text-primary-400 font-semibold">
                                Deshacer
                            </Button>
                            <button onClick={onClose} aria-label="Cerrar notificación" className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Progress Bar at the bottom */}
                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-black/10 dark:bg-white/10">
                        <motion.div
                            className="h-full bg-primary-500"
                            initial={{ width: '100%' }}
                            animate={{ width: '0%' }}
                            transition={{ duration: 5, ease: 'linear' }}
                        />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};