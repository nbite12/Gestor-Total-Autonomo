import React, { useState, useContext, useMemo, useCallback } from 'react';
import { AppContext } from '../App';
import { PersonalMovement, SavingsGoal, MoneySource, MoneyLocation, InvestmentGood } from '../types';
import { Card, Button, Modal, Input, Select, Icon, Celebration } from './ui';
import { PeriodSelector } from './PeriodSelector';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { MovementForm, SavingsGoalForm, AddFundsForm } from './TransactionForms';

// --- Main Personal View ---
const PersonalView: React.FC = () => {
  const context = useContext(AppContext);
  if (!context) return <div>Cargando...</div>;
  const { data, saveData, formatCurrency } = context;
  const { savingsGoals, personalCategories } = data;

  const [isMovementModalOpen, setMovementModalOpen] = useState(false);
  const [movementToEdit, setMovementToEdit] = useState<PersonalMovement | null>(null);
  const [isGoalFormOpen, setGoalFormOpen] = useState(false);
  const [goalToEdit, setGoalToEdit] = useState<SavingsGoal | null>(null);
  const [goalToAddFunds, setGoalToAddFunds] = useState<SavingsGoal | null>(null);
  const [celebrationType, setCelebrationType] = useState<'none' | 'contribution' | 'goalComplete'>('none');

  const [period, setPeriod] = useState<{ startDate: Date; endDate: Date }>(() => {
        const end = new Date();
        const start = new Date(end.getFullYear(), end.getMonth(), 1);
        return { startDate: start, endDate: end };
    });
  const handlePeriodChange = useCallback((startDate: Date, endDate: Date) => setPeriod({ startDate, endDate }), []);


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
                if (movement.type === 'income') balances[movement.location] = (balances[movement.location] || 0) + movement.amount;
                else balances[movement.location] = (balances[movement.location] || 0) - movement.amount;
            }
        });
        data.transfers.forEach(transfer => {
            balances[transfer.fromLocation] = (balances[transfer.fromLocation] || 0) - transfer.amount;
            balances[transfer.toLocation] = (balances[transfer.toLocation] || 0) + transfer.amount;
        });
        return balances;
    }, [data.incomes, data.expenses, data.investmentGoods, data.personalMovements, data.transfers, data.settings.initialBalances]);


  const filteredMovements = useMemo(() => data.personalMovements.filter(m => {
      const moveDate = new Date(m.date);
      return moveDate >= period.startDate && moveDate <= period.endDate;
  }), [data.personalMovements, period]);

  const summary = useMemo(() => {
    const personalBalance = (moneyDistribution[MoneyLocation.PERS_BANK] || 0) + (moneyDistribution[MoneyLocation.CASH] || 0) + (moneyDistribution[MoneyLocation.OTHER] || 0);
    const totalIncome = filteredMovements.filter(m => m.type === 'income' && m.isPaid).reduce((acc, m) => acc + m.amount, 0);
    const totalExpense = filteredMovements.filter(m => m.type === 'expense' && m.isPaid).reduce((acc, m) => acc + m.amount, 0);
    return {
      totalBalance: personalBalance,
      totalIncome,
      totalExpense
    };
  }, [filteredMovements, moneyDistribution]);

  const expenseChartData = useMemo(() => {
    const dataByCat = filteredMovements
        .filter(m => m.type === 'expense')
        .reduce((acc, m) => {
            const catName = personalCategories.find(c => c.id === m.categoryId)?.name || 'Sin Categoría';
            acc[catName] = (acc[catName] || 0) + m.amount;
            return acc;
        }, {} as {[key: string]: number});
    return Object.entries(dataByCat).map(([name, value]) => ({ name, value }));
  }, [filteredMovements, personalCategories]);
  
  const COLORS = ['#FF8042', '#0088FE', '#00C49F', '#FFBB28', '#AF19FF', '#FF4560'];

  const handleOpenMovementModal = (movement?: PersonalMovement) => {
    setMovementToEdit(movement || null);
    setMovementModalOpen(true);
  };
  
  const handleDeleteMovement = useCallback((id: string) => {
      if(window.confirm('¿Seguro que quieres borrar este movimiento?')) {
          saveData(prev => ({...prev, personalMovements: prev.personalMovements.filter(m => m.id !== id)}), "Movimiento eliminado.");
      }
  }, [saveData]);

   const handleDeleteGoal = useCallback((id: string) => {
      if(window.confirm('¿Seguro que quieres borrar este objetivo? No se borrarán las aportaciones ya hechas.')) {
          saveData(prev => ({...prev, savingsGoals: prev.savingsGoals.filter(g => g.id !== id)}), "Objetivo de ahorro eliminado.");
      }
  }, [saveData]);

  const handleOpenGoalForm = (goal: SavingsGoal | null) => {
    setGoalToEdit(goal);
    setGoalFormOpen(true);
  };

  const handleCloseGoalForm = () => {
    setGoalFormOpen(false);
    setGoalToEdit(null);
  }

  const handleSaveContribution = (isGoalCompleted: boolean) => {
    setCelebrationType(isGoalCompleted ? 'goalComplete' : 'contribution');
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        return (
        <div className="p-2 bg-black/80 text-white text-sm rounded-lg shadow-lg backdrop-blur-sm">
            <p className="font-bold">{`${payload[0].name}`}</p>
            <p>{`Total: ${formatCurrency(payload[0].value)}`}</p>
        </div>
        );
    }
    return null;
  };


  return (
    <div className="space-y-8">
       <Celebration type={celebrationType} onComplete={() => setCelebrationType('none')} />
       {/* Dashboard Summary */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           <Card className="p-6 text-center">
                <h3 className="text-lg text-slate-500 dark:text-slate-400">Fondos Personales Actuales</h3>
                <p className={`text-4xl font-bold break-words ${summary.totalBalance >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(summary.totalBalance)}</p>
           </Card>
           <Card className="p-6 text-center">
                <h3 className="text-lg text-slate-500 dark:text-slate-400">Ingresos (Periodo)</h3>
                <p className="text-3xl font-bold text-green-500 break-words">{formatCurrency(summary.totalIncome)}</p>
           </Card>
           <Card className="p-6 text-center">
                <h3 className="text-lg text-slate-500 dark:text-slate-400">Gastos (Periodo)</h3>
                <p className="text-3xl font-bold text-red-500 break-words">{formatCurrency(summary.totalExpense)}</p>
           </Card>
       </div>
       
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           {/* Savings Goals */}
           <Card className="p-6">
               <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">Objetivos de Ahorro</h2>
                  <Button onClick={() => handleOpenGoalForm(null)} size="sm">
                      <Icon name="Plus" className="w-4 h-4" /> Nuevo Objetivo
                  </Button>
               </div>
               <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                   {savingsGoals.length > 0 ? savingsGoals.map(goal => {
                       const progress = Math.min(100, (goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 100));
                       return (
                           <div key={goal.id}>
                               <div className="flex justify-between items-baseline mb-1">
                                    <span className="font-semibold">{goal.name}</span>
                                    <span className="text-sm text-slate-500">{formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}</span>
                               </div>
                               <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                                   <div className="bg-primary-500 h-2.5 rounded-full" style={{width: `${progress}%`}}></div>
                               </div>
                               <div className="flex justify-end items-center gap-1 mt-2">
                                   <Button size="sm" variant="secondary" onClick={() => setGoalToAddFunds(goal)}>Aportar</Button>
                                   <Button size="sm" variant="ghost" onClick={() => handleOpenGoalForm(goal)} title="Editar objetivo"><Icon name="Pencil" className="w-4 h-4"/></Button>
                                   <Button size="sm" variant="ghost" onClick={() => handleDeleteGoal(goal.id)} title="Eliminar objetivo"><Icon name="Trash2" className="w-4 h-4 text-red-500"/></Button>
                               </div>
                           </div>
                       );
                   }) : <p className="text-center text-slate-500 py-8">Aún no has creado ningún objetivo.</p>}
               </div>
           </Card>

           {/* Expense Chart */}
           <Card className="p-6">
                <h3 className="text-xl font-bold mb-4">Gastos por Categoría (Periodo)</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie data={expenseChartData} cx="50%" cy="50%" labelLine={false} outerRadius={100} fill="#8884d8" dataKey="value" nameKey="name">
                            {expenseChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
           </Card>
       </div>

       {/* Personal Movements List */}
        <Card className="p-6">
            <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                <h2 className="text-xl font-bold">Movimientos Personales</h2>
                <Button onClick={() => handleOpenMovementModal()}>
                    <Icon name="Plus" className="w-5 h-5" /> Añadir Movimiento
                </Button>
            </div>
            <PeriodSelector onPeriodChange={handlePeriodChange} />
             <div className="overflow-y-auto max-h-[40rem] mt-4">
                <div className="divide-y divide-slate-200/50 dark:divide-white/10">
                    {filteredMovements.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(mov => (
                        <div key={mov.id} className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-3 transition-colors ${!(mov.isPaid ?? true) ? 'opacity-60 italic' : ''}`}>
                            <div className="flex items-center gap-4 flex-grow min-w-[200px]">
                                <div className={`p-2 rounded-lg ${mov.type === 'income' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'} flex-shrink-0`}>
                                    <Icon name={mov.type === 'income' ? 'TrendingUp' : 'TrendingDown'} className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-semibold">{mov.concept}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{personalCategories.find(c => c.id === mov.categoryId)?.name || '-'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 w-full basis-auto justify-end">
                                <div className="text-right">
                                    <p className={`font-semibold break-words ${mov.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                                        {mov.type === 'income' ? '+' : '-'}{formatCurrency(mov.amount)}
                                    </p>
                                    {!(mov.isPaid ?? true) && <span className="text-xs text-yellow-500">Pendiente</span>}
                                </div>
                                <div className="flex items-center">
                                   <Button size="sm" variant="ghost" onClick={() => handleOpenMovementModal(mov)}><Icon name="Pencil" className="w-4 h-4" /></Button>
                                   <Button size="sm" variant="ghost" onClick={() => handleDeleteMovement(mov.id)}><Icon name="Trash2" className="w-4 h-4 text-red-500" /></Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
             </div>
             {filteredMovements.length === 0 && <p className="text-center text-slate-500 py-8">No hay movimientos registrados para este periodo.</p>}
        </Card>

      {/* Modals */}
      <Modal isOpen={isMovementModalOpen} onClose={() => setMovementModalOpen(false)} title={movementToEdit ? "Editar Movimiento" : "Nuevo Movimiento"}>
        <MovementForm onClose={() => setMovementModalOpen(false)} movementToEdit={movementToEdit} />
      </Modal>

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

export default PersonalView;