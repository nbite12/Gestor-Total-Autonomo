import React, { useState, useContext, useMemo, useCallback, useRef, useEffect } from 'react';
import { AppContext } from '../App';
import { Card, Icon, HelpTooltip, Button, Modal, Input, Select, Celebration } from './ui';
import { PeriodSelector } from './PeriodSelector';
import { PotentialIncome, MoneySource, MoneyLocation, Transfer, TransferJustification, PotentialExpense, Income, Expense, PersonalMovement, InvestmentGood, SavingsGoal, PotentialFrequency } from '../types';
// FIX: Import DatePickerInput from TransactionForms to use the shared component
import { IncomeForm, ExpenseForm, MovementForm, TransferForm, SavingsGoalForm, AddFundsForm, DatePickerInput } from './TransactionForms';
import { motion, AnimatePresence } from 'framer-motion';

// --- Helper Functions ---
const getMonthsInRange = (startDate: Date, endDate: Date): number => {
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();
    const startMonth = startDate.getMonth();
    const endMonth = endDate.getMonth();

    return (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
};

const getMonthsRemaining = (deadline: string): number => {
    const deadlineDate = new Date(deadline);
    const now = new Date();
    
    // Set to end of the day to include today in calculations
    deadlineDate.setHours(23, 59, 59, 999);
    now.setHours(0, 0, 0, 0);

    if (deadlineDate < now) return 0;
    
    const months = (deadlineDate.getFullYear() - now.getFullYear()) * 12 + (deadlineDate.getMonth() - now.getMonth());
    
    // If deadline is in the same month, we count it as 1 month remaining for contribution.
    return months <= 0 ? 1 : months;
};

const frequencyLabels: { [key in PotentialFrequency]: string } = {
    'one-off': 'Puntual',
    'weekly': 'Semanal',
    'monthly': 'Mensual',
    'quarterly': 'Trimestral',
    'yearly': 'Anual',
};


// --- Potential Income Form Modal ---
const PotentialIncomeForm: React.FC<{
    onClose: () => void;
    incomeToEdit: PotentialIncome | null;
}> = ({ onClose, incomeToEdit }) => {
    const { data: {settings}, saveData } = useContext(AppContext)!;
    
    const [formData, setFormData] = useState<Partial<PotentialIncome>>({
        id: incomeToEdit?.id || `pi-${Date.now()}`,
        concept: incomeToEdit?.concept || '',
        frequency: incomeToEdit?.frequency || (incomeToEdit?.type === 'monthly' ? 'monthly' : 'one-off'),
        startDate: incomeToEdit?.startDate || incomeToEdit?.date || new Date().toISOString(),
        endDate: incomeToEdit?.endDate,
        source: incomeToEdit?.source || MoneySource.AUTONOMO,
        location: incomeToEdit?.location || MoneyLocation.PRO_BANK,
        amount: incomeToEdit?.amount || 0,
        baseAmount: incomeToEdit?.baseAmount || 0,
        vatRate: incomeToEdit?.vatRate ?? settings.defaultVatRate,
        irpfRate: incomeToEdit?.irpfRate ?? settings.defaultIrpfRate,
    });
    const [hasEndDate, setHasEndDate] = useState(!!incomeToEdit?.endDate);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const isNumeric = ['amount', 'baseAmount', 'vatRate', 'irpfRate'].includes(name);
        setFormData(prev => ({...prev, [name]: isNumeric ? parseFloat(value) : value}));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        let baseIncomeData = {
            id: formData.id!,
            concept: formData.concept!,
            frequency: formData.frequency!,
            startDate: new Date(formData.startDate!).toISOString(),
            endDate: hasEndDate && formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
            source: formData.source!,
            location: formData.location!,
        };

        let finalIncome: PotentialIncome;

        if (formData.source === MoneySource.AUTONOMO) {
            finalIncome = {
                ...baseIncomeData,
                baseAmount: formData.baseAmount,
                vatRate: formData.vatRate,
                irpfRate: formData.irpfRate,
            };
        } else {
             finalIncome = {
                ...baseIncomeData,
                amount: formData.amount,
            };
        }
        
        saveData(prev => ({
            ...prev,
            potentialIncomes: incomeToEdit 
                ? prev.potentialIncomes.map(pi => pi.id === incomeToEdit.id ? finalIncome : pi)
                : [...prev.potentialIncomes, finalIncome]
        }), incomeToEdit ? "Ingreso potencial actualizado." : "Ingreso potencial añadido.");
        onClose();
    };
    
    useEffect(() => {
        if (!hasEndDate) {
            setFormData(p => ({...p, endDate: undefined}));
        }
    }, [hasEndDate]);

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Concepto" name="concept" value={formData.concept} onChange={handleChange} required />
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select label="Fuente" name="source" value={formData.source} onChange={handleChange}>
                    {Object.values(MoneySource).map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
                 <Select label="Ubicación del dinero" name="location" value={formData.location} onChange={handleChange}>
                    {Object.values(MoneyLocation).map(l => <option key={l} value={l}>{l}</option>)}
                </Select>
            </div>
            {formData.source === MoneySource.AUTONOMO ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border border-slate-300 dark:border-slate-600 rounded-md">
                   <Input label="Base Imponible (€)" name="baseAmount" type="number" min="0" step="0.01" value={formData.baseAmount} onChange={handleChange} required />
                   <Input label="IVA (%)" name="vatRate" type="number" min="0" step="0.01" value={formData.vatRate} onChange={handleChange} required />
                   <Input label="IRPF (%)" name="irpfRate" type="number" min="0" step="0.01" value={formData.irpfRate} onChange={handleChange} required />
                </div>
            ) : (
                <Input label="Importe Neto (€)" name="amount" type="number" min="0" step="0.01" value={formData.amount} onChange={handleChange} required />
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select label="Frecuencia" name="frequency" value={formData.frequency} onChange={handleChange}>
                    <option value="one-off">Puntual</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensual</option>
                    <option value="quarterly">Trimestral</option>
                    <option value="yearly">Anual</option>
                </Select>
                <DatePickerInput 
                    label={formData.frequency === 'one-off' ? "Fecha" : "Fecha de Inicio"} 
                    selectedDate={formData.startDate} 
                    onDateChange={(d) => setFormData(p => ({...p, startDate: d.toISOString()}))} 
                    required 
                />
            </div>
            
             {formData.frequency !== 'one-off' && (
                <div className="space-y-4">
                    <div className="flex items-center">
                        <input type="checkbox" id="has-end-date" name="has-end-date" checked={hasEndDate} onChange={(e) => setHasEndDate(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"/>
                        <label htmlFor="has-end-date" className="ml-2 block text-sm text-gray-900 dark:text-gray-200">Tiene fecha de fin</label>
                    </div>
                     <AnimatePresence>
                        {hasEndDate && (
                             <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <DatePickerInput 
                                    label="Fecha de Fin"
                                    selectedDate={formData.endDate}
                                    onDateChange={(d) => setFormData(p => ({...p, endDate: d.toISOString()}))}
                                    required={hasEndDate}
                                />
                             </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}


            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                <Button type="submit">{incomeToEdit ? 'Guardar Cambios' : 'Añadir Ingreso'}</Button>
            </div>
        </form>
    )
};

// --- Potential Expense Form Modal ---
const PotentialExpenseForm: React.FC<{
    onClose: () => void;
    expenseToEdit: PotentialExpense | null;
}> = ({ onClose, expenseToEdit }) => {
    const { data: { personalCategories }, saveData } = useContext(AppContext)!;
    
    const [formData, setFormData] = useState<Partial<PotentialExpense>>({
        id: expenseToEdit?.id || `pe-${Date.now()}`,
        concept: expenseToEdit?.concept || '',
        frequency: expenseToEdit?.frequency || (expenseToEdit?.type === 'monthly' ? 'monthly' : 'one-off'),
        startDate: expenseToEdit?.startDate || expenseToEdit?.date || new Date().toISOString(),
        endDate: expenseToEdit?.endDate,
        amount: expenseToEdit?.amount || 0,
        categoryId: expenseToEdit?.categoryId || (personalCategories[0]?.id || ''),
    });
    const [hasEndDate, setHasEndDate] = useState(!!expenseToEdit?.endDate);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: name === 'amount' ? parseFloat(value) : value}));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalExpense: PotentialExpense = {
            id: formData.id!,
            concept: formData.concept!,
            frequency: formData.frequency!,
            startDate: new Date(formData.startDate!).toISOString(),
            endDate: hasEndDate && formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
            amount: formData.amount!,
            categoryId: formData.categoryId!,
        };
        
        saveData(prev => ({
            ...prev,
            potentialExpenses: expenseToEdit 
                ? prev.potentialExpenses.map(pe => pe.id === expenseToEdit.id ? finalExpense : pe)
                : [...prev.potentialExpenses, finalExpense],
        }), expenseToEdit ? "Gasto potencial actualizado." : "Gasto potencial añadido.");
        onClose();
    };
    
    useEffect(() => {
        if (!hasEndDate) {
            setFormData(p => ({...p, endDate: undefined}));
        }
    }, [hasEndDate]);

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Concepto" name="concept" value={formData.concept} onChange={handleChange} required />
            <Input label="Importe (€)" name="amount" type="number" min="0" step="0.01" value={formData.amount} onChange={handleChange} required />
            <Select label="Categoría" name="categoryId" value={formData.categoryId} onChange={handleChange} required>
                {personalCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </Select>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select label="Frecuencia" name="frequency" value={formData.frequency} onChange={handleChange}>
                    <option value="one-off">Puntual</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensual</option>
                    <option value="quarterly">Trimestral</option>
                    <option value="yearly">Anual</option>
                </Select>
                <DatePickerInput 
                    label={formData.frequency === 'one-off' ? "Fecha" : "Fecha de Inicio"} 
                    selectedDate={formData.startDate} 
                    onDateChange={(d) => setFormData(p => ({...p, startDate: d.toISOString()}))} 
                    required 
                />
            </div>
            
            {formData.frequency !== 'one-off' && (
                <div className="space-y-4">
                     <div className="flex items-center">
                        <input type="checkbox" id="has-end-date-exp" name="has-end-date-exp" checked={hasEndDate} onChange={(e) => setHasEndDate(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"/>
                        <label htmlFor="has-end-date-exp" className="ml-2 block text-sm text-gray-900 dark:text-gray-200">Tiene fecha de fin</label>
                    </div>
                     <AnimatePresence>
                        {hasEndDate && (
                             <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <DatePickerInput 
                                    label="Fecha de Fin"
                                    selectedDate={formData.endDate}
                                    onDateChange={(d) => setFormData(p => ({...p, endDate: d.toISOString()}))}
                                    required={hasEndDate}
                                />
                             </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
            
            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                <Button type="submit">{expenseToEdit ? 'Guardar Cambios' : 'Añadir Gasto'}</Button>
            </div>
        </form>
    );
};

// --- Contabilize Modal ---
const ContabilizeModal: React.FC<{
    item: Income | Expense | PersonalMovement;
    onClose: () => void;
    onSave: (id: string, paymentDate: string, location: MoneyLocation) => void;
}> = ({ item, onClose, onSave }) => {
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString());
    const [location, setLocation] = useState(item.location || MoneyLocation.PRO_BANK);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(item.id, new Date(paymentDate).toISOString(), location);
        onClose();
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <p>Contabilizar: <strong>{item.concept}</strong></p>
            <DatePickerInput 
                label="Fecha de Pago/Cobro"
                selectedDate={paymentDate}
                onDateChange={(d) => setPaymentDate(d.toISOString())}
                required
            />
            <Select
                label="Ubicación del Dinero"
                value={location}
                onChange={(e) => setLocation(e.target.value as MoneyLocation)}
            >
                {Object.values(MoneyLocation).map(l => <option key={l} value={l}>{l}</option>)}
            </Select>
            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                <Button type="submit">Confirmar Pago</Button>
            </div>
        </form>
    )
};

// --- Periodize Modal ---
const PeriodizeExpenseModal: React.FC<{
    expense: Expense;
    onClose: () => void;
}> = ({ expense, onClose }) => {
    const { saveData } = useContext(AppContext)!;
    const [paymentDate, setPaymentDate] = useState(expense.date);
    const [location, setLocation] = useState(expense.location || MoneyLocation.PRO_BANK);
    const [periodStartDate, setPeriodStartDate] = useState(expense.date);
    const [periodEndDate, setPeriodEndDate] = useState(() => {
        const date = new Date(expense.date);
        date.setFullYear(date.getFullYear() + 1);
        date.setDate(date.getDate() - 1);
        return date.toISOString();
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const pStartDate = new Date(periodStartDate);
        const pEndDate = new Date(periodEndDate);

        if (pEndDate <= pStartDate) {
            alert("La fecha de fin debe ser posterior a la fecha de inicio.");
            return;
        }

        saveData(prev => {
            const months = getMonthsInRange(pStartDate, pEndDate);
            if (months <= 0) return prev;

            const monthlyBase = expense.baseAmount / months;
            
            const paymentExpense: Expense = {
                ...expense,
                id: `exp-pmt-${Date.now()}`,
                date: new Date(paymentDate).toISOString(),
                isPaid: true,
                paymentDate: new Date(paymentDate).toISOString(),
                location: location,
                isDeductible: false,
                concept: `${expense.concept} (Pago Periodificado)`
            };

            const periodizedExpenses: Expense[] = [];
            for (let i = 0; i < months; i++) {
                const monthDate = new Date(pStartDate);
                monthDate.setMonth(monthDate.getMonth() + i);

                const newMonthlyExpense: Expense = {
                    ...expense,
                    id: `exp-prd-${Date.now()}-${i}`,
                    date: monthDate.toISOString(),
                    baseAmount: monthlyBase,
                    isPaid: false, // These are accounting entries, not cash flow
                    location: undefined,
                    paymentDate: undefined,
                    isDeductible: true,
                    concept: `${expense.concept} (Mes ${i+1}/${months})`,
                    attachment: undefined, // Attachment stays with payment record
                };
                periodizedExpenses.push(newMonthlyExpense);
            }

            const updatedExpenses = prev.expenses
                .filter(e => e.id !== expense.id) // Remove original
                .concat([paymentExpense, ...periodizedExpenses]); // Add new ones
            
            return { ...prev, expenses: updatedExpenses };
        }, "Gasto periodificado correctamente.");

        onClose();
    };


    return (
        <form onSubmit={handleSubmit} className="space-y-4">
             <p>Periodizar: <strong>{expense.concept}</strong></p>
             <fieldset className="p-4 border border-slate-300 dark:border-slate-600 rounded-md space-y-4">
                <legend className="text-sm font-medium px-2">Detalles del Pago Real</legend>
                 <DatePickerInput 
                    label="Fecha de Pago"
                    selectedDate={paymentDate}
                    onDateChange={(d) => setPaymentDate(d.toISOString())}
                    required
                />
                <Select
                    label="Pagado Desde"
                    value={location}
                    onChange={(e) => setLocation(e.target.value as MoneyLocation)}
                >
                    {Object.values(MoneyLocation).map(l => <option key={l} value={l}>{l}</option>)}
                </Select>
             </fieldset>

             <fieldset className="p-4 border border-slate-300 dark:border-slate-600 rounded-md space-y-4">
                <legend className="text-sm font-medium px-2">Periodo a Cubrir</legend>
                 <DatePickerInput 
                    label="Fecha de Inicio del Gasto"
                    selectedDate={periodStartDate}
                    onDateChange={(d) => setPeriodStartDate(d.toISOString())}
                    required
                />
                <DatePickerInput 
                    label="Fecha de Fin del Gasto"
                    selectedDate={periodEndDate}
                    onDateChange={(d) => setPeriodEndDate(d.toISOString())}
                    required
                />
             </fieldset>

             <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                <Button type="submit">Confirmar y Periodizar</Button>
            </div>
        </form>
    )
}

// --- Add Pending Transaction Modal ---
const AddPendingTransactionModal: React.FC<{ isOpen: boolean; onClose: () => void; isProfessionalModeEnabled: boolean; }> = ({ isOpen, onClose, isProfessionalModeEnabled }) => {
    const [scope, setScope] = useState<'professional' | 'personal'>(isProfessionalModeEnabled ? 'professional' : 'personal');
    const [type, setType] = useState<'income' | 'expense'>('income');
  
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Añadir Transacción Pendiente">
        <div className="flex flex-col space-y-4">
          {isProfessionalModeEnabled && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200 dark:bg-slate-700 rounded-lg">
                <Button variant={scope === 'professional' ? 'primary' : 'secondary'} onClick={() => setScope('professional')} className="flex-1">Profesional</Button>
                <Button variant={scope === 'personal' ? 'primary' : 'secondary'} onClick={() => setScope('personal')} className="flex-1">Personal</Button>
            </div>
          )}
          
          {scope === 'professional' && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200 dark:bg-slate-700 rounded-lg">
                <Button variant={type === 'income' ? 'primary' : 'secondary'} onClick={() => setType('income')} className="flex-1">Ingreso / Cobro</Button>
                <Button variant={type === 'expense' ? 'primary' : 'secondary'} onClick={() => setType('expense')} className="flex-1">Gasto / Pago</Button>
            </div>
          )}
          
          <div className="pt-2">
            {scope === 'professional' && type === 'income' && <IncomeForm onClose={onClose} defaultIsPaid={false} />}
            {scope === 'professional' && type === 'expense' && <ExpenseForm onClose={onClose} defaultIsPaid={false} />}
            {scope === 'personal' && <MovementForm onClose={onClose} defaultIsPaid={false} />}
          </div>
        </div>
      </Modal>
    );
  };

// --- Taxes Breakdown Modal ---
const TaxesBreakdownModal: React.FC<{ isOpen: boolean; onClose: () => void; breakdown: any; formatCurrency: (val: number) => string; }> = ({ isOpen, onClose, breakdown, formatCurrency }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Desglose de Impuestos Trimestrales">
            <div className="space-y-4 text-sm">
                <p className="text-slate-600 dark:text-slate-400">Esta es una estimación de los impuestos a pagar para el trimestre actual, basada en los datos introducidos hasta ahora.</p>
                <div className="space-y-2 rounded-lg bg-black/5 dark:bg-white/5 p-4">
                    <div className="flex justify-between"><span>Modelo 303 (IVA):</span> <span className="font-semibold">{formatCurrency(breakdown.model303Result)}</span></div>
                    <div className="flex justify-between"><span>Modelo 130 (IRPF):</span> <span className="font-semibold">{formatCurrency(breakdown.model130Result)}</span></div>
                    <div className="flex justify-between"><span>Modelo 111 (Ret. Prof.):</span> <span className="font-semibold">{formatCurrency(breakdown.model111Result)}</span></div>
                    <div className="flex justify-between"><span>Modelo 115 (Ret. Alquiler):</span> <span className="font-semibold">{formatCurrency(breakdown.model115Result)}</span></div>
                    <div className="border-t-2 dark:border-slate-500 my-2 pt-2 flex justify-between text-base">
                        <span className="font-bold">Total Estimado:</span>
                        <span className="font-bold">{formatCurrency(breakdown.totalProjectedTaxes)}</span>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

// --- Local Toggle Switch Component ---
const Toggle: React.FC<{ checked: boolean; onChange: () => void; }> = ({ checked, onChange }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`${checked ? 'bg-green-500' : 'bg-black/10 dark:bg-white/10'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500`}
    >
        <span
            aria-hidden="true"
            className={`${checked ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
        />
    </button>
);


// --- Global View ---
const GlobalView: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return <div>Cargando...</div>;

    const { data, saveData, formatCurrency, isProfessionalModeEnabled } = context;
    const { incomes, expenses, personalMovements, settings, savingsGoals, potentialIncomes, potentialExpenses, transfers, personalCategories, investmentGoods } = data;

    const [period, setPeriod] = useState<{ startDate: Date; endDate: Date }>(() => {
        const end = new Date();
        const start = new Date(end.getFullYear(), end.getMonth(), 1);
        return { startDate: start, endDate: end };
    });
    
    const [includeSavings, setIncludeSavings] = useState(true);
    const [includePotentialIncome, setIncludePotentialIncome] = useState(true);
    const [includePotentialExpenses, setIncludePotentialExpenses] = useState(true);
    const [includePendingTransactions, setIncludePendingTransactions] = useState(false);
    const [showProjection, setShowProjection] = useState(false);
    const [isTaxesBreakdownOpen, setIsTaxesBreakdownOpen] = useState(false);

    const [includeNetCapitalItems, setIncludeNetCapitalItems] = useState({
        pendingIncome: true,
        pendingExpenses: true,
        taxes: true,
    });


    const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
    const [incomeToEdit, setIncomeToEdit] = useState<PotentialIncome | null>(null);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [expenseToEdit, setExpenseToEdit] = useState<PotentialExpense | null>(null);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferToEdit, setTransferToEdit] = useState<Transfer | null>(null);
    const [isGoalFormOpen, setIsGoalFormOpen] = useState(false);
    const [goalToEdit, setGoalToEdit] = useState<SavingsGoal | null>(null);
    const [goalToAddFunds, setGoalToAddFunds] = useState<SavingsGoal | null>(null);
    const [celebrationType, setCelebrationType] = useState<'none' | 'contribution' | 'goalComplete'>('none');


    // State for pending transaction modals
    const [itemToContabilize, setItemToContabilize] = useState<Income | Expense | PersonalMovement | null>(null);
    const [expenseToPeriodize, setExpenseToPeriodize] = useState<Expense | null>(null);
    const [isAddPendingModalOpen, setIsAddPendingModalOpen] = useState(false);

    // State for editing pending transactions
    const [professionalIncomeToEdit, setProfessionalIncomeToEdit] = useState<Income | null>(null);
    const [professionalExpenseToEdit, setProfessionalExpenseToEdit] = useState<Expense | null>(null);
    const [personalMovementToEdit, setPersonalMovementToEdit] = useState<PersonalMovement | null>(null);
    
    const [typeFilters, setTypeFilters] = useState({
        proIncome: true,
        proExpense: true,
        persIncome: true,
        persExpense: true,
        transfer: true,
    });
    
    const handleFilterChange = (filterKey: keyof typeof typeFilters) => {
        setTypeFilters(prev => ({ ...prev, [filterKey]: !prev[filterKey] }));
    };

    const handleToggleNetCapitalItem = (item: keyof typeof includeNetCapitalItems) => {
        setIncludeNetCapitalItems(prev => ({ ...prev, [item]: !prev[item] }));
    };


    const handlePeriodChange = useCallback((startDate: Date, endDate: Date) => setPeriod({ startDate, endDate }), []);

    // --- Memoized Calculations ---
    const monthsInPeriod = useMemo(() => getMonthsInRange(period.startDate, period.endDate), [period]);

    const moneyDistribution = useMemo(() => {
        const balances: { [key in MoneyLocation]: number } = {
            [MoneyLocation.CASH_PRO]: data.settings.initialBalances?.[MoneyLocation.CASH_PRO] || 0,
            [MoneyLocation.CASH]: data.settings.initialBalances?.[MoneyLocation.CASH] || 0,
            [MoneyLocation.PRO_BANK]: data.settings.initialBalances?.[MoneyLocation.PRO_BANK] || 0,
            [MoneyLocation.PERS_BANK]: data.settings.initialBalances?.[MoneyLocation.PERS_BANK] || 0,
            [MoneyLocation.OTHER]: data.settings.initialBalances?.[MoneyLocation.OTHER] || 0,
        };

        data.incomes.forEach(income => {
            if (income.isPaid && income.location) {
                const netAmount = income.baseAmount + (income.baseAmount * income.vatRate / 100) - (income.baseAmount * income.irpfRate / 100);
                balances[income.location] = (balances[income.location] || 0) + netAmount;
            }
        });

        data.expenses.forEach(expense => {
            if (expense.isPaid && expense.location) {
                // FIX: Correct cash flow logic to always subtract the full expense amount (base + VAT). The previous logic was incorrect for cash flow.
                const totalAmount = expense.baseAmount + (expense.baseAmount * expense.vatRate / 100);
                balances[expense.location] = (balances[expense.location] || 0) - totalAmount;
            }
        });

        data.investmentGoods.forEach(good => {
            if (good.isPaid && good.location) {
                const totalAmount = good.acquisitionValue + (good.acquisitionValue * good.vatRate / 100);
                balances[good.location] = (balances[good.location] || 0) - totalAmount;
            }
        });

        data.personalMovements.filter(m => m.isPaid).forEach(movement => {
            if (movement.location) {
                if (movement.type === 'income') {
                    balances[movement.location] = (balances[movement.location] || 0) + movement.amount;
                } else {
                    balances[movement.location] = (balances[movement.location] || 0) - movement.amount;
                }
            }
        });
        
        data.transfers.forEach(transfer => {
            balances[transfer.fromLocation] = (balances[transfer.fromLocation] || 0) - transfer.amount;
            balances[transfer.toLocation] = (balances[transfer.toLocation] || 0) + transfer.amount;
        });

        return balances;
    }, [data]);
    
    const netCapitalSummary = useMemo(() => {
        const professionalBalance = (moneyDistribution[MoneyLocation.PRO_BANK] || 0) + (moneyDistribution[MoneyLocation.CASH_PRO] || 0);
        const personalBalance = (moneyDistribution[MoneyLocation.PERS_BANK] || 0) + (moneyDistribution[MoneyLocation.CASH] || 0) + (moneyDistribution[MoneyLocation.OTHER] || 0);
        const currentTotalBalance = professionalBalance + personalBalance;
        
        const pendingProfessionalIncome = data.incomes.filter(i => !i.isPaid).reduce((sum, i) => sum + (i.baseAmount + (i.baseAmount * i.vatRate / 100) - (i.baseAmount * i.irpfRate / 100)), 0);
        const pendingPersonalIncome = data.personalMovements.filter(m => m.type === 'income' && !m.isPaid).reduce((sum, m) => sum + m.amount, 0);
        const totalPendingIncome = pendingProfessionalIncome + pendingPersonalIncome;
        
        const pendingProfessionalExpense = data.expenses.filter(e => !e.isPaid).reduce((sum, e) => {
            const expenseTotal = e.baseAmount + (e.baseAmount * e.vatRate / 100);
            return sum + expenseTotal;
        }, 0);
        const pendingPersonalExpense = data.personalMovements.filter(m => m.type === 'expense' && !m.isPaid).reduce((sum, m) => sum + m.amount, 0);
        const totalPendingExpenses = pendingProfessionalExpense + pendingPersonalExpense;

        const now = new Date();
        const year = now.getFullYear();
        const quarter = Math.floor(now.getMonth() / 3);
        const qPeriod = { startDate: new Date(year, quarter * 3, 1), endDate: new Date(year, quarter * 3 + 3, 0, 23, 59, 59, 999) };

        const { incomes, expenses, investmentGoods, settings } = data;
        const getCuotaIVA = (base: number, rate: number) => base * (rate / 100);
        const getCuotaIRPF = (base: number, rate: number) => base * (rate / 100);
        
        const qIncomes = incomes.filter(i => new Date(i.date) >= qPeriod.startDate && new Date(i.date) <= qPeriod.endDate);
        const qDeductibleExpenses = expenses.filter(e => e.isDeductible && new Date(e.date) >= qPeriod.startDate && new Date(e.date) <= qPeriod.endDate);

        const ivaRepercutido = qIncomes.reduce((sum, i) => sum + getCuotaIVA(i.baseAmount, i.vatRate), 0);
        // FIX: Replaced non-existent 'isVatDeductible' with 'isDeductible' as suggested by the error. Simplified logic as `qDeductibleExpenses` is already filtered.
        const ivaSoportadoFromExpenses = qDeductibleExpenses.reduce((sum, e) => sum + getCuotaIVA(e.baseAmount, e.vatRate), 0);
        const ivaSoportadoFromGoods = investmentGoods.filter(g => g.isDeductible && new Date(g.purchaseDate) >= qPeriod.startDate && new Date(g.purchaseDate) <= qPeriod.endDate).reduce((sum, g) => sum + getCuotaIVA(g.acquisitionValue, g.vatRate), 0);
        const ivaSoportado = ivaSoportadoFromExpenses + ivaSoportadoFromGoods;
        const model303Result = Math.max(0, ivaRepercutido - ivaSoportado);

        const yearOfPeriod = qPeriod.startDate.getFullYear();
        const quarterOfPeriod = quarter + 1;
        const incomesYTD = incomes.filter(i => { const d = new Date(i.date); return d.getFullYear() === yearOfPeriod && d <= qPeriod.endDate; });
        const expensesYTD = expenses.filter(e => { const d = new Date(e.date); return d.getFullYear() === yearOfPeriod && d <= qPeriod.endDate && e.isDeductible; });
        const grossYTD = incomesYTD.reduce((sum, i) => sum + i.baseAmount, 0);
        const expensesFromInvoicesYTD = expensesYTD.reduce((sum, e) => {
            const expenseBase = e.deductibleBaseAmount ?? e.baseAmount;
            // FIX: Replaced non-existent 'isVatDeductible' with 'isDeductible'. Since expenses are already filtered by `isDeductible`, this will correctly result in 0 for non-deductible VAT.
            const nonDeductibleVat = e.isDeductible ? 0 : getCuotaIVA(e.baseAmount, e.vatRate);
            return sum + expenseBase + nonDeductibleVat;
        }, 0);
        const amortizationYTD = investmentGoods.filter(g => g.isDeductible).reduce((sum, good) => {
             const dailyAmortization = (good.acquisitionValue / good.usefulLife) / 365.25;
             const goodStartDate = new Date(good.purchaseDate);
             if (goodStartDate.getFullYear() > yearOfPeriod) return sum;
             const effectiveStartDate = goodStartDate < new Date(yearOfPeriod, 0, 1) ? new Date(yearOfPeriod, 0, 1) : goodStartDate;
             const effectiveEndDate = qPeriod.endDate;
             const days = (effectiveEndDate.getTime() - effectiveStartDate.getTime()) / (1000 * 3600 * 24) + 1;
             return sum + (days * dailyAmortization);
        }, 0);
        const autonomoFeeYTD = (settings.monthlyAutonomoFee || 0) * (quarterOfPeriod * 3);
        const deductibleExpensesYTD = expensesFromInvoicesYTD + amortizationYTD + autonomoFeeYTD;
        const netProfitYTD = grossYTD - deductibleExpensesYTD;
        const quoteYTD = netProfitYTD * 0.20;
        const retencionesSoportadasYTD = incomesYTD.reduce((sum, i) => sum + getCuotaIRPF(i.baseAmount, i.irpfRate), 0);
        const model130Result = Math.max(0, quoteYTD - retencionesSoportadasYTD);

        const qAllExpenses = expenses.filter(e => new Date(e.date) >= qPeriod.startDate && new Date(e.date) <= qPeriod.endDate);
        const model111Result = qAllExpenses.reduce((sum, e) => sum + (e.irpfRetentionAmount && !e.isRentalExpense ? e.irpfRetentionAmount : 0), 0);
        const model115Result = qAllExpenses.reduce((sum, e) => sum + (e.irpfRetentionAmount && e.isRentalExpense ? e.irpfRetentionAmount : 0), 0);
        
        const totalProjectedTaxes = model303Result + model130Result + model111Result + model115Result;

        const netAvailableCapital = currentTotalBalance 
            + (includeNetCapitalItems.pendingIncome ? totalPendingIncome : 0)
            - (includeNetCapitalItems.pendingExpenses ? totalPendingExpenses : 0)
            - (includeNetCapitalItems.taxes ? totalProjectedTaxes : 0);

        return {
            professionalBalance,
            personalBalance,
            totalPendingIncome,
            totalPendingExpenses,
            totalProjectedTaxes,
            netAvailableCapital,
            taxesBreakdown: { model303Result, model130Result, model111Result, model115Result, totalProjectedTaxes }
        };

    }, [data, moneyDistribution, includeNetCapitalItems]);

    const pendingIncomes = useMemo(() => data.incomes.filter(i => !i.isPaid), [data.incomes]);
    const pendingExpenses = useMemo(() => data.expenses.filter(e => !e.isPaid), [data.expenses]);
    const pendingPersonalIncomes = useMemo(() => data.personalMovements.filter(m => m.type === 'income' && !m.isPaid), [data.personalMovements]);
    const pendingPersonalExpenses = useMemo(() => data.personalMovements.filter(m => m.type === 'expense' && !m.isPaid), [data.personalMovements]);

    const projectedMoneyDistribution = useMemo(() => {
        if (!showProjection) {
            return moneyDistribution;
        }

        const projectedBalances = { ...moneyDistribution };
        
        if (includePendingTransactions) {
            pendingIncomes.forEach(income => {
                if (income.location) {
                    const netAmount = income.baseAmount + (income.baseAmount * income.vatRate / 100) - (income.baseAmount * income.irpfRate / 100);
                    projectedBalances[income.location] = (projectedBalances[income.location] || 0) + netAmount;
                }
            });

            pendingExpenses.forEach(expense => {
                if (expense.location) {
                    const totalAmount = expense.baseAmount + (expense.baseAmount * expense.vatRate / 100);
                    projectedBalances[expense.location] = (projectedBalances[expense.location] || 0) + totalAmount;
                }
            });

            pendingPersonalIncomes.forEach(movement => {
                if (movement.location) {
                    projectedBalances[movement.location] = (projectedBalances[movement.location] || 0) + movement.amount;
                }
            });
            
            pendingPersonalExpenses.forEach(movement => {
                if (movement.location) {
                    projectedBalances[movement.location] = (projectedBalances[movement.location] || 0) - movement.amount;
                }
            });
        }

        return projectedBalances;
    }, [showProjection, moneyDistribution, pendingIncomes, pendingExpenses, pendingPersonalIncomes, pendingPersonalExpenses, includePendingTransactions]);


    const actualMovements = useMemo(() => {
        const professionalIncomes = incomes
            .filter(i => new Date(i.date) >= period.startDate && new Date(i.date) <= period.endDate && i.isPaid)
            .map(i => ({ amount: i.baseAmount + (i.baseAmount * i.vatRate / 100) - (i.baseAmount * i.irpfRate / 100) }));

        const professionalExpenses = expenses
            .filter(e => new Date(e.date) >= period.startDate && new Date(e.date) <= period.endDate)
            .map(e => ({ amount: e.baseAmount + (e.baseAmount * e.vatRate / 100) }));
            
        const personalMoves = personalMovements
            .filter(pm => new Date(pm.date) >= period.startDate && new Date(pm.date) <= period.endDate && pm.isPaid)

        const autonomoFee = { amount: settings.monthlyAutonomoFee * monthsInPeriod };
        
        const totalActualIncome = professionalIncomes.reduce((sum, i) => sum + i.amount, 0) + personalMoves.filter(p => p.type === 'income').reduce((sum, p) => sum + p.amount, 0);
        const totalActualExpense = professionalExpenses.reduce((sum, e) => sum + e.amount, 0) + personalMoves.filter(p => p.type === 'expense').reduce((sum, p) => sum + p.amount, 0) + autonomoFee.amount;

        return { totalActualIncome, totalActualExpense };

    }, [period, incomes, expenses, personalMovements, settings.monthlyAutonomoFee, monthsInPeriod]);


    const projectedSavings = useMemo(() => {
        if (!includeSavings) return 0;
        return savingsGoals.reduce((total, goal) => {
            if (goal.plannedContribution && goal.plannedContribution > 0) {
                return total + (goal.plannedContribution * monthsInPeriod);
            }
            const monthsRemaining = getMonthsRemaining(goal.deadline);
            if (monthsRemaining > 0) {
                const suggested = (goal.targetAmount - goal.currentAmount) / monthsRemaining;
                return total + (Math.max(0, suggested) * monthsInPeriod);
            }
            return total;
        }, 0);
    }, [includeSavings, savingsGoals, monthsInPeriod]);

    const getNetPotentialIncome = (pi: PotentialIncome): number => {
        if (pi.source === MoneySource.AUTONOMO) {
            const base = pi.baseAmount || 0;
            const vat = base * (pi.vatRate || 0) / 100;
            const irpf = base * (pi.irpfRate || 0) / 100;
            return base + vat - irpf;
        }
        return pi.amount || 0;
    };

    const countOccurrences = (
        frequency: PotentialFrequency,
        startDate: Date,
        endDate: Date | undefined,
        periodStart: Date,
        periodEnd: Date
    ): number => {
        if (startDate > periodEnd) return 0;
        const effectiveEndDate = endDate ? new Date(Math.min(new Date(endDate).getTime(), periodEnd.getTime())) : periodEnd;
        if (startDate > effectiveEndDate) return 0;

        let count = 0;
        let currentDate = new Date(startDate);
        
        while (currentDate <= effectiveEndDate) {
            if (currentDate >= periodStart) {
                count++;
            }
            switch (frequency) {
                case 'weekly': currentDate.setDate(currentDate.getDate() + 7); break;
                case 'monthly': currentDate.setMonth(currentDate.getMonth() + 1); break;
                case 'quarterly': currentDate.setMonth(currentDate.getMonth() + 3); break;
                case 'yearly': currentDate.setFullYear(currentDate.getFullYear() + 1); break;
                default: return count;
            }
        }
        return count;
    };


    const projectedIncome = useMemo(() => {
        if (!includePotentialIncome) return 0;
        
        let totalProjected = 0;
    
        potentialIncomes.forEach(pi => {
            const frequency = pi.frequency || (pi.type === 'monthly' ? 'monthly' : 'one-off');
            const startDate = pi.startDate || pi.date;
            if (!startDate) return;
    
            const itemStartDate = new Date(startDate);
            const itemEndDate = pi.endDate ? new Date(pi.endDate) : undefined;
    
            if (frequency === 'one-off') {
                if (itemStartDate >= period.startDate && itemStartDate <= period.endDate) {
                    totalProjected += getNetPotentialIncome(pi);
                }
            } else {
                const occurrences = countOccurrences(frequency, itemStartDate, itemEndDate, period.startDate, period.endDate);
                totalProjected += occurrences * getNetPotentialIncome(pi);
            }
        });
    
        return totalProjected;
    }, [includePotentialIncome, potentialIncomes, period]);
    
    const projectedExpenses = useMemo(() => {
        if (!includePotentialExpenses) return 0;
        
        let totalProjected = 0;
    
        potentialExpenses.forEach(pe => {
            const frequency = pe.frequency || (pe.type === 'monthly' ? 'monthly' : 'one-off');
            const startDate = pe.startDate || pe.date;
            if (!startDate) return;
    
            const itemStartDate = new Date(startDate);
            const itemEndDate = pe.endDate ? new Date(pe.endDate) : undefined;
    
            if (frequency === 'one-off') {
                if (itemStartDate >= period.startDate && itemStartDate <= period.endDate) {
                    totalProjected += pe.amount;
                }
            } else {
                 const occurrences = countOccurrences(frequency, itemStartDate, itemEndDate, period.startDate, period.endDate);
                 totalProjected += occurrences * pe.amount;
            }
        });
    
        return totalProjected;
    }, [includePotentialExpenses, potentialExpenses, period]);

    const projectedTaxes = useMemo(() => {
        const incomesForTaxCalc = incomes.filter(i => {
            const incomeDate = new Date(i.date);
            return incomeDate >= period.startDate && incomeDate <= period.endDate && (i.isPaid || includePendingTransactions);
        });

        if (includePotentialIncome) {
            const potentialAutonomoIncomes = potentialIncomes.filter(pi => pi.source === MoneySource.AUTONOMO);

            potentialAutonomoIncomes.forEach(pi => {
                const frequency = pi.frequency || (pi.type === 'monthly' ? 'monthly' : 'one-off');
                const startDate = pi.startDate || pi.date;
                if (!startDate) return;
        
                const itemStartDate = new Date(startDate);
                const itemEndDate = pi.endDate ? new Date(pi.endDate) : undefined;

                if (frequency === 'one-off') {
                    if (itemStartDate >= period.startDate && itemStartDate <= period.endDate) {
                         incomesForTaxCalc.push({
                            id: pi.id, baseAmount: pi.baseAmount || 0,
                            vatRate: pi.vatRate ?? settings.defaultVatRate, irpfRate: pi.irpfRate ?? settings.defaultIrpfRate,
                        } as Income);
                    }
                } else {
                    const occurrences = countOccurrences(frequency, itemStartDate, itemEndDate, period.startDate, period.endDate);
                    for (let i = 0; i < occurrences; i++) {
                         incomesForTaxCalc.push({
                            id: `${pi.id}-proj-${i}`, baseAmount: pi.baseAmount || 0,
                            vatRate: pi.vatRate ?? settings.defaultVatRate, irpfRate: pi.irpfRate ?? settings.defaultIrpfRate,
                        } as Income);
                    }
                }
            });
        }
        
        const expensesInPeriod = expenses.filter(e => {
            const expenseDate = new Date(e.date);
            return expenseDate >= period.startDate && expenseDate <= period.endDate && e.isDeductible && (e.isPaid || includePendingTransactions);
        });
        
        const investmentGoodsInPeriod = investmentGoods.filter(g => {
            const purchaseDate = new Date(g.purchaseDate);
            return purchaseDate >= period.startDate && purchaseDate <= period.endDate && g.isDeductible && (g.isPaid || includePendingTransactions);
        });

        const ivaRepercutido = incomesForTaxCalc.reduce((sum, i) => sum + (i.baseAmount * i.vatRate / 100), 0);
        const ivaSoportadoFromExpenses = expensesInPeriod.reduce((sum, e) => sum + (e.baseAmount * e.vatRate / 100), 0);
        const ivaSoportadoFromGoods = investmentGoodsInPeriod.reduce((sum, g) => sum + (g.acquisitionValue * g.vatRate / 100), 0);
        const ivaSoportado = ivaSoportadoFromExpenses + ivaSoportadoFromGoods;
        const vatPayment = Math.max(0, ivaRepercutido - ivaSoportado);

        const totalIngresos = incomesForTaxCalc.reduce((sum, i) => sum + i.baseAmount, 0);
        const totalGastosFacturas = expensesInPeriod.reduce((sum, e) => sum + (e.deductibleBaseAmount ?? e.baseAmount), 0);
        
        const totalAmortization = investmentGoods.filter(g => g.isDeductible).reduce((sum, good) => {
            const dailyAmortization = (good.acquisitionValue / good.usefulLife) / 365.25;
            const goodStartDate = new Date(good.purchaseDate);
            const goodEndDate = new Date(goodStartDate.getFullYear() + good.usefulLife, goodStartDate.getMonth(), goodStartDate.getDate());
            
            const effectiveStartDate = goodStartDate > period.startDate ? goodStartDate : period.startDate;
            const effectiveEndDate = goodEndDate < period.endDate ? goodEndDate : period.endDate;
            
            if (effectiveEndDate > effectiveStartDate) {
                const daysInPeriod = (effectiveEndDate.getTime() - effectiveStartDate.getTime()) / (1000 * 3600 * 24) + 1;
                return sum + (daysInPeriod * dailyAmortization);
            }
            return sum;
        }, 0);
        
        const cuotaAutonomo = settings.monthlyAutonomoFee * monthsInPeriod;
        const totalGastosDeducibles = totalGastosFacturas + totalAmortization + cuotaAutonomo;
        const rendimientoNeto = totalIngresos - totalGastosDeducibles;
        const irpfPayment = Math.max(0, rendimientoNeto * 0.2);

        return { vatPayment, irpfPayment };
        
    }, [
        period.startDate, period.endDate, incomes, expenses, investmentGoods, settings, 
        monthsInPeriod, potentialIncomes, includePotentialIncome, includePendingTransactions
    ]);

    const summary = useMemo(() => {
        const totalProjectedIncome = actualMovements.totalActualIncome + projectedIncome;
        const taxPayments = projectedTaxes.vatPayment + projectedTaxes.irpfPayment;
        const totalProjectedExpense = actualMovements.totalActualExpense + projectedSavings + projectedExpenses + (isProfessionalModeEnabled ? taxPayments : 0);
        const netProjectedCashFlow = totalProjectedIncome - totalProjectedExpense;

        return {
            ...actualMovements,
            projectedIncome,
            projectedSavings,
            projectedExpenses,
            totalProjectedIncome,
            totalProjectedExpense,
            netProjectedCashFlow,
            taxPayments,
        }
    }, [actualMovements, projectedIncome, projectedSavings, projectedExpenses, projectedTaxes, isProfessionalModeEnabled]);
    
    const typeLabels: { [key: string]: { label: string, color: string } } = {
        proIncome: { label: 'Ingreso Pro.', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
        proExpense: { label: 'Gasto Pro.', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
        persIncome: { label: 'Ingreso Pers.', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
        persExpense: { label: 'Gasto Pers.', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' },
        transfer: { label: 'Transferencia', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
    };

    const unifiedTransactions = useMemo(() => {
        const allTransactions = [
            ...(isProfessionalModeEnabled ? incomes.map(i => ({
                id: `inc-${i.id}`,
                date: new Date(i.date),
                type: 'proIncome' as const,
                typeLabel: typeLabels.proIncome,
                concept: i.concept,
                details: `Cliente: ${i.clientName}`,
                amount: i.baseAmount + (i.baseAmount * i.vatRate / 100) - (i.baseAmount * i.irpfRate / 100),
                isPaid: i.isPaid,
                autoGenerated: i.autoGenerated,
            })) : []),
            ...(isProfessionalModeEnabled ? expenses.map(e => ({
                id: `exp-${e.id}`,
                date: new Date(e.date),
                type: 'proExpense' as const,
                typeLabel: typeLabels.proExpense,
                concept: e.concept,
                details: `Proveedor: ${e.providerName}`,
                amount: -(e.baseAmount + (e.baseAmount * e.vatRate / 100)),
                isPaid: e.isPaid,
                autoGenerated: e.autoGenerated,
            })) : []),
            ...personalMovements.map(p => ({
                id: `pm-${p.id}`,
                date: new Date(p.date),
                type: p.type === 'income' ? 'persIncome' as const : 'persExpense' as const,
                typeLabel: p.type === 'income' ? typeLabels.persIncome : typeLabels.persExpense,
                concept: p.concept,
                details: `Categoría: ${personalCategories.find(c => c.id === p.categoryId)?.name || '-'}`,
                amount: p.type === 'income' ? p.amount : -p.amount,
                isPaid: p.isPaid ?? false,
                autoGenerated: p.autoGenerated,
            })),
            ...transfers.map(t => ({
                id: `tr-${t.id}`,
                date: new Date(t.date),
                type: 'transfer' as const,
                typeLabel: typeLabels.transfer,
                concept: t.concept,
                details: `${t.fromLocation} -> ${t.toLocation}`,
                amount: t.amount,
                isPaid: true,
                autoGenerated: false,
            })),
        ];
        
        return allTransactions
            .filter(t => t.date >= period.startDate && t.date <= period.endDate)
            .filter(t => typeFilters[t.type])
            .sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [incomes, expenses, personalMovements, transfers, period, typeFilters, personalCategories, isProfessionalModeEnabled]);


    // --- Handlers ---
    const handleSaveContabilizar = (id: string, paymentDate: string, location: MoneyLocation) => {
        saveData(prev => {
            const isIncome = prev.incomes.some(i => i.id === id);
            const isExpense = prev.expenses.some(e => e.id === id);
            
            if (isIncome) {
                return { ...prev, incomes: prev.incomes.map(i => i.id === id ? { ...i, isPaid: true, paymentDate, location } : i) };
            } else if (isExpense) {
                return { ...prev, expenses: prev.expenses.map(e => e.id === id ? { ...e, isPaid: true, paymentDate, location } : e) };
            } else { // Personal Movement
                return { ...prev, personalMovements: prev.personalMovements.map(m => m.id === id ? { ...m, isPaid: true, paymentDate, location } : m) };
            }
        }, "Transacción contabilizada.");
    };

    const handleDeletePending = (id: string, type: 'income' | 'expense' | 'personal_movement') => {
        if (!window.confirm('¿Estás seguro de que quieres eliminar esta transacción pendiente? Esta acción no se puede deshacer.')) return;
        saveData(prev => {
            switch (type) {
                case 'income':
                    return { ...prev, incomes: prev.incomes.filter(i => i.id !== id) };
                case 'expense':
                    return { ...prev, expenses: prev.expenses.filter(e => e.id !== id) };
                case 'personal_movement':
                    return { ...prev, personalMovements: prev.personalMovements.filter(pm => pm.id !== id) };
                default:
                    return prev;
            }
        }, "Transacción pendiente eliminada.");
    };

    const handleGoalContributionChange = (goalId: string, value: string) => {
        const amount = parseFloat(value);
        saveData(prev => ({
            ...prev,
            savingsGoals: prev.savingsGoals.map(g => g.id === goalId ? {...g, plannedContribution: isNaN(amount) ? undefined : amount} : g)
        }), "Aportación de ahorro planificada actualizada.");
    };
    
    const handleOpenIncomeModal = (income?: PotentialIncome) => {
        setIncomeToEdit(income || null);
        setIsIncomeModalOpen(true);
    };

    const handleDeletePotentialIncome = (id: string) => {
        if (window.confirm('¿Seguro que quieres eliminar este ingreso potencial?')) {
            saveData(prev => ({...prev, potentialIncomes: prev.potentialIncomes.filter(pi => pi.id !== id)}), "Ingreso potencial eliminado.");
        }
    };
    
     const handleOpenExpenseModal = (expense?: PotentialExpense) => {
        setExpenseToEdit(expense || null);
        setIsExpenseModalOpen(true);
    };

    const handleDeletePotentialExpense = (id: string) => {
        if (window.confirm('¿Seguro que quieres eliminar este gasto potencial?')) {
            saveData(prev => ({...prev, potentialExpenses: prev.potentialExpenses.filter(pe => pe.id !== id)}), "Gasto potencial eliminado.");
        }
    };

    const handleOpenTransferModal = (transfer?: Transfer) => {
        setTransferToEdit(transfer || null);
        setIsTransferModalOpen(true);
    }
    
    const handleEditUnified = (prefixedId: string) => {
        const [type, ...idParts] = prefixedId.split('-');
        const id = idParts.join('-');

        switch (type) {
            case 'inc': {
                const income = data.incomes.find(i => i.id === id);
                if (income) setProfessionalIncomeToEdit(income);
                break;
            }
            case 'exp': {
                const expense = data.expenses.find(e => e.id === id);
                if (expense) setProfessionalExpenseToEdit(expense);
                break;
            }
            case 'pm': {
                const movement = data.personalMovements.find(pm => pm.id === id);
                if (movement) setPersonalMovementToEdit(movement);
                break;
            }
            case 'tr': {
                const transfer = data.transfers.find(t => t.id === id);
                if (transfer) handleOpenTransferModal(transfer);
                break;
            }
        }
    };

    const handleDeleteUnified = (prefixedId: string) => {
        if (!window.confirm('¿Estás seguro de que quieres eliminar esta transacción?')) return;
        
        const [type, ...idParts] = prefixedId.split('-');
        const id = idParts.join('-');

        let message = "Transacción eliminada.";

        saveData(prev => {
            switch (type) {
                case 'inc':
                    message = "Ingreso profesional eliminado.";
                    return { ...prev, incomes: prev.incomes.filter(i => i.id !== id) };
                case 'exp':
                    message = "Gasto profesional eliminado.";
                    return { ...prev, expenses: prev.expenses.filter(e => e.id !== id) };
                case 'pm':
                    message = "Movimiento personal eliminado.";
                    return { ...prev, personalMovements: prev.personalMovements.filter(pm => pm.id !== id) };
                case 'tr':
                    message = "Transferencia eliminada.";
                    return { ...prev, transfers: prev.transfers.filter(t => t.id !== id) };
                default:
                    return prev;
            }
        }, message);
    };

    const handleOpenGoalForm = (goal?: SavingsGoal) => {
        setGoalToEdit(goal || null);
        setIsGoalFormOpen(true);
    };

    const handleCloseGoalForm = () => {
        setGoalToEdit(null);
        setIsGoalFormOpen(false);
    };

    const handleDeleteGoal = useCallback((id: string) => {
        if (window.confirm('¿Seguro que quieres borrar este objetivo? No se borrarán las aportaciones ya hechas.')) {
            saveData(prev => ({ ...prev, savingsGoals: prev.savingsGoals.filter(g => g.id !== id) }), "Objetivo de ahorro eliminado.");
        }
    }, [saveData]);

    const handleSaveContribution = (isGoalCompleted: boolean) => {
        setCelebrationType(isGoalCompleted ? 'goalComplete' : 'contribution');
    };


    const sourceColors: {[key in MoneySource]: string} = {
        [MoneySource.AUTONOMO]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        [MoneySource.PERSONAL]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    };
    const locationColors: {[key in MoneyLocation]: string} = {
        [MoneyLocation.PRO_BANK]: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
        [MoneyLocation.CASH_PRO]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        [MoneyLocation.PERS_BANK]: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
        [MoneyLocation.CASH]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        [MoneyLocation.OTHER]: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
    };
    const categoryColors: { [key: string]: string } = personalCategories.reduce((acc, cat, index) => {
        const colors = ['bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300', 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300', 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300'];
        acc[cat.id] = colors[index % colors.length];
        return acc;
    }, {} as { [key: string]: string });

    const BalanceDisplay = ({ location, icon }: { location: MoneyLocation; icon: string; }) => {
        const currentBalance = moneyDistribution[location];
        const projectedBalance = projectedMoneyDistribution[location];
        return (
            <div className="flex items-center gap-4 p-6 bg-slate-50 dark:bg-slate-700/50 rounded-2xl">
                <Icon name={icon} className="w-8 h-8 text-primary-500 flex-shrink-0" />
                <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{location}</p>
                    <p className={`text-lg font-bold transition-colors ${showProjection && currentBalance !== projectedBalance ? 'text-primary-600 dark:text-primary-400' : ''}`}>
                        {formatCurrency(showProjection ? projectedBalance : currentBalance)}
                    </p>
                    {showProjection && currentBalance !== projectedBalance && (
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                            Actual: {formatCurrency(currentBalance)}
                        </p>
                    )}
                </div>
            </div>
        );
    };


    return (
        <div className="space-y-8">
            <div className="flex items-center gap-3">
                <Icon name="Globe" className="w-8 h-8 text-primary-500" />
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Visión Global y Proyección</h2>
            </div>
            
            <Celebration type={celebrationType} onComplete={() => setCelebrationType('none')} />
            
            {isProfessionalModeEnabled && (
                <Card className="p-6">
                    <div className="flex justify-between items-start">
                        <h3 className="text-xl font-semibold">Capital Neto Disponible</h3>
                        <HelpTooltip content="Estimación de tu dinero total después de cobrar lo pendiente, pagar deudas y liquidar los impuestos del trimestre actual." />
                    </div>
                    <div className="text-center my-4">
                        <p className="text-5xl md:text-6xl font-thin tracking-tight text-gray-800 dark:text-white break-words">
                            {formatCurrency(netCapitalSummary.netAvailableCapital)}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Estimación después de obligaciones</p>
                    </div>
                    <div className="text-sm space-y-2 border-t dark:border-slate-700 pt-4">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-600 dark:text-gray-400">Fondos Profesionales (Bruto)</span>
                            <span className="font-medium">{formatCurrency(netCapitalSummary.professionalBalance)}</span>
                        </div>
                         <div className="flex justify-between items-center">
                            <span className="text-gray-600 dark:text-gray-400">Fondos Personales</span>
                            <span className="font-medium">{formatCurrency(netCapitalSummary.personalBalance)}</span>
                        </div>
                        <div className={`flex justify-between items-center transition-opacity ${!includeNetCapitalItems.pendingIncome ? 'opacity-40' : ''}`}>
                            <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                <Toggle checked={includeNetCapitalItems.pendingIncome} onChange={() => handleToggleNetCapitalItem('pendingIncome')} />
                                Cobros Pendientes
                            </span>
                            <span className="font-medium text-green-500">+{formatCurrency(netCapitalSummary.totalPendingIncome)}</span>
                        </div>
                        <div className={`flex justify-between items-center transition-opacity ${!includeNetCapitalItems.pendingExpenses ? 'opacity-40' : ''}`}>
                             <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                <Toggle checked={includeNetCapitalItems.pendingExpenses} onChange={() => handleToggleNetCapitalItem('pendingExpenses')} />
                                Pagos Pendientes
                            </span>
                            <span className="font-medium text-red-500">-{formatCurrency(netCapitalSummary.totalPendingExpenses)}</span>
                        </div>
                        <div className={`flex justify-between items-center transition-opacity ${!includeNetCapitalItems.taxes ? 'opacity-40' : ''}`}>
                           <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                <Toggle checked={includeNetCapitalItems.taxes} onChange={() => handleToggleNetCapitalItem('taxes')} />
                                Impuestos Trimestrales (Est.)
                                <button onClick={() => setIsTaxesBreakdownOpen(true)} className="text-slate-400 hover:text-primary-500">
                                    <Icon name="Info" className="w-4 h-4" />
                                </button>
                            </span>
                            <span className="font-medium text-red-500">-{formatCurrency(netCapitalSummary.totalProjectedTaxes)}</span>
                        </div>
                    </div>
                </Card>
            )}

            <Card className="p-6">
                <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
                    <div>
                        <h3 className="text-xl font-semibold">Distribución del Dinero</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{showProjection ? `Saldos proyectados ${includePendingTransactions ? 'incluyendo' : 'excluyendo'} transacciones pendientes.` : 'Saldos actuales en tus cuentas.'}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Proyectar</span>
                            <Toggle checked={showProjection} onChange={() => setShowProjection(p => !p)} />
                        </div>
                        <Button size="sm" onClick={() => handleOpenTransferModal()}>
                            <Icon name="ArrowRightLeft" className="w-4 h-4" /> Transferir
                        </Button>
                    </div>
                </div>
                <div className={`grid grid-cols-1 sm:grid-cols-2 ${isProfessionalModeEnabled ? 'lg:grid-cols-5' : 'md:grid-cols-3'} gap-4`}>
                    {isProfessionalModeEnabled && <BalanceDisplay location={MoneyLocation.PRO_BANK} icon="Building2" />}
                    {isProfessionalModeEnabled && <BalanceDisplay location={MoneyLocation.CASH_PRO} icon="Briefcase" />}
                    <BalanceDisplay location={MoneyLocation.PERS_BANK} icon="UserCircle" />
                    <BalanceDisplay location={MoneyLocation.CASH} icon="Banknote" />
                    <BalanceDisplay location={MoneyLocation.OTHER} icon="Globe" />
                </div>
            </Card>

            <Card className="p-6">
                <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
                    <h3 className="text-xl font-semibold">Transacciones Pendientes</h3>
                    <Button size="sm" variant="secondary" onClick={() => setIsAddPendingModalOpen(true)}>
                        <Icon name="Plus" className="w-4 h-4" /> Añadir Transacción Pendiente
                    </Button>
                </div>
                {pendingIncomes.length === 0 && pendingExpenses.length === 0 && pendingPersonalIncomes.length === 0 && pendingPersonalExpenses.length === 0 ? (
                    <p className="text-center text-gray-600 dark:text-gray-400 py-8">No hay transacciones pendientes. ¡Añade una para empezar a planificar!</p>
                ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
                    {isProfessionalModeEnabled && (
                        <>
                            <div>
                                <h4 className="font-semibold mb-2 text-green-600 dark:text-green-400">Pendiente de Cobro (Profesional)</h4>
                                {pendingIncomes.length > 0 ? (
                                    <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">{pendingIncomes.map(income => (
                                        <li key={income.id} className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded-md text-sm">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-2">
                                                    {/* FIX: Wrap Icon in a span with a title attribute to provide a tooltip, as Icon component doesn't accept a title prop. */}
                                                    {income.autoGenerated && <span title="Generado automáticamente"><Icon name="Bot" className="w-4 h-4 text-slate-500"/></span>}
                                                    <div>
                                                        <p>{income.concept}</p>
                                                        <p className="text-xs text-gray-600 dark:text-gray-400">{income.clientName} | {new Date(income.date).toLocaleDateString('es-ES')}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right flex-shrink-0 ml-2">
                                                    <p className="font-semibold">{formatCurrency(income.baseAmount + (income.baseAmount * income.vatRate / 100) - (income.baseAmount * income.irpfRate / 100))}</p>
                                                    <span className="px-2 mt-1 inline-block py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Pendiente</span>
                                                </div>
                                            </div>
                                            <div className="flex justify-end gap-1 mt-1">
                                                <Button size="sm" variant="ghost" onClick={() => setProfessionalIncomeToEdit(income)} title="Editar"><Icon name="Pencil" className="w-4 h-4" /></Button>
                                                <Button size="sm" variant="secondary" onClick={() => setItemToContabilize(income)}>Contabilizar</Button>
                                                <Button size="sm" variant="ghost" onClick={() => handleDeletePending(income.id, 'income')} title="Eliminar"><Icon name="Trash2" className="w-4 h-4 text-red-500" /></Button>
                                            </div>
                                        </li>
                                    ))}</ul>
                                ) : (
                                    <p className="text-sm text-gray-600 dark:text-gray-400 italic">No hay cobros profesionales pendientes.</p>
                                )}
                            </div>
                            <div>
                                <h4 className="font-semibold mb-2 text-red-600 dark:text-red-400">Pendiente de Pago (Profesional)</h4>
                                {pendingExpenses.length > 0 ? (
                                    <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">{pendingExpenses.map(expense => (
                                        <li key={expense.id} className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded-md text-sm">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-2">
                                                    {/* FIX: Wrap Icon in a span with a title attribute to provide a tooltip, as Icon component doesn't accept a title prop. */}
                                                    {expense.autoGenerated && <span title="Generado automáticamente"><Icon name="Bot" className="w-4 h-4 text-slate-500"/></span>}
                                                    <div>
                                                        <p>{expense.concept}</p>
                                                        <p className="text-xs text-gray-600 dark:text-gray-400">{expense.providerName} | {new Date(expense.date).toLocaleDateString('es-ES')}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right flex-shrink-0 ml-2">
                                                    <p className="font-semibold">{formatCurrency(expense.baseAmount + (expense.baseAmount * expense.vatRate / 100))}</p>
                                                    <span className="px-2 mt-1 inline-block py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Pendiente</span>
                                                </div>
                                            </div>
                                            <div className="flex justify-end gap-1 mt-1">
                                                <Button size="sm" variant="ghost" onClick={() => setProfessionalExpenseToEdit(expense)} title="Editar"><Icon name="Pencil" className="w-4 h-4" /></Button>
                                                <Button size="sm" variant="secondary" onClick={() => setItemToContabilize(expense)}>Contabilizar</Button>
                                                <Button size="sm" variant="ghost" onClick={() => setExpenseToPeriodize(expense)}>Periodizar</Button>
                                                <Button size="sm" variant="ghost" onClick={() => handleDeletePending(expense.id, 'expense')} title="Eliminar"><Icon name="Trash2" className="w-4 h-4 text-red-500" /></Button>
                                            </div>
                                        </li>
                                    ))}</ul>
                                ) : (
                                    <p className="text-sm text-gray-600 dark:text-gray-400 italic">No hay pagos profesionales pendientes.</p>
                                )}
                            </div>
                        </>
                    )}
                    <div>
                        <h4 className="font-semibold mb-2 text-green-500 dark:text-green-300">Pendiente de Ingreso (Personal)</h4>
                         {pendingPersonalIncomes.length > 0 ? (
                            <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">{pendingPersonalIncomes.map(mov => (
                                <li key={mov.id} className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded-md text-sm">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                            {/* FIX: Wrap Icon in a span with a title attribute to provide a tooltip, as Icon component doesn't accept a title prop. */}
                                            {mov.autoGenerated && <span title="Generado automáticamente"><Icon name="Bot" className="w-4 h-4 text-slate-500"/></span>}
                                            <div>
                                                <p>{mov.concept}</p>
                                                <p className="text-xs text-gray-600 dark:text-gray-400">{new Date(mov.date).toLocaleDateString('es-ES')}</p>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0 ml-2">
                                            <p className="font-semibold">{formatCurrency(mov.amount)}</p>
                                            <span className="px-2 mt-1 inline-block py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Pendiente</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-1 mt-1">
                                        <Button size="sm" variant="ghost" onClick={() => setPersonalMovementToEdit(mov)} title="Editar"><Icon name="Pencil" className="w-4 h-4" /></Button>
                                        <Button size="sm" variant="secondary" onClick={() => setItemToContabilize(mov)}>Contabilizar</Button>
                                        <Button size="sm" variant="ghost" onClick={() => handleDeletePending(mov.id, 'personal_movement')} title="Eliminar"><Icon name="Trash2" className="w-4 h-4 text-red-500" /></Button>
                                    </div>
                                </li>
                            ))}</ul>
                        ) : (
                            <p className="text-sm text-gray-600 dark:text-gray-400 italic">No hay ingresos personales pendientes.</p>
                        )}
                    </div>
                     <div>
                        <h4 className="font-semibold mb-2 text-red-500 dark:text-red-300">Pendiente de Gasto (Personal)</h4>
                         {pendingPersonalExpenses.length > 0 ? (
                            <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">{pendingPersonalExpenses.map(mov => (
                                <li key={mov.id} className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded-md text-sm">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                            {/* FIX: Wrap Icon in a span with a title attribute to provide a tooltip, as Icon component doesn't accept a title prop. */}
                                            {mov.autoGenerated && <span title="Generado automáticamente"><Icon name="Bot" className="w-4 h-4 text-slate-500"/></span>}
                                            <div>
                                                <p>{mov.concept}</p>
                                                <p className="text-xs text-gray-600 dark:text-gray-400">{new Date(mov.date).toLocaleDateString('es-ES')}</p>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0 ml-2">
                                            <p className="font-semibold">{formatCurrency(mov.amount)}</p>
                                            <span className="px-2 mt-1 inline-block py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Pendiente</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-1 mt-1">
                                        <Button size="sm" variant="ghost" onClick={() => setPersonalMovementToEdit(mov)} title="Editar"><Icon name="Pencil" className="w-4 h-4" /></Button>
                                        <Button size="sm" variant="secondary" onClick={() => setItemToContabilize(mov)}>Contabilizar</Button>
                                        <Button size="sm" variant="ghost" onClick={() => handleDeletePending(mov.id, 'personal_movement')} title="Eliminar"><Icon name="Trash2" className="w-4 h-4 text-red-500" /></Button>
                                    </div>
                                </li>
                             ))}</ul>
                         ) : (
                            <p className="text-sm text-gray-600 dark:text-gray-400 italic">No hay gastos personales pendientes.</p>
                         )}
                    </div>
                </div>
                )}
            </Card>

            <PeriodSelector onPeriodChange={handlePeriodChange} />
            
            {/* Main KPIs */}
            <Card className="p-6">
                 <h3 className="text-xl font-semibold mb-4">Resumen y Proyección del Periodo</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center divide-y md:divide-y-0 md:divide-x dark:divide-slate-700">
                    <div className="p-4">
                        <h4 className="text-lg text-gray-600 dark:text-gray-400">Ingresos Proyectados</h4>
                        <p className="text-3xl font-bold text-green-500">{formatCurrency(summary.totalProjectedIncome)}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">({formatCurrency(summary.totalActualIncome)} reales + {formatCurrency(summary.projectedIncome)} pot.)</p>
                    </div>
                    <div className="p-4">
                        <h4 className="text-lg text-gray-600 dark:text-gray-400">Gastos Proyectados</h4>
                        <p className="text-3xl font-bold text-red-500">{formatCurrency(summary.totalProjectedExpense)}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">({formatCurrency(summary.totalActualExpense)} reales + {formatCurrency(summary.projectedSavings)} ahorro + {formatCurrency(summary.projectedExpenses)} pot.{isProfessionalModeEnabled && ` + ${formatCurrency(summary.taxPayments)} imp.`})</p>
                    </div>
                    <div className="p-4">
                        <h4 className="text-lg text-gray-600 dark:text-gray-400">Flujo de Caja Neto Proyectado</h4>
                        <p className={`text-4xl font-bold ${summary.netProjectedCashFlow >= 0 ? 'text-primary-500' : 'text-red-600'}`}>{formatCurrency(summary.netProjectedCashFlow)}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Dinero neto disponible estimado</p>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Planning Panels */}
                <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Controles de Proyección</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Incluir Movimientos Pendientes</span>
                            <Toggle checked={includePendingTransactions} onChange={() => setIncludePendingTransactions(p => !p)} />
                        </div>
                         <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Incluir Ahorro Planificado</span>
                            <Toggle checked={includeSavings} onChange={() => setIncludeSavings(p => !p)} />
                        </div>
                         <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Incluir Ingresos Potenciales</span>
                            <Toggle checked={includePotentialIncome} onChange={() => setIncludePotentialIncome(p => !p)} />
                        </div>
                         <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Incluir Gastos Potenciales</span>
                            <Toggle checked={includePotentialExpenses} onChange={() => setIncludePotentialExpenses(p => !p)} />
                        </div>
                    </div>
                </Card>
                 <Card className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Ingresos Potenciales</h3>
                        <Button size="sm" onClick={() => handleOpenIncomeModal()}> <Icon name="Plus" className="w-4 h-4" /> Añadir</Button>
                    </div>
                    <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
                        {potentialIncomes.length > 0 ? potentialIncomes.map(pi => {
                            const frequency = pi.frequency || (pi.type === 'monthly' ? 'monthly' : 'one-off');
                            return (
                           <div key={pi.id} className="text-sm p-2 bg-slate-50 dark:bg-slate-700/50 rounded-md">
                               <div className="flex justify-between items-start">
                                   <div>
                                       <p className="font-semibold">{pi.concept}</p>
                                       <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(getNetPotentialIncome(pi))}</p>
                                   </div>
                                   <div className="flex-shrink-0">
                                       <Button variant="ghost" size="sm" onClick={() => handleOpenIncomeModal(pi)}><Icon name="Pencil" className="w-4 h-4" /></Button>
                                       <Button variant="ghost" size="sm" onClick={() => handleDeletePotentialIncome(pi.id)}><Icon name="Trash2" className="w-4 h-4 text-red-500" /></Button>
                                   </div>
                               </div>
                               <div className="flex flex-wrap gap-2 mt-1">
                                   <span className={`px-2 py-1 rounded-full text-xs font-medium ${sourceColors[pi.source]}`}>{pi.source.split(' ')[0]}</span>
                                   <span className={`px-2 py-1 rounded-full text-xs font-medium ${locationColors[pi.location]}`}>{pi.location}</span>
                                   <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-200 text-slate-800 dark:bg-slate-600 dark:text-slate-200">{frequencyLabels[frequency]}</span>
                               </div>
                           </div>
                        )}) : <p className="text-sm text-center text-gray-600 dark:text-gray-400">Añade ingresos futuros para proyectar tu crecimiento.</p>}
                    </div>
                </Card>
            </div>
            
            <Card className="p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Gastos Potenciales</h3>
                    <Button size="sm" onClick={() => handleOpenExpenseModal()}> <Icon name="Plus" className="w-4 h-4" /> Añadir</Button>
                </div>
                <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
                    {potentialExpenses.length > 0 ? potentialExpenses.map(pe => {
                        const category = personalCategories.find(c => c.id === pe.categoryId);
                        const frequency = pe.frequency || (pe.type === 'monthly' ? 'monthly' : 'one-off');
                        return (
                       <div key={pe.id} className="text-sm p-2 bg-slate-50 dark:bg-slate-700/50 rounded-md">
                           <div className="flex justify-between items-start">
                               <div>
                                   <p className="font-semibold">{pe.concept}</p>
                                   <p className="text-lg font-bold text-red-600 dark:text-red-400">{formatCurrency(pe.amount)}</p>
                               </div>
                               <div className="flex-shrink-0">
                                   <Button variant="ghost" size="sm" onClick={() => handleOpenExpenseModal(pe)}><Icon name="Pencil" className="w-4 h-4" /></Button>
                                   <Button variant="ghost" size="sm" onClick={() => handleDeletePotentialExpense(pe.id)}><Icon name="Trash2" className="w-4 h-4 text-red-500" /></Button>
                               </div>
                           </div>
                           <div className="flex flex-wrap gap-2 mt-1">
                               {category && <span className={`px-2 py-1 rounded-full text-xs font-medium ${categoryColors[category.id] || 'bg-gray-100 text-gray-800'}`}>{category.name}</span>}
                               <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-200 text-slate-800 dark:bg-slate-600 dark:text-slate-200">{frequencyLabels[frequency]}</span>
                           </div>
                       </div>
                    )}) : <p className="text-sm text-center text-gray-600 dark:text-gray-400">Añade gastos futuros (suscripciones, etc.) para una proyección más precisa.</p>}
                </div>
            </Card>

            <Card className="p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">Planificación de Ahorro</h3>
                    <Button size="sm" onClick={() => handleOpenGoalForm()}>
                        <Icon name="Plus" className="w-4 h-4" /> Nuevo Objetivo
                    </Button>
                </div>
                <div className="space-y-4">
                    {savingsGoals.length > 0 ? savingsGoals.map(goal => {
                        const amountRemaining = goal.targetAmount - goal.currentAmount;
                        let projectedFinishDate: Date | null = null;
                        if (goal.plannedContribution && goal.plannedContribution > 0 && amountRemaining > 0) {
                            const dailyContribution = goal.plannedContribution / (365.25 / 12);
                            const daysNeeded = Math.ceil(amountRemaining / dailyContribution);
                            projectedFinishDate = new Date();
                            projectedFinishDate.setDate(projectedFinishDate.getDate() + daysNeeded);
                        }

                        return (
                            <div key={goal.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start border-t dark:border-slate-700 pt-4 first:border-t-0">
                                <div className="md:col-span-1">
                                    <p className="font-semibold">{goal.name}</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">
                                        Restante: {formatCurrency(Math.max(0, amountRemaining))}
                                    </p>
                                </div>
                                {(() => {
                                    if (amountRemaining <= 0) {
                                        return (
                                            <div className="md:col-span-3 flex items-center gap-2 text-green-500">
                                                <Icon name="Sparkles" className="w-5 h-5" />
                                                <p className="font-semibold">¡Objetivo conseguido!</p>
                                            </div>
                                        );
                                    }

                                    const monthsRemaining = getMonthsRemaining(goal.deadline);
                                    if (monthsRemaining === 0) {
                                        return (
                                            <div className="md:col-span-3 text-red-500">
                                                <p className="font-semibold">Plazo vencido</p>
                                                <p className="text-sm">No has alcanzado este objetivo a tiempo.</p>
                                            </div>
                                        );
                                    }

                                    const suggestedContribution = amountRemaining / monthsRemaining;
                                    let statusMessage = null;
                                    let statusColor = '';

                                    if (goal.plannedContribution && goal.plannedContribution > 0) {
                                        if (goal.plannedContribution >= suggestedContribution) {
                                            statusMessage = '¡Vas por buen camino para cumplir tu objetivo a tiempo!';
                                            statusColor = 'text-green-500';
                                        } else {
                                            const difference = suggestedContribution - goal.plannedContribution;
                                            statusMessage = `Necesitas aportar ${formatCurrency(difference)} más al mes para llegar a tiempo.`;
                                            statusColor = 'text-orange-500';
                                        }
                                    }
                                    
                                    return (
                                        <>
                                            <div className="md:col-span-1">
                                                <p className="text-sm">Aportación mensual sugerida:</p>
                                                <p className="font-semibold">{formatCurrency(suggestedContribution)}</p>
                                            </div>
                                            <div className="md:col-span-1">
                                            <Input 
                                                label="Mi aportación mensual"
                                                type="number"
                                                placeholder={formatCurrency(suggestedContribution)}
                                                value={goal.plannedContribution || ''}
                                                onChange={(e) => handleGoalContributionChange(goal.id, e.target.value)}
                                            />
                                            {statusMessage && <p className={`text-xs mt-1 ${statusColor}`}>{statusMessage}</p>}
                                             {projectedFinishDate && (
                                                <div className="text-xs mt-1 text-primary-600 dark:text-primary-400">
                                                    <p><strong>Final estimado: {projectedFinishDate.toLocaleDateString('es-ES')}</strong></p>
                                                    <p>(vs. objetivo: {new Date(goal.deadline).toLocaleDateString('es-ES')})</p>
                                                </div>
                                            )}
                                            </div>
                                            <div className="md:col-span-1 flex justify-end items-center self-start pt-6 gap-1">
                                                <Button size="sm" variant="secondary" onClick={() => setGoalToAddFunds(goal)}>Aportar</Button>
                                                <Button size="sm" variant="ghost" onClick={() => handleOpenGoalForm(goal)} title="Editar objetivo"><Icon name="Pencil" className="w-4 h-4"/></Button>
                                                <Button size="sm" variant="ghost" onClick={() => handleDeleteGoal(goal.id)} title="Eliminar objetivo"><Icon name="Trash2" className="w-4 h-4 text-red-500"/></Button>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        );
                    }) : <p className="text-center text-gray-600 dark:text-gray-400">Crea objetivos en el Área Personal para planificar tu ahorro.</p>}
                </div>
            </Card>

            <Card className="p-6">
                <h3 className="text-xl font-semibold mb-4">Registro Global de Movimientos</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                     {isProfessionalModeEnabled && (
                        <>
                            <Button
                                size="sm"
                                variant={typeFilters.proIncome ? 'primary' : 'secondary'}
                                onClick={() => handleFilterChange('proIncome')}
                            >
                                {typeLabels.proIncome.label}
                            </Button>
                            <Button
                                size="sm"
                                variant={typeFilters.proExpense ? 'primary' : 'secondary'}
                                onClick={() => handleFilterChange('proExpense')}
                            >
                                {typeLabels.proExpense.label}
                            </Button>
                        </>
                    )}
                    <Button size="sm" variant={typeFilters.persIncome ? 'primary' : 'secondary'} onClick={() => handleFilterChange('persIncome')}>
                        {typeLabels.persIncome.label}
                    </Button>
                    <Button size="sm" variant={typeFilters.persExpense ? 'primary' : 'secondary'} onClick={() => handleFilterChange('persExpense')}>
                        {typeLabels.persExpense.label}
                    </Button>
                    <Button size="sm" variant={typeFilters.transfer ? 'primary' : 'secondary'} onClick={() => handleFilterChange('transfer')}>
                        {typeLabels.transfer.label}
                    </Button>
                </div>

                <div className="overflow-y-auto max-h-[40rem] mt-4">
                    <div className="divide-y divide-slate-200/50 dark:divide-white/10">
                        {unifiedTransactions.map(t => {
                            const iconName = t.type === 'transfer' ? 'ArrowRightLeft' : t.amount > 0 ? 'TrendingUp' : 'TrendingDown';
                            return (
                                <div key={t.id} className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-3 transition-colors ${!t.isPaid ? 'opacity-60 italic' : ''}`}>
                                    <div className="flex items-center gap-4 flex-grow min-w-[200px]">
                                        <div className={`p-2 rounded-lg ${t.typeLabel.color} flex-shrink-0`}>
                                            <Icon name={iconName} className="w-5 h-5" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {/* FIX: Wrap Icon in a span with a title attribute to provide a tooltip, as Icon component doesn't accept a title prop. */}
                                            {t.autoGenerated && <span title="Generado automáticamente"><Icon name="Bot" className="w-4 h-4 text-slate-500"/></span>}
                                            <div>
                                                <p className="font-semibold">{t.concept}</p>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">{t.details}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 w-full basis-auto justify-end">
                                        <div className="text-right">
                                            <p className={`font-semibold break-words ${
                                                t.type === 'transfer' ? 'text-gray-600 dark:text-gray-400' :
                                                t.amount > 0 ? 'text-green-500' : 'text-red-500'
                                            }`}>
                                                {formatCurrency(t.amount)}
                                            </p>
                                            {!t.isPaid && <span className="text-xs text-yellow-500">Pendiente</span>}
                                        </div>
                                        <div className="flex items-center">
                                            <Button size="sm" variant="ghost" onClick={() => handleEditUnified(t.id)} title="Editar"><Icon name="Pencil" className="w-4 h-4" /></Button>
                                            <Button size="sm" variant="ghost" onClick={() => handleDeleteUnified(t.id)} title="Eliminar"><Icon name="Trash2" className="w-4 h-4 text-red-500" /></Button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                {unifiedTransactions.length === 0 && (
                    <p className="text-center text-gray-600 dark:text-gray-400 py-8">No hay movimientos que coincidan con los filtros para este periodo.</p>
                )}
            </Card>

            {/* Modals for this view */}
            <TaxesBreakdownModal isOpen={isTaxesBreakdownOpen} onClose={() => setIsTaxesBreakdownOpen(false)} breakdown={netCapitalSummary.taxesBreakdown} formatCurrency={formatCurrency} />
            <Modal isOpen={isIncomeModalOpen} onClose={() => setIsIncomeModalOpen(false)} title={incomeToEdit ? "Editar Ingreso Potencial" : "Añadir Ingreso Potencial"}>
                <PotentialIncomeForm onClose={() => setIsIncomeModalOpen(false)} incomeToEdit={incomeToEdit} />
            </Modal>
             <Modal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} title={expenseToEdit ? "Editar Gasto Potencial" : "Añadir Gasto Potencial"}>
                <PotentialExpenseForm onClose={() => setIsExpenseModalOpen(false)} expenseToEdit={expenseToEdit} />
            </Modal>
            <Modal isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} title={transferToEdit ? "Editar Transferencia" : "Nueva Transferencia"}>
                <TransferForm onClose={() => setIsTransferModalOpen(false)} transferToEdit={transferToEdit} />
            </Modal>
            {itemToContabilize && (
                 <Modal isOpen={true} onClose={() => setItemToContabilize(null)} title="Contabilizar Transacción">
                    <ContabilizeModal item={itemToContabilize} onClose={() => setItemToContabilize(null)} onSave={handleSaveContabilizar} />
                 </Modal>
            )}
            {expenseToPeriodize && (
                 <Modal isOpen={true} onClose={() => setExpenseToPeriodize(null)} title="Periodizar Gasto">
                    <PeriodizeExpenseModal expense={expenseToPeriodize} onClose={() => setExpenseToPeriodize(null)} />
                 </Modal>
            )}
            <AddPendingTransactionModal isOpen={isAddPendingModalOpen} onClose={() => setIsAddPendingModalOpen(false)} isProfessionalModeEnabled={isProfessionalModeEnabled} />

            {professionalIncomeToEdit && (
                <Modal isOpen={true} onClose={() => setProfessionalIncomeToEdit(null)} title="Editar Ingreso Profesional">
                    <IncomeForm onClose={() => setProfessionalIncomeToEdit(null)} incomeToEdit={professionalIncomeToEdit} />
                </Modal>
            )}
            {professionalExpenseToEdit && (
                <Modal isOpen={true} onClose={() => setProfessionalExpenseToEdit(null)} title="Editar Gasto Profesional">
                    <ExpenseForm onClose={() => setProfessionalExpenseToEdit(null)} expenseToEdit={professionalExpenseToEdit} />
                </Modal>
            )}
            {personalMovementToEdit && (
                <Modal isOpen={true} onClose={() => setPersonalMovementToEdit(null)} title="Editar Movimiento Personal">
                    <MovementForm onClose={() => setPersonalMovementToEdit(null)} movementToEdit={personalMovementToEdit} />
                </Modal>
            )}
             <Modal isOpen={isGoalFormOpen} onClose={handleCloseGoalForm} title={goalToEdit ? "Editar Objetivo de Ahorro" : "Crear Nuevo Objetivo de Ahorro"}>
                <SavingsGoalForm onClose={handleCloseGoalForm} goalToEdit={goalToEdit} />
            </Modal>
             {goalToAddFunds && (
                <Modal isOpen={true} onClose={() => setGoalToAddFunds(null)} title="Aportar a Objetivo">
                    <AddFundsForm 
                        goal={goalToAddFunds} 
                        onClose={() => setGoalToAddFunds(null)}
                        onSaveSuccess={handleSaveContribution}
                    />
                </Modal>
            )}
        </div>
    );
};

export default GlobalView;