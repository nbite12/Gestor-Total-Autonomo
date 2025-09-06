import React, { useState, useContext } from 'react';
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
export const IncomeForm: React.FC<{ onClose: () => void; incomeToEdit?: Partial<Income> | null; defaultIsPaid?: boolean; }> = ({ onClose, incomeToEdit, defaultIsPaid = false }) => {
  const { data, saveData } = useContext(AppContext)!;
  const [formData, setFormData] = useState<Partial<Income>>({
    id: incomeToEdit?.id || `inc-${Date.now()}`,
    invoiceNumber: incomeToEdit?.invoiceNumber || '',
    date: incomeToEdit?.date ? formatDateForDateTimeLocalInput(incomeToEdit.date) : formatDateForDateTimeLocalInput(),
    clientName: incomeToEdit?.clientName || '',
    clientNif: incomeToEdit?.clientNif || '',
    clientAddress: incomeToEdit?.clientAddress || '',
    concept: incomeToEdit?.concept || '',
    baseAmount: incomeToEdit?.baseAmount || 0,
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
        ? prevData.incomes.map(i => i.id === incomeToEdit.id ? newIncome : i)
        : [...prevData.incomes, newIncome],
    }), isEditing ? "Ingreso actualizado." : "Ingreso añadido.");
    onClose();
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Nº Factura" name="invoiceNumber" value={formData.invoiceNumber} required />
          <Input label="Fecha Expedición" name="date" type="datetime-local" value={formData.date} onChange={handleChange} required />
        </div>
        <Input label="Nombre o Razón Social Cliente" name="clientName" value={formData.clientName} onChange={handleChange} required />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="NIF/CIF Cliente" name="clientNif" value={formData.clientNif} onChange={handleChange} />
          <Input label="Dirección Cliente" name="clientAddress" value={formData.clientAddress} onChange={handleChange} />
        </div>
        <div className="flex items-center">
            <Switch 
                label="Operación Intracomunitaria (Mod. 349)"
                checked={formData.isIntraCommunity ?? false} 
                onChange={(c) => setFormData(p => ({...p, isIntraCommunity: c, vatRate: c ? 0 : data.settings.defaultVatRate }))} 
            />
            <HelpTooltip content="Marca esta opción si la factura es para un cliente en otro país de la UE y ambos estáis en el ROI. Se aplicará un 0% de IVA." />
        </div>
        <Input label="Concepto" name="concept" value={formData.concept} onChange={handleChange} required />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="Base Imponible (€)" name="baseAmount" type="number" step="0.01" value={formData.baseAmount} onChange={handleChange} required />
          <Select label="Tipo de IVA (%)" name="vatRate" value={formData.vatRate} onChange={handleChange} disabled={formData.isIntraCommunity}>
              <option value="21">21% (General)</option><option value="10">10% (Reducido)</option><option value="4">4% (Superreducido)</option><option value="0">0% (Exento)</option>
          </Select>
          <Select label="Retención IRPF (%)" name="irpfRate" value={formData.irpfRate} onChange={handleChange}>
              <option value="15">15% (General)</option><option value="7">7% (Nuevos autónomos)</option><option value="0">0% (Sin retención)</option>
          </Select>
        </div>
        <Select label="Ubicación del Dinero (si está pagada)" name="location" value={formData.location} onChange={handleChange}>
          {Object.values(MoneyLocation).map(loc => <option key={loc} value={loc}>{loc}</option>)}
        </Select>
        
        <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Adjuntar Factura</label>
            <div className="flex items-center gap-2">
                <div className="flex-grow">
                    {!formData.attachment ? (
                        <Input type="file" label="" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} accept="image/*,application/pdf" />
                    ) : (
                        <div className="flex items-center justify-between p-2 bg-slate-100 dark:bg-slate-700 rounded-md">
                            <span className="text-sm truncate"><Icon name="paperclip" className="inline w-4 h-4 mr-2" />{formData.attachment.name}</span>
                            <Button variant="ghost" size="sm" onClick={() => handleFileChange(null)}><Icon name="x" className="w-4 h-4" /></Button>
                        </div>
                    )}
                </div>
                <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setIsAiModalOpen(true)}
                    disabled={!data.settings.geminiApiKey}
                    title={!data.settings.geminiApiKey ? "Configura tu API Key de Gemini en Ajustes" : "Escanear con IA"}
                >
                    <Icon name="sparkles" className="w-5 h-5" />
                </Button>
            </div>
        </div>

        <Switch label="Marcar como Pagada" checked={formData.isPaid ?? false} onChange={(c) => setFormData(p => ({...p, isPaid: c}))} />
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit">{incomeToEdit?.id && data.incomes.some(i => i.id === incomeToEdit.id) ? 'Guardar Cambios' : 'Añadir Ingreso'}</Button>
        </div>
      </form>
      {isAiModalOpen && (
          <AiModal
              isOpen={isAiModalOpen}
              onClose={() => setIsAiModalOpen(false)}
              onAnalysisComplete={handleAiAnalysisComplete}
              apiKey={data.settings.geminiApiKey}
              fixedType="income"
          />
      )}
    </>
  );
};

export const ExpenseForm: React.FC<{ onClose: () => void; expenseToEdit?: Partial<Expense> | null; defaultIsPaid?: boolean; }> = ({ onClose, expenseToEdit, defaultIsPaid = true }) => {
    const { data, saveData } = useContext(AppContext)!;
    const [formData, setFormData] = useState<Partial<Expense>>({
        id: expenseToEdit?.id || `exp-${Date.now()}`,
        date: expenseToEdit?.date ? formatDateForDateTimeLocalInput(expenseToEdit.date) : formatDateForDateTimeLocalInput(),
        invoiceNumber: expenseToEdit?.invoiceNumber || '',
        providerName: expenseToEdit?.providerName || '',
        providerNif: expenseToEdit?.providerNif || '',
        concept: expenseToEdit?.concept || '',
        baseAmount: expenseToEdit?.baseAmount || 0,
        deductibleBaseAmount: expenseToEdit?.deductibleBaseAmount,
        vatRate: expenseToEdit?.vatRate ?? data.settings.defaultVatRate,
        irpfRetentionRate: expenseToEdit?.irpfRetentionRate,
        irpfRetentionAmount: expenseToEdit?.irpfRetentionAmount,
        recargoEquivalenciaRate: expenseToEdit?.recargoEquivalenciaRate,
        recargoEquivalenciaAmount: expenseToEdit?.recargoEquivalenciaAmount,
        categoryId: expenseToEdit?.categoryId || (data.professionalCategories[0]?.id || ''),
        location: expenseToEdit?.location || MoneyLocation.PRO_BANK,
        isDeductible: expenseToEdit?.isDeductible ?? true,
        isPaid: expenseToEdit?.isPaid ?? defaultIsPaid,
        paymentDate: expenseToEdit?.paymentDate,
        attachment: expenseToEdit?.attachment,
        isIntraCommunity: expenseToEdit?.isIntraCommunity ?? false,
        isRentalExpense: expenseToEdit?.isRentalExpense ?? false,
        landlordNif: expenseToEdit?.landlordNif || '',
        propertyCadastralRef: expenseToEdit?.propertyCadastralRef || '',
    });
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [isPartiallyDeductible, setIsPartiallyDeductible] = useState(typeof expenseToEdit?.deductibleBaseAmount === 'number');
    const [hasIrpfRetention, setHasIrpfRetention] = useState(typeof expenseToEdit?.irpfRetentionRate === 'number');
    const [hasRecargoEquivalencia, setHasRecargoEquivalencia] = useState(typeof expenseToEdit?.recargoEquivalenciaRate === 'number');
    const [isRentalExpense, setIsRentalExpense] = useState(expenseToEdit?.isRentalExpense ?? false);
    const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
    const [aiSuggestion, setAiSuggestion] = useState('');


    const handleFileChange = async (file: File | null) => {
        if (!file) { setFormData(prev => ({ ...prev, attachment: undefined })); return; }
        const base64 = await fileToBase64(file);
        setFormData(prev => ({ ...prev, attachment: { name: file.name, type: file.type, data: base64 } }));
    };

     const handleAiAnalysisComplete = (extractedData: any, type: 'income' | 'expense' | 'investment', file: File) => {
        const suggestedCategoryId = findBestCategoryId(extractedData.suggestedCategoryName, data.professionalCategories);
        setFormData(prev => ({
            ...prev,
            ...extractedData,
            date: extractedData.date ? formatDateForDateTimeLocalInput(extractedData.date) : prev.date,
            deductibleBaseAmount: extractedData.suggestedDeductibleBaseAmount,
            ...(suggestedCategoryId && { categoryId: suggestedCategoryId }),
        }));
        if (extractedData.suggestedDeductibleBaseAmount) {
            setIsPartiallyDeductible(true);
        }
        handleFileChange(file);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
         if (type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
        } else {
            const isNumeric = ['baseAmount', 'deductibleBaseAmount', 'vatRate', 'irpfRetentionRate', 'irpfRetentionAmount', 'recargoEquivalenciaRate', 'recargoEquivalenciaAmount'].includes(name);
            const numericValue = isNumeric ? parseFloat(value) : value;

            setFormData(prev => {
                const newState = { ...prev, [name]: numericValue };
                const base = (name === 'baseAmount' ? numericValue : newState.baseAmount) as number || 0;

                if (name === 'baseAmount' || name === 'irpfRetentionRate') {
                    const rate = (name === 'irpfRetentionRate' ? numericValue : newState.irpfRetentionRate) as number || 0;
                    newState.irpfRetentionAmount = base * (rate / 100);
                }
                
                if (name === 'baseAmount' || name === 'recargoEquivalenciaRate') {
                    const rate = (name === 'recargoEquivalenciaRate' ? numericValue : newState.recargoEquivalenciaRate) as number || 0;
                    newState.recargoEquivalenciaAmount = base * (rate / 100);
                }

                return newState;
            });
        }
    };

    const handlePartialDeductibilityChange = (checked: boolean) => {
        setIsPartiallyDeductible(checked);
        if (!checked) {
            setFormData(prev => {
                const { deductibleBaseAmount, ...rest } = prev;
                return rest;
            });
        } else {
            setFormData(prev => ({ ...prev, deductibleBaseAmount: prev.baseAmount }));
        }
    };

    const handleIrpfRetentionChange = (checked: boolean) => {
        setHasIrpfRetention(checked);
        if (!checked) {
            setFormData(prev => {
                const { irpfRetentionRate, irpfRetentionAmount, ...rest } = prev;
                return rest;
            });
        } else {
            const rate = isRentalExpense ? 19 : 15;
            const base = formData.baseAmount || 0;
            setFormData(prev => ({ 
                ...prev, 
                irpfRetentionRate: rate,
                irpfRetentionAmount: base * (rate / 100)
            }));
        }
    };
    
    const handleRentalExpenseChange = (checked: boolean) => {
        setIsRentalExpense(checked);
        if (!checked) {
            setFormData(prev => {
                const { landlordNif, propertyCadastralRef, ...rest } = prev;
                return { ...rest, isRentalExpense: false };
            });
            // if retention was active, maybe reset it or change it
            if(hasIrpfRetention) {
                const rate = 15; // default prof rate
                const base = formData.baseAmount || 0;
                setFormData(prev => ({...prev, irpfRetentionRate: rate, irpfRetentionAmount: base * (rate/100)}));
            }
        } else {
             setFormData(prev => ({ ...prev, isRentalExpense: true }));
             if(hasIrpfRetention) {
                const rate = 19; // rental rate
                const base = formData.baseAmount || 0;
                setFormData(prev => ({...prev, irpfRetentionRate: rate, irpfRetentionAmount: base * (rate/100)}));
            }
        }
    };

    const handleRecargoChange = (checked: boolean) => {
        setHasRecargoEquivalencia(checked);
        if (!checked) {
            setFormData(prev => {
                const { recargoEquivalenciaRate, recargoEquivalenciaAmount, ...rest } = prev;
                return rest;
            });
        } else {
            const rate = 5.2; // Default to 5.2%
            const base = formData.baseAmount || 0;
            setFormData(prev => ({
                ...prev,
                recargoEquivalenciaRate: rate,
                recargoEquivalenciaAmount: base * (rate / 100)
            }));
        }
    };
    
    const handleAiDeductibilityCheck = async () => {
        if (!formData.concept || !formData.baseAmount) {
            alert("Por favor, introduce al menos el concepto y la base imponible.");
            return;
        }
        setIsAiAnalyzing(true);
        setAiSuggestion('');
        try {
            const suggestion = await suggestDeductibility(formData.concept, formData.baseAmount, data.settings.geminiApiKey);
            
            setFormData(prev => ({
                ...prev,
                isDeductible: suggestion.isDeductible,
                deductibleBaseAmount: suggestion.deductibleBaseAmount
            }));
            
            if (suggestion.deductibleBaseAmount) {
                setIsPartiallyDeductible(true);
            } else {
                setIsPartiallyDeductible(false);
            }
            setAiSuggestion(suggestion.reason);

        } catch (e: any) {
            alert(`Error de la IA: ${e.message}`);
        } finally {
            setIsAiAnalyzing(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const isEditing = expenseToEdit?.id && data.expenses.some(ex => ex.id === expenseToEdit.id);
        let newExpense = { ...formData, date: new Date(formData.date!).toISOString() } as Expense;
        
        if (!isPartiallyDeductible) delete newExpense.deductibleBaseAmount;
        if (!hasIrpfRetention) {
            delete newExpense.irpfRetentionRate;
            delete newExpense.irpfRetentionAmount;
        }
        if (!hasRecargoEquivalencia) {
            delete newExpense.recargoEquivalenciaRate;
            delete newExpense.recargoEquivalenciaAmount;
        }
        if (!isRentalExpense) {
            delete newExpense.isRentalExpense;
            delete newExpense.landlordNif;
            delete newExpense.propertyCadastralRef;
        }

        if (newExpense.isPaid && !newExpense.paymentDate) {
            newExpense.paymentDate = newExpense.date;
        }
        saveData(prevData => ({
            ...prevData,
            expenses: isEditing
                ? prevData.expenses.map(ex => ex.id === expenseToEdit.id ? newExpense : ex)
                : [...prevData.expenses, newExpense],
        }), isEditing ? "Gasto actualizado." : "Gasto añadido.");
        onClose();
    };

    return (
        <>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Fecha Expedición" name="date" type="datetime-local" value={formData.date} onChange={handleChange} required />
                    <Input label="Nº Factura" name="invoiceNumber" value={formData.invoiceNumber} onChange={handleChange} />
                </div>
                <Input label="Nombre o Razón Social Proveedor" name="providerName" value={formData.providerName} onChange={handleChange} required />
                <Input label="NIF/CIF Proveedor" name="providerNif" value={formData.providerNif} onChange={handleChange} />
                 <div className="flex items-center">
                    <Switch 
                        label="Operación Intracomunitaria (Mod. 349)"
                        checked={formData.isIntraCommunity ?? false} 
                        onChange={(c) => setFormData(p => ({...p, isIntraCommunity: c, vatRate: c ? 0 : data.settings.defaultVatRate }))}
                        disabled={!data.settings.isInROI}
                    />
                    <HelpTooltip content={!data.settings.isInROI ? "Activa la opción 'Estoy en el ROI' en Ajustes > Perfil Fiscal para habilitar esto." : "Marca esta opción si la factura es de un proveedor en otro país de la UE y ambos estáis en el ROI. El IVA soportado será 0%."} />
                </div>
                <Input label="Concepto" name="concept" value={formData.concept} onChange={handleChange} required />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Base Imponible (€)" name="baseAmount" type="number" step="0.01" value={formData.baseAmount} onChange={handleChange} required />
                    <Select label="Tipo de IVA (%)" name="vatRate" value={formData.vatRate} onChange={handleChange} disabled={formData.isIntraCommunity}>
                        <option value="21">21%</option><option value="10">10%</option><option value="4">4%</option><option value="0">0%</option>
                    </Select>
                </div>
                <Select label="Categoría" name="categoryId" value={formData.categoryId} onChange={handleChange} required>
                    {data.professionalCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </Select>
                <Select label="Ubicación del Gasto" name="location" value={formData.location} onChange={handleChange}>
                    {Object.values(MoneyLocation).map(loc => <option key={loc} value={loc}>{loc}</option>)}
                </Select>
                
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Adjuntar Factura</label>
                    <div className="flex items-center gap-2">
                        <div className="flex-grow">
                            {!formData.attachment ? (
                                <Input type="file" label="" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} accept="image/*,application/pdf" />
                            ) : (
                                <div className="flex items-center justify-between p-2 bg-slate-100 dark:bg-slate-700 rounded-md">
                                    <span className="text-sm truncate"><Icon name="paperclip" className="inline w-4 h-4 mr-2" />{formData.attachment.name}</span>
                                    <Button variant="ghost" size="sm" onClick={() => handleFileChange(null)}><Icon name="x" className="w-4 h-4" /></Button>
                                </div>
                            )}
                        </div>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setIsAiModalOpen(true)}
                            disabled={!data.settings.geminiApiKey}
                            title={!data.settings.geminiApiKey ? "Configura tu API Key de Gemini en Ajustes" : "Escanear con IA"}
                        >
                            <Icon name="sparkles" className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                <div className="border-t dark:border-slate-700 pt-4 space-y-4">
                    <div className="flex items-center">
                        <Switch 
                            label="Es un gasto de alquiler (para Mod. 115)"
                            checked={isRentalExpense} 
                            onChange={handleRentalExpenseChange} 
                        />
                        <HelpTooltip content="Activa esto si el gasto corresponde al alquiler de tu local u oficina. Se pedirán datos adicionales para el modelo 115." />
                    </div>

                    {isRentalExpense && (
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-md grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="NIF del Arrendador"
                                name="landlordNif"
                                value={formData.landlordNif || ''}
                                onChange={handleChange}
                                required
                            />
                            <Input
                                label="Referencia Catastral"
                                name="propertyCadastralRef"
                                value={formData.propertyCadastralRef || ''}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    )}
                    <Switch label="Gasto Deducible" checked={formData.isDeductible ?? true} onChange={(c) => setFormData(p => ({...p, isDeductible: c}))} />
                    
                    <div className="flex justify-between items-center">
                        <Switch label="Deducibilidad Parcial" checked={isPartiallyDeductible} onChange={handlePartialDeductibilityChange} />
                        <Button type="button" variant="ghost" size="sm" onClick={handleAiDeductibilityCheck} disabled={isAiAnalyzing || !data.settings.geminiApiKey}>
                            <Icon name="sparkles" className="w-4 h-4"/> {isAiAnalyzing ? 'Analizando...' : 'Sugerir con IA'}
                        </Button>
                    </div>
                    {aiSuggestion && <p className="text-xs text-slate-500 p-2 bg-slate-100 dark:bg-slate-700 rounded-md">{aiSuggestion}</p>}
                    
                    {isPartiallyDeductible && (
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-md">
                            <Input
                                label="Base Deducible (€)"
                                name="deductibleBaseAmount"
                                type="number"
                                step="0.01"
                                value={formData.deductibleBaseAmount || ''}
                                onChange={handleChange}
                                required
                                error={formData.deductibleBaseAmount && formData.baseAmount && formData.deductibleBaseAmount > formData.baseAmount ? "No puede ser mayor que la base imponible total." : ""}
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Indica qué parte de la base imponible ({formatCurrencyForUI(formData.baseAmount || 0)}) es fiscalmente deducible.
                            </p>
                        </div>
                    )}
                    
                    <Switch label="Aplicar Retención de IRPF" checked={hasIrpfRetention} onChange={handleIrpfRetentionChange} />

                    {hasIrpfRetention && (
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-md grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                            <Select label="Retención IRPF (%)" name="irpfRetentionRate" value={formData.irpfRetentionRate || ''} onChange={handleChange}>
                                <option value="19">19% (Alquiler)</option>
                                <option value="15">15% (Profesional)</option>
                                <option value="7">7% (Nuevos Autónomos)</option>
                                <option value="1">1% (Ciertas actividades)</option>
                            </Select>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Importe Retenido</label>
                                <p className="p-2 bg-slate-200 dark:bg-slate-700 rounded-md text-sm">{formatCurrencyForUI(formData.irpfRetentionAmount || 0)}</p>
                            </div>
                        </div>
                    )}

                    {data.settings.isInRecargoEquivalencia && (
                        <Switch label="Aplicar Recargo de Equivalencia" checked={hasRecargoEquivalencia} onChange={handleRecargoChange} />
                    )}

                    {hasRecargoEquivalencia && data.settings.isInRecargoEquivalencia && (
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-md grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                            <Select label="Recargo de Equivalencia (%)" name="recargoEquivalenciaRate" value={formData.recargoEquivalenciaRate || ''} onChange={handleChange}>
                                <option value="5.2">5.2% (General)</option>
                                <option value="1.4">1.4% (Reducido)</option>
                                <option value="0.5">0.5% (Superreducido)</option>
                            </Select>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Importe Recargo</label>
                                <p className="p-2 bg-slate-200 dark:bg-slate-700 rounded-md text-sm">{formatCurrencyForUI(formData.recargoEquivalenciaAmount || 0)}</p>
                            </div>
                        </div>
                    )}
                </div>

                <Switch label="Marcar como Pagado" checked={formData.isPaid ?? true} onChange={(c) => setFormData(p => ({...p, isPaid: c}))} />
                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button type="submit">{expenseToEdit?.id ? 'Guardar Cambios' : 'Añadir Gasto'}</Button>
                </div>
            </form>
            {isAiModalOpen && (
                <AiModal
                    isOpen={isAiModalOpen}
                    onClose={() => setIsAiModalOpen(false)}
                    onAnalysisComplete={handleAiAnalysisComplete}
                    apiKey={data.settings.geminiApiKey}
                    fixedType="expense"
                />
            )}
        </>
    );
};

export const InvestmentGoodForm: React.FC<{ onClose: () => void; goodToEdit?: Partial<InvestmentGood> | null; }> = ({ onClose, goodToEdit }) => {
    const { data, saveData } = useContext(AppContext)!;
    const [formData, setFormData] = useState<Partial<InvestmentGood>>({
        id: goodToEdit?.id || `inv-${Date.now()}`,
        purchaseDate: goodToEdit?.purchaseDate ? formatDateForDateTimeLocalInput(goodToEdit.purchaseDate) : formatDateForDateTimeLocalInput(),
        description: goodToEdit?.description || '',
        providerName: goodToEdit?.providerName || '',
        providerNif: goodToEdit?.providerNif || '',
        invoiceNumber: goodToEdit?.invoiceNumber || '',
        acquisitionValue: goodToEdit?.acquisitionValue || 0,
        vatRate: goodToEdit?.vatRate ?? data.settings.defaultVatRate,
        usefulLife: goodToEdit?.usefulLife || 4,
        attachment: goodToEdit?.attachment,
        isDeductible: goodToEdit?.isDeductible ?? true,
        categoryId: goodToEdit?.categoryId || (data.professionalCategories.find(c=>c.name.toLowerCase().includes('hardware'))?.id || data.professionalCategories[0]?.id || ''),
        isPaid: goodToEdit?.isPaid ?? true,
        paymentDate: goodToEdit?.paymentDate,
        location: goodToEdit?.location || MoneyLocation.PRO_BANK,
    });
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);

     const handleFileChange = async (file: File | null) => {
        if (!file) { setFormData(prev => ({ ...prev, attachment: undefined })); return; }
        const base64 = await fileToBase64(file);
        setFormData(prev => ({ ...prev, attachment: { name: file.name, type: file.type, data: base64 } }));
    };

    const handleAiAnalysisComplete = (extractedData: any, type: 'income' | 'expense' | 'investment', file: File) => {
        setFormData(prev => ({
            ...prev,
            ...extractedData,
            purchaseDate: extractedData.purchaseDate ? formatDateForDateTimeLocalInput(extractedData.purchaseDate) : prev.purchaseDate
        }));
        handleFileChange(file);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: name.includes('Value') || name.includes('Life') || name.includes('Rate') ? parseFloat(value) : value }));
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
                ? prev.investmentGoods.map(g => g.id === goodToEdit.id ? newGood : g)
                : [...prev.investmentGoods, newGood],
        }), isEditing ? "Bien de inversión actualizado." : "Bien de inversión añadido.");
        onClose();
    };

    return (
        <>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Fecha de Compra" name="purchaseDate" type="datetime-local" value={formData.purchaseDate} onChange={handleChange} required />
                <Input label="Descripción del Bien" name="description" value={formData.description} onChange={handleChange} required />
                 <Select label="Categoría" name="categoryId" value={formData.categoryId} onChange={handleChange} required>
                    {data.professionalCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </Select>
                <Input label="Nombre del Proveedor" name="providerName" value={formData.providerName} onChange={handleChange} required />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="NIF/CIF Proveedor" name="providerNif" value={formData.providerNif} onChange={handleChange} />
                    <Input label="Nº Factura" name="invoiceNumber" value={formData.invoiceNumber} onChange={handleChange} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input label="Base Imponible (€)" name="acquisitionValue" type="number" step="0.01" min="0" value={formData.acquisitionValue} onChange={handleChange} required />
                    <Select label="Tipo de IVA (%)" name="vatRate" value={formData.vatRate} onChange={handleChange}>
                        <option value="21">21%</option><option value="10">10%</option><option value="4">4%</option><option value="0">0%</option>
                    </Select>
                    <Input label="Vida Útil (Años)" name="usefulLife" type="number" step="1" min="1" value={formData.usefulLife} onChange={handleChange} required />
                </div>
                
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Adjuntar Factura</label>
                    <div className="flex items-center gap-2">
                        <div className="flex-grow">
                            {!formData.attachment ? (
                                <Input type="file" label="" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} accept="image/*,application/pdf" />
                            ) : (
                                <div className="flex items-center justify-between p-2 bg-slate-100 dark:bg-slate-700 rounded-md">
                                    <span className="text-sm truncate"><Icon name="paperclip" className="inline w-4 h-4 mr-2" />{formData.attachment.name}</span>
                                    <Button variant="ghost" size="sm" onClick={() => handleFileChange(null)}><Icon name="x" className="w-4 h-4" /></Button>
                                </div>
                            )}
                        </div>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setIsAiModalOpen(true)}
                            disabled={!data.settings.geminiApiKey}
                            title={!data.settings.geminiApiKey ? "Configura tu API Key de Gemini en Ajustes" : "Escanear con IA"}
                        >
                            <Icon name="sparkles" className="w-5 h-5" />
                        </Button>
                    </div>
                </div>
                
                <Select label="Ubicación del Pago" name="location" value={formData.location} onChange={handleChange}>
                    {Object.values(MoneyLocation).map(loc => <option key={loc} value={loc}>{loc}</option>)}
                </Select>
                <Switch label="Bien Deducible" checked={formData.isDeductible ?? true} onChange={(c) => setFormData(p => ({...p, isDeductible: c}))} />
                <Switch label="Marcar como Pagado" checked={formData.isPaid ?? true} onChange={(c) => setFormData(p => ({...p, isPaid: c}))} />

                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button type="submit">{goodToEdit?.id ? 'Guardar Cambios' : 'Añadir Bien'}</Button>
                </div>
            </form>
            {isAiModalOpen && (
                <AiModal
                    isOpen={isAiModalOpen}
                    onClose={() => setIsAiModalOpen(false)}
                    onAnalysisComplete={handleAiAnalysisComplete}
                    apiKey={data.settings.geminiApiKey}
                    fixedType="investment"
                />
            )}
        </>
    );
};

export const MovementForm: React.FC<{
    onClose: () => void;
    movementToEdit?: Partial<PersonalMovement> | null;
    defaultIsPaid?: boolean;
    defaultType?: 'income' | 'expense';
  }> = ({ onClose, movementToEdit, defaultIsPaid = true, defaultType = 'expense' }) => {
    const context = useContext(AppContext);
    if (!context) throw new Error("Context not available");
    const { data, saveData } = context;
  
    const [formData, setFormData] = useState<Partial<PersonalMovement>>({
      id: movementToEdit?.id || `pm-${Date.now()}`,
      date: movementToEdit?.date ? formatDateForDateTimeLocalInput(movementToEdit.date) : formatDateForDateTimeLocalInput(),
      concept: movementToEdit?.concept || '',
      amount: movementToEdit?.amount || 0,
      type: movementToEdit?.type || defaultType,
      categoryId: movementToEdit?.categoryId || (data.personalCategories[0]?.id || ''),
      source: movementToEdit?.source || MoneySource.PERSONAL,
      location: movementToEdit?.location || MoneyLocation.PERS_BANK,
      isPaid: movementToEdit?.isPaid ?? defaultIsPaid,
      paymentDate: movementToEdit?.paymentDate,
    });
  
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: name === 'amount' ? parseFloat(value) : value }));
    };
  
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const isEditing = movementToEdit?.id && data.personalMovements.some(m => m.id === movementToEdit.id);
      const newMovement = { ...formData, date: new Date(formData.date!).toISOString() } as PersonalMovement;
      if (newMovement.isPaid && !newMovement.paymentDate) {
        newMovement.paymentDate = newMovement.date;
      }

      saveData(prevData => ({
        ...prevData,
        personalMovements: isEditing
          ? prevData.personalMovements.map(m => m.id === movementToEdit.id ? newMovement : m)
          : [...prevData.personalMovements, newMovement],
      }), isEditing ? "Movimiento actualizado." : "Movimiento añadido.");
      onClose();
    };
  
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-4 mb-4">
            <Button type="button" variant={formData.type === 'expense' ? 'primary' : 'secondary'} onClick={() => setFormData(p => ({...p, type: 'expense'}))} className="flex-1">Gasto</Button>
            <Button type="button" variant={formData.type === 'income' ? 'primary' : 'secondary'} onClick={() => setFormData(p => ({...p, type: 'income'}))} className="flex-1">Ingreso</Button>
        </div>
        <Input label="Fecha" name="date" type="datetime-local" value={formData.date} onChange={handleChange} required />
        <Input label="Concepto" name="concept" value={formData.concept} onChange={handleChange} required />
        <Input label="Importe (€)" name="amount" type="number" step="0.01" min="0" value={formData.amount} onChange={handleChange} required />
        <Select label="Categoría" name="categoryId" value={formData.categoryId} onChange={handleChange} required>
            {data.personalCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
        </Select>
        <Select label="Ubicación del dinero" name="location" value={formData.location} onChange={handleChange} required>
          {Object.values(MoneyLocation).map(l => <option key={l} value={l}>{l}</option>)}
        </Select>
        {formData.type === 'income' && (
          <Select label="Fuente" name="source" value={formData.source} onChange={handleChange}>
             {Object.values(MoneySource).map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        )}
        <Switch label="Marcar como Pagado/Recibido" checked={formData.isPaid ?? false} onChange={(c) => setFormData(p => ({...p, isPaid: c}))} />
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit">{movementToEdit?.id ? 'Guardar Cambios' : 'Añadir Movimiento'}</Button>
        </div>
      </form>
    );
  };
  

export const TransferForm: React.FC<{
    onClose: () => void;
    transferToEdit: Partial<Transfer> | null;
}> = ({ onClose, transferToEdit }) => {
    const { saveData } = useContext(AppContext)!;

    const [formData, setFormData] = useState<Partial<Transfer>>({
        id: transferToEdit?.id || `tr-${Date.now()}`,
        date: transferToEdit?.date ? formatDateForDateTimeLocalInput(transferToEdit.date) : formatDateForDateTimeLocalInput(),
        amount: transferToEdit?.amount || 0,
        fromLocation: transferToEdit?.fromLocation || MoneyLocation.PRO_BANK,
        toLocation: transferToEdit?.toLocation || MoneyLocation.CASH,
        concept: transferToEdit?.concept || '',
        justification: transferToEdit?.justification || TransferJustification.SUELDO_AUTONOMO
    });

    const [error, setError] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: name === 'amount' ? parseFloat(value) : value}));
        if(name === 'fromLocation' || name === 'toLocation') {
             setError('');
        }
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.fromLocation === formData.toLocation) {
            setError('La ubicación de origen y destino no pueden ser la misma.');
            return;
        }
        setError('');
        
        const finalTransfer: Transfer = {
            id: formData.id!,
            date: new Date(formData.date!).toISOString(),
            amount: formData.amount!,
            fromLocation: formData.fromLocation!,
            toLocation: formData.toLocation!,
            concept: formData.concept!,
            justification: formData.justification!
        };
        
        saveData(prev => ({
            ...prev,
            transfers: transferToEdit?.id
                ? prev.transfers.map(t => t.id === transferToEdit.id ? finalTransfer : t)
                : [...prev.transfers, finalTransfer]
        }), transferToEdit?.id ? "Transferencia actualizada." : "Transferencia realizada.");
        onClose();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Importe (€)" name="amount" type="number" min="0.01" step="0.01" value={formData.amount} onChange={handleChange} required />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select label="Desde" name="fromLocation" value={formData.fromLocation} onChange={handleChange}>
                    {Object.values(MoneyLocation).map(l => <option key={l} value={l}>{l}</option>)}
                </Select>
                 <Select label="Hasta" name="toLocation" value={formData.toLocation} onChange={handleChange}>
                    {Object.values(MoneyLocation).map(l => <option key={l} value={l}>{l}</option>)}
                </Select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Input label="Fecha" name="date" type="datetime-local" value={formData.date} onChange={handleChange} required />
            <Input label="Concepto" name="concept" value={formData.concept} onChange={handleChange} required />
            <Select label="Justificación (para informe fiscal)" name="justification" value={formData.justification} onChange={handleChange}>
                {Object.values(TransferJustification).map(j => <option key={j} value={j}>{j}</option>)}
            </Select>

            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                <Button type="submit">{transferToEdit?.id ? 'Guardar Cambios' : 'Añadir Transferencia'}</Button>
            </div>
        </form>
    )
};

export const SavingsGoalForm: React.FC<{
    onClose: () => void;
    goalToEdit: SavingsGoal | null;
}> = ({ onClose, goalToEdit }) => {
    const context = useContext(AppContext);
    if (!context) throw new Error("Context not available");
    const { saveData } = context;

    const [formData, setFormData] = useState(() => {
        const defaultDeadline = new Date();
        defaultDeadline.setMonth(defaultDeadline.getMonth() + 1);
        return {
            name: goalToEdit?.name || '',
            targetAmount: goalToEdit?.targetAmount || 0,
            deadline: goalToEdit ? formatDateForDateTimeLocalInput(goalToEdit.deadline) : formatDateForDateTimeLocalInput(defaultDeadline)
        }
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'targetAmount' ? parseFloat(value) : value }));
    };

    const setDeadline = (months: number) => {
        const newDeadline = new Date();
        newDeadline.setMonth(newDeadline.getMonth() + months);
        setFormData(prev => ({ ...prev, deadline: formatDateForDateTimeLocalInput(newDeadline) }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const message = goalToEdit ? "Objetivo de ahorro actualizado." : "Objetivo de ahorro creado.";
        if (goalToEdit) {
            const updatedGoal: SavingsGoal = {
                ...goalToEdit,
                name: formData.name,
                targetAmount: formData.targetAmount,
                deadline: new Date(formData.deadline).toISOString(),
            };
            saveData(prev => ({
                ...prev,
                savingsGoals: prev.savingsGoals.map(g => g.id === goalToEdit.id ? updatedGoal : g)
            }), message);
        } else {
            const newGoal: SavingsGoal = {
                id: `sg-${Date.now()}`,
                name: formData.name,
                targetAmount: formData.targetAmount,
                currentAmount: 0,
                deadline: new Date(formData.deadline).toISOString(),
            };
            saveData(prev => ({...prev, savingsGoals: [...prev.savingsGoals, newGoal]}), message);
        }
        onClose();
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Nombre del Objetivo" name="name" value={formData.name} onChange={handleChange} required />
            <Input label="Importe Objetivo (€)" name="targetAmount" type="number" step="0.01" min="0" value={formData.targetAmount} onChange={handleChange} required />
            
            <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Plazo Rápido</label>
                <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={() => setDeadline(1)}>1 Mes</Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => setDeadline(3)}>3 Meses</Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => setDeadline(6)}>6 Meses</Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => setDeadline(12)}>1 Año</Button>
                </div>
            </div>

            <Input label="Fecha Límite" name="deadline" type="datetime-local" value={formData.deadline} onChange={handleChange} required />
             <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                <Button type="submit">{goalToEdit ? 'Guardar Cambios' : 'Crear Objetivo'}</Button>
            </div>
        </form>
    );
}

// --- Add Funds Form ---
export const AddFundsForm: React.FC<{
  goal: SavingsGoal;
  onClose: () => void;
  onSaveSuccess: (isGoalCompleted: boolean) => void;
}> = ({ goal, onClose, onSaveSuccess }) => {
    const context = useContext(AppContext);
    if (!context) throw new Error("Context not available");
    const { saveData } = context;
    const [amount, setAmount] = useState(0);
    const [location, setLocation] = useState<MoneyLocation>(MoneyLocation.PERS_BANK);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (amount <= 0) return;

        let isCompleted = false;

        saveData(prev => {
            const currentGoal = prev.savingsGoals.find(g => g.id === goal.id);
            if (currentGoal) {
                const newCurrentAmount = currentGoal.currentAmount + amount;
                isCompleted = newCurrentAmount >= currentGoal.targetAmount;
            }
            
            // Update goal
            const updatedGoals = prev.savingsGoals.map(g => 
                g.id === goal.id ? { ...g, currentAmount: g.currentAmount + amount } : g
            );
            // Create expense movement
            const newMovement: PersonalMovement = {
                id: `pm-${Date.now()}`,
                date: new Date().toISOString(),
                concept: `Aportación a objetivo: ${goal.name}`,
                amount: amount,
                type: 'expense',
                categoryId: prev.personalCategories.find(c => c.name.toLowerCase().includes('ahorro'))?.id || prev.personalCategories[0].id,
                location: location,
                isPaid: true,
                paymentDate: new Date().toISOString(),
            };

            return {...prev, savingsGoals: updatedGoals, personalMovements: [...prev.personalMovements, newMovement]};
        }, `Aportación de ${formatCurrencyForUI(amount)} a "${goal.name}".`);
        
        onSaveSuccess(isCompleted);
        onClose();
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input label={`Añadir fondos a "${goal.name}"`} type="number" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value))} min="0.01" step="0.01" />
            <Select label="Desde" value={location} onChange={(e) => setLocation(e.target.value as MoneyLocation)}>
                {Object.values(MoneyLocation).map(l => <option key={l} value={l}>{l}</option>)}
            </Select>
            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                <Button type="submit">Añadir</Button>
            </div>
        </form>
    )
}