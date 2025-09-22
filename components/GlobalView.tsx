import React, { useState, useContext, useMemo, useCallback, useRef, useEffect } from 'react';
import { AppContext } from '../App';
import { Card, Icon, HelpTooltip, Button, Modal, Input, Select, Celebration } from './ui';
import { PeriodSelector } from './PeriodSelector';
import { ScheduledTransaction, MoneyLocation, Transfer, TransferJustification, Income, Expense, PersonalMovement, InvestmentGood, SavingsGoal, PotentialFrequency } from '../types';
// FIX: Import DatePickerInput to be used in modals within this component.
import { IncomeForm, ExpenseForm, MovementForm, TransferForm, SavingsGoalForm, AddFundsForm, ScheduledTransactionForm, DatePickerInput } from './TransactionForms';
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

const formatDateTime = (isoDate: Date) => {
    return new Date(isoDate).toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).replace(',', '');
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
  
// --- Add Recorded Transaction Modal ---
const AddRecordedTransactionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    isProfessionalModeEnabled: boolean;
}> = ({ isOpen, onClose, isProfessionalModeEnabled }) => {
    const [view, setView] = useState<'select' | 'proIncome' | 'proExpense' | 'persMove' | 'transfer'>('select');

    const handleClose = () => {
        setView('select');
        onClose();
    };

    const getTitle = () => {
        switch(view) {
            case 'proIncome': return "Añadir Ingreso Contabilizado";
            case 'proExpense': return "Añadir Gasto Contabilizado";
            case 'persMove': return "Añadir Movimiento Personal";
            case 'transfer': return "Añadir Transferencia";
            default: return "Añadir Movimiento Contabilizado";
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={getTitle()}>
            {view === 'select' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {isProfessionalModeEnabled && (
                        <>
                            <Button variant="secondary" className="h-20 flex-col" onClick={() => setView('proIncome')}><Icon name="TrendingUp" className="mb-1" />Ingreso Profesional</Button>
                            <Button variant="secondary" className="h-20 flex-col" onClick={() => setView('proExpense')}><Icon name="TrendingDown" className="mb-1" />Gasto Profesional</Button>
                        </>
                    )}
                    <Button variant="secondary" className="h-20 flex-col" onClick={() => setView('persMove')}><Icon name="Home" className="mb-1" />Movimiento Personal</Button>
                    <Button variant="secondary" className="h-20 flex-col" onClick={() => setView('transfer')}><Icon name="ArrowRightLeft" className="mb-1" />Transferencia</Button>
                </div>
            ) : (
                <>
                    <Button variant="ghost" size="sm" onClick={() => setView('select')} className="mb-4 -ml-2">
                        <Icon name="ArrowLeft" className="w-4 h-4 mr-1" /> Volver
                    </Button>
                    {view === 'proIncome' && <IncomeForm onClose={handleClose} defaultIsPaid={true} />}
                    {view === 'proExpense' && <ExpenseForm onClose={handleClose} defaultIsPaid={true} />}
                    {view === 'persMove' && <MovementForm onClose={handleClose} defaultIsPaid={true} />}
                    {view === 'transfer' && <TransferForm onClose={handleClose} />}
                </>
            )}
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
    const { incomes, expenses, personalMovements, settings, savingsGoals, scheduledTransactions, transfers, personalCategories, investmentGoods } = data;

    const [period, setPeriod] = useState<{ startDate: Date; endDate: Date }>(() => {
        const end = new Date();
        const start = new Date(end.getFullYear(), end.getMonth(), 1);
        return { startDate: start, endDate: end };
    });
    
    const [includeSavings, setIncludeSavings] = useState(true);
    const [includeScheduled, setIncludeScheduled] = useState(true);
    const [includePendingTransactions, setIncludePendingTransactions] = useState(false);
    const [showProjection, setShowProjection] = useState(false);
    const [isTaxesBreakdownOpen, setIsTaxesBreakdownOpen] = useState(false);

    const [includeNetCapitalItems, setIncludeNetCapitalItems] = useState({
        pendingIncome: true,
        pendingExpenses: true,
        taxes: true,
        scheduledIncome: true,
        scheduledExpenses: true,
    });


    const [isScheduledModalOpen, setIsScheduledModalOpen] = useState(false);
    const [scheduledToEdit, setScheduledToEdit] = useState<ScheduledTransaction | null>(null);
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
    const [isAddRecordedModalOpen, setIsAddRecordedModalOpen] = useState(false);

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
    
    const getNetScheduledAmount = useCallback((st: ScheduledTransaction): number => {
        if (st.scope === 'professional') {
            const base = st.baseAmount || 0;
            const vat = base * (st.vatRate || 0) / 100;
            const irpf = base * (st.irpfRate || 0) / 100;
            return st.type === 'income' ? (base + vat - irpf) : (base + vat);
        }
        return st.amount || 0;
    }, []);

    const countOccurrences = useCallback((
        frequency: PotentialFrequency,
        startDate: Date,
        endDate: Date | undefined,
        periodStart: Date,
        periodEnd: Date
    ): number => {
        if (startDate > periodEnd) return 0;
        
        let count = 0;
        let currentDate = new Date(startDate);
        
        while (currentDate <= periodEnd) {
             if (endDate && currentDate > endDate) break;

            if (currentDate >= periodStart) {
                count++;
            }
            if(frequency === 'one-off') break;

            const tempDate = new Date(currentDate);
            switch (frequency) {
                case 'weekly': tempDate.setDate(tempDate.getDate() + 7); break;
                case 'monthly': tempDate.setMonth(tempDate.getMonth() + 1); break;
                case 'quarterly': tempDate.setMonth(tempDate.getMonth() + 3); break;
                case 'yearly': tempDate.setFullYear(tempDate.getFullYear() + 1); break;
            }
            if (tempDate <= currentDate) break; // prevent infinite loops
            currentDate = tempDate;
        }
        return count;
    }, []);

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
        const qStartDate = new Date(year, quarter * 3, 1);
        const qEndDate = new Date(year, quarter * 3 + 3, 0, 23, 59, 59, 999);
        
        let scheduledIncomeInQuarter = 0;
        let scheduledExpenseInQuarter = 0;

        scheduledTransactions.forEach(st => {
            const occurrences = countOccurrences(st.frequency, new Date(st.startDate), st.endDate ? new Date(st.endDate) : undefined, qStartDate, qEndDate);
            const amount = getNetScheduledAmount(st);
            if (st.type === 'income') {
                scheduledIncomeInQuarter += occurrences * amount;
            } else {
                scheduledExpenseInQuarter += occurrences * amount;
            }
        });

        const { incomes, expenses, investmentGoods, settings } = data;
        const getCuotaIVA = (base: number, rate: number) => base * (rate / 100);
        const getCuotaIRPF = (base: number, rate: number) => base * (rate / 100);
        
        const qIncomes = incomes.filter(i => new Date(i.date) >= qStartDate && new Date(i.date) <= qEndDate);
        const qDeductibleExpenses = expenses.filter(e => e.isDeductible && new Date(e.date) >= qStartDate && new Date(e.date) <= qEndDate);

        const ivaRepercutido = qIncomes.reduce((sum, i) => sum + getCuotaIVA(i.baseAmount, i.vatRate), 0);
        const ivaSoportadoFromExpenses = qDeductibleExpenses.reduce((sum, e) => sum + getCuotaIVA(e.baseAmount, e.vatRate), 0);
        const ivaSoportadoFromGoods = investmentGoods.filter(g => g.isDeductible && new Date(g.purchaseDate) >= qStartDate && new Date(g.purchaseDate) <= qEndDate).reduce((sum, g) => sum + getCuotaIVA(g.acquisitionValue, g.vatRate), 0);
        const ivaSoportado = ivaSoportadoFromExpenses + ivaSoportadoFromGoods;
        const model303Result = Math.max(0, ivaRepercutido - ivaSoportado);

        const yearOfPeriod = qStartDate.getFullYear();
        const quarterOfPeriod = quarter + 1;
        const incomesYTD = incomes.filter(i => { const d = new Date(i.date); return d.getFullYear() === yearOfPeriod && d <= qEndDate; });
        const expensesYTD = expenses.filter(e => { const d = new Date(e.date); return d.getFullYear() === yearOfPeriod && d <= qEndDate && e.isDeductible; });
        const grossYTD = incomesYTD.reduce((sum, i) => sum + i.baseAmount, 0);
        const expensesFromInvoicesYTD = expensesYTD.reduce((sum, e) => {
            const expenseBase = e.deductibleBaseAmount ?? e.baseAmount;
            const nonDeductibleVat = e.isDeductible ? 0 : getCuotaIVA(e.baseAmount, e.vatRate);
            return sum + expenseBase + nonDeductibleVat;
        }, 0);
        const amortizationYTD = investmentGoods.filter(g => g.isDeductible).reduce((sum, good) => {
             const dailyAmortization = (good.acquisitionValue / good.usefulLife) / 365.25;
             const goodStartDate = new Date(good.purchaseDate);
             if (goodStartDate.getFullYear() > yearOfPeriod) return sum;
             const effectiveStartDate = goodStartDate < new Date(yearOfPeriod, 0, 1) ? new Date(yearOfPeriod, 0, 1) : goodStartDate;
             const effectiveEndDate = qEndDate;
             const days = (effectiveEndDate.getTime() - effectiveStartDate.getTime()) / (1000 * 3600 * 24) + 1;
             return sum + (days * dailyAmortization);
        }, 0);
        const autonomoFeeYTD = (settings.monthlyAutonomoFee || 0) * (quarterOfPeriod * 3);
        const deductibleExpensesYTD = expensesFromInvoicesYTD + amortizationYTD + autonomoFeeYTD;
        const netProfitYTD = grossYTD - deductibleExpensesYTD;
        const quoteYTD = netProfitYTD * 0.20;
        const retencionesSoportadasYTD = incomesYTD.reduce((sum, i) => sum + getCuotaIRPF(i.baseAmount, i.irpfRate), 0);
        const model130Result = Math.max(0, quoteYTD - retencionesSoportadasYTD);

        const qAllExpenses = expenses.filter(e => new Date(e.date) >= qStartDate && new Date(e.date) <= qEndDate);
        const model111Result = qAllExpenses.reduce((sum, e) => sum + (e.irpfRetentionAmount && !e.isRentalExpense ? e.irpfRetentionAmount : 0), 0);
        const model115Result = qAllExpenses.reduce((sum, e) => sum + (e.irpfRetentionAmount && e.isRentalExpense ? e.irpfRetentionAmount : 0), 0);
        
        const totalProjectedTaxes = model303Result + model130Result + model111Result + model115Result;

        const netAvailableCapital = currentTotalBalance 
            + (includeNetCapitalItems.pendingIncome ? totalPendingIncome : 0)
            - (includeNetCapitalItems.pendingExpenses ? totalPendingExpenses : 0)
            - (includeNetCapitalItems.taxes ? totalProjectedTaxes : 0)
            + (includeNetCapitalItems.scheduledIncome ? scheduledIncomeInQuarter : 0)
            - (includeNetCapitalItems.scheduledExpenses ? scheduledExpenseInQuarter : 0);


        return {
            professionalBalance,
            personalBalance,
            totalPendingIncome,
            totalPendingExpenses,
            totalProjectedTaxes,
            scheduledIncomeInQuarter,
            scheduledExpenseInQuarter,
            netAvailableCapital,
            taxesBreakdown: { model303Result, model130Result, model111Result, model115Result, totalProjectedTaxes }
        };

    }, [data, moneyDistribution, includeNetCapitalItems, scheduledTransactions, getNetScheduledAmount, countOccurrences]);

    const pendingIncomes = useMemo(() => data.incomes.filter(i => !i.isPaid), [data.incomes]);
    const pendingExpenses = useMemo(() => data.expenses.filter(e => !e.isPaid), [data.expenses]);
    const pendingPersonalIncomes = useMemo(() => data.personalMovements.filter(m => m.type === 'income' && !m.isPaid), [data.personalMovements]);
    const pendingPersonalExpenses = useMemo(() => data.personalMovements.filter(m => m.type === 'expense' && !m.isPaid), [data.personalMovements]);

    const unifiedTransactions = useMemo(() => {
        const getNextDate = (currentDate: Date, frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly'): Date => {
            const next = new Date(currentDate);
            switch (frequency) {
                case 'weekly': next.setDate(next.getDate() + 7); break;
                case 'monthly': next.setMonth(next.getMonth() + 1); break;
                case 'quarterly': next.setMonth(next.getMonth() + 3); break;
                case 'yearly': next.setFullYear(next.getFullYear() + 1); break;
            }
            return next;
        };
        
        const typeLabels: { [key: string]: { label: string, color: string } } = {
            proIncome: { label: 'Ingreso Pro.', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
            proExpense: { label: 'Gasto Pro.', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
            persIncome: { label: 'Ingreso Pers.', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
            persExpense: { label: 'Gasto Pers.', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' },
            transfer: { label: 'Transferencia', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
        };

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
                isProjection: false,
                originalItem: i,
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
                isProjection: false,
                originalItem: e,
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
                isProjection: false,
                originalItem: p,
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
                isProjection: false,
                originalItem: t,
            })),
        ];

        const projectedTransactions: any[] = [];
        scheduledTransactions.forEach(st => {
            if (!st.startDate) return;

            let currentDate = new Date(st.startDate);
            const itemEndDate = st.endDate ? new Date(st.endDate) : null;
            
            while (currentDate < period.startDate && st.frequency !== 'one-off') {
                const nextDate = getNextDate(currentDate, st.frequency);
                if (nextDate <= currentDate) break;
                currentDate = nextDate;
            }

            while (currentDate <= period.endDate) {
                if (itemEndDate && currentDate > itemEndDate) break;

                const amount = getNetScheduledAmount(st);
                const typeKey = st.scope === 'professional' ? (st.type === 'income' ? 'proIncome' : 'proExpense') : (st.type === 'income' ? 'persIncome' : 'persExpense');
                
                projectedTransactions.push({
                    id: `proj-${st.id}-${currentDate.getTime()}`,
                    date: new Date(currentDate),
                    type: typeKey,
                    typeLabel: typeLabels[typeKey],
                    concept: st.concept,
                    details: `Programado ${frequencyLabels[st.frequency]}`,
                    amount: st.type === 'income' ? amount : -amount,
                    isPaid: false,
                    autoGenerated: false,
                    isProjection: true,
                });

                if (st.frequency === 'one-off') break;
                const next = getNextDate(currentDate, st.frequency);
                if (next <= currentDate) break;
                currentDate = next;
            }
        });
        
        return [...allTransactions, ...projectedTransactions]
            .filter(t => t.date >= period.startDate && t.date <= period.endDate)
            .filter(t => {
                // If it's a projection, it has no 'originalItem', so it always passes this filter.
                if (t.isProjection) return true;
                // For actual items, apply the type filter.
                return typeFilters[t.type as keyof typeof typeFilters];
            })
            .sort((a, b) => b.date.getTime() - a.date.getTime());

    }, [incomes, expenses, personalMovements, transfers, period, typeFilters, personalCategories, isProfessionalModeEnabled, scheduledTransactions, getNetScheduledAmount]);


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
    
    const handleOpenScheduledModal = (st?: ScheduledTransaction) => {
        setScheduledToEdit(st || null);
        setIsScheduledModalOpen(true);
    };

    const handleDeleteScheduled = (id: string) => {
        if (window.confirm('¿Seguro que quieres eliminar esta transacción programada?')) {
            saveData(prev => ({...prev, scheduledTransactions: prev.scheduledTransactions.filter(st => st.id !== id)}), "Transacción programada eliminada.");
        }
    };
    
    const handleOpenTransferModal = (transfer?: Transfer) => {
        setTransferToEdit(transfer || null);
        setIsTransferModalOpen(true);
    }
    
    const handleEditUnified = (item: any) => {
         if (item.isProjection) {
            // Find the original scheduled transaction to edit it
            const originalId = item.id.split('-')[1];
            const originalST = scheduledTransactions.find(st => st.id === originalId);
            if(originalST) {
                handleOpenScheduledModal(originalST);
            }
            return;
        }

        const prefixedId = item.id;
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

    const handleDeleteUnified = (item: any) => {
        if (item.isProjection) {
            if (window.confirm('Esto eliminará la regla de transacción programada que genera esta proyección. ¿Continuar?')) {
                const originalId = item.id.split('-')[1];
                handleDeleteScheduled(originalId);
            }
            return;
        }

        if (!window.confirm('¿Estás seguro de que quieres eliminar esta transacción?')) return;
        
        const prefixedId = item.id;
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

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-3">
                <Icon name="Globe" className="w-8 h-8 text-primary-500" />
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Visión Global y Proyección</h2>
            </div>

            <div className="flex justify-center">
                <Button size="lg" onClick={() => setIsAddRecordedModalOpen(true)} className="shadow-lg transform hover:scale-105">
                    <Icon name="PlusCircle" className="w-6 h-6 mr-2"/>
                    Añadir Movimiento
                </Button>
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
                            <span className="text-gray-600 dark:text-gray-400">Fondos (Bruto)</span>
                            <span className="font-medium">{formatCurrency(netCapitalSummary.professionalBalance + netCapitalSummary.personalBalance)}</span>
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
                        <div className={`flex justify-between items-center transition-opacity ${!includeNetCapitalItems.scheduledIncome ? 'opacity-40' : ''}`}>
                             <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                <Toggle checked={includeNetCapitalItems.scheduledIncome} onChange={() => handleToggleNetCapitalItem('scheduledIncome')} />
                                Ingresos Programados (Trimestre)
                            </span>
                            <span className="font-medium text-green-500">+{formatCurrency(netCapitalSummary.scheduledIncomeInQuarter)}</span>
                        </div>
                         <div className={`flex justify-between items-center transition-opacity ${!includeNetCapitalItems.scheduledExpenses ? 'opacity-40' : ''}`}>
                             <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                <Toggle checked={includeNetCapitalItems.scheduledExpenses} onChange={() => handleToggleNetCapitalItem('scheduledExpenses')} />
                                Gastos Programados (Trimestre)
                            </span>
                            <span className="font-medium text-red-500">-{formatCurrency(netCapitalSummary.scheduledExpenseInQuarter)}</span>
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

            <PeriodSelector onPeriodChange={handlePeriodChange} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Planning Panels */}
                <Card className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Transacciones Programadas</h3>
                        <Button size="sm" onClick={() => handleOpenScheduledModal()}> <Icon name="Plus" className="w-4 h-4" /> Añadir</Button>
                    </div>
                    <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
                        {scheduledTransactions.length > 0 ? scheduledTransactions.map(st => {
                             const amount = getNetScheduledAmount(st);
                             const color = st.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
                             const scopeColor = st.scope === 'professional' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800';
                             return (
                           <div key={st.id} className="text-sm p-2 bg-slate-50 dark:bg-slate-700/50 rounded-md">
                               <div className="flex justify-between items-start">
                                   <div>
                                       <p className="font-semibold">{st.concept}</p>
                                       <p className={`text-lg font-bold ${color}`}>{formatCurrency(amount)}</p>
                                   </div>
                                   <div className="flex-shrink-0">
                                       <Button variant="ghost" size="sm" onClick={() => handleOpenScheduledModal(st)}><Icon name="Pencil" className="w-4 h-4" /></Button>
                                       <Button variant="ghost" size="sm" onClick={() => handleDeleteScheduled(st.id)}><Icon name="Trash2" className="w-4 h-4 text-red-500" /></Button>
                                   </div>
                               </div>
                               <div className="flex flex-wrap gap-2 mt-1">
                                   <span className={`px-2 py-1 rounded-full text-xs font-medium ${scopeColor}`}>{st.scope === 'professional' ? 'Profesional' : 'Personal'}</span>
                                   <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-200 text-slate-800 dark:bg-slate-600 dark:text-slate-200">{frequencyLabels[st.frequency]}</span>
                               </div>
                           </div>
                        )}) : <p className="text-sm text-center text-gray-600 dark:text-gray-400">Añade transacciones futuras para proyectar tu crecimiento.</p>}
                    </div>
                </Card>
                 <Card className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Objetivos de Ahorro</h3>
                        <Button size="sm" onClick={() => handleOpenGoalForm()}> <Icon name="Plus" className="w-4 h-4" /> Añadir</Button>
                    </div>
                    <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
                        {savingsGoals.length > 0 ? savingsGoals.map(goal => (
                            <div key={goal.id}>
                                <div className="flex justify-between items-baseline mb-1">
                                    <span className="font-semibold">{goal.name}</span>
                                    <span className="text-sm text-slate-500">{formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}</span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                                    <div className="bg-primary-500 h-2.5 rounded-full" style={{ width: `${Math.min(100, (goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 100))}%` }}></div>
                                </div>
                                <div className="flex justify-end items-center gap-1 mt-2">
                                    <Button size="sm" variant="secondary" onClick={() => setGoalToAddFunds(goal)}>Aportar</Button>
                                    <Button size="sm" variant="ghost" onClick={() => handleOpenGoalForm(goal)} title="Editar objetivo"><Icon name="Pencil" className="w-4 h-4" /></Button>
                                    <Button size="sm" variant="ghost" onClick={() => handleDeleteGoal(goal.id)} title="Eliminar objetivo"><Icon name="Trash2" className="w-4 h-4 text-red-500" /></Button>
                                </div>
                            </div>
                        )) : <p className="text-sm text-center text-gray-600 dark:text-gray-400">Crea objetivos para planificar tu ahorro.</p>}
                    </div>
                </Card>
            </div>

            <Card className="p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">Registro Global de Movimientos</h3>
                    <div className="flex flex-wrap gap-2">
                        {isProfessionalModeEnabled && (
                            <>
                                <Button size="sm" variant={typeFilters.proIncome ? 'primary' : 'secondary'} onClick={() => handleFilterChange('proIncome')}>Ingreso Pro.</Button>
                                <Button size="sm" variant={typeFilters.proExpense ? 'primary' : 'secondary'} onClick={() => handleFilterChange('proExpense')}>Gasto Pro.</Button>
                            </>
                        )}
                        <Button size="sm" variant={typeFilters.persIncome ? 'primary' : 'secondary'} onClick={() => handleFilterChange('persIncome')}>Ingreso Pers.</Button>
                        <Button size="sm" variant={typeFilters.persExpense ? 'primary' : 'secondary'} onClick={() => handleFilterChange('persExpense')}>Gasto Pers.</Button>
                        <Button size="sm" variant={typeFilters.transfer ? 'primary' : 'secondary'} onClick={() => handleFilterChange('transfer')}>Transferencia</Button>
                    </div>
                </div>

                <div className="overflow-y-auto max-h-[40rem] mt-4">
                    <div className="divide-y divide-slate-200/50 dark:divide-white/10">
                        {unifiedTransactions.map(t => {
                            const iconName = t.type === 'transfer' ? 'ArrowRightLeft' : t.amount > 0 ? 'TrendingUp' : 'TrendingDown';
                            return (
                                <div key={t.id} className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-3 transition-colors ${!t.isPaid ? 'opacity-60 italic' : ''} ${t.isProjection ? 'opacity-60' : ''}`}>
                                    <div className="flex items-center gap-4 flex-grow min-w-[200px]">
                                        <div className={`p-2 rounded-lg ${t.typeLabel.color} flex-shrink-0`}>
                                            <Icon name={iconName} className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold">{t.concept}</p>
                                                {t.autoGenerated && <Icon name="Bot" className="w-4 h-4 text-slate-500" title="Generado automáticamente"/>}
                                                {t.isProjection && <Icon name="Clock" className="w-4 h-4 text-slate-500" title="Proyección futura"/>}
                                            </div>
                                            <div className="flex items-baseline gap-2 text-sm">
                                                <p className="text-gray-600 dark:text-gray-400 truncate">{t.details}</p>
                                                <span className="text-xs font-mono text-gray-500 flex-shrink-0">{formatDateTime(t.date)}</span>
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
                                             {!t.isPaid && !t.isProjection && (
                                                <Button size="sm" variant="secondary" onClick={() => setItemToContabilize(t.originalItem)}>Contabilizar</Button>
                                            )}
                                            <Button size="sm" variant="ghost" onClick={() => handleEditUnified(t)} title="Editar"><Icon name="Pencil" className="w-4 h-4" /></Button>
                                            <Button size="sm" variant="ghost" onClick={() => handleDeleteUnified(t)} title="Eliminar"><Icon name="Trash2" className="w-4 h-4 text-red-500" /></Button>
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
            <Modal isOpen={isScheduledModalOpen} onClose={() => setIsScheduledModalOpen(false)} title={scheduledToEdit ? "Editar Transacción Programada" : "Nueva Transacción Programada"}>
                <ScheduledTransactionForm onClose={() => setIsScheduledModalOpen(false)} transactionToEdit={scheduledToEdit} />
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
            <AddRecordedTransactionModal isOpen={isAddRecordedModalOpen} onClose={() => setIsAddRecordedModalOpen(false)} isProfessionalModeEnabled={isProfessionalModeEnabled} />

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