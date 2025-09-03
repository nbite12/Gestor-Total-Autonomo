import React, { useState, useContext, useMemo, useCallback } from 'react';
import { AppContext } from '../App';
import { Card, Icon, HelpTooltip, Switch, Button, Modal, Input, Select } from './ui';
import { PeriodSelector } from './PeriodSelector';
import { PotentialIncome, MoneySource, MoneyLocation, Transfer, TransferJustification, PotentialExpense, Income, Expense, PersonalMovement } from '../types';
import { IncomeForm, ExpenseForm, MovementForm } from './TransactionForms';

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

const formatDateForInput = (isoDate: string | Date | undefined) => {
    if (!isoDate) return new Date().toISOString().split('T')[0];
    return new Date(isoDate).toISOString().split('T')[0];
}


// --- Potential Income Form Modal ---
const PotentialIncomeForm: React.FC<{
    onClose: () => void;
    incomeToEdit: PotentialIncome | null;
}> = ({ onClose, incomeToEdit }) => {
    const { data: {settings}, setData } = useContext(AppContext)!;
    
    const [formData, setFormData] = useState<Partial<PotentialIncome>>({
        id: incomeToEdit?.id || `pi-${Date.now()}`,
        concept: incomeToEdit?.concept || '',
        type: incomeToEdit?.type || 'monthly',
        date: incomeToEdit?.date ? formatDateForInput(incomeToEdit.date) : new Date().toISOString().split('T')[0],
        source: incomeToEdit?.source || MoneySource.AUTONOMO,
        location: incomeToEdit?.location || MoneyLocation.PRO_BANK,
        amount: incomeToEdit?.amount || 0,
        baseAmount: incomeToEdit?.baseAmount || 0,
        vatRate: incomeToEdit?.vatRate ?? settings.defaultVatRate,
        irpfRate: incomeToEdit?.irpfRate ?? settings.defaultIrpfRate,
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const isNumeric = ['amount', 'baseAmount', 'vatRate', 'irpfRate'].includes(name);
        setFormData(prev => ({...prev, [name]: isNumeric ? parseFloat(value) : value}));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        let finalIncome: PotentialIncome;

        if (formData.source === MoneySource.AUTONOMO) {
            finalIncome = {
                id: formData.id!,
                concept: formData.concept!,
                type: formData.type!,
                source: formData.source!,
                location: formData.location!,
                baseAmount: formData.baseAmount,
                vatRate: formData.vatRate,
                irpfRate: formData.irpfRate,
                date: formData.type === 'one-off' ? new Date(formData.date!).toISOString() : undefined
            };
        } else {
             finalIncome = {
                id: formData.id!,
                concept: formData.concept!,
                type: formData.type!,
                source: formData.source!,
                location: formData.location!,
                amount: formData.amount,
                date: formData.type === 'one-off' ? new Date(formData.date!).toISOString() : undefined
            };
        }
        
        setData(prev => ({
            ...prev,
            potentialIncomes: incomeToEdit 
                ? prev.potentialIncomes.map(pi => pi.id === incomeToEdit.id ? finalIncome : pi)
                : [...prev.potentialIncomes, finalIncome]
        }));
        onClose();
    };

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
            
            <Select label="Tipo de Ingreso" name="type" value={formData.type} onChange={handleChange}>
                <option value="monthly">Mensual</option>
                <option value="one-off">Puntual</option>
            </Select>
            {formData.type === 'one-off' && (
                <Input label="Fecha" name="date" type="date" value={formData.date} onChange={handleChange} required />
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
    const { data: { personalCategories }, setData } = useContext(AppContext)!;
    
    const [formData, setFormData] = useState<Partial<PotentialExpense>>({
        id: expenseToEdit?.id || `pe-${Date.now()}`,
        concept: expenseToEdit?.concept || '',
        type: expenseToEdit?.type || 'monthly',
        date: expenseToEdit?.date ? formatDateForInput(expenseToEdit.date) : new Date().toISOString().split('T')[0],
        amount: expenseToEdit?.amount || 0,
        categoryId: expenseToEdit?.categoryId || (personalCategories[0]?.id || ''),
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: name === 'amount' ? parseFloat(value) : value}));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalExpense: PotentialExpense = {
            id: formData.id!,
            concept: formData.concept!,
            type: formData.type!,
            amount: formData.amount!,
            categoryId: formData.categoryId!,
            date: formData.type === 'one-off' ? new Date(formData.date!).toISOString() : undefined,
        };
        
        setData(prev => ({
            ...prev,
            potentialExpenses: expenseToEdit 
                ? prev.potentialExpenses.map(pe => pe.id === expenseToEdit.id ? finalExpense : pe)
                : [...prev.potentialExpenses, finalExpense],
        }));
        onClose();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Concepto" name="concept" value={formData.concept} onChange={handleChange} required />
            <Input label="Importe (€)" name="amount" type="number" min="0" step="0.01" value={formData.amount} onChange={handleChange} required />
            <Select label="Categoría" name="categoryId" value={formData.categoryId} onChange={handleChange} required>
                {personalCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </Select>
            <Select label="Tipo de Gasto" name="type" value={formData.type} onChange={handleChange}>
                <option value="monthly">Mensual</option>
                <option value="one-off">Puntual</option>
            </Select>
            {formData.type === 'one-off' && (
                <Input label="Fecha" name="date" type="date" value={formData.date} onChange={handleChange} required />
            )}
            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                <Button type="submit">{expenseToEdit ? 'Guardar Cambios' : 'Añadir Gasto'}</Button>
            </div>
        </form>
    );
};


// --- Transfer Form Modal ---
const TransferForm: React.FC<{
    onClose: () => void;
    transferToEdit: Transfer | null;
}> = ({ onClose, transferToEdit }) => {
    const { setData } = useContext(AppContext)!;

    const [formData, setFormData] = useState<Partial<Transfer>>({
        id: transferToEdit?.id || `tr-${Date.now()}`,
        date: transferToEdit?.date ? formatDateForInput(transferToEdit.date) : new Date().toISOString().split('T')[0],
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
        
        setData(prev => ({
            ...prev,
            transfers: transferToEdit
                ? prev.transfers.map(t => t.id === transferToEdit.id ? finalTransfer : t)
                : [...prev.transfers, finalTransfer]
        }));
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
            <Input label="Fecha" name="date" type="date" value={formData.date} onChange={handleChange} required />
            <Input label="Concepto" name="concept" value={formData.concept} onChange={handleChange} required />
            <Select label="Justificación (para informe fiscal)" name="justification" value={formData.justification} onChange={handleChange}>
                {Object.values(TransferJustification).map(j => <option key={j} value={j}>{j}</option>)}
            </Select>

            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                <Button type="submit">{transferToEdit ? 'Guardar Cambios' : 'Añadir Transferencia'}</Button>
            </div>
        </form>
    )
};

// --- Contabilize Modal ---
const ContabilizeModal: React.FC<{
    item: Income | Expense | PersonalMovement;
    onClose: () => void;
    onSave: (id: string, paymentDate: string, location: MoneyLocation) => void;
}> = ({ item, onClose, onSave }) => {
    const [paymentDate, setPaymentDate] = useState(formatDateForInput(new Date()));
    const [location, setLocation] = useState(item.location || MoneyLocation.PRO_BANK);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(item.id, new Date(paymentDate).toISOString(), location);
        onClose();
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <p>Contabilizar: <strong>{item.concept}</strong></p>
            <Input 
                label="Fecha de Pago/Cobro"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
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
    const { setData } = useContext(AppContext)!;
    const [paymentDate, setPaymentDate] = useState(formatDateForInput(expense.date));
    const [location, setLocation] = useState(expense.location || MoneyLocation.PRO_BANK);
    const [periodStartDate, setPeriodStartDate] = useState(formatDateForInput(expense.date));
    const [periodEndDate, setPeriodEndDate] = useState(() => {
        const date = new Date(expense.date);
        date.setFullYear(date.getFullYear() + 1);
        date.setDate(date.getDate() - 1);
        return formatDateForInput(date);
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const pStartDate = new Date(periodStartDate);
        const pEndDate = new Date(periodEndDate);

        if (pEndDate <= pStartDate) {
            alert("La fecha de fin debe ser posterior a la fecha de inicio.");
            return;
        }

        setData(prev => {
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
        });

        onClose();
    };


    return (
        <form onSubmit={handleSubmit} className="space-y-4">
             <p>Periodizar: <strong>{expense.concept}</strong></p>
             <fieldset className="p-4 border border-slate-300 dark:border-slate-600 rounded-md space-y-4">
                <legend className="text-sm font-medium px-2">Detalles del Pago Real</legend>
                 <Input 
                    label="Fecha de Pago"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
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
                 <Input 
                    label="Fecha de Inicio del Gasto"
                    type="date"
                    value={periodStartDate}
                    onChange={(e) => setPeriodStartDate(e.target.value)}
                    required
                />
                <Input 
                    label="Fecha de Fin del Gasto"
                    type="date"
                    value={periodEndDate}
                    onChange={(e) => setPeriodEndDate(e.target.value)}
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
const AddPendingTransactionModal: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    const [scope, setScope] = useState<'professional' | 'personal'>('professional');
    const [type, setType] = useState<'income' | 'expense'>('income');
  
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Añadir Transacción Pendiente">
        <div className="flex flex-col space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200 dark:bg-slate-700 rounded-lg">
            <Button variant={scope === 'professional' ? 'primary' : 'secondary'} onClick={() => setScope('professional')} className="flex-1">Profesional</Button>
            <Button variant={scope === 'personal' ? 'primary' : 'secondary'} onClick={() => setScope('personal')} className="flex-1">Personal</Button>
          </div>
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200 dark:bg-slate-700 rounded-lg">
            <Button variant={type === 'income' ? 'primary' : 'secondary'} onClick={() => setType('income')} className="flex-1">Ingreso / Cobro</Button>
            <Button variant={type === 'expense' ? 'primary' : 'secondary'} onClick={() => setType('expense')} className="flex-1">Gasto / Pago</Button>
          </div>
          
          <div className="pt-2">
            {scope === 'professional' && type === 'income' && <IncomeForm onClose={onClose} defaultIsPaid={false} />}
            {scope === 'professional' && type === 'expense' && <ExpenseForm onClose={onClose} defaultIsPaid={false} />}
            {scope === 'personal' && <MovementForm onClose={onClose} defaultIsPaid={false} defaultType={type} />}
          </div>
        </div>
      </Modal>
    );
  };


// --- Global View ---
const GlobalView: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return <div>Cargando...</div>;

    const { data, setData, formatCurrency } = context;
    const { incomes, expenses, personalMovements, settings, savingsGoals, potentialIncomes, potentialExpenses, transfers, personalCategories } = data;

    const [period, setPeriod] = useState<{ startDate: Date; endDate: Date }>(() => {
        const end = new Date();
        const start = new Date(end.getFullYear(), end.getMonth(), 1);
        return { startDate: start, endDate: end };
    });
    
    const [includeSavings, setIncludeSavings] = useState(true);
    const [includePotentialIncome, setIncludePotentialIncome] = useState(true);
    const [includePotentialExpenses, setIncludePotentialExpenses] = useState(true);

    const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
    const [incomeToEdit, setIncomeToEdit] = useState<PotentialIncome | null>(null);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [expenseToEdit, setExpenseToEdit] = useState<PotentialExpense | null>(null);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferToEdit, setTransferToEdit] = useState<Transfer | null>(null);

    // State for pending transaction modals
    const [itemToContabilize, setItemToContabilize] = useState<Income | Expense | PersonalMovement | null>(null);
    const [expenseToPeriodize, setExpenseToPeriodize] = useState<Expense | null>(null);
    const [isAddPendingModalOpen, setIsAddPendingModalOpen] = useState(false);


    const handlePeriodChange = useCallback((startDate: Date, endDate: Date) => setPeriod({ startDate, endDate }), []);

    // --- Memoized Calculations ---
    const monthsInPeriod = useMemo(() => getMonthsInRange(period.startDate, period.endDate), [period]);

    const moneyDistribution = useMemo(() => {
        const balances: { [key in MoneyLocation]: number } = {
            [MoneyLocation.CASH]: data.settings.initialBalances?.[MoneyLocation.CASH] || 0,
            [MoneyLocation.PRO_BANK]: data.settings.initialBalances?.[MoneyLocation.PRO_BANK] || 0,
            [MoneyLocation.PERS_BANK]: data.settings.initialBalances?.[MoneyLocation.PERS_BANK] || 0,
            [MoneyLocation.OTHER]: data.settings.initialBalances?.[MoneyLocation.OTHER] || 0,
        };

        // Process paid professional incomes
        data.incomes.forEach(income => {
            if (income.isPaid && income.location) {
                const netAmount = income.baseAmount + (income.baseAmount * income.vatRate / 100) - (income.baseAmount * income.irpfRate / 100);
                balances[income.location] = (balances[income.location] || 0) + netAmount;
            }
        });

        // Process paid professional expenses
        data.expenses.forEach(expense => {
            if (expense.isPaid && expense.location) {
                const totalAmount = expense.baseAmount + (expense.baseAmount * expense.vatRate / 100);
                balances[expense.location] = (balances[expense.location] || 0) - totalAmount;
            }
        });

        // Process personal movements
        data.personalMovements.filter(m => m.isPaid).forEach(movement => {
            if (movement.location) {
                if (movement.type === 'income') {
                    balances[movement.location] = (balances[movement.location] || 0) + movement.amount;
                } else {
                    balances[movement.location] = (balances[movement.location] || 0) - movement.amount;
                }
            }
        });
        
        // Process transfers
        data.transfers.forEach(transfer => {
            balances[transfer.fromLocation] = (balances[transfer.fromLocation] || 0) - transfer.amount;
            balances[transfer.toLocation] = (balances[transfer.toLocation] || 0) + transfer.amount;
        });

        return balances;
    }, [data.incomes, data.expenses, data.personalMovements, data.transfers, data.settings.initialBalances]);


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

    const projectedIncome = useMemo(() => {
        if (!includePotentialIncome) return 0;
        
        const monthly = potentialIncomes
            .filter(pi => pi.type === 'monthly')
            .reduce((sum, pi) => sum + (getNetPotentialIncome(pi) * monthsInPeriod), 0);
            
        const oneOff = potentialIncomes
            .filter(pi => pi.type === 'one-off' && pi.date && new Date(pi.date) >= period.startDate && new Date(pi.date) <= period.endDate)
            .reduce((sum, pi) => sum + getNetPotentialIncome(pi), 0);

        return monthly + oneOff;
    }, [includePotentialIncome, potentialIncomes, monthsInPeriod, period]);
    
    const projectedExpenses = useMemo(() => {
        if (!includePotentialExpenses) return 0;
        
        const monthly = potentialExpenses
            .filter(pe => pe.type === 'monthly')
            .reduce((sum, pe) => sum + pe.amount, 0) * monthsInPeriod;
            
        const oneOff = potentialExpenses
            .filter(pe => pe.type === 'one-off' && pe.date && new Date(pe.date) >= period.startDate && new Date(pe.date) <= period.endDate)
            .reduce((sum, pe) => sum + pe.amount, 0);

        return monthly + oneOff;
    }, [includePotentialExpenses, potentialExpenses, monthsInPeriod, period]);

    const summary = useMemo(() => {
        const totalProjectedIncome = actualMovements.totalActualIncome + projectedIncome;
        const totalProjectedExpense = actualMovements.totalActualExpense + projectedSavings + projectedExpenses;
        const netProjectedCashFlow = totalProjectedIncome - totalProjectedExpense;

        return {
            ...actualMovements,
            projectedIncome,
            projectedSavings,
            projectedExpenses,
            totalProjectedIncome,
            totalProjectedExpense,
            netProjectedCashFlow,
        }
    }, [actualMovements, projectedIncome, projectedSavings, projectedExpenses]);
    
    const pendingIncomes = useMemo(() => data.incomes.filter(i => !i.isPaid), [data.incomes]);
    const pendingExpenses = useMemo(() => data.expenses.filter(e => !e.isPaid), [data.expenses]);
    const pendingPersonalIncomes = useMemo(() => data.personalMovements.filter(m => m.type === 'income' && !m.isPaid), [data.personalMovements]);
    const pendingPersonalExpenses = useMemo(() => data.personalMovements.filter(m => m.type === 'expense' && !m.isPaid), [data.personalMovements]);


    // --- Handlers ---
    const handleSaveContabilizar = (id: string, paymentDate: string, location: MoneyLocation) => {
        setData(prev => {
            const isIncome = prev.incomes.some(i => i.id === id);
            const isExpense = prev.expenses.some(e => e.id === id);
            
            if (isIncome) {
                return { ...prev, incomes: prev.incomes.map(i => i.id === id ? { ...i, isPaid: true, paymentDate, location } : i) };
            } else if (isExpense) {
                return { ...prev, expenses: prev.expenses.map(e => e.id === id ? { ...e, isPaid: true, paymentDate, location } : e) };
            } else { // Personal Movement
                return { ...prev, personalMovements: prev.personalMovements.map(m => m.id === id ? { ...m, isPaid: true, paymentDate, location } : m) };
            }
        });
    };

    const handleGoalContributionChange = (goalId: string, value: string) => {
        const amount = parseFloat(value);
        setData(prev => ({
            ...prev,
            savingsGoals: prev.savingsGoals.map(g => g.id === goalId ? {...g, plannedContribution: isNaN(amount) ? undefined : amount} : g)
        }));
    };
    
    const handleOpenIncomeModal = (income?: PotentialIncome) => {
        setIncomeToEdit(income || null);
        setIsIncomeModalOpen(true);
    };

    const handleDeletePotentialIncome = (id: string) => {
        if (window.confirm('¿Seguro que quieres eliminar este ingreso potencial?')) {
            setData(prev => ({...prev, potentialIncomes: prev.potentialIncomes.filter(pi => pi.id !== id)}));
        }
    };
    
     const handleOpenExpenseModal = (expense?: PotentialExpense) => {
        setExpenseToEdit(expense || null);
        setIsExpenseModalOpen(true);
    };

    const handleDeletePotentialExpense = (id: string) => {
        if (window.confirm('¿Seguro que quieres eliminar este gasto potencial?')) {
            setData(prev => ({...prev, potentialExpenses: prev.potentialExpenses.filter(pe => pe.id !== id)}));
        }
    };

    const handleOpenTransferModal = (transfer?: Transfer) => {
        setTransferToEdit(transfer || null);
        setIsTransferModalOpen(true);
    }
    
    const handleDeleteTransfer = (id: string) => {
        if (window.confirm('¿Seguro que quieres eliminar esta transferencia?')) {
            setData(prev => ({...prev, transfers: prev.transfers.filter(t => t.id !== id)}));
        }
    }


    const sourceColors: {[key in MoneySource]: string} = {
        [MoneySource.AUTONOMO]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        [MoneySource.PERSONAL]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        [MoneySource.B]: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    };
    const locationColors: {[key in MoneyLocation]: string} = {
        [MoneyLocation.PRO_BANK]: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
        [MoneyLocation.PERS_BANK]: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
        [MoneyLocation.CASH]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        [MoneyLocation.OTHER]: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
    };
    const categoryColors: { [key: string]: string } = personalCategories.reduce((acc, cat, index) => {
        const colors = ['bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300', 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300', 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300'];
        acc[cat.id] = colors[index % colors.length];
        return acc;
    }, {} as { [key: string]: string });


    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Visión Global y Proyección</h2>
            
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">Distribución del Dinero</h3>
                    <Button size="sm" onClick={() => handleOpenTransferModal()}>
                        <Icon name="switch-horizontal" className="w-4 h-4" /> Transferir
                    </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
                        <Icon name="cash" className="w-8 h-8 text-primary-500 flex-shrink-0" />
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{MoneyLocation.CASH}</p>
                            <p className="text-lg font-bold">{formatCurrency(moneyDistribution[MoneyLocation.CASH])}</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
                        <Icon name="office-building" className="w-8 h-8 text-primary-500 flex-shrink-0" />
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{MoneyLocation.PRO_BANK}</p>
                            <p className="text-lg font-bold">{formatCurrency(moneyDistribution[MoneyLocation.PRO_BANK])}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
                        <Icon name="user-circle" className="w-8 h-8 text-primary-500 flex-shrink-0" />
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{MoneyLocation.PERS_BANK}</p>
                            <p className="text-lg font-bold">{formatCurrency(moneyDistribution[MoneyLocation.PERS_BANK])}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
                        <Icon name="globe" className="w-8 h-8 text-primary-500 flex-shrink-0" />
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{MoneyLocation.OTHER}</p>
                            <p className="text-lg font-bold">{formatCurrency(moneyDistribution[MoneyLocation.OTHER])}</p>
                        </div>
                    </div>
                </div>
            </Card>

            <Card>
                <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
                    <h3 className="text-xl font-bold">Transacciones Pendientes</h3>
                    <Button size="sm" variant="secondary" onClick={() => setIsAddPendingModalOpen(true)}>
                        <Icon name="plus" className="w-4 h-4" /> Añadir Transacción Pendiente
                    </Button>
                </div>
                {pendingIncomes.length === 0 && pendingExpenses.length === 0 && pendingPersonalIncomes.length === 0 && pendingPersonalExpenses.length === 0 ? (
                    <p className="text-center text-slate-500 py-8">No hay transacciones pendientes. ¡Añade una para empezar a planificar!</p>
                ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
                    <div>
                        <h4 className="font-semibold mb-2 text-green-600 dark:text-green-400">Pendiente de Cobro (Profesional)</h4>
                         {pendingIncomes.length > 0 ? (
                            <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">{pendingIncomes.map(income => (
                                <li key={income.id} className="p-2 bg-slate-50 dark:bg-slate-700 rounded-md text-sm">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p>{income.concept}</p>
                                            <p className="text-xs text-slate-500">{income.clientName} | {new Date(income.date).toLocaleDateString('es-ES')}</p>
                                        </div>
                                        <p className="font-semibold">{formatCurrency(income.baseAmount + (income.baseAmount * income.vatRate / 100) - (income.baseAmount * income.irpfRate / 100))}</p>
                                    </div>
                                    <div className="flex justify-end gap-2 mt-1">
                                        <Button size="sm" variant="secondary" onClick={() => setItemToContabilize(income)}>Contabilizar</Button>
                                    </div>
                                </li>
                            ))}</ul>
                        ) : (
                            <p className="text-sm text-slate-400 italic">No hay cobros profesionales pendientes.</p>
                        )}
                    </div>
                    <div>
                        <h4 className="font-semibold mb-2 text-red-600 dark:text-red-400">Pendiente de Pago (Profesional)</h4>
                         {pendingExpenses.length > 0 ? (
                            <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">{pendingExpenses.map(expense => (
                                <li key={expense.id} className="p-2 bg-slate-50 dark:bg-slate-700 rounded-md text-sm">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p>{expense.concept}</p>
                                            <p className="text-xs text-slate-500">{expense.providerName} | {new Date(expense.date).toLocaleDateString('es-ES')}</p>
                                        </div>
                                        <p className="font-semibold">{formatCurrency(expense.baseAmount + (expense.baseAmount * expense.vatRate / 100))}</p>
                                    </div>
                                    <div className="flex justify-end gap-2 mt-1">
                                        <Button size="sm" variant="secondary" onClick={() => setItemToContabilize(expense)}>Contabilizar</Button>
                                        <Button size="sm" variant="ghost" onClick={() => setExpenseToPeriodize(expense)}>Periodizar</Button>
                                    </div>
                                </li>
                             ))}</ul>
                         ) : (
                            <p className="text-sm text-slate-400 italic">No hay pagos profesionales pendientes.</p>
                         )}
                    </div>
                    <div>
                        <h4 className="font-semibold mb-2 text-green-500 dark:text-green-300">Pendiente de Ingreso (Personal)</h4>
                         {pendingPersonalIncomes.length > 0 ? (
                            <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">{pendingPersonalIncomes.map(mov => (
                                <li key={mov.id} className="p-2 bg-slate-50 dark:bg-slate-700 rounded-md text-sm">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p>{mov.concept}</p>
                                            <p className="text-xs text-slate-500">{new Date(mov.date).toLocaleDateString('es-ES')}</p>
                                        </div>
                                        <p className="font-semibold">{formatCurrency(mov.amount)}</p>
                                    </div>
                                    <div className="flex justify-end gap-2 mt-1">
                                        <Button size="sm" variant="secondary" onClick={() => setItemToContabilize(mov)}>Contabilizar</Button>
                                    </div>
                                </li>
                            ))}</ul>
                        ) : (
                            <p className="text-sm text-slate-400 italic">No hay ingresos personales pendientes.</p>
                        )}
                    </div>
                     <div>
                        <h4 className="font-semibold mb-2 text-red-500 dark:text-red-300">Pendiente de Gasto (Personal)</h4>
                         {pendingPersonalExpenses.length > 0 ? (
                            <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">{pendingPersonalExpenses.map(mov => (
                                <li key={mov.id} className="p-2 bg-slate-50 dark:bg-slate-700 rounded-md text-sm">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p>{mov.concept}</p>
                                            <p className="text-xs text-slate-500">{new Date(mov.date).toLocaleDateString('es-ES')}</p>
                                        </div>
                                        <p className="font-semibold">{formatCurrency(mov.amount)}</p>
                                    </div>
                                    <div className="flex justify-end gap-2 mt-1">
                                        <Button size="sm" variant="secondary" onClick={() => setItemToContabilize(mov)}>Contabilizar</Button>
                                    </div>
                                </li>
                             ))}</ul>
                         ) : (
                            <p className="text-sm text-slate-400 italic">No hay gastos personales pendientes.</p>
                         )}
                    </div>
                </div>
                )}
            </Card>

            <Card>
                 <h3 className="text-xl font-bold mb-4">Historial de Transferencias</h3>
                 <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400 sticky top-0">
                            <tr>
                                <th scope="col" className="px-4 py-2">Fecha</th>
                                <th scope="col" className="px-4 py-2">Concepto / Just.</th>
                                <th scope="col" className="px-4 py-2">Desde</th>
                                <th scope="col" className="px-4 py-2">Hasta</th>
                                <th scope="col" className="px-4 py-2 text-right">Importe</th>
                                <th scope="col" className="px-4 py-2 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transfers.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(tr => (
                                <tr key={tr.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                    <td className="px-4 py-2">{new Date(tr.date).toLocaleDateString('es-ES')}</td>
                                    <td className="px-4 py-2">
                                        <p className="font-semibold">{tr.concept}</p>
                                        <p className="text-xs text-slate-500">{tr.justification}</p>
                                    </td>
                                    <td className="px-4 py-2"><span className={`px-2 py-1 rounded-full text-xs font-medium ${locationColors[tr.fromLocation]}`}>{tr.fromLocation}</span></td>
                                    <td className="px-4 py-2"><span className={`px-2 py-1 rounded-full text-xs font-medium ${locationColors[tr.toLocation]}`}>{tr.toLocation}</span></td>
                                    <td className="px-4 py-2 font-semibold text-right">{formatCurrency(tr.amount)}</td>
                                    <td className="px-4 py-2 text-center">
                                        <Button size="sm" variant="ghost" onClick={() => handleOpenTransferModal(tr)} title="Editar"><Icon name="pencil" className="w-4 h-4" /></Button>
                                        <Button size="sm" variant="ghost" onClick={() => handleDeleteTransfer(tr.id)} title="Eliminar"><Icon name="trash" className="w-4 h-4 text-red-500" /></Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
                 {transfers.length === 0 && <p className="text-center text-slate-500 py-8">No hay transferencias registradas.</p>}
            </Card>

            <PeriodSelector onPeriodChange={handlePeriodChange} />
            
            {/* Main KPIs */}
            <Card>
                 <h3 className="text-xl font-bold mb-4">Resumen y Proyección del Periodo</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center divide-y md:divide-y-0 md:divide-x dark:divide-slate-700">
                    <div className="p-4">
                        <h4 className="text-lg text-slate-500 dark:text-slate-400">Ingresos Proyectados</h4>
                        <p className="text-3xl font-bold text-green-500">{formatCurrency(summary.totalProjectedIncome)}</p>
                        <p className="text-xs text-slate-400">({formatCurrency(summary.totalActualIncome)} reales + {formatCurrency(summary.projectedIncome)} pot.)</p>
                    </div>
                    <div className="p-4">
                        <h4 className="text-lg text-slate-500 dark:text-slate-400">Gastos Proyectados</h4>
                        <p className="text-3xl font-bold text-red-500">{formatCurrency(summary.totalProjectedExpense)}</p>
                        <p className="text-xs text-slate-400">({formatCurrency(summary.totalActualExpense)} reales + {formatCurrency(summary.projectedSavings)} ahorro + {formatCurrency(summary.projectedExpenses)} pot.)</p>
                    </div>
                    <div className="p-4">
                        <h4 className="text-lg text-slate-500 dark:text-slate-400">Flujo de Caja Neto Proyectado</h4>
                        <p className={`text-4xl font-bold ${summary.netProjectedCashFlow >= 0 ? 'text-primary-500' : 'text-red-600'}`}>{formatCurrency(summary.netProjectedCashFlow)}</p>
                        <p className="text-xs text-slate-400">Dinero neto disponible estimado</p>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Planning Panels */}
                <Card>
                    <h3 className="text-lg font-bold mb-4">Controles de Proyección</h3>
                    <div className="space-y-4">
                        <Switch label="Incluir Ahorro Planificado" checked={includeSavings} onChange={setIncludeSavings} />
                        <Switch label="Incluir Ingresos Potenciales" checked={includePotentialIncome} onChange={setIncludePotentialIncome} />
                        <Switch label="Incluir Gastos Potenciales" checked={includePotentialExpenses} onChange={setIncludePotentialExpenses} />
                    </div>
                </Card>
                 <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold">Ingresos Potenciales</h3>
                        <Button size="sm" onClick={() => handleOpenIncomeModal()}> <Icon name="plus" className="w-4 h-4" /> Añadir</Button>
                    </div>
                    <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
                        {potentialIncomes.length > 0 ? potentialIncomes.map(pi => (
                           <div key={pi.id} className="text-sm p-2 bg-slate-50 dark:bg-slate-700 rounded-md">
                               <div className="flex justify-between items-start">
                                   <div>
                                       <p className="font-semibold">{pi.concept}</p>
                                       <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(getNetPotentialIncome(pi))}</p>
                                   </div>
                                   <div className="flex-shrink-0">
                                       <Button variant="ghost" size="sm" onClick={() => handleOpenIncomeModal(pi)}><Icon name="pencil" className="w-4 h-4" /></Button>
                                       <Button variant="ghost" size="sm" onClick={() => handleDeletePotentialIncome(pi.id)}><Icon name="trash" className="w-4 h-4 text-red-500" /></Button>
                                   </div>
                               </div>
                               <div className="flex flex-wrap gap-2 mt-1">
                                   <span className={`px-2 py-1 rounded-full text-xs font-medium ${sourceColors[pi.source]}`}>{pi.source.split(' ')[0]}</span>
                                   <span className={`px-2 py-1 rounded-full text-xs font-medium ${locationColors[pi.location]}`}>{pi.location}</span>
                                   <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-200 text-slate-800 dark:bg-slate-600 dark:text-slate-200">{pi.type === 'monthly' ? 'Mensual' : `Puntual`}</span>
                               </div>
                           </div>
                        )) : <p className="text-sm text-center text-slate-500">Añade ingresos futuros para proyectar tu crecimiento.</p>}
                    </div>
                </Card>
            </div>
            
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Gastos Potenciales</h3>
                    <Button size="sm" onClick={() => handleOpenExpenseModal()}> <Icon name="plus" className="w-4 h-4" /> Añadir</Button>
                </div>
                <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
                    {potentialExpenses.length > 0 ? potentialExpenses.map(pe => {
                        const category = personalCategories.find(c => c.id === pe.categoryId);
                        return (
                       <div key={pe.id} className="text-sm p-2 bg-slate-50 dark:bg-slate-700 rounded-md">
                           <div className="flex justify-between items-start">
                               <div>
                                   <p className="font-semibold">{pe.concept}</p>
                                   <p className="text-lg font-bold text-red-600 dark:text-red-400">{formatCurrency(pe.amount)}</p>
                               </div>
                               <div className="flex-shrink-0">
                                   <Button variant="ghost" size="sm" onClick={() => handleOpenExpenseModal(pe)}><Icon name="pencil" className="w-4 h-4" /></Button>
                                   <Button variant="ghost" size="sm" onClick={() => handleDeletePotentialExpense(pe.id)}><Icon name="trash" className="w-4 h-4 text-red-500" /></Button>
                               </div>
                           </div>
                           <div className="flex flex-wrap gap-2 mt-1">
                               {category && <span className={`px-2 py-1 rounded-full text-xs font-medium ${categoryColors[category.id] || 'bg-gray-100 text-gray-800'}`}>{category.name}</span>}
                               <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-200 text-slate-800 dark:bg-slate-600 dark:text-slate-200">{pe.type === 'monthly' ? 'Mensual' : `Puntual`}</span>
                           </div>
                       </div>
                    )}) : <p className="text-sm text-center text-slate-500">Añade gastos futuros (suscripciones, etc.) para una proyección más precisa.</p>}
                </div>
            </Card>

            <Card>
                <h3 className="text-xl font-bold mb-4">Planificación de Ahorro</h3>
                <div className="space-y-4">
                    {savingsGoals.length > 0 ? savingsGoals.map(goal => (
                        <div key={goal.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center border-t dark:border-slate-700 pt-4 first:border-t-0">
                            <div className="md:col-span-1">
                                <p className="font-semibold">{goal.name}</p>
                                <p className="text-xs text-slate-500">
                                    Restante: {formatCurrency(Math.max(0, goal.targetAmount - goal.currentAmount))}
                                </p>
                            </div>
                            {(() => {
                                const amountRemaining = goal.targetAmount - goal.currentAmount;
                                if (amountRemaining <= 0) {
                                    return (
                                        <div className="md:col-span-2 flex items-center gap-2 text-green-500">
                                            <Icon name="sparkles" className="w-5 h-5" />
                                            <p className="font-semibold">¡Objetivo conseguido!</p>
                                        </div>
                                    );
                                }

                                const monthsRemaining = getMonthsRemaining(goal.deadline);
                                if (monthsRemaining === 0) {
                                    return (
                                        <div className="md:col-span-2 text-red-500">
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
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )) : <p className="text-center text-slate-500">Crea objetivos en el Área Personal para planificar tu ahorro.</p>}
                </div>
            </Card>

            {/* Modals for this view */}
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
            <AddPendingTransactionModal isOpen={isAddPendingModalOpen} onClose={() => setIsAddPendingModalOpen(false)} />
        </div>
    );
};

export default GlobalView;