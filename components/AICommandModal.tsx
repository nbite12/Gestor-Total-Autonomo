import React, { useState, useEffect, useContext, useRef } from 'react';
import { AppContext } from '../App';
import { Modal, Button, Icon } from './ui';
import { parseNaturalLanguageTransaction, ParsedCommand } from '../services/geminiService';
import { MoneyLocation, Category, Income, Expense, PersonalMovement, Transfer, TransferJustification } from '../types';
import { IncomeForm, ExpenseForm, MovementForm, TransferForm } from './TransactionForms';

const findLocation = (hint: string | undefined): MoneyLocation => {
    if (!hint) return MoneyLocation.PERS_BANK;
    const lowerHint = hint.toLowerCase();
    if (lowerHint.includes('profesional')) return MoneyLocation.PRO_BANK;
    if (lowerHint.includes('personal')) return MoneyLocation.PERS_BANK;
    if (lowerHint.includes('efectivo') || lowerHint.includes('cash')) return MoneyLocation.CASH;
    if (lowerHint.includes('crypto') || lowerHint.includes('otro')) return MoneyLocation.OTHER;
    return MoneyLocation.PERS_BANK;
};

const findCategoryId = (hint: string | undefined, categories: Category[]): string => {
    if (!hint || categories.length === 0) return categories[0]?.id || '';
    const lowerHint = hint.toLowerCase();
    const found = categories.find(c => c.name.toLowerCase().includes(lowerHint) || lowerHint.includes(c.name.toLowerCase()));
    return found?.id || categories[0]?.id || '';
};

export const AICommandModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
}> = ({ isOpen, onClose }) => {
    const context = useContext(AppContext);
    if (!context) return null;
    const { data, isProfessionalModeEnabled } = context;

    const [commandText, setCommandText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [parsedData, setParsedData] = useState<ParsedCommand | null>(null);

    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);
    const isListeningRef = useRef(false);

    useEffect(() => {
        isListeningRef.current = isListening;
    }, [isListening]);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setError('El reconocimiento de voz no es compatible con este navegador.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'es-ES';

        recognition.onresult = (event: any) => {
            let fullTranscript = '';
            for (let i = 0; i < event.results.length; i++) {
                fullTranscript += event.results[i][0].transcript;
            }
            setCommandText(fullTranscript);
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error', event.error);
            let errorMessage = 'Error en el reconocimiento de voz. Inténtalo de nuevo.';
            if (event.error === 'no-speech') return;
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                errorMessage = 'Permiso para micrófono denegado. Habilítalo en los ajustes del navegador.';
            }
            setError(errorMessage);
            setIsListening(false);
        };

        recognition.onend = () => {
            if (isListeningRef.current) {
                try {
                    recognition.start();
                } catch(e) { /* Already starting */ }
            } else {
                setIsListening(false);
            }
        };

        recognitionRef.current = recognition;

        return () => {
            if (recognitionRef.current) {
                isListeningRef.current = false;
                recognitionRef.current.abort();
            }
        };
    }, []);
    
    const startListening = () => {
        if (!recognitionRef.current || isListeningRef.current) return;
        setError('');
        setCommandText('');
        try {
            recognitionRef.current.start();
            setIsListening(true);
        } catch(e) {
            console.error("Error starting recognition:", e);
        }
    };

    const stopListening = () => {
        if (!recognitionRef.current || !isListeningRef.current) return;
        recognitionRef.current.stop();
        setIsListening(false);
    };

    useEffect(() => {
        if (isOpen) {
            startListening();
        }
    }, [isOpen]);
    
    const handleProcessCommand = async () => {
        if (!commandText.trim()) return;
        stopListening();
        setIsLoading(true);
        setError('');
        setParsedData(null);
        try {
            const result = await parseNaturalLanguageTransaction(
                commandText,
                data.settings.geminiApiKey,
                data.professionalCategories,
                data.personalCategories
            );
            setParsedData(result);
        } catch (err: any) {
            setError(err.message || 'Ha ocurrido un error inesperado.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCloseAndReset = () => {
        stopListening();
        setCommandText('');
        setError('');
        setIsLoading(false);
        setParsedData(null);
        onClose();
    };

    const renderConfirmationForm = () => {
        if (!parsedData) return null;

        if (!isProfessionalModeEnabled && (parsedData.action === 'income' || parsedData.action === 'expense')) {
            setError("El Área Profesional está desactivada. No se pueden añadir facturas. Habilítala en Ajustes.");
            setParsedData(null);
            return null;
        }

        let initialData: Partial<Income | Expense | PersonalMovement | Transfer> = {};
        
        switch (parsedData.action) {
            case 'income':
                initialData = {
                    concept: parsedData.concept,
                    baseAmount: parsedData.amount || parsedData.baseAmount || 0,
                    clientName: parsedData.partyName || '',
                    date: parsedData.date,
                    location: findLocation(parsedData.locationHint),
                    isPaid: false,
                } as Partial<Income>;
                return <IncomeForm onClose={handleCloseAndReset} incomeToEdit={initialData} />

            case 'expense':
                const base = parsedData.baseAmount ?? (parsedData.amount ? parsedData.amount / 1.21 : 0);
                 initialData = {
                    concept: parsedData.concept,
                    baseAmount: parseFloat(base.toFixed(2)),
                    deductibleBaseAmount: parsedData.suggestedDeductibleBaseAmount,
                    providerName: parsedData.partyName || '',
                    date: parsedData.date,
                    location: findLocation(parsedData.locationHint),
                    categoryId: findCategoryId(parsedData.categoryHint, data.professionalCategories),
                    isPaid: false, // Voice commands create pending transactions
                } as Partial<Expense>;
                return <ExpenseForm onClose={handleCloseAndReset} expenseToEdit={initialData} />

            case 'personal_movement':
                 initialData = {
                    concept: parsedData.concept,
                    amount: parsedData.amount || 0,
                    type: parsedData.movementType || 'expense',
                    date: parsedData.date,
                    location: findLocation(parsedData.locationHint),
                    categoryId: findCategoryId(parsedData.categoryHint, data.personalCategories),
                    isPaid: false,
                } as Partial<PersonalMovement>;
                return <MovementForm onClose={handleCloseAndReset} movementToEdit={initialData} />

            case 'transfer':
                 initialData = {
                    concept: parsedData.concept,
                    amount: parsedData.amount || 0,
                    date: parsedData.date,
                    fromLocation: findLocation(parsedData.fromLocationHint),
                    toLocation: findLocation(parsedData.toLocationHint),
                    justification: TransferJustification.SUELDO_AUTONOMO
                } as Partial<Transfer>;
                return <TransferForm onClose={handleCloseAndReset} transferToEdit={initialData} />
            
            default:
                setError("No he reconocido la acción. Por favor, inténtalo de nuevo.");
                setParsedData(null);
                return null;
        }
    }
    
    const getModalTitle = () => {
        if (!parsedData) return "Asistente IA";
        switch (parsedData.action) {
            case 'income': return "Confirmar Ingreso Profesional";
            case 'expense': return "Confirmar Gasto Profesional";
            case 'personal_movement': return "Confirmar Movimiento Personal";
            case 'transfer': return "Confirmar Transferencia";
            default: return "Asistente IA";
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={handleCloseAndReset} title={getModalTitle()}>
            {parsedData ? (
                renderConfirmationForm()
            ) : (
                <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        {isListening 
                            ? "¡Escuchando! La transcripción aparecerá abajo en tiempo real." 
                            : `Describe el movimiento que quieres añadir. Por ejemplo: ${isProfessionalModeEnabled ? '"Factura para Acme Inc de 1000€" o ' : ''}"Gasto personal de 45€ en el supermercado".`}
                    </p>
                    <textarea
                        rows={4}
                        className="block w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm dark:bg-slate-800 dark:border-slate-600 dark:placeholder-slate-500"
                        placeholder={isListening ? "Escuchando... hable con claridad." : "Pulsa 'Grabar Voz' o escribe tu comando aquí..."}
                        value={commandText}
                        onChange={(e) => setCommandText(e.target.value)}
                        disabled={isLoading}
                    />
                    {error && <p className="text-sm text-red-500 text-center">{error}</p>}
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Button onClick={isListening ? stopListening : startListening} variant="secondary" className="w-full" disabled={isLoading}>
                            <Icon name="microphone" className={`w-5 h-5 ${isListening ? 'text-red-500 animate-pulse' : ''}`} />
                            {isListening ? 'Detener Grabación' : 'Grabar Voz'}
                        </Button>
                        <Button onClick={handleProcessCommand} className="w-full" disabled={isLoading || isListening || !commandText}>
                            {isLoading ? 'Analizando...' : <> <Icon name="sparkles" className="w-5 h-5"/> Procesar Comando </>}
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
};
