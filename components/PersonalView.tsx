import React, { useState, useContext, useMemo, useCallback } from 'react';
import { AppContext } from '../App';
import { PersonalMovement, SavingsGoal, MoneySource, MoneyLocation } from '../types';
import { Card, Button, Modal, Input, Select, Icon } from './ui';
import { PeriodSelector } from './PeriodSelector';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { MovementForm } from './TransactionForms';


const formatCurrencyForUI = (amount: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
const formatDateForInput = (isoDate: string) => isoDate.split('T')[0];

// --- Savings Goal Form ---
const SavingsGoalForm: React.FC<{
    onClose: () => void;
    goalToEdit: SavingsGoal | null;
}> = ({ onClose, goalToEdit }) => {
    const context = useContext(AppContext);
    if (!context) throw new Error("Context not available");
    const { setData } = context;

    const [formData, setFormData] = useState({
        name: goalToEdit?.name || '',
        targetAmount: goalToEdit?.targetAmount || 0,
        deadline: goalToEdit ? formatDateForInput(goalToEdit.deadline) : new Date().toISOString().split('T')[0]
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'targetAmount' ? parseFloat(value) : value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (goalToEdit) {
            const updatedGoal: SavingsGoal = {
                ...goalToEdit,
                name: formData.name,
                targetAmount: formData.targetAmount,
                deadline: new Date(formData.deadline).toISOString(),
            };
            setData(prev => ({
                ...prev,
                savingsGoals: prev.savingsGoals.map(g => g.id === goalToEdit.id ? updatedGoal : g)
            }));
        } else {
            const newGoal: SavingsGoal = {
                id: `sg-${Date.now()}`,
                name: formData.name,
                targetAmount: formData.targetAmount,
                currentAmount: 0,
                deadline: new Date(formData.deadline).toISOString(),
            };
            setData(prev => ({...prev, savingsGoals: [...prev.savingsGoals, newGoal]}));
        }
        onClose();
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Nombre del Objetivo" name="name" value={formData.name} onChange={handleChange} required />
            <Input label="Importe Objetivo (€)" name="targetAmount" type="number" step="0.01" min="0" value={formData.targetAmount} onChange={handleChange} required />
            <Input label="Fecha Límite" name="deadline" type="date" value={formData.deadline} onChange={handleChange} required />
             <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                <Button type="submit">{goalToEdit ? 'Guardar Cambios' : 'Crear Objetivo'}</Button>
            </div>
        </form>
    );
}

// --- Add Funds Form ---
const AddFundsForm: React.FC<{
  goal: SavingsGoal;
  onClose: () => void;
}> = ({ goal, onClose }) => {
    const context = useContext(AppContext);
    if (!context) throw new Error("Context not available");
    const { data, setData } = context;
    const [amount, setAmount] = useState(0);
    const [location, setLocation] = useState<MoneyLocation>(MoneyLocation.PERS_BANK);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (amount <= 0) return;

        setData(prev => {
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
        });
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

// --- Main Personal View ---
const PersonalView: React.FC = () => {
  const context = useContext(AppContext);
  if (!context) return <div>Cargando...</div>;
  const { data, setData, formatCurrency } = context;
  const { savingsGoals, personalCategories } = data;

  const [isMovementModalOpen, setMovementModalOpen] = useState(false);
  const [movementToEdit, setMovementToEdit] = useState<PersonalMovement | null>(null);
  const [isGoalFormOpen, setGoalFormOpen] = useState(false);
  const [goalToEdit, setGoalToEdit] = useState<SavingsGoal | null>(null);
  const [goalToAddFunds, setGoalToAddFunds] = useState<SavingsGoal | null>(null);
  const [period, setPeriod] = useState<{ startDate: Date; endDate: Date }>(() => {
        const end = new Date();
        const start = new Date(end.getFullYear(), end.getMonth(), 1);
        return { startDate: start, endDate: end };
    });
  const handlePeriodChange = useCallback((startDate: Date, endDate: Date) => setPeriod({ startDate, endDate }), []);


  const moneyDistribution = useMemo(() => {
        const balances: { [key in MoneyLocation]: number } = {
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
    }, [data.incomes, data.expenses, data.personalMovements, data.transfers, data.settings.initialBalances]);


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
          setData(prev => ({...prev, personalMovements: prev.personalMovements.filter(m => m.id !== id)}));
      }
  }, [setData]);

   const handleDeleteGoal = useCallback((id: string) => {
      if(window.confirm('¿Seguro que quieres borrar este objetivo? No se borrarán las aportaciones ya hechas.')) {
          setData(prev => ({...prev, savingsGoals: prev.savingsGoals.filter(g => g.id !== id)}));
      }
  }, [setData]);

  const handleOpenGoalForm = (goal: SavingsGoal | null) => {
    setGoalToEdit(goal);
    setGoalFormOpen(true);
  };

  const handleCloseGoalForm = () => {
    setGoalFormOpen(false);
    setGoalToEdit(null);
  }


  return (
    <div className="space-y-6">
       {/* Dashboard Summary */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           <Card className="text-center">
                <h3 className="text-lg text-slate-500 dark:text-slate-400">Fondos Personales Actuales</h3>
                <p className={`text-4xl font-bold ${summary.totalBalance >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(summary.totalBalance)}</p>
           </Card>
           <Card className="text-center">
                <h3 className="text-lg text-slate-500 dark:text-slate-400">Ingresos (Periodo)</h3>
                <p className="text-3xl font-bold text-green-500">{formatCurrency(summary.totalIncome)}</p>
           </Card>
           <Card className="text-center">
                <h3 className="text-lg text-slate-500 dark:text-slate-400">Gastos (Periodo)</h3>
                <p className="text-3xl font-bold text-red-500">{formatCurrency(summary.totalExpense)}</p>
           </Card>
       </div>
       
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           {/* Savings Goals */}
           <Card>
               <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">Objetivos de Ahorro</h2>
                  <Button onClick={() => handleOpenGoalForm(null)} size="sm">
                      <Icon name="plus" className="w-4 h-4" /> Nuevo Objetivo
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
                                   <Button size="sm" variant="ghost" onClick={() => handleOpenGoalForm(goal)} title="Editar objetivo"><Icon name="pencil" className="w-4 h-4"/></Button>
                                   <Button size="sm" variant="ghost" onClick={() => handleDeleteGoal(goal.id)} title="Eliminar objetivo"><Icon name="trash" className="w-4 h-4 text-red-500"/></Button>
                               </div>
                           </div>
                       );
                   }) : <p className="text-center text-slate-500 py-8">Aún no has creado ningún objetivo.</p>}
               </div>
           </Card>

           {/* Expense Chart */}
           <Card>
                <h3 className="text-xl font-bold mb-4">Gastos por Categoría (Periodo)</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie data={expenseChartData} cx="50%" cy="50%" labelLine={false} outerRadius={100} fill="#8884d8" dataKey="value" nameKey="name">
                            {expenseChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
           </Card>
       </div>

       {/* Personal Movements List */}
        <Card>
            <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                <h2 className="text-xl font-bold">Movimientos Personales</h2>
                <Button onClick={() => handleOpenMovementModal()}>
                    <Icon name="plus" className="w-5 h-5" /> Añadir Movimiento
                </Button>
            </div>
            <PeriodSelector onPeriodChange={handlePeriodChange} />
             <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">Fecha</th>
                            <th scope="col" className="px-6 py-3">Concepto</th>
                            <th scope="col" className="px-6 py-3">Categoría</th>
                            <th scope="col" className="px-6 py-3">Estado</th>
                            <th scope="col" className="px-6 py-3">Importe</th>
                            <th scope="col" className="px-6 py-3">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredMovements.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(mov => (
                            <tr key={mov.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                <td className="px-6 py-4">{new Date(mov.date).toLocaleDateString('es-ES')}</td>
                                <td className="px-6 py-4">{mov.concept}</td>
                                <td className="px-6 py-4">{personalCategories.find(c => c.id === mov.categoryId)?.name || '-'}</td>
                                <td className="px-6 py-4">
                                    {mov.isPaid ? 
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`}>{mov.type === 'income' ? 'Recibido' : 'Pagado'}</span> :
                                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Pendiente</span>
                                    }
                                </td>
                                <td className={`px-6 py-4 font-semibold ${mov.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>{mov.type === 'income' ? '+' : '-'}{formatCurrency(mov.amount)}</td>
                                <td className="px-6 py-4 flex gap-2">
                                   <Button size="sm" variant="ghost" onClick={() => handleOpenMovementModal(mov)}><Icon name="pencil" className="w-4 h-4" /></Button>
                                   <Button size="sm" variant="ghost" onClick={() => handleDeleteMovement(mov.id)}><Icon name="trash" className="w-4 h-4 text-red-500" /></Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
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
            <AddFundsForm goal={goalToAddFunds} onClose={() => setGoalToAddFunds(null)} />
        </Modal>
      )}
    </div>
  );
};

export default PersonalView;
