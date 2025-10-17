import React, { useState, useContext, useMemo, useEffect, useRef, useCallback } from 'react';
import { AppContext } from '../App';
import { AppData } from '../types';
import { Modal, Button, Icon } from './ui';
import { askWithImageContext } from '../services/geminiService';
import { motion, AnimatePresence } from 'framer-motion';

// --- Main Component ---
interface AITaxAssistantModalProps { isOpen: boolean; onClose: () => void; appData: AppData; }

export const AITaxAssistantModal: React.FC<AITaxAssistantModalProps> = ({ isOpen, onClose, appData }) => {
    const context = useContext(AppContext);
    
    const [messages, setMessages] = useState<{ id: string; role: 'user' | 'model'; text: string; image?: string; }[]>([]);
    const [inputText, setInputText] = useState('');
    const [inputImage, setInputImage] = useState<{ file: File; previewUrl: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const chatContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    const handleFileSelect = (file: File | null | undefined) => {
        if (file && file.type.startsWith('image/')) {
            const previewUrl = URL.createObjectURL(file);
            setInputImage({ file, previewUrl });
            setError('');
        }
    };

    const handlePaste = useCallback((event: ClipboardEvent) => {
        const file = event.clipboardData?.files[0];
        handleFileSelect(file);
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [isOpen, handlePaste]);

    useEffect(() => {
        chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, isLoading]);

    useEffect(() => {
        if (textAreaRef.current) {
            textAreaRef.current.style.height = 'auto';
            textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
        }
    }, [inputText]);

    const resetState = () => {
        setMessages([]);
        setInputText('');
        setInputImage(null);
        setIsLoading(false);
        setError('');
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    const handleSend = async () => {
        if ((!inputText.trim() && !inputImage) || isLoading) return;

        const userText = inputText.trim();
        const userImage = inputImage;

        setMessages(prev => [
            ...prev,
            { id: `user-${Date.now()}`, role: 'user', text: userText, image: userImage?.previewUrl }
        ]);

        setInputText('');
        setInputImage(null);
        setIsLoading(true);
        setError('');

        try {
            if (!context?.data.settings.geminiApiKey) {
                throw new Error("API Key de Gemini no configurada en Ajustes.");
            }
            const responseText = await askWithImageContext(userText, userImage?.file || null, context.data.settings.geminiApiKey);
            setMessages(prev => [
                ...prev,
                { id: `model-${Date.now()}`, role: 'model', text: responseText }
            ]);
        } catch (err: any) {
            setError(err.message || 'Hubo un error al procesar la solicitud.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Asistente Fiscal IA">
            <div className="flex flex-col h-[70vh] max-h-[550px]">
                {/* Chat Area */}
                <div ref={chatContainerRef} className="flex-grow space-y-4 overflow-y-auto p-4 bg-black/5 dark:bg-white/5 rounded-t-lg">
                    {messages.length === 0 && !isLoading && (
                        <div className="text-center text-slate-500 p-8">
                            <Icon name="Bot" className="w-12 h-12 mx-auto mb-4" />
                            <h3 className="font-semibold text-slate-700 dark:text-slate-200">¿En qué puedo ayudarte?</h3>
                            <p className="text-sm">Pega una captura de pantalla, adjunta una imagen o escribe tu pregunta fiscal a continuación.</p>
                        </div>
                    )}

                    {messages.map(msg => (
                        <div key={msg.id} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'model' && <Icon name="Bot" className="w-6 h-6 text-primary-500 flex-shrink-0 mb-2" />}
                            <div className={`w-full max-w-md p-3 rounded-2xl ${msg.role === 'user' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none shadow-sm'}`}>
                                {msg.image && <img src={msg.image} alt="Contexto de usuario" className="rounded-lg mb-2 max-h-48" />}
                                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                            </div>
                        </div>
                    ))}
                    
                    {isLoading && (
                         <div className="flex items-end gap-2 justify-start">
                             <Icon name="Bot" className="w-6 h-6 text-primary-500 flex-shrink-0 mb-2" />
                             <div className="w-full max-w-md p-3 rounded-2xl bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none shadow-sm">
                                <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"></div>
                                </div>
                            </div>
                        </div>
                    )}
                    {error && (
                        <div className="flex justify-center">
                            <p className="text-sm text-red-500 bg-red-500/10 p-2 rounded-md">{error}</p>
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="flex-shrink-0 p-4 border-t border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-black/20 rounded-b-3xl">
                    {inputImage && (
                        <div className="relative w-24 h-24 mb-2 p-1 border rounded-lg bg-slate-100 dark:bg-slate-700">
                             <img src={inputImage.previewUrl} alt="Previsualización" className="w-full h-full object-contain rounded" />
                             <button onClick={() => setInputImage(null)} className="absolute -top-2 -right-2 bg-slate-600 text-white rounded-full p-0.5 hover:bg-red-500 transition-colors" aria-label="Eliminar imagen">
                                <Icon name="X" className="w-4 h-4" />
                             </button>
                        </div>
                    )}
                    <div className="flex items-end gap-2">
                        <textarea
                            ref={textAreaRef}
                            rows={1}
                            className="block w-full px-4 py-2 bg-white/80 dark:bg-black/30 border border-slate-300 dark:border-slate-600 rounded-xl shadow-inner placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 sm:text-sm resize-none"
                            placeholder="Escribe tu pregunta aquí..."
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            disabled={isLoading}
                        />
                         <input type="file" ref={fileInputRef} onChange={(e) => handleFileSelect(e.target.files?.[0])} accept="image/*" className="hidden" />
                        <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={isLoading} aria-label="Adjuntar imagen">
                            <Icon name="ImagePlus" className="w-5 h-5"/>
                        </Button>
                        <Button onClick={handleSend} disabled={isLoading || (!inputText.trim() && !inputImage)} aria-label="Enviar">
                            <Icon name="Send" className="w-5 h-5"/>
                        </Button>
                    </div>
                     <p className="text-xs text-center text-slate-500 mt-2">
                        Puedes pegar una imagen directamente con <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-md dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">Ctrl+V</kbd>.
                    </p>
                </div>
            </div>
        </Modal>
    );
};
