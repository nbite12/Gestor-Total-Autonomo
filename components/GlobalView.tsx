import React, { useState, useContext, useMemo, useCallback, useRef, useEffect } from 'react';
import { AppContext } from '../App';
import { Card, Icon, HelpTooltip, Button, Modal, Input, Select, Celebration } from './ui';
import { PeriodSelector } from './PeriodSelector';
import { ScheduledTransaction, MoneyLocation, Transfer, TransferJustification, Income, Expense, PersonalMovement, InvestmentGood, SavingsGoal, PotentialFrequency, AppData } from '../types';
// FIX: Import DatePickerInput to be used in modals within this component.
import { IncomeForm, ExpenseForm, MovementForm, TransferForm, SavingsGoalForm, AddFundsForm, ScheduledTransactionForm, DatePickerInput } from './TransactionForms';
import { motion, AnimatePresence } from 'framer-motion';

// --- Helper Functions ---
const getMonthsInRange = (startDate: Date, endDate: Date): number => {
    if (endDate < startDate) return 0;
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();
    const startMonth = startDate.getMonth();
    const endMonth = endDate.getMonth();

    return (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
};

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

const getCuotaIRPF = (base: number, rate: number) => base * (rate / 100);

// Helper function for Model 130 quarter calculation (from ProfessionalView)
const calculateQuarterly130 = (
    targetQuarter: number,
    targetYear: number,
    pagosAnteriores130: number,
    allIncomes: Income[],
    allExpenses: Expense[],
    allInvestmentGoods: InvestmentGood[],
    settings: AppData['settings']
) => {
    const endDate = new Date(targetYear, targetQuarter * 3, 0, 23, 59, 59, 999);
    const incomesYTD = allIncomes.filter(i => { const d = new Date(i.date); return d.getFullYear() === targetYear && d <= endDate; });
    const expensesYTD = allExpenses.filter(e => { const d = new Date(e.date); return d.getFullYear() === targetYear && d <= endDate && e.isDeductible; });

    const grossYTD = incomesYTD.reduce((sum, i) => sum + i.baseAmount, 0);
    const expensesFromInvoicesYTD = expensesYTD.reduce((sum, e) => sum + (e.deductibleBaseAmount ?? e.baseAmount), 0);
    
    const amortizationYTD = allInvestmentGoods.filter(g => g.isDeductible && new Date(g.purchaseDate) <= endDate).reduce((sum, good) => {
        const dailyAmortization = (good.acquisitionValue / good.usefulLife) / 365.25;
        const goodStartDate = new Date(good.purchaseDate);
        const goodEndDate = new Date(goodStartDate.getFullYear() + good.usefulLife, goodStartDate.getMonth(), goodStartDate.getDate());
        
        const effectiveStartDate = goodStartDate < new Date(targetYear, 0, 1) ? new Date(targetYear, 0, 1) : goodStartDate;
        const effectiveEndDate = endDate < goodEndDate ? endDate : goodEndDate;
        
        if (effectiveEndDate > effectiveStartDate) {
            const days = (effectiveEndDate.getTime() - effectiveStartDate.getTime()) / (1000 * 3600 * 24) + 1;
            return sum + (days * dailyAmortization);
        }
        return sum;
    }, 0);
    
    // The monthly fee is already accounted for in projected expenses, but for the official 130 model, it's a key deductible.
    const autonomoFeeYTD = (settings.monthlyAutonomoFee || 0) * (targetQuarter * 3);
    const deductibleExpensesYTD = expensesFromInvoicesYTD + amortizationYTD + autonomoFeeYTD;
    const netProfitYTD = grossYTD - deductibleExpensesYTD;
    const quoteYTD = netProfitYTD * 0.20;
    const retencionesSoportadasYTD = incomesYTD.reduce((sum, i) => sum + getCuotaIRPF(i.baseAmount, i.irpfRate), 0);
    
    const result = Math.max(0, quoteYTD - retencionesSoportadasYTD - pagosAnteriores130);

    return {
        grossYTD, deductibleExpensesYTD, netProfitYTD, quoteYTD,
        retencionesSoportadasYTD, pagosAnteriores130, result
    };
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

// --- Local InfoBox Component for Modals ---
const InfoBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="p-3 my-2 bg-blue-50 dark:bg-blue-900/50 border-l-4 border-blue-400 text-blue-800 dark:text-blue-200 rounded-r-lg">
        <div className="flex items-start gap-2">
            <Icon name="Info" className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="text-sm">{children}</div>
        </div>
    </div>
);


// --- Taxes Breakdown Modal ---
const TaxesBreakdownModal: React.FC<{ isOpen: boolean; onClose: () => void; breakdown: any; formatCurrency: (val: number) => string; projectionPeriodLabel: string; }> = ({ isOpen, onClose, breakdown, formatCurrency, projectionPeriodLabel }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Desglose de Impuestos Estimados">
            <div className="space-y-4 text-sm">
                <p className="text-slate-600 dark:text-slate-400">Esta es una estimación para el trimestre fiscal que finaliza junto con tu periodo de proyección ({projectionPeriodLabel}).</p>
                <div className="space-y-2 rounded-lg bg-black/5 dark:bg-white/5 p-4">
                    <div className="flex justify-between"><span>Modelo 303 (IVA):</span> <span className="font-semibold">{formatCurrency(breakdown.model303Result)}</span></div>
                    <div className="flex justify-between"><span>Modelo 130 (IRPF):</span> <span className="font-semibold">{formatCurrency(breakdown.model130Result)}</span></div>
                    <div className="flex justify-between"><span>Modelo 111 (Ret. Prof.):</span> <span className="font-semibold">{formatCurrency(breakdown.model111Result)}</span></div>
                    <div className="flex justify-between"><span>Modelo 115 (Ret. Alquiler):</span> <span className="font-semibold">{formatCurrency(breakdown.model115Result)}</span></div>
                    
                    <div className="border-t-2 dark:border-slate-500 my-2 pt-2 flex justify-between text-base">
                        <span className="font-bold">Total Impuestos Estimados:</span>
                        <span className="font-bold">{formatCurrency(breakdown.totalProjectedTaxes)}</span>
                    </div>
                </div>
                 <InfoBox>Los modelos de impuestos (303, 130, etc.) se calculan para el trimestre fiscal correspondiente. La cuota de autónomo, al ser un gasto mensual, se proyecta dentro de "Gastos Prog." en la vista principal.</InfoBox>
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

const FilterButton: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`relative rounded-full px-3 py-1 text-sm font-medium transition-colors focus:outline-none ${active ? 'text-primary-600 dark:text-primary-300' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
    >
        {active && (
            <motion.div
                layoutId="global-filter-pill"
                className="absolute inset-0 bg-white dark:bg-black/20 rounded-full shadow"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
        )}
        <span className="relative z-10">{label}</span>
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
    
    const [isTaxesBreakdownOpen, setIsTaxesBreakdownOpen] = useState(false);
    const [projectionPeriod, setProjectionPeriod] = useState<'this_month' | 'this_quarter' | '6_months' | '1_year' | 'custom'>('this_quarter');
    const [customProjectionStart, setCustomProjectionStart] = useState<Date>(new Date());
    const [customProjectionEnd, setCustomProjectionEnd] = useState<Date>(() => {
        const end = new Date();
        end.setMonth(end.getMonth() + 3);
        return end;
    });

    const [historyModalLocation, setHistoryModalLocation] = useState<MoneyLocation | null>(null);


    const includeNetCapitalItems = settings.netCapitalToggles || {
        pendingIncome: true,
        pendingExpenses: true,
        taxes: true,
        scheduledIncome: true,
        scheduledExpenses: true,
    };


    const [isScheduledModalOpen, setIsScheduledModalOpen] = useState(false);
    const [scheduledToEdit, setScheduledToEdit] = useState<ScheduledTransaction | null>(null);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferToEdit, setTransferToEdit] = useState<Transfer | null>(null);
    const [isGoalFormOpen, setIsGoalFormOpen] = useState(false);
    const [goalToEdit, setGoalToEdit] = useState<SavingsGoal | null>(null);
    const [goalToAddFunds, setGoalToAddFunds] = useState<SavingsGoal | null>(null);
    const [celebrationType, setCelebrationType] = useState<'none' | 'contribution' | 'goalComplete'>('none');
    
    const [isAddRecordedModalOpen, setIsAddRecordedModalOpen] = useState(false);

    const [professionalIncomeToEdit, setProfessionalIncomeToEdit] = useState<Partial<Income> | null>(null);
    const [professionalExpenseToEdit, setProfessionalExpenseToEdit] = useState<Partial<Expense> | null>(null);
    const [personalMovementToEdit, setPersonalMovementToEdit] = useState<Partial<PersonalMovement> | null>(null);
    const [confirmingScheduledId, setConfirmingScheduledId] = useState<string | null>(null);
    
    const [isActionsCardOpen, setIsActionsCardOpen] = useState(false);
    const [snoozingAction, setSnoozingAction] = useState<any | null>(null);
    const [snoozeDate, setSnoozeDate] = useState<Date>(new Date());

    const globalFilters = useMemo(() => settings.globalViewFilters || {
        typeFilters: {
            proIncome: true,
            proExpense: true,
            persIncome: true,
            persExpense: true,
            transfer: true,
        },
        showProjections: false,
        showPending: true,
    }, [settings.globalViewFilters]);
    
    const handleFilterChange = (filterKey: keyof typeof globalFilters.typeFilters) => {
        saveData(prev => ({
            ...prev,
            settings: {
                ...prev.settings,
                globalViewFilters: {
                    ...(prev.settings.globalViewFilters || globalFilters),
                    typeFilters: {
                        ...(prev.settings.globalViewFilters?.typeFilters || globalFilters.typeFilters),
                        [filterKey]: !prev.settings.globalViewFilters?.typeFilters?.[filterKey],
                    }
                }
            }
        }), "Filtro actualizado.");
    };

    const handleToggleShowProjections = () => {
        saveData(prev => ({
            ...prev,
            settings: {
                ...prev.settings,
                globalViewFilters: {
                    ...(prev.settings.globalViewFilters || globalFilters),
                    showProjections: !prev.settings.globalViewFilters?.showProjections,
                }
            }
        }), "Vista de proyecciones actualizada.");
    };

    const handleToggleShowPending = () => {
        saveData(prev => ({
            ...prev,
            settings: {
                ...prev.settings,
                globalViewFilters: {
                    ...(prev.settings.globalViewFilters || globalFilters),
                    showPending: !prev.settings.globalViewFilters?.showPending,
                }
            }
        }), "Vista de pendientes actualizada.");
    };

    
    const handleToggleNetCapitalItem = (item: keyof typeof includeNetCapitalItems) => {
        saveData(prev => {
            const currentToggles = prev.settings.netCapitalToggles || includeNetCapitalItems;
            return {
                ...prev,
                settings: {
                    ...prev.settings,
                    netCapitalToggles: {
                        ...currentToggles,
                        [item]: !currentToggles[item],
                    }
                }
            }
        }, "Preferencia de vista guardada.");
    };


    const handlePeriodChange = useCallback((startDate: Date, endDate: Date) => setPeriod({ startDate, endDate }), []);

    // --- Memoized Calculations ---
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
        if (frequency === 'one-off') {
            return startDate >= periodStart && startDate <= periodEnd ? 1 : 0;
        }

        if (startDate > periodEnd) return 0;
        
        let count = 0;
        let currentDate = new Date(startDate);
        
        while (currentDate <= periodEnd) {
             if (endDate && currentDate > endDate) break;

            if (currentDate >= periodStart) {
                count++;
            }

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

        // Calculate projection period for scheduled transactions
        let projectionStart: Date;
        let projectionEnd: Date;
    
        if (projectionPeriod === 'custom') {
            projectionStart = new Date(customProjectionStart);
            projectionStart.setHours(0, 0, 0, 0);
            projectionEnd = new Date(customProjectionEnd);
            projectionEnd.setHours(23, 59, 59, 999);
        } else {
            projectionStart = new Date();
            projectionStart.setHours(0, 0, 0, 0);
            projectionEnd = new Date(); // re-init
            switch (projectionPeriod) {
                case 'this_month':
                    projectionEnd = new Date(projectionStart.getFullYear(), projectionStart.getMonth() + 1, 0);
                    break;
                case 'this_quarter':
                    const currentQuarter = Math.floor(projectionStart.getMonth() / 3);
                    projectionEnd = new Date(projectionStart.getFullYear(), currentQuarter * 3 + 3, 0);
                    break;
                case '6_months':
                    projectionEnd.setMonth(projectionEnd.getMonth() + 6);
                    break;
                case '1_year':
                    projectionEnd.setFullYear(projectionEnd.getFullYear() + 1);
                    break;
            }
            projectionEnd.setHours(23, 59, 59, 999);
        }
        
        let scheduledIncomeInPeriod = 0;
        let scheduledExpenseInPeriod = 0;
        
        scheduledTransactions.forEach(st => {
            const occurrences = countOccurrences(st.frequency, new Date(st.startDate), st.endDate ? new Date(st.endDate) : undefined, projectionStart, projectionEnd);
            const amount = getNetScheduledAmount(st);
            if (st.type === 'income') {
                scheduledIncomeInPeriod += occurrences * amount;
            } else {
                scheduledExpenseInPeriod += occurrences * amount;
            }
        });
        
        const monthsInProjection = getMonthsInRange(projectionStart, projectionEnd);
        const projectedAutonomoFee = (settings.monthlyAutonomoFee || 0) * monthsInProjection;
        const totalProjectedExpenses = scheduledExpenseInPeriod + projectedAutonomoFee;

        // Tax calculations for the quarter of the projection's END DATE
        const taxYear = projectionEnd.getFullYear();
        const taxQuarter = Math.floor(projectionEnd.getMonth() / 3) + 1;
        const qStartDate = new Date(taxYear, (taxQuarter - 1) * 3, 1);
        const qEndDate = new Date(taxYear, taxQuarter * 3, 0, 23, 59, 59, 999);

        const getCuotaIVA = (base: number, rate: number) => base * (rate / 100);
        
        const qIncomes = incomes.filter(i => new Date(i.date) >= qStartDate && new Date(i.date) <= qEndDate);
        const qDeductibleExpenses = expenses.filter(e => e.isDeductible && new Date(e.date) >= qStartDate && new Date(e.date) <= qEndDate);

        const ivaRepercutido = qIncomes.reduce((sum, i) => sum + getCuotaIVA(i.baseAmount, i.vatRate), 0);
        const ivaSoportadoFromExpenses = qDeductibleExpenses.reduce((sum, e) => sum + getCuotaIVA(e.baseAmount, e.vatRate), 0);
        const ivaSoportadoFromGoods = investmentGoods.filter(g => g.isDeductible && new Date(g.purchaseDate) >= qStartDate && new Date(g.purchaseDate) <= qEndDate).reduce((sum, g) => sum + getCuotaIVA(g.acquisitionValue, g.vatRate), 0);
        const ivaSoportado = ivaSoportadoFromExpenses + ivaSoportadoFromGoods;
        const model303Result = Math.max(0, ivaRepercutido - ivaSoportado);

        let pagosAnteriores130 = 0;
        for (let q = 1; q < taxQuarter; q++) {
            const prevQResult = calculateQuarterly130(q, taxYear, pagosAnteriores130, incomes, expenses, investmentGoods, settings);
            pagosAnteriores130 += prevQResult.result;
        }
        const model130Data = calculateQuarterly130(taxQuarter, taxYear, pagosAnteriores130, incomes, expenses, investmentGoods, settings);
        const model130Result = model130Data.result;

        const qAllExpenses = expenses.filter(e => new Date(e.date) >= qStartDate && new Date(e.date) <= qEndDate);
        const model111Result = qAllExpenses.reduce((sum, e) => sum + (e.irpfRetentionAmount && !e.isRentalExpense ? e.irpfRetentionAmount : 0), 0);
        const model115Result = qAllExpenses.reduce((sum, e) => sum + (e.irpfRetentionAmount && e.isRentalExpense ? e.irpfRetentionAmount : 0), 0);
        
        const totalProjectedTaxes = model303Result + model130Result + model111Result + model115Result;

        const netAvailableCapital = currentTotalBalance
            + (includeNetCapitalItems.pendingIncome ? totalPendingIncome : 0)
            - (includeNetCapitalItems.pendingExpenses ? totalPendingExpenses : 0)
            - (includeNetCapitalItems.taxes ? totalProjectedTaxes : 0)
            + (includeNetCapitalItems.scheduledIncome ? scheduledIncomeInPeriod : 0)
            - (includeNetCapitalItems.scheduledExpenses ? totalProjectedExpenses : 0);

        return {
            professionalBalance,
            personalBalance,
            totalPendingIncome,
            totalPendingExpenses,
            totalProjectedTaxes,
            scheduledIncomeInPeriod,
            totalProjectedExpenses,
            netAvailableCapital,
            taxesBreakdown: { model303Result, model130Result, model111Result, model115Result, totalProjectedTaxes }
        };

    }, [data, moneyDistribution, includeNetCapitalItems, scheduledTransactions, getNetScheduledAmount, countOccurrences, projectionPeriod, customProjectionStart, customProjectionEnd]);
    
    const locationHistory = useMemo(() => {
        if (!historyModalLocation) return [];

        const initialBalance = data.settings.initialBalances?.[historyModalLocation] || 0;
        
        type HistoryItem = {
            date: Date;
            concept: string;
            amount: number;
        };

        const transactions: HistoryItem[] = [];

        data.incomes.forEach(i => {
            if (i.isPaid && i.location === historyModalLocation && i.paymentDate) {
                transactions.push({
                    date: new Date(i.paymentDate),
                    concept: i.concept,
                    amount: i.baseAmount + (i.baseAmount * i.vatRate / 100) - (i.baseAmount * i.irpfRate / 100),
                });
            }
        });
        
        data.expenses.forEach(e => {
            if (e.isPaid && e.location === historyModalLocation && e.paymentDate) {
                transactions.push({
                    date: new Date(e.paymentDate),
                    concept: e.concept,
                    amount: -(e.baseAmount + (e.baseAmount * e.vatRate / 100)),
                });
            }
        });

        data.investmentGoods.forEach(g => {
            if (g.isPaid && g.location === historyModalLocation && g.paymentDate) {
                transactions.push({
                    date: new Date(g.paymentDate),
                    concept: g.description,
                    amount: -(g.acquisitionValue + (g.acquisitionValue * g.vatRate / 100)),
                });
            }
        });

        data.personalMovements.forEach(p => {
            if (p.isPaid && p.location === historyModalLocation && p.paymentDate) {
                transactions.push({
                    date: new Date(p.paymentDate),
                    concept: p.concept,
                    amount: p.type === 'income' ? p.amount : -p.amount,
                });
            }
        });

        data.transfers.forEach(t => {
            if (t.fromLocation === historyModalLocation) {
                transactions.push({
                    date: new Date(t.date),
                    concept: t.concept,
                    amount: -t.amount,
                });
            }
            if (t.toLocation === historyModalLocation) {
                transactions.push({
                    date: new Date(t.date),
                    concept: t.concept,
                    amount: t.amount,
                });
            }
        });

        transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
        
        let runningBalance = initialBalance;
        const historyWithBalance = transactions.map(t => {
            runningBalance += t.amount;
            return { ...t, balance: runningBalance };
        });

        return [{
            date: null,
            concept: 'Saldo Inicial',
            amount: initialBalance,
            balance: initialBalance,
        }, ...historyWithBalance];

    }, [historyModalLocation, data]);

    const unifiedTransactions = useMemo(() => {
        const typeLabels: { [key: string]: { label: string, color: string } } = {
            proIncome: { label: 'Ingreso Pro.', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
            proExpense: { label: 'Gasto Pro.', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
            persIncome: { label: 'Ingreso Pers.', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
            persExpense: { label: 'Gasto Pers.', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' },
            transfer: { label: 'Transferencia', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
        };

        const allTransactions: any[] = [
            ...(isProfessionalModeEnabled ? incomes.map(i => ({
                id: `inc-${i.id}`,
                date: new Date(i.date),
                type: 'proIncome' as const,
                typeLabel: typeLabels.proIncome,
                concept: i.concept,
                details: `Cliente: ${i.clientName}`,
                amount: i.baseAmount + (i.baseAmount * i.vatRate / 100) - (i.baseAmount * i.irpfRate / 100),
                isPaid: i.isPaid,
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
                originalItem: t,
            })),
        ];

        if (globalFilters.showProjections) {
            const projections: any[] = [];
            
            scheduledTransactions.forEach(st => {
                // Skip one-off if already generated
                if (st.frequency === 'one-off' && st.lastGeneratedDate) {
                    return; 
                }

                let cursorDate;
                if (st.frequency !== 'one-off' && st.lastGeneratedDate) {
                    cursorDate = getNextDate(new Date(st.lastGeneratedDate), st.frequency as any);
                } else {
                    cursorDate = new Date(st.startDate);
                }

                const futureLimit = new Date();
                futureLimit.setFullYear(futureLimit.getFullYear() + 5); // safety break

                while (cursorDate <= futureLimit && (!st.endDate || cursorDate <= new Date(st.endDate))) {
                    if (cursorDate > period.endDate) break;

                    if (cursorDate >= period.startDate) {
                        const amount = getNetScheduledAmount(st);
                        const typeKey = st.scope === 'professional' 
                            ? (st.type === 'income' ? 'proIncome' : 'proExpense') 
                            : (st.type === 'income' ? 'persIncome' : 'persExpense');
                        
                        projections.push({
                            id: `proj-${st.id}-${cursorDate.toISOString()}`,
                            date: new Date(cursorDate),
                            type: typeKey,
                            typeLabel: typeLabels[typeKey],
                            concept: st.concept,
                            details: `Programado (${frequencyLabels[st.frequency]})`,
                            amount: st.type === 'income' ? amount : -amount,
                            isPaid: false,
                            isProjection: true,
                            originalItem: st,
                        });
                    }
                    
                    if (st.frequency === 'one-off') break;
                    
                    const nextCursor = getNextDate(cursorDate, st.frequency as any);
                    if (nextCursor <= cursorDate) break;
                    cursorDate = nextCursor;
                }
            });
            allTransactions.push(...projections);
        }
        
        return allTransactions
            .filter(t => t.date >= period.startDate && t.date <= period.endDate)
            .filter(t => globalFilters.typeFilters[t.type as keyof typeof globalFilters.typeFilters])
            .filter(t => {
                if (t.isProjection) {
                    return true; // Projections are already filtered by showProjections, so if it's here, show it.
                }
                // For non-projections (recorded transactions)
                return globalFilters.showPending || t.isPaid;
            })
            .sort((a, b) => b.date.getTime() - a.date.getTime());

    }, [incomes, expenses, personalMovements, transfers, period, globalFilters, personalCategories, isProfessionalModeEnabled, scheduledTransactions, getNetScheduledAmount]);

    const categorizedActions = useMemo(() => {
        const allActions: { id: string, type: string, emoji: string, concept: string, date: Date, isScheduled: boolean, originalItem: any }[] = [];
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        scheduledTransactions.forEach(st => {
            if (!st.startDate || isNaN(new Date(st.startDate).getTime())) return;
            const startDate = new Date(st.startDate);
            let nextDueDate: Date;
            if (st.frequency === 'one-off') {
                if (st.lastGeneratedDate) return;
                nextDueDate = startDate;
            } else {
                const lastGenerated = st.lastGeneratedDate && !isNaN(new Date(st.lastGeneratedDate).getTime()) ? new Date(st.lastGeneratedDate) : null;
                nextDueDate = lastGenerated ? getNextDate(lastGenerated, st.frequency as any) : startDate;
            }
            if (isNaN(nextDueDate.getTime())) return;

            const isDue = nextDueDate < today;
            const endDate = st.endDate && !isNaN(new Date(st.endDate).getTime()) ? new Date(st.endDate) : null;
            const hasNotEnded = !endDate || nextDueDate <= endDate;
            if (isDue && hasNotEnded) {
                allActions.push({
                    id: `sched-${st.id}-${nextDueDate.toISOString()}`,
                    type: 'scheduled',
                    emoji: '🗓️',
                    concept: st.concept,
                    date: nextDueDate,
                    isScheduled: true,
                    originalItem: { ...st, dueDate: nextDueDate },
                });
            }
        });

        incomes.filter(i => !i.isPaid).forEach(i => {
            allActions.push({
                id: `inc-manual-${i.id}`,
                type: 'proIncomeManual',
                emoji: '❗',
                concept: i.concept,
                date: new Date(i.date),
                isScheduled: false,
                originalItem: i,
            });
        });
        
        expenses.filter(e => !e.isPaid).forEach(e => {
            allActions.push({
                id: `exp-manual-${e.id}`,
                type: 'proExpenseManual',
                emoji: '❗',
                concept: e.concept,
                date: new Date(e.date),
                isScheduled: false,
                originalItem: e,
            });
        });

        personalMovements.filter(m => !(m.isPaid ?? false)).forEach(m => {
            allActions.push({
                id: `pm-manual-${m.id}`,
                type: 'persMovementManual',
                emoji: '❗',
                concept: m.concept,
                date: new Date(m.date),
                isScheduled: false,
                originalItem: m,
            });
        });
        
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const urgent: any[] = [];
        const snoozed: any[] = [];

        allActions.forEach(action => {
            const snoozeDateStr = data.snoozedActions?.[action.id];
            if (snoozeDateStr) {
                const snoozeDate = new Date(snoozeDateStr);
                if (snoozeDate > startOfToday) {
                    snoozed.push({ ...action, snoozeDate });
                    return;
                }
            }
            urgent.push(action);
        });

        return {
            urgentActions: urgent.sort((a,b) => a.date.getTime() - b.date.getTime()),
            snoozedActions: snoozed.sort((a,b) => a.snoozeDate.getTime() - b.snoozeDate.getTime()),
        };

    }, [scheduledTransactions, incomes, expenses, personalMovements, data.snoozedActions]);

    type DisplayScheduledTransaction = ScheduledTransaction & { isVirtual?: boolean };

    const allScheduledTransactions = useMemo<DisplayScheduledTransaction[]>(() => {
        const manualTransactions: DisplayScheduledTransaction[] = [...scheduledTransactions];
        
        const hasManualAutonomoEntry = manualTransactions.some(st => 
            st.concept.toLowerCase().includes('autonomo') || st.concept.toLowerCase().includes('autónomo')
        );
    
        if (isProfessionalModeEnabled && settings.monthlyAutonomoFee > 0 && !hasManualAutonomoEntry) {
            const virtualAutonomoFee: DisplayScheduledTransaction = {
                id: 'virtual-autonomo-fee',
                concept: 'Cuota de Autónomo',
                scope: 'professional',
                type: 'expense',
                frequency: 'monthly',
                startDate: new Date(0).toISOString(),
                baseAmount: settings.monthlyAutonomoFee,
                vatRate: 0,
                irpfRate: 0,
                location: MoneyLocation.PRO_BANK,
                isVirtual: true,
            };
            return [...manualTransactions, virtualAutonomoFee];
        }
    
        return manualTransactions;
    }, [scheduledTransactions, settings.monthlyAutonomoFee, isProfessionalModeEnabled]);

    // --- Handlers ---
    const handleConfirmScheduled = (st: ScheduledTransaction & { dueDate: Date }) => {
        const dueDateISO = st.dueDate.toISOString();
        const commonData = {
            concept: st.concept,
            date: dueDateISO,
            isPaid: true,
            paymentDate: dueDateISO,
            location: st.location,
        };
        
        setConfirmingScheduledId(st.id);
    
        if (st.scope === 'professional') {
            if (st.type === 'income') {
                setProfessionalIncomeToEdit({
                    ...commonData,
                    baseAmount: st.baseAmount,
                    vatRate: st.vatRate,
                    irpfRate: st.irpfRate,
                    clientName: st.concept, // Best guess
                });
            } else { // expense
                setProfessionalExpenseToEdit({
                    ...commonData,
                    baseAmount: st.baseAmount,
                    vatRate: st.vatRate,
                    providerName: st.concept, // Best guess
                    categoryId: '', // User must select
                });
            }
        } else { // personal
            setPersonalMovementToEdit({
                ...commonData,
                amount: st.amount,
                type: st.type,
                categoryId: st.categoryId,
            });
        }
    };

    const handleConfirmManual = (item: any) => {
        const paymentInfo = { isPaid: true, paymentDate: new Date().toISOString() };
        switch (item.type) {
            case 'proIncomeManual':
                setProfessionalIncomeToEdit({ ...item.originalItem, ...paymentInfo });
                break;
            case 'proExpenseManual':
                setProfessionalExpenseToEdit({ ...item.originalItem, ...paymentInfo });
                break;
            case 'persMovementManual':
                setPersonalMovementToEdit({ ...item.originalItem, ...paymentInfo });
                break;
        }
    };

    const handleOpenSnoozeModal = (action: any) => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0,0,0,0);
        setSnoozeDate(tomorrow);
        setSnoozingAction(action);
    };

    const handleConfirmSnooze = () => {
        if (!snoozingAction) return;
        saveData(prev => ({
            ...prev,
            snoozedActions: {
                ...(prev.snoozedActions || {}),
                [snoozingAction.id]: snoozeDate.toISOString(),
            }
        }), "Recordatorio guardado.");
        setSnoozingAction(null);
    };

    const handleDiscardAction = useCallback((action: any) => {
        if (action.isScheduled) {
            const scheduledTx = action.originalItem as ScheduledTransaction & { dueDate: Date };
            if (!scheduledTx) return;

            if (window.confirm(`¿Estás seguro de que quieres descartar esta instancia de "${scheduledTx.concept}"? La próxima programación no se verá afectada.`)) {
                saveData(prev => ({
                    ...prev,
                    scheduledTransactions: prev.scheduledTransactions.map(st => 
                        st.id === scheduledTx.id 
                            ? { ...st, lastGeneratedDate: scheduledTx.dueDate.toISOString() } 
                            : st
                    )
                }), "Instancia programada descartada.");
            }
        } else {
            const item = action.originalItem;
            const itemType = action.type;

            if (window.confirm(`¿Estás seguro de que quieres eliminar permanentemente este movimiento pendiente: "${item.concept}"?`)) {
                 saveData(prev => {
                    let updatedData = { ...prev };
                    if (itemType === 'proIncomeManual') {
                        updatedData.incomes = prev.incomes.filter(i => i.id !== item.id);
                    } else if (itemType === 'proExpenseManual') {
                        updatedData.expenses = prev.expenses.filter(e => e.id !== item.id);
                    } else if (itemType === 'persMovementManual') {
                        updatedData.personalMovements = prev.personalMovements.filter(pm => pm.id !== item.id);
                    }
                    return updatedData;
                }, "Movimiento pendiente eliminado.");
            }
        }
    }, [saveData]);
    
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
        const [type, ...idParts] = item.id.split('-');
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
        if (!window.confirm('¿Estás seguro de que quieres eliminar esta transacción?')) return;
        
        const [type, ...idParts] = item.id.split('-');
        const id = idParts.join('-');
        let message = "Transacción eliminada.";

        saveData(prev => {
            switch (type) {
                case 'inc': message = "Ingreso profesional eliminado."; return { ...prev, incomes: prev.incomes.filter(i => i.id !== id) };
                case 'exp': message = "Gasto profesional eliminado."; return { ...prev, expenses: prev.expenses.filter(e => e.id !== id) };
                case 'pm': message = "Movimiento personal eliminado."; return { ...prev, personalMovements: prev.personalMovements.filter(pm => pm.id !== id) };
                case 'tr': message = "Transferencia eliminada."; return { ...prev, transfers: prev.transfers.filter(t => t.id !== id) };
                default: return prev;
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
    
    const getProjectionPeriodLabel = useCallback(() => {
        switch (projectionPeriod) {
            case 'this_month': return 'Este Mes';
            case 'this_quarter': return 'Este Trimestre';
            case '6_months': return '6 Meses';
            case '1_year': return '1 Año';
            case 'custom': return 'Personalizado';
            default: return '';
        }
    }, [projectionPeriod]);
    
    const { urgentActions, snoozedActions } = categorizedActions;
    const urgentCount = urgentActions.length;
    const snoozedCount = snoozedActions.length;
    const hasUrgent = urgentCount > 0;
    const hasSnoozedOnly = !hasUrgent && snoozedCount > 0;

    let cardState: 'urgent' | 'snoozed' | 'ok' = 'ok';
    if (hasUrgent) {
        cardState = 'urgent';
    } else if (hasSnoozedOnly) {
        cardState = 'snoozed';
    }

    const stateConfig = {
        urgent: {
            borderColor: 'border-red-500',
            bgColor: 'bg-red-500/10',
            icon: 'AlertTriangle',
            iconColor: 'text-red-500',
            iconAnimation: 'animate-pulse',
            summary: `${urgentCount} urgente(s)${snoozedCount > 0 ? ` y ${snoozedCount} pospuesta(s)` : ''}`
        },
        snoozed: {
            borderColor: 'border-orange-500',
            bgColor: 'bg-orange-500/10',
            icon: 'Clock',
            iconColor: 'text-orange-500',
            iconAnimation: '',
            summary: `${snoozedCount} pospuesta(s)`
        },
        ok: {
            borderColor: 'border-green-500',
            bgColor: 'bg-green-500/10',
            icon: 'CheckCircle',
            iconColor: 'text-green-500',
            iconAnimation: '',
            summary: 'Todo al día'
        }
    };

    const currentConfig = stateConfig[cardState];

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-3">
                <Icon name="Globe" className="w-8 h-8 text-primary-500" />
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Visión Global y Planificación</h2>
            </div>

            <div className="flex justify-center">
                <Button size="lg" onClick={() => setIsAddRecordedModalOpen(true)} className="shadow-lg transform hover:scale-105">
                    <Icon name="PlusCircle" className="w-6 h-6 mr-2"/>
                    Añadir Movimiento
                </Button>
            </div>
            
            <Celebration type={celebrationType} onComplete={() => setCelebrationType('none')} />
            
            <Card className={`p-0 overflow-hidden border-2 transition-all duration-300 ${currentConfig.borderColor}`}>
                <button 
                    onClick={() => setIsActionsCardOpen(prev => !prev)} 
                    className={`w-full flex items-center justify-between p-3 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${currentConfig.bgColor}`}
                    aria-expanded={isActionsCardOpen}
                    aria-controls="pending-actions-content"
                >
                    <div className="flex items-center gap-3 flex-grow min-w-0">
                        <Icon name={currentConfig.icon} className={`w-6 h-6 flex-shrink-0 ${currentConfig.iconColor} ${currentConfig.iconAnimation}`} />
                        <div className="flex-grow min-w-0 md:flex md:items-baseline md:gap-2">
                            <span className="font-bold text-slate-800 dark:text-slate-100 block md:inline">Acciones Pendientes</span>
                            <span className="text-sm text-slate-600 dark:text-slate-400 truncate block md:inline">
                                {currentConfig.summary}
                            </span>
                        </div>
                    </div>
                    <Icon name={isActionsCardOpen ? "ChevronUp" : "ChevronDown"} className="w-5 h-5 text-slate-500 flex-shrink-0 ml-2" />
                </button>

                <AnimatePresence>
                    {isActionsCardOpen && (
                        <motion.div
                            id="pending-actions-content"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="p-4 border-t-2 dark:border-slate-700">
                                <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                                    {urgentActions.map(action => (
                                        <div key={action.id} className="flex flex-wrap items-center justify-between gap-2 p-3 bg-red-500/10 rounded-lg border-l-4 border-red-500">
                                            <div className="flex-grow flex items-center gap-3 min-w-0">
                                                <span className="text-xl">{action.emoji}</span>
                                                <div className="flex-grow min-w-0">
                                                    <div className="flex items-center gap-2">
                                                      <p className="font-semibold truncate">{action.concept}</p>
                                                      {action.isScheduled && (
                                                        <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-600 rounded-full flex-shrink-0">Programado</span>
                                                      )}
                                                    </div>
                                                    <p className="text-sm text-slate-500 truncate">Vence el {action.date.toLocaleDateString('es-ES')}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                 <Button size="sm" variant="ghost" title="Descartar" onClick={() => handleDiscardAction(action)}>
                                                    <Icon name="X" className="w-4 h-4 text-red-500"/>
                                                </Button>
                                                <Button size="sm" variant="ghost" title="Recordar más tarde" onClick={() => handleOpenSnoozeModal(action)}>
                                                    <Icon name="Clock" className="w-4 h-4 text-slate-500"/>
                                                </Button>
                                                <Button size="sm" onClick={() => action.type === 'scheduled' ? handleConfirmScheduled(action.originalItem) : handleConfirmManual(action)}>
                                                    <Icon name="Check" className="w-4 h-4 mr-1"/>
                                                    {action.type === 'scheduled' ? 'Registrar' : 'Confirmar'}
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                    {snoozedActions.map(action => (
                                         <div key={action.id} className="flex flex-wrap items-center justify-between gap-2 p-3 bg-orange-500/10 rounded-lg border-l-4 border-orange-500">
                                            <div className="flex-grow flex items-center gap-3 min-w-0">
                                                <span className="text-xl">{action.emoji}</span>
                                                <div className="flex-grow min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-semibold truncate">{action.concept}</p>
                                                        {action.isScheduled && (
                                                            <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-600 rounded-full flex-shrink-0">Programado</span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-orange-600 dark:text-orange-400 truncate">Pospuesto hasta el {action.snoozeDate.toLocaleDateString('es-ES')}</p>
                                                </div>
                                            </div>
                                             <div className="flex items-center gap-1 flex-shrink-0">
                                                 <Button size="sm" variant="ghost" title="Descartar" onClick={() => handleDiscardAction(action)}>
                                                    <Icon name="X" className="w-4 h-4 text-red-500"/>
                                                </Button>
                                                <Button size="sm" variant="ghost" title="Cambiar recordatorio" onClick={() => handleOpenSnoozeModal(action)}>
                                                    <Icon name="Clock" className="w-4 h-4 text-slate-500"/>
                                                </Button>
                                                <Button size="sm" onClick={() => action.type === 'scheduled' ? handleConfirmScheduled(action.originalItem) : handleConfirmManual(action)}>
                                                    <Icon name="Check" className="w-4 h-4 mr-1"/>
                                                    {action.type === 'scheduled' ? 'Registrar' : 'Confirmar'}
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                     {(urgentActions.length + snoozedActions.length) === 0 && (
                                        <p className="text-center text-slate-500 py-4">No tienes ninguna acción pendiente.</p>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {isProfessionalModeEnabled && (
                    <Card className="p-6">
                        <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                             <div className="flex items-center gap-2">
                                <h3 className="text-xl font-semibold">Capital Actual y Proyección</h3>
                                <HelpTooltip content="Estimación de tu dinero total después de cobrar lo pendiente, pagar deudas y liquidar los impuestos del trimestre." />
                            </div>
                            <select
                                value={projectionPeriod}
                                onChange={(e) => setProjectionPeriod(e.target.value as any)}
                                className="block w-auto px-3 py-1.5 text-sm bg-white/10 dark:bg-black/10 backdrop-blur-sm border border-white/20 rounded-lg shadow-inner-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                                aria-label="Seleccionar periodo de proyección"
                            >
                                <option value="this_month">Este Mes</option>
                                <option value="this_quarter">Este Trimestre</option>
                                <option value="6_months">Próximos 6 Meses</option>
                                <option value="1_year">Próximo Año</option>
                                <option value="custom">Personalizado</option>
                            </select>
                        </div>

                         <AnimatePresence>
                            {projectionPeriod === 'custom' && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="grid grid-cols-2 gap-4 mt-2 mb-4 p-4 bg-black/5 dark:bg-white/5 rounded-2xl">
                                        <DatePickerInput 
                                            label="Desde"
                                            selectedDate={customProjectionStart.toISOString()}
                                            onDateChange={setCustomProjectionStart}
                                        />
                                        <DatePickerInput 
                                            label="Hasta"
                                            selectedDate={customProjectionEnd.toISOString()}
                                            onDateChange={setCustomProjectionEnd}
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="text-center my-4">
                            <p className="text-5xl md:text-6xl font-thin tracking-tight text-gray-800 dark:text-white break-words">
                                {formatCurrency(netCapitalSummary.netAvailableCapital)}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Capital Neto Estimado</p>
                        </div>
                         <div className="text-sm space-y-2 border-t dark:border-slate-700 pt-4">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600 dark:text-gray-400">Fondos Actuales (Bruto)</span>
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
                                    Ingresos Prog. ({getProjectionPeriodLabel()})
                                </span>
                                <span className="font-medium text-green-500">+{formatCurrency(netCapitalSummary.scheduledIncomeInPeriod)}</span>
                            </div>
                            <div className={`flex justify-between items-center transition-opacity ${!includeNetCapitalItems.scheduledExpenses ? 'opacity-40' : ''}`}>
                                <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                <Toggle checked={includeNetCapitalItems.scheduledExpenses} onChange={() => handleToggleNetCapitalItem('scheduledExpenses')} />
                                    Gastos Prog. ({getProjectionPeriodLabel()})
                                     <HelpTooltip content="Incluye gastos programados y la cuota de autónomo mensual de tus Ajustes. Para registrar pagos reales de la cuota, añádelos como un 'Gasto Profesional' con 0% de IVA." />
                                </span>
                                <span className="font-medium text-red-500">-{formatCurrency(netCapitalSummary.totalProjectedExpenses)}</span>
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
                <Card className={`p-6 ${!isProfessionalModeEnabled ? 'lg:col-span-2' : ''}`}>
                    <h3 className="text-xl font-semibold mb-4">Saldos por Ubicación</h3>
                    <div className="space-y-1">
                        {Object.entries(moneyDistribution).map(([location, balance]) => {
                             if (!isProfessionalModeEnabled && (location === MoneyLocation.PRO_BANK || location === MoneyLocation.CASH_PRO)) {
                                return null;
                            }
                            return (
                                <button
                                    key={location}
                                    onClick={() => setHistoryModalLocation(location as MoneyLocation)}
                                    className="w-full flex justify-between items-center text-sm p-2 transition-colors rounded-md hover:bg-black/5 dark:hover:bg-white/5"
                                    aria-label={`Ver historial de ${location}`}
                                >
                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                        <Icon name={
                                            location.includes('Banco') ? 'Landmark' :
                                            location.includes('Efectivo') ? 'Wallet' : 'Bitcoin'
                                        } className="w-4 h-4" />
                                        <span>{location}</span>
                                    </div>
                                    <span className="font-semibold break-words">{formatCurrency(balance || 0)}</span>
                                </button>
                            );
                        })}
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Planning Panels */}
                <Card className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Transacciones Programadas</h3>
                        <Button size="sm" onClick={() => handleOpenScheduledModal()}> <Icon name="Plus" className="w-4 h-4" /> Añadir</Button>
                    </div>
                    <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
                        {allScheduledTransactions.length > 0 ? allScheduledTransactions.map(st => {
                             const isVirtual = st.isVirtual;
                             const amount = getNetScheduledAmount(st);
                             const color = st.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
                             const scopeColor = st.scope === 'professional' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800';
                             return (
                                <div key={st.id} className="text-sm p-2 bg-slate-50 dark:bg-slate-700/50 rounded-md">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-1">
                                                <p className="font-semibold">{st.concept}</p>
                                                {isVirtual && <HelpTooltip content="Este gasto se basa en la 'Cuota de Autónomo' de tus Ajustes y no se puede editar aquí." />}
                                            </div>
                                            <p className={`text-lg font-bold ${color}`}>{formatCurrency(amount)}</p>
                                        </div>
                                        <div className="flex-shrink-0">
                                            {!isVirtual && (
                                                <>
                                                    <Button variant="ghost" size="sm" onClick={() => handleOpenScheduledModal(st)}><Icon name="Pencil" className="w-4 h-4" /></Button>
                                                    <Button variant="ghost" size="sm" onClick={() => handleDeleteScheduled(st.id)}><Icon name="Trash2" className="w-4 h-4 text-red-500" /></Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${scopeColor}`}>{st.scope === 'professional' ? 'Profesional' : 'Personal'}</span>
                                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-200 text-slate-800 dark:bg-slate-600 dark:text-slate-200">{frequencyLabels[st.frequency]}</span>
                                    </div>
                                </div>
                            );
                        }) : <p className="text-sm text-center text-gray-600 dark:text-gray-400">Añade transacciones futuras para proyectar tu crecimiento.</p>}
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
                <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                     <div className="flex flex-wrap items-center gap-4">
                        <h3 className="text-xl font-semibold">Registro Global de Movimientos</h3>
                        <div className="flex items-center gap-2 bg-black/5 dark:bg-white/5 p-1 rounded-full">
                            <span className="text-sm font-medium pl-2">Mostrar Programaciones</span>
                            <Toggle checked={globalFilters.showProjections} onChange={handleToggleShowProjections} />
                        </div>
                        <div className="flex items-center gap-2 bg-black/5 dark:bg-white/5 p-1 rounded-full">
                            <span className="text-sm font-medium pl-2">Mostrar Pendientes</span>
                            <Toggle checked={globalFilters.showPending} onChange={handleToggleShowPending} />
                        </div>
                    </div>
                    <div className="flex space-x-1 rounded-full bg-black/5 dark:bg-white/5 p-1">
                         {isProfessionalModeEnabled && (
                            <>
                                <FilterButton label="Ingreso Pro." active={globalFilters.typeFilters.proIncome} onClick={() => handleFilterChange('proIncome')} />
                                <FilterButton label="Gasto Pro." active={globalFilters.typeFilters.proExpense} onClick={() => handleFilterChange('proExpense')} />
                            </>
                        )}
                        <FilterButton label="Ingreso Pers." active={globalFilters.typeFilters.persIncome} onClick={() => handleFilterChange('persIncome')} />
                        <FilterButton label="Gasto Pers." active={globalFilters.typeFilters.persExpense} onClick={() => handleFilterChange('persExpense')} />
                        <FilterButton label="Transferencia" active={globalFilters.typeFilters.transfer} onClick={() => handleFilterChange('transfer')} />
                    </div>
                </div>
                
                <PeriodSelector onPeriodChange={handlePeriodChange} />

                <div className="overflow-y-auto max-h-[40rem] mt-4">
                    <div className="divide-y divide-slate-200/50 dark:divide-white/10">
                        {unifiedTransactions.map(t => {
                            const isProjection = t.isProjection;
                            const iconName = isProjection ? 'Calendar' : t.type === 'transfer' ? 'ArrowRightLeft' : t.amount > 0 ? 'TrendingUp' : 'TrendingDown';
                             const projectionColor = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';

                            return (
                                <div key={t.id} className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-3 transition-colors ${!t.isPaid ? 'opacity-60' : ''} ${isProjection ? 'opacity-60 italic' : ''}`}>
                                    <div className="flex items-center gap-4 flex-grow min-w-[200px]">
                                        <div className={`p-2 rounded-lg ${isProjection ? projectionColor : t.typeLabel.color} flex-shrink-0`}>
                                            <Icon name={iconName} className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold">{t.concept}</p>
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
                                            {!t.isPaid && !isProjection && <span className="text-xs text-yellow-500">Pendiente</span>}
                                        </div>
                                         <div className="flex items-center w-24 justify-end">
                                            {isProjection ? (
                                                <Button size="sm" variant="secondary" onClick={() => handleConfirmScheduled(t.originalItem)} title="Registrar">
                                                    <Icon name="PlusCircle" className="w-4 h-4 mr-1" /> Registrar
                                                </Button>
                                            ) : (
                                                <>
                                                    <Button size="sm" variant="ghost" onClick={() => handleEditUnified(t)} title="Editar"><Icon name="Pencil" className="w-4 h-4" /></Button>
                                                    <Button size="sm" variant="ghost" onClick={() => handleDeleteUnified(t)} title="Eliminar"><Icon name="Trash2" className="w-4 h-4 text-red-500" /></Button>
                                                </>
                                            )}
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
            <Modal
                isOpen={!!historyModalLocation}
                onClose={() => setHistoryModalLocation(null)}
                title={`Historial de ${historyModalLocation}`}
            >
                <div className="max-h-[60vh] overflow-y-auto">
                    {locationHistory.length > 1 ? (
                        <div className="divide-y divide-slate-200/50 dark:divide-white/10">
                            {locationHistory.map((item, index) => (
                                <div key={index} className="flex justify-between items-center p-3">
                                    <div className="flex-grow">
                                        <p className="font-semibold">{item.concept}</p>
                                        <p className="text-xs text-slate-500">
                                            {item.date ? item.date.toLocaleDateString('es-ES') : 'Inicio'}
                                        </p>
                                    </div>
                                    <div className="text-right ml-4 flex-shrink-0">
                                        <p className={`font-bold ${index > 0 ? (item.amount >= 0 ? 'text-green-500' : 'text-red-500') : ''}`}>
                                            {index > 0 && (item.amount >= 0 ? '+' : '')}{formatCurrency(item.amount)}
                                        </p>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">{formatCurrency(item.balance)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-slate-500 py-8">No hay movimientos registrados para esta ubicación.</p>
                    )}
                </div>
            </Modal>
            <TaxesBreakdownModal isOpen={isTaxesBreakdownOpen} onClose={() => setIsTaxesBreakdownOpen(false)} breakdown={netCapitalSummary.taxesBreakdown} formatCurrency={formatCurrency} projectionPeriodLabel={getProjectionPeriodLabel()} />
            <Modal isOpen={isScheduledModalOpen} onClose={() => setIsScheduledModalOpen(false)} title={scheduledToEdit ? "Editar Transacción Programada" : "Nueva Transacción Programada"}>
                <ScheduledTransactionForm onClose={() => setIsScheduledModalOpen(false)} transactionToEdit={scheduledToEdit} />
            </Modal>
            <Modal isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} title={transferToEdit ? "Editar Transferencia" : "Nueva Transferencia"}>
                <TransferForm onClose={() => setIsTransferModalOpen(false)} transferToEdit={transferToEdit} />
            </Modal>

            <AddRecordedTransactionModal isOpen={isAddRecordedModalOpen} onClose={() => setIsAddRecordedModalOpen(false)} isProfessionalModeEnabled={isProfessionalModeEnabled} />

            {professionalIncomeToEdit && (
                <Modal isOpen={true} onClose={() => { setProfessionalIncomeToEdit(null); setConfirmingScheduledId(null); }} title={confirmingScheduledId ? "Confirmar Ingreso Programado" : (professionalIncomeToEdit.id ? "Editar Ingreso" : "Nuevo Ingreso")}>
                    <IncomeForm onClose={() => { setProfessionalIncomeToEdit(null); setConfirmingScheduledId(null); }} incomeToEdit={professionalIncomeToEdit} fromScheduledId={confirmingScheduledId} />
                </Modal>
            )}
            {professionalExpenseToEdit && (
                <Modal isOpen={true} onClose={() => { setProfessionalExpenseToEdit(null); setConfirmingScheduledId(null); }} title={confirmingScheduledId ? "Confirmar Gasto Programado" : (professionalExpenseToEdit.id ? "Editar Gasto" : "Nuevo Gasto")}>
                    <ExpenseForm onClose={() => { setProfessionalExpenseToEdit(null); setConfirmingScheduledId(null); }} expenseToEdit={professionalExpenseToEdit} fromScheduledId={confirmingScheduledId} />
                </Modal>
            )}
            {personalMovementToEdit && (
                <Modal isOpen={true} onClose={() => { setPersonalMovementToEdit(null); setConfirmingScheduledId(null); }} title={confirmingScheduledId ? "Confirmar Movimiento Programado" : (personalMovementToEdit.id ? "Editar Movimiento" : "Nuevo Movimiento")}>
                    <MovementForm onClose={() => { setPersonalMovementToEdit(null); setConfirmingScheduledId(null); }} movementToEdit={personalMovementToEdit} fromScheduledId={confirmingScheduledId} />
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
            {snoozingAction && (
                <Modal isOpen={!!snoozingAction} onClose={() => setSnoozingAction(null)} title={`Recordar Más Tarde: ${snoozingAction.concept}`}>
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600 dark:text-slate-400">Selecciona una fecha futura para que esta acción deje de considerarse urgente.</p>
                        <DatePickerInput 
                            label="Fecha del Recordatorio"
                            selectedDate={snoozeDate.toISOString()}
                            onDateChange={setSnoozeDate}
                        />
                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="secondary" onClick={() => setSnoozingAction(null)}>Cancelar</Button>
                            <Button onClick={handleConfirmSnooze}>Guardar Recordatorio</Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default GlobalView;