import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../App';
import { Income, Expense, InvestmentGood, Attachment, MoneyLocation, PersonalMovement, MoneySource, Transfer, TransferJustification, Category, SavingsGoal } from '../types';
import { Button, Input, Select, Icon, Switch, HelpTooltip } from './ui';
import { AiModal } from './AiModal';
import { suggestDeductibility } from '../services/geminiService';

// --- Helper Functions ---
const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
});

export const formatDateForDateTimeLocalInput = (isoDate?: string | Date): string => {
    const date = isoDate ? new Date(isoDate) : new Date();

    // Check if the provided string was just a date (YYYY-MM-DD). If so, new Date() might interpret it as UTC midnight.
    // To correct this, we can use a regex and re-parse it to respect local timezone.
    if (typeof isoDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
        // Using replace with '/' helps some browsers interpret the date as local time, not UTC.
        const dateWithTz = new Date(isoDate.replace(/-/g, '/'));
        const year = dateWithTz.getFullYear();
        const month = (dateWithTz.getMonth() + 1).toString().padStart(2, '0');
        const day = dateWithTz.getDate().toString().padStart(2, '0');
        // Default to midnight as time is not specified
        return `${year}-${month}-${day}T00:00`;
    }

    // For full ISO strings or Date objects, format to local time for the input.
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatCurrencyForUI = (amount: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);

const findBestCategoryId = (suggestion: string | undefined, categories: Category[]): string | undefined => {
    if (!suggestion || categories.length === 0) {
        return undefined;
    }
    const lowerSuggestion = suggestion.toLowerCase().trim();
    
    const exactMatch = categories.find(c => c.name.toLowerCase() === lowerSuggestion);
    if (exactMatch) return exactMatch.id;

    const suggestionIncludes = categories.find(c => lowerSuggestion.includes(c.name.toLowerCase()));
    if (suggestionIncludes) return suggestionIncludes.id;

    const categoryIncludes = categories.find(c => c.name.toLowerCase().includes(lowerSuggestion));
    if (categoryIncludes) return categoryIncludes.id;
    
    return undefined;
};


// --- Form Components ---
export const IncomeForm: React.FC<{ onClose: () => void; incomeToEdit?: Partial<Income> | null; defaultIsPaid?: boolean; }> = ({ onClose, incomeToEdit, defaultIsPaid = true }) => {
  const { data, saveData, isProfessionalModeEnabled } = useContext(AppContext)!;
  const [formData, setFormData] = useState<Partial<Income>>({
    id: incomeToEdit?.id || `inc-${Date.now()}`,
    invoiceNumber: incomeToEdit?.invoiceNumber || '',
    date: incomeToEdit?.date ? formatDateForDateTimeLocalInput(incomeToEdit.date) : formatDateForDateTimeLocalInput(),
    clientName: incomeToEdit?.clientName || '',
    clientNif: incomeToEdit?.clientNif || '',
    clientAddress: incomeToEdit?.clientAddress || '',
    concept: incomeToEdit?.concept || '',
    baseAmount: incomeToEdit?.baseAmount || 0,
    // FIX: Corrected typo from defaultVratRate to defaultVatRate
    vatRate: incomeToEdit?.vatRate ?? data.settings.defaultVatRate,
    irpfRate: incomeToEdit?.irpfRate ?? data.settings.defaultIrpfRate,
    isPaid: incomeToEdit?.isPaid ?? defaultIsPaid,
    paymentDate: incomeToEdit?.paymentDate,
    location: incomeToEdit?.location || MoneyLocation.PRO_BANK,
    attachment: incomeToEdit?.attachment,
    isIntraCommunity: incomeToEdit?.isIntraCommunity ?? false,
  });
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  const handleFileChange = async (file: File | null) => {
    if (!file) {
        setFormData(prev => ({ ...prev, attachment: undefined }));
        return;
    }
    const base64 = await fileToBase64(file);
    setFormData(prev => ({ ...prev, attachment: { name: file.name, type: file.type, data: base64 } }));
  };

  const handleAiAnalysisComplete = (extractedData: any, type: 'income' | 'expense' | 'investment', file: File) => {
      setFormData(prev => ({
          ...prev,
          ...extractedData,
          date: extractedData.date ? formatDateForDateTimeLocalInput(extractedData.date) : prev.date
      }));
      handleFileChange(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
        setFormData(prev => ({ ...prev, [name]: name.includes('Amount') || name.includes('Rate') ? parseFloat(value) : value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isEditing = incomeToEdit?.id && data.incomes.some(i => i.id === incomeToEdit.id);
    const newIncome = { ...formData, date: new Date(formData.date!).toISOString() } as Income;
    if (newIncome.isPaid && !newIncome.paymentDate) {
        newIncome.paymentDate = newIncome.date;
    }

    saveData(prevData => ({
      ...prevData,
      incomes: isEditing
        ? prevData.incomes.map(i => i.id === incomeToEdit!.id ? newIncome : i)
        : [...prevData.incomes, newIncome],
    }), isEditing ? "Ingreso actualizado." : "Ingreso añadido.");
    onClose();
  };
  
    const availableLocations = isProfessionalModeEnabled 
        ? Object.values(MoneyLocation) 
        : Object.values(MoneyLocation).filter(l => l !== MoneyLocation.PRO_BANK && l !== MoneyLocation.CASH_PRO);

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Nº Factura" name="invoiceNumber" value={formData.invoiceNumber} onChange={handleChange} />
          <Input label="Fecha Expedición" name="date" type="datetime-local" value={formData.date} onChange={handleChange} required />
        </div>
        <Input label="Nombre o Razón Social Cliente" name="clientName" value={formData.clientName} onChange={handleChange} required />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="NIF Cliente (Opcional)" name="clientNif" value={formData.clientNif} onChange={handleChange} />
            <Input label="Dirección Cliente (Opcional)" name="clientAddress" value={formData.clientAddress} onChange={handleChange} />
        </div>
        <Input label="Concepto" name="concept" value={formData.concept} onChange={handleChange} required />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Base Imponible (€)" name="baseAmount" type="number" step="0.01" value={formData.baseAmount} onChange={handleChange} required />
            <Input label="IVA (%)" name="vatRate" type="number" step="0.01" value={formData.vatRate} onChange={handleChange} required />
            <Input label="IRPF (%)" name="irpfRate" type="number" step="0.01" value={formData.irpfRate} onChange={handleChange} required />
        </div>
        <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-4">
            <Switch label="Factura Pagada" name="isPaid" checked={formData.isPaid ?? false} onChange={(c) => setFormData(p => ({...p, isPaid: c}))} />
            {formData.isPaid && (
                <Select label="Ubicación del Dinero" name="location" value={formData.location} onChange={handleChange}>
                    {availableLocations.map(l => <option key={l} value={l}>{l}</option>)}
                </Select>
            )}
        </div>
        {data.settings.isInROI && (
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <Switch label="Operación Intracomunitaria" name="isIntraCommunity" checked={formData.isIntraCommunity ?? false} onChange={(c) => setFormData(p => ({...p, isIntraCommunity: c}))} />
            </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit">{incomeToEdit?.id ? 'Guardar Cambios' : 'Añadir Ingreso'}</Button>
        </div>
      </form>
      <AiModal 
        isOpen={isAiModalOpen} 
        onClose={() => setIsAiModalOpen(false)} 
        onAnalysisComplete={handleAiAnalysisComplete} 
        apiKey={data.settings.geminiApiKey} 
        fixedType="income"
      />
    </>
  );
};

// FIX: Added missing ExpenseForm component
export const ExpenseForm: React.FC<{ onClose: () => void; expenseToEdit?: Partial<Expense> | null; defaultIsPaid?: boolean; }> = ({ onClose, expenseToEdit, defaultIsPaid = true }) => {
    const { data, saveData, isProfessionalModeEnabled } = useContext(AppContext)!;
    const [formData, setFormData] = useState<Partial<Expense>>({
        id: expenseToEdit?.id || `exp-${Date.now()}`,
        date: expenseToEdit?.date ? formatDateForDateTimeLocalInput(expenseToEdit.date) : formatDateForDateTimeLocalInput(),
        isPaid: expenseToEdit?.isPaid ?? defaultIsPaid,
        paymentDate: expenseToEdit?.paymentDate,
        invoiceNumber: expenseToEdit?.invoiceNumber || '',
        providerName: expenseToEdit?.providerName || '',
        providerNif: expenseToEdit?.providerNif || '',
        concept: expenseToEdit?.concept || '',
        baseAmount: expenseToEdit?.baseAmount || 0,
        deductibleBaseAmount: expenseToEdit?.deductibleBaseAmount,
        vatRate: expenseToEdit?.vatRate ?? data.settings.defaultVatRate,
        categoryId: expenseToEdit?.categoryId || (data.professionalCategories[0]?.id || ''),
        location: expenseToEdit?.location || MoneyLocation.PRO_BANK,
        attachment: expenseToEdit?.attachment,
        isDeductible: expenseToEdit?.isDeductible ?? true,
        isIntraCommunity: expenseToEdit?.isIntraCommunity ?? false,
        isRentalExpense: expenseToEdit?.isRentalExpense ?? false,
    });
    const [deductibilitySuggestion, setDeductibilitySuggestion] = useState<{ isDeductible: boolean; deductibleBaseAmount?: number; reason: string; } | null>(null);
    const [isCheckingDeductibility, setIsCheckingDeductibility] = useState(false);

    useEffect(() => {
        if(expenseToEdit?.suggestedCategoryName) {
            const bestId = findBestCategoryId(expenseToEdit.suggestedCategoryName, data.professionalCategories);
            if (bestId) {
                setFormData(prev => ({...prev, categoryId: bestId}));
            }
        }
    }, [expenseToEdit?.suggestedCategoryName, data.professionalCategories]);

    const handleDeductibilityCheck = async () => {
        if (!data.settings.geminiApiKey || !formData.concept || !formData.baseAmount) return;
        setIsCheckingDeductibility(true);
        setDeductibilitySuggestion(null);
        try {
            const suggestion = await suggestDeductibility(formData.concept, formData.baseAmount, data.settings.geminiApiKey);
            setDeductibilitySuggestion(suggestion);
        } catch (error) {
            console.error(error);
        } finally {
            setIsCheckingDeductibility(false);
        }
    };

    const applyDeductibilitySuggestion = () => {
        if (!deductibilitySuggestion) return;
        setFormData(prev => ({
            ...prev,
            isDeductible: deductibilitySuggestion.isDeductible,
            deductibleBaseAmount: deductibilitySuggestion.deductibleBaseAmount
        }));
        setDeductibilitySuggestion(null);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: name.includes('Amount') || name.includes('Rate') ? parseFloat(value) : value }));
        }
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const isEditing = expenseToEdit?.id && data.expenses.some(ex => ex.id === expenseToEdit.id);
        const newExpense = { ...formData, date: new Date(formData.date!).toISOString() } as Expense;
        if (newExpense.isPaid && !newExpense.paymentDate) {
            newExpense.paymentDate = newExpense.date;
        }

        saveData(prevData => ({
            ...prevData,
            expenses: isEditing
                ? prevData.expenses.map(ex => ex.id === expenseToEdit!.id ? newExpense : ex)
                : [...prevData.expenses, newExpense],
        }), isEditing ? "Gasto actualizado." : "Gasto añadido.");
        onClose();
    };

    const availableLocations = isProfessionalModeEnabled 
        ? Object.values(MoneyLocation) 
        : Object.values(MoneyLocation).filter(l => l !== MoneyLocation.PRO_BANK && l !== MoneyLocation.CASH_PRO);

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Fecha Gasto" name="date" type="datetime-local" value={formData.date} onChange={handleChange} required />
                <Input label="Nº Factura (Opcional)" name="invoiceNumber" value={formData.invoiceNumber} onChange={handleChange} />
            </div>
            <Input label="Nombre o Razón Social Proveedor" name="providerName" value={formData.providerName} onChange={handleChange} required />
            <Input label="Concepto" name="concept" value={formData.concept} onChange={handleChange} required />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Base Imponible (€)" name="baseAmount" type="number" step="0.01" value={formData.baseAmount} onChange={handleChange} required />
                <Input label="IVA Soportado (%)" name="vatRate" type="number" step="0.01" value={formData.vatRate} onChange={handleChange} required />
            </div>
            <Select label="Categoría" name="categoryId" value={formData.categoryId} onChange={handleChange} required>
                {data.professionalCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </Select>
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-4">
                <Switch label="Es Gasto Deducible" name="isDeductible" checked={formData.isDeductible ?? true} onChange={(c) => setFormData(p => ({...p, isDeductible: c}))} />
                {formData.isDeductible && (
                    <>
                        <Button type="button" variant="secondary" size="sm" onClick={handleDeductibilityCheck} disabled={isCheckingDeductibility || !data.settings.geminiApiKey}>
                            <Icon name="sparkles" className="w-4 h-4" /> {isCheckingDeductibility ? 'Consultando...' : 'Sugerencia IA Deducibilidad'}
                        </Button>
                        {deductibilitySuggestion && (
                            <div className="p-2 bg-blue-50 dark:bg-blue-900/50 rounded-md text-sm">
                                <p><strong>Sugerencia:</strong> {deductibilitySuggestion.reason}</p>
                                <Button size="sm" variant="secondary" onClick={applyDeductibilitySuggestion} className="mt-2">Aplicar Sugerencia</Button>
                            </div>
                        )}
                        <Input label="Base Deducible (si es parcial)" name="deductibleBaseAmount" type="number" step="0.01" value={formData.deductibleBaseAmount} onChange={handleChange} placeholder="Dejar en blanco si es 100% deducible" />
                    </>
                )}
            </div>
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-4">
                <Switch label="Gasto Pagado" name="isPaid" checked={formData.isPaid ?? false} onChange={(c) => setFormData(p => ({...p, isPaid: c}))} />
                {formData.isPaid && (
                    <Select label="Ubicación del Dinero" name="location" value={formData.location} onChange={handleChange}>
                        {availableLocations.map(l => <option key={l} value={l}>{l}</option>)}
                    </Select>
                )}
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                <Button type="submit">{expenseToEdit?.id ? 'Guardar Cambios' : 'Añadir Gasto'}</Button>
            </div>
        </form>
    );
};

// FIX: Added missing InvestmentGoodForm component
export const InvestmentGoodForm: React.FC<{ onClose: () => void; goodToEdit?: Partial<InvestmentGood> | null; }> = ({ onClose, goodToEdit }) => {
    const { data, saveData } = useContext(AppContext)!;
    const [formData, setFormData] = useState<Partial<InvestmentGood>>({
        id: goodToEdit?.id || `inv-${Date.now()}`,
        purchaseDate: goodToEdit?.purchaseDate ? formatDateForDateTimeLocalInput(goodToEdit.purchaseDate) : formatDateForDateTimeLocalInput(),
        description: goodToEdit?.description || '',
        providerName: goodToEdit?.providerName || '',
        invoiceNumber: goodToEdit?.invoiceNumber || '',
        acquisitionValue: goodToEdit?.acquisitionValue || 0,
        vatRate: goodToEdit?.vatRate ?? data.settings.defaultVatRate,
        usefulLife: goodToEdit?.usefulLife || 4,
        isDeductible: goodToEdit?.isDeductible ?? true,
        categoryId: goodToEdit?.categoryId || (data.professionalCategories[0]?.id || ''),
        isPaid: goodToEdit?.isPaid ?? true,
        location: goodToEdit?.location || MoneyLocation.PRO_BANK,
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: ['acquisitionValue', 'vatRate', 'usefulLife'].includes(name) ? parseFloat(value) : value }));
        }
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const isEditing = goodToEdit?.id && data.investmentGoods.some(g => g.id === goodToEdit.id);
        const newGood = { ...formData, purchaseDate: new Date(formData.purchaseDate!).toISOString() } as InvestmentGood;
        if (newGood.isPaid && !newGood.paymentDate) {
            newGood.paymentDate = newGood.purchaseDate;
        }
        
        saveData(prev => ({
            ...prev,
            investmentGoods: isEditing
                ? prev.investmentGoods.map(g => g.id === goodToEdit!.id ? newGood : g)
                : [...prev.investmentGoods, newGood]
        }), isEditing ? "Bien de inversión actualizado." : "Bien de inversión añadido.");
        onClose();
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Descripción del Bien" name="description" value={formData.description} onChange={handleChange} required />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Fecha de Compra" name="purchaseDate" type="datetime-local" value={formData.purchaseDate} onChange={handleChange} required />
                <Input label="Proveedor" name="providerName" value={formData.providerName} onChange={handleChange} required />
            </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="Valor Adquisición (Base €)" name="acquisitionValue" type="number" step="0.01" value={formData.acquisitionValue} onChange={handleChange} required />
                <Input label="IVA Soportado (%)" name="vatRate" type="number" step="0.01" value={formData.vatRate} onChange={handleChange} required />
                <Input label="Vida Útil (años)" name="usefulLife" type="number" step="1" value={formData.usefulLife} onChange={handleChange} required />
            </div>
             <Select label="Categoría" name="categoryId" value={formData.categoryId} onChange={handleChange} required>
                {data.professionalCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </Select>
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-4">
                <Switch label="Amortizable (Deducible)" name="isDeductible" checked={formData.isDeductible ?? true} onChange={(c) => setFormData(p => ({...p, isDeductible: c}))} />
                <Switch label="Pagado" name="isPaid" checked={formData.isPaid ?? true} onChange={(c) => setFormData(p => ({...p, isPaid: c}))} />
                {formData.isPaid && (
                    <Select label="Pagado Desde" name="location" value={formData.location} onChange={handleChange}>
                        {Object.values(MoneyLocation).map(l => <option key={l} value={l}>{l}</option>)}
                    </Select>
                )}
            </div>
            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                <Button type="submit">{goodToEdit?.id ? 'Guardar Cambios' : 'Añadir Bien'}</Button>
            </div>
        </form>
    );
};


// FIX: Added missing MovementForm component
export const MovementForm: React.FC<{ onClose: () => void; movementToEdit?: Partial<PersonalMovement> | null; defaultIsPaid?: boolean; }> = ({ onClose, movementToEdit, defaultIsPaid = true }) => {
    const { data, saveData } = useContext(AppContext)!;
    const [formData, setFormData] = useState<Partial<PersonalMovement>>({
        id: movementToEdit?.id || `pm-${Date.now()}`,
        date: movementToEdit?.date ? formatDateForDateTimeLocalInput(movementToEdit.date) : formatDateForDateTimeLocalInput(),
        concept: movementToEdit?.concept || '',
        amount: movementToEdit?.amount || 0,
        type: movementToEdit?.type || 'expense',
        categoryId: movementToEdit?.categoryId || (data.personalCategories[0]?.id || ''),
        location: movementToEdit?.location || MoneyLocation.PERS_BANK,
        isPaid: movementToEdit?.isPaid ?? defaultIsPaid,
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: name === 'amount' ? parseFloat(value) : value }));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const isEditing = movementToEdit?.id && data.personalMovements.some(m => m.id === movementToEdit.id);
        const newMovement = { ...formData, date: new Date(formData.date!).toISOString() } as PersonalMovement;
        if (newMovement.isPaid && !newMovement.paymentDate) {
            newMovement.paymentDate = newMovement.date;
        }

        saveData(prev => ({
            ...prev,
            personalMovements: isEditing
                ? prev.personalMovements.map(m => m.id === movementToEdit!.id ? newMovement : m)
                : [...prev.personalMovements, newMovement]
        }), isEditing ? "Movimiento actualizado." : "Movimiento añadido.");
        onClose();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Concepto" name="concept" value={formData.concept} onChange={handleChange} required />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Importe (€)" name="amount" type="number" step="0.01" value={formData.amount} onChange={handleChange} required />
                <Input label="Fecha" name="date" type="datetime-local" value={formData.date} onChange={handleChange} required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <Select label="Tipo" name="type" value={formData.type} onChange={handleChange}>
                    <option value="expense">Gasto</option>
                    <option value="income">Ingreso</option>
                </Select>
                 <Select label="Categoría" name="categoryId" value={formData.categoryId} onChange={handleChange} required>
                    {data.personalCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-4">
                <Switch label="Pagado / Recibido" name="isPaid" checked={formData.isPaid ?? false} onChange={(c) => setFormData(p => ({...p, isPaid: c}))} />
                {formData.isPaid && (
                     <Select label="Ubicación del Dinero" name="location" value={formData.location} onChange={handleChange}>
                        {Object.values(MoneyLocation).map(l => <option key={l} value={l}>{l}</option>)}
                    </Select>
                )}
            </div>
            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                <Button type="submit">{movementToEdit?.id ? 'Guardar Cambios' : 'Añadir Movimiento'}</Button>
            </div>
        </form>
    );
};

// FIX: Added missing TransferForm component
export const TransferForm: React.FC<{ onClose: () => void; transferToEdit?: Partial<Transfer> | null }> = ({ onClose, transferToEdit }) => {
    const { data, saveData } = useContext(AppContext)!;
    const [formData, setFormData] = useState<Partial<Transfer>>({
        id: transferToEdit?.id || `trn-${Date.now()}`,
        date: transferToEdit?.date ? formatDateForDateTimeLocalInput(transferToEdit.date) : formatDateForDateTimeLocalInput(),
        amount: transferToEdit?.amount || 0,
        fromLocation: transferToEdit?.fromLocation || MoneyLocation.PRO_BANK,
        toLocation: transferToEdit?.toLocation || MoneyLocation.PERS_BANK,
        concept: transferToEdit?.concept || '',
        justification: transferToEdit?.justification || TransferJustification.SUELDO_AUTONOMO,
    });
     const [error, setError] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'amount' ? parseFloat(value) : value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.fromLocation === formData.toLocation) {
            setError('La cuenta de origen y destino no pueden ser la misma.');
            return;
        }
        setError('');
        const isEditing = transferToEdit?.id && data.transfers.some(t => t.id === transferToEdit.id);
        const newTransfer = { ...formData, date: new Date(formData.date!).toISOString() } as Transfer;

        saveData(prev => ({
            ...prev,
            transfers: isEditing
                ? prev.transfers.map(t => t.id === transferToEdit!.id ? newTransfer : t)
                : [...prev.transfers, newTransfer]
        }), isEditing ? "Transferencia actualizada." : "Transferencia añadida.");
        onClose();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Importe (€)" name="amount" type="number" step="0.01" value={formData.amount} onChange={handleChange} required />
            <Input label="Fecha" name="date" type="datetime-local" value={formData.date} onChange={handleChange} required />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select label="Desde" name="fromLocation" value={formData.fromLocation} onChange={handleChange}>
                    {Object.values(MoneyLocation).map(l => <option key={l} value={l}>{l}</option>)}
                </Select>
                <Select label="Hasta" name="toLocation" value={formData.toLocation} onChange={handleChange}>
                     {Object.values(MoneyLocation).map(l => <option key={l} value={l}>{l}</option>)}
                </Select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Input label="Concepto (Opcional)" name="concept" value={formData.concept} onChange={handleChange} />
            <Select label="Justificación" name="justification" value={formData.justification} onChange={handleChange}>
                {Object.values(TransferJustification).map(j => <option key={j} value={j}>{j}</option>)}
            </Select>
            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                <Button type="submit">{transferToEdit?.id ? 'Guardar Cambios' : 'Añadir Transferencia'}</Button>
            </div>
        </form>
    );
};

// FIX: Added missing SavingsGoalForm component
export const SavingsGoalForm: React.FC<{ onClose: () => void; goalToEdit?: SavingsGoal | null }> = ({ onClose, goalToEdit }) => {
    const { data, saveData } = useContext(AppContext)!;
    const [formData, setFormData] = useState<Partial<SavingsGoal>>({
        id: goalToEdit?.id || `goal-${Date.now()}`,
        name: goalToEdit?.name || '',
        targetAmount: goalToEdit?.targetAmount || 1000,
        currentAmount: goalToEdit?.currentAmount || 0,
        deadline: goalToEdit?.deadline ? formatDateForDateTimeLocalInput(goalToEdit.deadline) : formatDateForDateTimeLocalInput(new Date().setFullYear(new Date().getFullYear() + 1)),
        plannedContribution: goalToEdit?.plannedContribution
    });
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: ['targetAmount', 'currentAmount', 'plannedContribution'].includes(name) ? parseFloat(value) : value}));
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const isEditing = goalToEdit && data.savingsGoals.some(g => g.id === goalToEdit.id);
        const newGoal = { ...formData, deadline: new Date(formData.deadline!).toISOString() } as SavingsGoal;
        
        saveData(prev => ({
            ...prev,
            savingsGoals: isEditing
                ? prev.savingsGoals.map(g => g.id === goalToEdit.id ? newGoal : g)
                : [...prev.savingsGoals, newGoal]
        }), isEditing ? "Objetivo actualizado." : "Objetivo creado.");
        onClose();
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Nombre del Objetivo" name="name" value={formData.name} onChange={handleChange} required />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Cantidad Objetivo (€)" name="targetAmount" type="number" step="0.01" value={formData.targetAmount} onChange={handleChange} required />
                <Input label="Cantidad Actual (€)" name="currentAmount" type="number" step="0.01" value={formData.currentAmount} onChange={handleChange} required />
            </div>
            <Input label="Fecha Límite" name="deadline" type="datetime-local" value={formData.deadline} onChange={handleChange} required />
            <Input label="Aportación Mensual Planeada (Opcional)" name="plannedContribution" type="number" step="0.01" value={formData.plannedContribution} onChange={handleChange} placeholder="Ej: 50" />
            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                <Button type="submit">{goalToEdit ? 'Guardar Cambios' : 'Crear Objetivo'}</Button>
            </div>
        </form>
    );
};

// FIX: Added missing AddFundsForm component
export const AddFundsForm: React.FC<{ goal: SavingsGoal; onClose: () => void; onSaveSuccess: (isGoalCompleted: boolean) => void; }> = ({ goal, onClose, onSaveSuccess }) => {
    const { data, saveData } = useContext(AppContext)!;
    const [amount, setAmount] = useState<number | string>('');
    const [location, setLocation] = useState<MoneyLocation>(MoneyLocation.PERS_BANK);
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const contributionAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
        if (isNaN(contributionAmount) || contributionAmount <= 0) return;

        const newMovement: PersonalMovement = {
            id: `pm-contr-${Date.now()}`,
            date: new Date().toISOString(),
            concept: `Aportación a objetivo: ${goal.name}`,
            amount: contributionAmount,
            type: 'expense',
            categoryId: data.personalCategories.find(c => c.name.toLowerCase().includes('ahorro'))?.id || data.personalCategories[0]?.id,
            location,
            isPaid: true,
            paymentDate: new Date().toISOString(),
        };

        const newCurrentAmount = goal.currentAmount + contributionAmount;
        const isGoalCompleted = newCurrentAmount >= goal.targetAmount;

        saveData(prev => {
            const updatedGoals = prev.savingsGoals.map(g => g.id === goal.id ? { ...g, currentAmount: newCurrentAmount } : g);
            return {
                ...prev,
                personalMovements: [...prev.personalMovements, newMovement],
                savingsGoals: updatedGoals,
            };
        }, "Aportación registrada.");
        
        onSaveSuccess(isGoalCompleted);
        onClose();
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <p>Aportando a: <strong>{goal.name}</strong></p>
            <p className="text-sm text-slate-500">Progreso actual: {formatCurrencyForUI(goal.currentAmount)} / {formatCurrencyForUI(goal.targetAmount)}</p>
            <Input label="Cantidad a Aportar (€)" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required autoFocus />
            <Select label="Desde" value={location} onChange={e => setLocation(e.target.value as MoneyLocation)}>
                {Object.values(MoneyLocation).map(l => <option key={l} value={l}>{l}</option>)}
            </Select>
            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                <Button type="submit">Aportar Fondos</Button>
            </div>
        </form>
    );
};
