
import React, { useState, useContext, useMemo, useCallback } from 'react';
import { AppContext } from '../App';
import { Card, Icon, HelpTooltip, Switch, Button, Modal, Input, Select } from './ui';
import { PeriodSelector } from './PeriodSelector';
import { Income, Expense, PersonalMovement, PotentialIncome, SavingsGoal, MoneySource, MoneyLocation } from '../types';

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

const formatDateForInput = (isoDate: string) => isoDate.split('T')[0];


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


// --- Global View ---
const GlobalView: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return <div>Cargando...</div>;

    const { data, setData, formatCurrency } = context;
    const { incomes, expenses, personalMovements, settings, savingsGoals, potentialIncomes } = data;

    const [period, setPeriod] = useState<{ startDate: Date; endDate: Date }>(() => {
        const end = new Date();
        const start = new Date(end.getFullYear(), end.getMonth(), 1);
        return { startDate: start, endDate: end };
    });
    
    const [includeSavings, setIncludeSavings] = useState(true);
    const [includePotentialIncome, setIncludePotentialIncome] = useState(true);
    const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
    const [incomeToEdit, setIncomeToEdit] = useState<PotentialIncome | null>(null);

    const handlePeriodChange = useCallback((startDate: Date, endDate: Date) => setPeriod({ startDate, endDate }), []);

    // --- Memoized Calculations ---
    const monthsInPeriod = useMemo(() => getMonthsInRange(period.startDate, period.endDate), [period]);

    const moneyDistribution = useMemo(() => {
        const balances: { [key in MoneyLocation]: number } = {
            [MoneyLocation.CASH]: 0,
            [MoneyLocation.PRO_BANK]: 0,
            [MoneyLocation.PERS_BANK]: 0,
            [MoneyLocation.OTHER]: 0,
        };

        // Process paid professional incomes
        data.incomes.forEach(income => {
            if (income.isPaid && income.location) {
                const netAmount = income.baseAmount + (income.baseAmount * income.vatRate / 100) - (income.baseAmount * income.irpfRate / 100);
                balances[income.location] = (balances[income.location] || 0) + netAmount;
            }
        });

        // Process professional expenses
        data.expenses.forEach(expense => {
            if (expense.location) {
                const totalAmount = expense.baseAmount + (expense.baseAmount * expense.vatRate / 100);
                balances[expense.location] = (balances[expense.location] || 0) - totalAmount;
            }
        });

        // Process personal movements
        data.personalMovements.forEach(movement => {
            if (movement.location) {
                if (movement.type === 'income') {
                    balances[movement.location] = (balances[movement.location] || 0) + movement.amount;
                } else {
                    balances[movement.location] = (balances[movement.location] || 0) - movement.amount;
                }
            }
        });

        return balances;
    }, [data.incomes, data.expenses, data.personalMovements]);


    const actualMovements = useMemo(() => {
        const professionalIncomes = incomes
            .filter(i => new Date(i.date) >= period.startDate && new Date(i.date) <= period.endDate && i.isPaid)
            .map(i => ({ amount: i.baseAmount + (i.baseAmount * i.vatRate / 100) - (i.baseAmount * i.irpfRate / 100) }));

        const professionalExpenses = expenses
            .filter(e => new Date(e.date) >= period.startDate && new Date(e.date) <= period.endDate)
            .map(e => ({ amount: e.baseAmount + (e.baseAmount * e.vatRate / 100) }));
            
        const personalMoves = personalMovements
            .filter(pm => new Date(pm.date) >= period.startDate && new Date(pm.date) <= period.endDate)

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
    
    const summary = useMemo(() => {
        const totalProjectedIncome = actualMovements.totalActualIncome + projectedIncome;
        const totalProjectedExpense = actualMovements.totalActualExpense + projectedSavings;
        const netProjectedCashFlow = totalProjectedIncome - totalProjectedExpense;

        return {
            ...actualMovements,
            projectedIncome,
            projectedSavings,
            totalProjectedIncome,
            totalProjectedExpense,
            netProjectedCashFlow,
        }
    }, [actualMovements, projectedIncome, projectedSavings]);

    // --- Handlers ---
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


    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Visión Global y Proyección</h2>
            
            <Card>
                <h3 className="text-xl font-bold mb-4">Distribución del Dinero</h3>
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

            <PeriodSelector onPeriodChange={handlePeriodChange} />
            
            {/* Main KPIs */}
            <Card>
                 <h3 className="text-xl font-bold mb-4">Resumen y Proyección del Periodo</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center divide-y md:divide-y-0 md:divide-x dark:divide-slate-700">
                    <div className="p-4">
                        <h4 className="text-lg text-slate-500 dark:text-slate-400">Ingresos Proyectados</h4>
                        <p className="text-3xl font-bold text-green-500">{formatCurrency(summary.totalProjectedIncome)}</p>
                        <p className="text-xs text-slate-400">({formatCurrency(summary.totalActualIncome)} reales + {formatCurrency(summary.projectedIncome)} potenciales)</p>
                    </div>
                    <div className="p-4">
                        <h4 className="text-lg text-slate-500 dark:text-slate-400">Gastos Proyectados</h4>
                        <p className="text-3xl font-bold text-red-500">{formatCurrency(summary.totalProjectedExpense)}</p>
                        <p className="text-xs text-slate-400">({formatCurrency(summary.totalActualExpense)} reales + {formatCurrency(summary.projectedSavings)} ahorro)</p>
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

            <Modal isOpen={isIncomeModalOpen} onClose={() => setIsIncomeModalOpen(false)} title={incomeToEdit ? "Editar Ingreso Potencial" : "Añadir Ingreso Potencial"}>
                <PotentialIncomeForm onClose={() => setIsIncomeModalOpen(false)} incomeToEdit={incomeToEdit} />
            </Modal>
        </div>
    );
};

export default GlobalView;