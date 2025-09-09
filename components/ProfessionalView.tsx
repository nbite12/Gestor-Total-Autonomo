import React, { useState, useContext, useMemo, useCallback } from 'react';
import { AppContext } from '../App';
import { Income, Expense, Attachment, InvestmentGood, AppData } from '../types';
import { Card, Button, Modal, Icon, HelpTooltip, Select } from './ui';
import { IRPF_BRACKETS } from '../constants';
import { generateIncomesPDF, generateExpensesPDF, generateComprehensivePeriodPDF } from '../services/pdfService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { PeriodSelector } from './PeriodSelector';
import { IncomeForm, ExpenseForm, InvestmentGoodForm } from './TransactionForms';
import { AiModal } from './AiModal';
import { UnsupportedModelsModal } from './ui';

// --- Type definitions ---
type ProViewTab = 'libros' | 'analisis' | 'pdf';
type TaxModel = '303/130/111/115' | '390' | '100' | '347' | '190/180' | '349';

// --- Helper Functions ---
const formatDate = (isoDate: string | Date) => new Date(isoDate).toLocaleDateString('es-ES');
const getCuotaIVA = (base: number, rate: number) => base * (rate / 100);
const getCuotaIRPF = (base: number, rate: number) => base * (rate / 100);
const getTotalFacturaEmitida = (inc: Income) => inc.baseAmount + getCuotaIVA(inc.baseAmount, inc.vatRate) - getCuotaIRPF(inc.baseAmount, inc.irpfRate);

const handleDownloadAttachment = (attachment: Attachment) => {
    const byteCharacters = atob(attachment.data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: attachment.type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

interface IRPFBreakdownRow {
  bracket: { limit: number; rate: number };
  baseInBracket: number;
  partialQuota: number;
}

const calculateAnnualIRPFBreakdown = (annualIncome: number) => {
    let totalQuota = 0;
    let remainingIncome = annualIncome;
    let lastLimit = 0;
    const breakdown: IRPFBreakdownRow[] = [];

    for (const bracket of IRPF_BRACKETS) {
        const bracketLimit = bracket.limit === Infinity ? Infinity : bracket.limit;
        const bracketWidth = bracketLimit - lastLimit;
        
        if (remainingIncome <= 0 && annualIncome > lastLimit) {
            breakdown.push({ bracket, baseInBracket: 0, partialQuota: 0 });
            lastLimit = bracketLimit;
            continue;
        }
        
        const baseInBracket = Math.min(remainingIncome, bracketWidth);
        if(baseInBracket <= 0) continue;

        const partialQuota = baseInBracket * bracket.rate;

        totalQuota += partialQuota;
        remainingIncome -= baseInBracket;
        
        breakdown.push({ bracket, baseInBracket, partialQuota });

        lastLimit = bracketLimit;
    }
    
    const lastBracketIndex = IRPF_BRACKETS.findIndex(b => b.limit === lastLimit);
    if(lastBracketIndex > -1 && lastBracketIndex < IRPF_BRACKETS.length - 1) {
        IRPF_BRACKETS.slice(lastBracketIndex + 1).forEach(bracket => {
            breakdown.push({ bracket, baseInBracket: 0, partialQuota: 0 });
        });
    }

    const effectiveRate = annualIncome > 0 ? (totalQuota / annualIncome) * 100 : 0;

    return { breakdown, totalQuota, effectiveRate };
};

const checkFilingPeriod = (model: TaxModel, year: number, quarter: number): { isOpen: boolean; text: string } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffInCalendarDays = (d1: Date, d2: Date) => {
        const date1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
        const date2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
        return Math.round((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
    };

    const formatDateForDeadline = (date: Date) => date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

    const getFilingDates = (): { start: Date; end: Date } | null => {
        switch(model) {
            case '303/130/111/115':
                 switch (quarter) {
                    case 1: return { start: new Date(year, 3, 1), end: new Date(year, 3, 20) }; // Q1 -> April
                    case 2: return { start: new Date(year, 6, 1), end: new Date(year, 6, 20) }; // Q2 -> July
                    case 3: return { start: new Date(year, 9, 1), end: new Date(year, 9, 20) }; // Q3 -> October
                    case 4: return { start: new Date(year + 1, 0, 1), end: new Date(year + 1, 0, 30) }; // Q4 -> Jan
                    default: return null;
                }
            case '100': return { start: new Date(year + 1, 3, 1), end: new Date(year + 1, 5, 30) }; // Renta (year) -> April-June next year
            case '390':
            case '190/180':
                return { start: new Date(year + 1, 0, 1), end: new Date(year + 1, 0, 31) }; // Annual Summaries -> January
            case '347': return { start: new Date(year + 1, 1, 1), end: new Date(year + 1, 1, 28) }; // Ops with 3rd parties -> February
            default: return null;
        }
    };
    
    const filingDates = getFilingDates();
    if (!filingDates) return { isOpen: false, text: 'Plazo no definido' };

    const { start: filingStart, end: filingEnd } = filingDates;
    
    if (today >= filingStart && today <= filingEnd) {
        const daysLeft = diffInCalendarDays(today, filingEnd);
        if (daysLeft === 0) return { isOpen: true, text: 'Plazo abierto. ¡Finaliza hoy!' };
        if (daysLeft === 1) return { isOpen: true, text: 'Plazo abierto. Finaliza mañana.' };
        return { isOpen: true, text: `Plazo abierto. Finaliza en ${daysLeft} días.` };
    } else if (today < filingStart) {
        const daysUntil = diffInCalendarDays(today, filingStart);
        if (daysUntil === 1) return { isOpen: false, text: `Fuera de plazo. El plazo abre mañana.` };
        if (daysUntil <= 15) return { isOpen: false, text: `Fuera de plazo. El plazo abre en ${daysUntil} días.` };
        return { isOpen: false, text: `Fuera de plazo. El plazo abre el ${formatDateForDeadline(filingStart)}.` };
    } else {
        return { isOpen: false, text: `Plazo finalizado el ${formatDateForDeadline(filingEnd)}.` };
    }
};

// Helper function for Model 100
const calculateAnnualRent = (year: number, appData: AppData) => {
    const { incomes, expenses, investmentGoods, settings } = appData;
    const yearIncomes = incomes.filter(i => new Date(i.date).getFullYear() === year);
    const yearDeductibleExpenses = expenses.filter(e => e.isDeductible && new Date(e.date).getFullYear() === year);
    const annualGrossInvoiced = yearIncomes.reduce((sum, i) => sum + i.baseAmount, 0);
    const annualExpensesFromInvoices = yearDeductibleExpenses.reduce((sum, e) => sum + (e.deductibleBaseAmount ?? e.baseAmount) + (e.recargoEquivalenciaAmount || 0), 0);
    const annualAmortization = investmentGoods.filter(g => g.isDeductible && new Date(g.purchaseDate).getFullYear() <= year).reduce((sum, good) => {
        const dailyAmortization = (good.acquisitionValue / good.usefulLife) / 365.25;
        const goodStartDate = new Date(good.purchaseDate);
        const effectiveStartDate = goodStartDate < new Date(year, 0, 1) ? new Date(year, 0, 1) : goodStartDate;
        const effectiveEndDate = new Date(year, 11, 31);
        if (effectiveEndDate >= effectiveStartDate && new Date(goodStartDate.getFullYear() + good.usefulLife, goodStartDate.getMonth(), goodStartDate.getDate()) >= effectiveStartDate) {
            const daysInPeriod = (effectiveEndDate.getTime() - effectiveStartDate.getTime()) / (1000 * 3600 * 24) + 1;
            return sum + (daysInPeriod * dailyAmortization);
        }
        return sum;
    }, 0);
    const annualCuotaAutonomo = (settings.monthlyAutonomoFee || 0) * 12;
    const annualTotalDeductibleExpenses = annualExpensesFromInvoices + annualCuotaAutonomo + annualAmortization;
    const annualNetProfitBeforeDeductions = annualGrossInvoiced - annualTotalDeductibleExpenses;
    
    let gastosDificilJustificacion = 0;
    if (settings.applySevenPercentDeduction && annualNetProfitBeforeDeductions > 0) {
        gastosDificilJustificacion = Math.min(2000, annualNetProfitBeforeDeductions * 0.07);
    }
    
    const finalNetProfit = annualNetProfitBeforeDeductions - gastosDificilJustificacion;

    const { totalQuota: cuotaIntegra, breakdown, effectiveRate } = calculateAnnualIRPFBreakdown(finalNetProfit);
    const retencionesSoportadas = yearIncomes.reduce((sum, i) => sum + getCuotaIRPF(i.baseAmount, i.irpfRate), 0);
    // Simplified 130 calculation for the whole year for now
    const pagosACuenta130 = Math.max(0, finalNetProfit * 0.20); // This is a simplification
    const resultadoFinal = cuotaIntegra - retencionesSoportadas - pagosACuenta130;
    
    return { 
        annualNetProfit: finalNetProfit, 
        cuotaIntegra, 
        retencionesSoportadas, 
        pagosACuenta130, 
        resultadoFinal, 
        gastosDificilJustificacion,
        irpfBreakdown: breakdown, 
        effectiveRate 
    };
};

// --- Main Professional View ---
const ProfessionalView: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return <div>Cargando...</div>;
    const { data, saveData } = context;
    const [activeTab, setActiveTab] = useState<ProViewTab>('analisis');
    const [isIncomeModalOpen, setIncomeModalOpen] = useState(false);
    const [incomeToEdit, setIncomeToEdit] = useState<Partial<Income> | null>(null);
    const [isExpenseModalOpen, setExpenseModalOpen] = useState(false);
    const [expenseToEdit, setExpenseToEdit] = useState<Partial<Expense> | null>(null);
    const [isInvestmentModalOpen, setInvestmentModalOpen] = useState(false);
    const [investmentToEdit, setInvestmentToEdit] = useState<Partial<InvestmentGood> | null>(null);
    const [isAiImportModalOpen, setAiImportModalOpen] = useState(false);

    const handleOpenIncomeModal = (income?: Partial<Income>) => { setIncomeToEdit(income || null); setIncomeModalOpen(true); };
    const handleOpenExpenseModal = (expense?: Partial<Expense>) => { setExpenseToEdit(expense || null); setExpenseModalOpen(true); };
    const handleOpenInvestmentModal = (good?: Partial<InvestmentGood>) => { setInvestmentToEdit(good || null); setInvestmentModalOpen(true); };

    const handleDelete = (type: 'income' | 'expense' | 'investment', id: string) => {
        if (!window.confirm('¿Estás seguro de que quieres borrar este elemento?')) return;
        saveData(prev => {
            if (type === 'income') return { ...prev, incomes: prev.incomes.filter(i => i.id !== id) };
            if (type === 'expense') return { ...prev, expenses: prev.expenses.filter(e => e.id !== id) };
            if (type === 'investment') return { ...prev, investmentGoods: prev.investmentGoods.filter(g => g.id !== id) };
            return prev;
        }, "Elemento eliminado.");
    };
    
    const handleAnalysisComplete = (extractedData: Partial<Income> | Partial<Expense> | Partial<InvestmentGood>, type: 'income' | 'expense' | 'investment', file: File) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const attachment: Attachment = { name: file.name, type: file.type, data: (reader.result as string).split(',')[1] };
            const dataWithAttachment = { ...extractedData, attachment };
            if (type === 'income') handleOpenIncomeModal(dataWithAttachment);
            else if (type === 'expense') handleOpenExpenseModal(dataWithAttachment);
            else if (type === 'investment') handleOpenInvestmentModal(dataWithAttachment);
        };
    };
    
    const TabButton: React.FC<{ tabName: ProViewTab; label: string; }> = ({ tabName, label }) => (
        <button onClick={() => setActiveTab(tabName)} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === tabName ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'}`}>
            {label}
        </button>
    );

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap justify-between items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Área Profesional</h2>
                <div title={!data.settings.geminiApiKey ? "Configura tu API Key de Gemini en Ajustes para activar" : "Importar factura con IA"}>
                    <Button onClick={() => setAiImportModalOpen(true)} disabled={!data.settings.geminiApiKey}><Icon name="Sparkles" className="w-5 h-5"/> Importar con IA</Button>
                </div>
            </div>
            <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="-mb-px flex space-x-6 sm:space-x-8 overflow-x-auto" aria-label="Tabs">
                    <TabButton tabName="analisis" label="Dashboard Fiscal" />
                    <TabButton tabName="libros" label="Libros de Registro" />
                    <TabButton tabName="pdf" label="Generar PDFs" />
                </nav>
            </div>
            <div className="pt-4">
                {activeTab === 'libros' && <LibrosRegistroView onEditIncome={handleOpenIncomeModal} onEditExpense={handleOpenExpenseModal} onEditInvestment={handleOpenInvestmentModal} onDelete={handleDelete} />}
                {activeTab === 'analisis' && <AnalisisFiscalView />}
                {activeTab === 'pdf' && <GenerarPDFsView />}
            </div>
            <AiModal 
                isOpen={isAiImportModalOpen} 
                onClose={() => setAiImportModalOpen(false)} 
                onAnalysisComplete={handleAnalysisComplete} 
                apiKey={data.settings.geminiApiKey} 
                professionalCategories={data.professionalCategories}
            />
            <Modal isOpen={isIncomeModalOpen} onClose={() => setIncomeModalOpen(false)} title={incomeToEdit?.id ? "Editar Factura Emitida" : "Nueva Factura Emitida"}><IncomeForm onClose={() => setIncomeModalOpen(false)} incomeToEdit={incomeToEdit} /></Modal>
            <Modal isOpen={isExpenseModalOpen} onClose={() => setExpenseModalOpen(false)} title={expenseToEdit?.id ? "Editar Factura Recibida" : "Nueva Factura Recibida"}><ExpenseForm onClose={() => setExpenseModalOpen(false)} expenseToEdit={expenseToEdit} /></Modal>
            <Modal isOpen={isInvestmentModalOpen} onClose={() => setInvestmentModalOpen(false)} title={investmentToEdit?.id ? "Editar Bien de Inversión" : "Nuevo Bien de Inversión"}><InvestmentGoodForm onClose={() => setInvestmentModalOpen(false)} goodToEdit={investmentToEdit} /></Modal>
        </div>
    );
};

// --- View Components for Tabs ---
const IncomeBook: React.FC<{ onEdit: (income?: Partial<Income>) => void; onDelete: (id: string) => void; }> = ({ onEdit, onDelete }) => {
    const { data, formatCurrency } = useContext(AppContext)!;
    const { incomes } = data;
    return (
        <Card>
            <div className="flex flex-wrap gap-2 justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Libro de Ingresos</h3>
                <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => generateIncomesPDF(incomes)} disabled={incomes.length === 0}><Icon name="Download" className="w-4 h-4" /> PDF</Button>
                    <Button onClick={() => onEdit()}><Icon name="Plus" /> Añadir Ingreso</Button>
                </div>
            </div>
             <div className="overflow-y-auto max-h-[40rem] mt-4">
                <div className="divide-y divide-slate-200/50 dark:divide-white/10">
                    {incomes.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(inc => (
                        <div key={inc.id} className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-3 transition-colors ${!inc.isPaid ? 'opacity-60 italic' : ''}`}>
                            <div className="flex items-center gap-4 flex-grow min-w-[200px]">
                                <div className="p-2 rounded-lg bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 flex-shrink-0">
                                    <Icon name="TrendingUp" className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-semibold">{inc.concept || inc.invoiceNumber}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{inc.clientName} - {formatDate(inc.date)}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 w-full basis-auto justify-end">
                                <div className="text-right">
                                    <p className="font-semibold whitespace-nowrap text-green-500">
                                        {formatCurrency(getTotalFacturaEmitida(inc))}
                                    </p>
                                    {!inc.isPaid && <span className="text-xs text-yellow-500">Pendiente</span>}
                                </div>
                                <div className="flex items-center">
                                   {inc.attachment && <Button size="sm" variant="ghost" onClick={() => handleDownloadAttachment(inc.attachment!)} title={inc.attachment.name}><Icon name="Paperclip" className="w-4 h-4" /></Button>}
                                   <Button size="sm" variant="ghost" onClick={() => onEdit(inc)} title="Editar"><Icon name="Pencil" className="w-4 h-4" /></Button>
                                   <Button size="sm" variant="ghost" onClick={() => onDelete(inc.id)} title="Eliminar"><Icon name="Trash2" className="w-4 h-4 text-red-500" /></Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Card>
    );
};

const UnifiedExpenseBook: React.FC<{
    onEditExpense: (expense?: Partial<Expense>) => void;
    onEditInvestment: (good?: Partial<InvestmentGood>) => void;
    onDelete: (type: 'expense' | 'investment', id: string) => void;
}> = ({ onEditExpense, onEditInvestment, onDelete }) => {
    const { data, formatCurrency } = useContext(AppContext)!;
    const { expenses, investmentGoods } = data;

    type UnifiedExpenseItem = 
        | (Expense & { itemType: 'expense' })
        | (InvestmentGood & { itemType: 'investment' });

    const unifiedExpenses = useMemo<UnifiedExpenseItem[]>(() => {
        const expenseItems: UnifiedExpenseItem[] = expenses.map(e => ({ ...e, itemType: 'expense' }));
        const investmentItems: UnifiedExpenseItem[] = investmentGoods.map(g => ({ ...g, itemType: 'investment' }));

        const allItems = [...expenseItems, ...investmentItems];
        
        return allItems.sort((a, b) => {
            const dateA = new Date(a.itemType === 'investment' ? a.purchaseDate : a.date);
            const dateB = new Date(b.itemType === 'investment' ? b.purchaseDate : b.date);
            return dateB.getTime() - dateA.getTime();
        });
    }, [expenses, investmentGoods]);
    
    return (
        <Card>
            <div className="flex flex-wrap gap-2 justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Libro de Gastos y Bienes de Inversión</h3>
                <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => generateExpensesPDF(expenses, investmentGoods)} disabled={unifiedExpenses.length === 0}><Icon name="Download" className="w-4 h-4" /> PDF</Button>
                    <Button onClick={() => onEditExpense()}><Icon name="Plus" /> Añadir Gasto</Button>
                    <Button onClick={() => onEditInvestment()} variant="secondary"><Icon name="Plus" /> Añadir Bien Inversión</Button>
                </div>
            </div>
             <div className="overflow-y-auto max-h-[40rem] mt-4">
                <div className="divide-y divide-slate-200/50 dark:divide-white/10">
                    {unifiedExpenses.map(item => {
                        const isExpense = item.itemType === 'expense';
                        const date = isExpense ? item.date : item.purchaseDate;
                        const concept = isExpense ? item.concept : item.description;
                        const provider = item.providerName;
                        const base = isExpense ? item.baseAmount : item.acquisitionValue;
                        const vatRate = item.vatRate;
                        const vatAmount = base * (vatRate / 100);
                        const total = base + vatAmount;

                        return (
                             <div key={`${item.itemType}-${item.id}`} className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-3 transition-colors ${!item.isPaid ? 'opacity-60 italic' : ''}`}>
                                <div className="flex items-center gap-4 flex-grow min-w-[200px]">
                                    <div className={`p-2 rounded-lg ${isExpense ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' : 'bg-slate-200 text-slate-800 dark:bg-slate-600 dark:text-slate-200'} flex-shrink-0`}>
                                        <Icon name={isExpense ? 'TrendingDown' : 'Package'} className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-semibold">{concept}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{provider} - {formatDate(date)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 w-full basis-auto justify-end">
                                    <div className="text-right">
                                        <p className="font-semibold whitespace-nowrap text-red-500">
                                            {formatCurrency(total)}
                                        </p>
                                        {!item.isPaid && <span className="text-xs text-yellow-500">Pendiente</span>}
                                    </div>
                                    <div className="flex items-center">
                                       {item.attachment && <Button size="sm" variant="ghost" onClick={() => handleDownloadAttachment(item.attachment!)} title={item.attachment.name}><Icon name="Paperclip" className="w-4 h-4" /></Button>}
                                       <Button size="sm" variant="ghost" onClick={() => isExpense ? onEditExpense(item) : onEditInvestment(item)} title="Editar"><Icon name="Pencil" className="w-4 h-4" /></Button>
                                       <Button size="sm" variant="ghost" onClick={() => onDelete(item.itemType, item.id)} title="Eliminar"><Icon name="Trash2" className="w-4 h-4 text-red-500" /></Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </Card>
    );
};

const LibrosRegistroView: React.FC<{
    onEditIncome: (income?: Partial<Income>) => void; 
    onEditExpense: (expense?: Partial<Expense>) => void; 
    onEditInvestment: (good?: Partial<InvestmentGood>) => void; 
    onDelete: (type: 'income' | 'expense' | 'investment', id: string) => void;
}> = ({ onEditIncome, onEditExpense, onEditInvestment, onDelete }) => {
    return (
        <div className="space-y-8">
            <IncomeBook onEdit={onEditIncome} onDelete={(id) => onDelete('income', id)} />
            <UnifiedExpenseBook 
                onEditExpense={onEditExpense}
                onEditInvestment={onEditInvestment}
                onDelete={onDelete}
            />
        </div>
    );
};


const AnalisisFiscalView: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return <div>Cargando...</div>;
    const { data, formatCurrency } = context;
    const { incomes, expenses, investmentGoods, settings } = data;

    const [period, setPeriod] = useState<{ startDate: Date; endDate: Date }>(() => {
        const now = new Date();
        const year = now.getFullYear();
        const quarter = Math.floor(now.getMonth() / 3);
        return {
            startDate: new Date(year, quarter * 3, 1),
            endDate: new Date(year, quarter * 3 + 3, 0, 23, 59, 59, 999),
        };
    });

    const handlePeriodChange = useCallback((startDate: Date, endDate: Date) => {
        setPeriod({ startDate, endDate });
    }, []);

    const availableYears = useMemo(() => {
        const years = new Set<number>();
        incomes.forEach(i => years.add(new Date(i.date).getFullYear()));
        expenses.forEach(e => years.add(new Date(e.date).getFullYear()));
        if (years.size === 0) years.add(new Date().getFullYear());
        return Array.from(years).sort((a, b) => b - a);
    }, [incomes, expenses]);
    
    const [rentaYear, setRentaYear] = useState<number>(availableYears[0] || new Date().getFullYear());

    const fiscalCalculations = useMemo(() => {
        // --- Period Calculations (303, 130, 111, 115) ---
        const periodIncomes = incomes.filter(i => new Date(i.date) >= period.startDate && new Date(i.date) <= period.endDate);
        const periodExpenses = expenses.filter(e => new Date(e.date) >= period.startDate && new Date(e.date) <= period.endDate);
        const periodDeductibleExpenses = periodExpenses.filter(e => e.isDeductible);
        
        // KPIs
        const kpiTotalInvoiced = periodIncomes.reduce((sum, i) => sum + i.baseAmount, 0);
        const kpiTotalExpenses = periodExpenses.reduce((sum, e) => sum + e.baseAmount, 0);
        const kpiGrossProfit = kpiTotalInvoiced - kpiTotalExpenses;
        const kpiProfitMargin = kpiTotalInvoiced > 0 ? (kpiGrossProfit / kpiTotalInvoiced) * 100 : 0;
        const kpis = { kpiTotalInvoiced, kpiTotalExpenses, kpiGrossProfit, kpiProfitMargin };

        // 303
        const ivaRepercutido = periodIncomes.reduce((sum, i) => sum + getCuotaIVA(i.baseAmount, i.vatRate), 0);
        const ivaSoportadoFromExpenses = periodDeductibleExpenses
            .filter(e => !e.recargoEquivalenciaAmount) // Exclude VAT from RE purchases
            .reduce((sum, e) => sum + getCuotaIVA(e.baseAmount, e.vatRate), 0);
        const ivaSoportadoFromGoods = investmentGoods
            .filter(g => g.isDeductible && new Date(g.purchaseDate) >= period.startDate && new Date(g.purchaseDate) <= period.endDate)
            .reduce((sum, g) => sum + getCuotaIVA(g.acquisitionValue, g.vatRate), 0);
        const ivaSoportado = ivaSoportadoFromExpenses + ivaSoportadoFromGoods;
        const model303 = { ivaRepercutido, ivaSoportado, result: ivaRepercutido - ivaSoportado };

        // 111 & 115
        const model111 = periodExpenses.reduce((sum, e) => sum + (e.irpfRetentionAmount && !e.isRentalExpense ? e.irpfRetentionAmount : 0), 0);
        const model115 = periodExpenses.reduce((sum, e) => sum + (e.irpfRetentionAmount && e.isRentalExpense ? e.irpfRetentionAmount : 0), 0);

        // 130 - complex calculation
        const yearOfPeriod = period.startDate.getFullYear();
        const quarterOfPeriod = Math.floor(period.startDate.getMonth() / 3) + 1;
        
        const incomesYTD = incomes.filter(i => { const d = new Date(i.date); return d.getFullYear() === yearOfPeriod && d <= period.endDate; });
        const expensesYTD = expenses.filter(e => { const d = new Date(e.date); return d.getFullYear() === yearOfPeriod && d <= period.endDate && e.isDeductible; });
        
        const grossYTD = incomesYTD.reduce((sum, i) => sum + i.baseAmount, 0);
        const expensesFromInvoicesYTD = expensesYTD.reduce((sum, e) => sum + (e.deductibleBaseAmount ?? e.baseAmount) + (e.recargoEquivalenciaAmount || 0), 0);
        const amortizationYTD = investmentGoods.filter(g => g.isDeductible).reduce((sum, good) => {
             const dailyAmortization = (good.acquisitionValue / good.usefulLife) / 365.25;
             const goodStartDate = new Date(good.purchaseDate);
             if (goodStartDate.getFullYear() > yearOfPeriod) return sum;
             const effectiveStartDate = goodStartDate < new Date(yearOfPeriod, 0, 1) ? new Date(yearOfPeriod, 0, 1) : goodStartDate;
             const effectiveEndDate = period.endDate;
             const days = (effectiveEndDate.getTime() - effectiveStartDate.getTime()) / (1000 * 3600 * 24) + 1;
             return sum + (days * dailyAmortization);
        }, 0);
        const autonomoFeeYTD = (settings.monthlyAutonomoFee || 0) * (quarterOfPeriod * 3);
        const deductibleExpensesYTD = expensesFromInvoicesYTD + amortizationYTD + autonomoFeeYTD;
        const netProfitYTD = grossYTD - deductibleExpensesYTD;
        const quoteYTD = netProfitYTD * 0.20;
        const retencionesSoportadasYTD = incomesYTD.reduce((sum, i) => sum + getCuotaIRPF(i.baseAmount, i.irpfRate), 0);
        
        // Previous 130 payments
        let pagosAnteriores130 = 0;
        // This is a simplified calculation. A real one would store the results.
        const model130 = {
            netProfit: netProfitYTD,
            quote: quoteYTD,
            retenciones: retencionesSoportadasYTD,
            previousPayments: pagosAnteriores130,
            result: Math.max(0, quoteYTD - retencionesSoportadasYTD - pagosAnteriores130)
        };
        
        // Model 349
        const opsByNif349: { [nif: string]: { name: string; total: number; key: 'E' | 'A' } } = {};
        periodIncomes
            .filter(i => i.isIntraCommunity)
            .forEach(i => {
                if (!i.clientNif) return;
                opsByNif349[i.clientNif] = opsByNif349[i.clientNif] || { name: i.clientName, total: 0, key: 'E' };
                opsByNif349[i.clientNif].total += i.baseAmount;
            });
        periodExpenses
            .filter(e => e.isIntraCommunity)
            .forEach(e => {
                if (!e.providerNif) return;
                opsByNif349[e.providerNif] = opsByNif349[e.providerNif] || { name: e.providerName, total: 0, key: 'A' };
                opsByNif349[e.providerNif].total += e.baseAmount;
            });
        const model349 = Object.entries(opsByNif349).map(([nif, data]) => ({ nif, ...data }));


        // --- Annual Calculations ---
        const yearIncomes = incomes.filter(i => new Date(i.date).getFullYear() === rentaYear);
        const yearExpenses = expenses.filter(e => new Date(e.date).getFullYear() === rentaYear);
        
        // 390
        const annualIVARepercutido = yearIncomes.reduce((sum, i) => sum + getCuotaIVA(i.baseAmount, i.vatRate), 0);
        const annualIVASoportado = yearExpenses
            .filter(e => e.isDeductible && !e.recargoEquivalenciaAmount)
            .reduce((sum, e) => sum + getCuotaIVA(e.baseAmount, e.vatRate), 0) + 
            investmentGoods
            .filter(g => g.isDeductible && new Date(g.purchaseDate).getFullYear() === rentaYear)
            .reduce((sum, g) => sum + getCuotaIVA(g.acquisitionValue, g.vatRate), 0);
        const model390 = { ivaRepercutido: annualIVARepercutido, ivaSoportado: annualIVASoportado, result: annualIVARepercutido - annualIVASoportado };
        
        // 190 & 180
        const model190 = yearExpenses.reduce((sum, e) => sum + (e.irpfRetentionAmount && !e.isRentalExpense ? e.irpfRetentionAmount : 0), 0);
        const model180 = yearExpenses.reduce((sum, e) => sum + (e.irpfRetentionAmount && e.isRentalExpense ? e.irpfRetentionAmount : 0), 0);

        // 347
        const opsByNif: { [nif: string]: { name: string, total: number } } = {};
        yearIncomes.forEach(i => {
            if (!i.clientNif) return;
            opsByNif[i.clientNif] = opsByNif[i.clientNif] || { name: i.clientName, total: 0 };
            opsByNif[i.clientNif].total += getTotalFacturaEmitida(i);
        });
        yearExpenses.forEach(e => {
            if (!e.providerNif) return;
            opsByNif[e.providerNif] = opsByNif[e.providerNif] || { name: e.providerName, total: 0 };
            opsByNif[e.providerNif].total += e.baseAmount + getCuotaIVA(e.baseAmount, e.vatRate);
        });
        const model347 = Object.entries(opsByNif).map(([nif, data]) => ({ nif, ...data })).filter(op => op.total > 3005.06);

        // 100
        const model100 = calculateAnnualRent(rentaYear, data);

        return { kpis, model303, model130, model111, model115, model349, model390, model190, model180, model347, model100 };
    }, [period, rentaYear, data]);
    
    const periodQuarter = Math.floor(period.startDate.getMonth() / 3) + 1;
    const periodYear = period.startDate.getFullYear();
    const quarterlyStatus = useMemo(() => checkFilingPeriod('303/130/111/115', periodYear, periodQuarter), [periodYear, periodQuarter]);
    const annualStatus100 = useMemo(() => checkFilingPeriod('100', rentaYear, 0), [rentaYear]);
    const annualStatus390 = useMemo(() => checkFilingPeriod('390', rentaYear, 0), [rentaYear]);
    const annualStatus347 = useMemo(() => checkFilingPeriod('347', rentaYear, 0), [rentaYear]);


    return (
        <div className="space-y-8">
            {/* --- Period Selection --- */}
            <PeriodSelector onPeriodChange={handlePeriodChange} />

            {/* --- Business Health KPIs --- */}
            <section>
                <h3 className="text-xl font-bold mb-4">Resumen del Periodo ({periodQuarter}T {periodYear})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    <Card><h4 className="text-sm font-medium text-slate-500">Total Facturado (Base)</h4><p className="text-2xl font-bold">{formatCurrency(fiscalCalculations.kpis.kpiTotalInvoiced)}</p></Card>
                    <Card><h4 className="text-sm font-medium text-slate-500">Gastos Totales</h4><p className="text-2xl font-bold">{formatCurrency(fiscalCalculations.kpis.kpiTotalExpenses)}</p></Card>
                    <Card><h4 className="text-sm font-medium text-slate-500">Beneficio Bruto</h4><p className={`text-2xl font-bold ${fiscalCalculations.kpis.kpiGrossProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(fiscalCalculations.kpis.kpiGrossProfit)}</p></Card>
                    <Card><h4 className="text-sm font-medium text-slate-500">Margen de Beneficio</h4><p className={`text-2xl font-bold ${fiscalCalculations.kpis.kpiProfitMargin >= 0 ? 'text-green-500' : 'text-red-500'}`}>{fiscalCalculations.kpis.kpiProfitMargin.toFixed(2)}%</p></Card>
                </div>
            </section>
            
            {/* --- Quarterly Liquidation Models --- */}
            <section>
                <h3 className="text-xl font-bold mb-4">Liquidaciones del Periodo ({periodQuarter}T {periodYear})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {/* Model 303 */}
                    <Card><ModelCardHeader model="303 (IVA)" tutorialLink="http://www.youtube.com/watch?v=N7IdGTRpe8o" link="https://sede.agenciatributaria.gob.es/Sede/iva/presentar-declaracion-iva-modelo-303/formas-presentacion-modelo-303.html" tooltip="Declaración trimestral del IVA. Diferencia entre el IVA cobrado y el pagado." /><div className="mt-4 space-y-2 text-sm"><ModelRow label="IVA Repercutido" value={fiscalCalculations.model303.ivaRepercutido} color="green" /><ModelRow label="IVA Soportado Deducible" value={fiscalCalculations.model303.ivaSoportado} color="red" negative /><ModelResult label="Resultado IVA" value={fiscalCalculations.model303.result} resultText={v => v >= 0 ? 'A Pagar' : 'A Compensar'} /></div><StatusFooter status={quarterlyStatus} /></Card>
                    {/* Model 130 */}
                    <Card><ModelCardHeader model="130 (IRPF)" tutorialLink="http://www.youtube.com/watch?v=UHABkojAhHE" link="https://sede.agenciatributaria.gob.es/Sede/ayuda/consultas-informaticas/presentacion-declaraciones-ayuda-tecnica/modelo-130.html" tooltip="Pago a cuenta trimestral del 20% sobre el rendimiento neto acumulado del año." /><div className="mt-4 space-y-2 text-sm"><ModelRow label="Rendimiento Neto (Acum.)" value={fiscalCalculations.model130.netProfit} /><ModelRow label="Cuota (20%)" value={fiscalCalculations.model130.quote} /><ModelRow label="Retenciones Soportadas" value={fiscalCalculations.model130.retenciones} color="green" negative /><ModelResult label="Resultado IRPF" value={fiscalCalculations.model130.result} resultText={() => 'A Pagar'} /></div><StatusFooter status={quarterlyStatus} /></Card>
                    {/* Model 111 */}
                    {settings.hiresProfessionals && <Card><ModelCardHeader model="111 (Retenciones Prof.)" tutorialLink="http://www.youtube.com/watch?v=UDoDQgFHNu4" link="https://sede.agenciatributaria.gob.es/Sede/procedimientoini/GH01.shtml" tooltip="Ingreso trimestral de las retenciones de IRPF practicadas en facturas de otros profesionales." /><div className="mt-4 space-y-2 text-sm"><ModelResult label="Total a Ingresar" value={fiscalCalculations.model111} resultText={() => 'A Pagar'} /></div><StatusFooter status={quarterlyStatus} /></Card>}
                    {/* Model 115 */}
                    {settings.rentsOffice && <Card><ModelCardHeader model="115 (Retenciones Alq.)" tutorialLink="http://www.youtube.com/watch?v=fMfRZo2DvH0" link="https://sede.agenciatributaria.gob.es/Sede/procedimientoini/GH02.shtml" tooltip="Ingreso trimestral de las retenciones de IRPF practicadas en la factura del alquiler de tu local u oficina." /><div className="mt-4 space-y-2 text-sm"><ModelResult label="Total a Ingresar" value={fiscalCalculations.model115} resultText={() => 'A Pagar'} /></div><StatusFooter status={quarterlyStatus} /></Card>}
                </div>
                 {/* Model 349 */}
                {settings.isInROI && <Card className="mt-6">
                    <ModelCardHeader model="349 (Op. Intracomunitarias)" tutorialLink="http://www.youtube.com/watch?v=mAiFQB-5GYc" link="https://sede.agenciatributaria.gob.es/Sede/procedimientoini/GI28.shtml" tooltip="Declaración informativa de compras (adquisiciones) y ventas (entregas) a empresas de otros países de la Unión Europea." />
                    <div className="mt-4">
                        {fiscalCalculations.model349.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400">
                                        <tr>
                                            <th className="px-4 py-2">NIF Intracomunitario</th>
                                            <th className="px-4 py-2">Nombre / Razón Social</th>
                                            <th className="px-4 py-2 text-center">Clave</th>
                                            <th className="px-4 py-2 text-right">Importe</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {fiscalCalculations.model349.map(op => (
                                            <tr key={op.nif} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                                <td className="px-4 py-2 font-mono text-xs">{op.nif}</td>
                                                <td className="px-4 py-2">{op.name}</td>
                                                <td className="px-4 py-2 text-center font-semibold">
                                                    <span title={op.key === 'E' ? 'Entrega de Bienes/Servicios' : 'Adquisición de Bienes/Servicios'}>
                                                        {op.key}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 text-right font-bold">{formatCurrency(op.total)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-center text-slate-500 py-4">No se han registrado operaciones intracomunitarias en este periodo.</p>
                        )}
                    </div>
                    <StatusFooter status={quarterlyStatus} />
                </Card>}
            </section>
            
            <div className="border-t dark:border-slate-700 pt-8" />
            
            {/* --- Annual Models --- */}
            <section>
                 <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                    <h3 className="text-xl font-bold">Declaraciones y Resúmenes Anuales</h3>
                    <div className="w-full sm:w-auto"><Select label="Seleccionar Año Fiscal" value={rentaYear} onChange={e => setRentaYear(parseInt(e.target.value))}>{availableYears.map(year => <option key={year} value={year}>{year}</option>)}</Select></div>
                </div>

                {/* Model 100 */}
                <Card className="mb-8">
                    <ModelCardHeader model={`100 (Declaración de la Renta ${rentaYear})`} tutorialLink="http://www.youtube.com/watch?v=_cVdVrUzjPI" link="https://sede.agenciatributaria.gob.es/Sede/irpf/tengo-que-presentar-declaracion/modelo-100-i-sobre-r-anual.html" tooltip="Declaración anual que resume todos tus rendimientos del año para calcular el IRPF final." />
                     <div className="mt-4 space-y-2 text-sm">
                        <ModelRow label="Rendimiento Neto Anual" value={fiscalCalculations.model100.annualNetProfit} />
                        {settings.applySevenPercentDeduction && fiscalCalculations.model100.gastosDificilJustificacion > 0 && (
                            <ModelRow label="Gastos Difícil Justificación (7%)" value={fiscalCalculations.model100.gastosDificilJustificacion} color="red" negative />
                        )}
                        <ModelRow label="Cuota Íntegra (Total IRPF)" value={fiscalCalculations.model100.cuotaIntegra} />
                        <hr className="dark:border-slate-700 my-1"/>
                        <ModelRow label="Retenciones Soportadas" value={fiscalCalculations.model100.retencionesSoportadas} color="green" negative />
                        <ModelRow label="Pagos a Cuenta (Mod. 130)" value={fiscalCalculations.model100.pagosACuenta130} color="green" negative />
                        <ModelResult label="Resultado Final" value={fiscalCalculations.model100.resultadoFinal} resultText={v => v >= 0 ? 'A PAGAR' : 'A DEVOLVER'} isAbsolute />
                    </div>
                    <StatusFooter status={annualStatus100} customText={`para la declaración del año ${rentaYear}`}/>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {/* Model 390 */}
                    <Card><ModelCardHeader model="390 (Resumen IVA)" tutorialLink="http://www.youtube.com/watch?v=yVtU7kjaZeo" link="https://sede.agenciatributaria.gob.es/Sede/procedimientoini/G412.shtml" tooltip="Resumen anual informativo de todas tus declaraciones de IVA (Modelo 303) del año." /><div className="mt-4 space-y-2 text-sm"><ModelRow label="Total IVA Repercutido" value={fiscalCalculations.model390.ivaRepercutido} color="green" /><ModelRow label="Total IVA Soportado" value={fiscalCalculations.model390.ivaSoportado} color="red" negative /><ModelResult label="Resultado Anual" value={fiscalCalculations.model390.result} /></div><StatusFooter status={annualStatus390} customText={`para la declaración del año ${rentaYear}`}/></Card>
                    {/* Model 190 */}
                    {settings.hiresProfessionals && <Card><ModelCardHeader model="190 (Resumen Ret. Prof.)" tutorialLink="http://www.youtube.com/watch?v=PHbwM2KjdY4" link="https://sede.agenciatributaria.gob.es/Sede/procedimientoini/GI10.shtml" tooltip="Resumen anual de las retenciones a profesionales (Modelo 111), identificando a cada perceptor." /><div className="mt-4 space-y-2 text-sm"><ModelResult label="Total Retenido" value={fiscalCalculations.model190} /></div><StatusFooter status={annualStatus390} customText={`para la declaración del año ${rentaYear}`}/></Card>}
                    {/* Model 180 */}
                    {settings.rentsOffice && <Card><ModelCardHeader model="180 (Resumen Ret. Alq.)" tutorialLink="http://www.youtube.com/watch?v=FA_IcE6UwW0" link="https://sede.agenciatributaria.gob.es/Sede/procedimientoini/GI00.shtml" tooltip="Resumen anual de las retenciones de alquileres (Modelo 115), identificando a cada arrendador." /><div className="mt-4 space-y-2 text-sm"><ModelResult label="Total Retenido" value={fiscalCalculations.model180} /></div><StatusFooter status={annualStatus390} customText={`para la declaración del año ${rentaYear}`}/></Card>}
                    {/* Dummy Card to fill space, as 349 is now below */}
                    <div className="hidden lg:block"></div>
                </div>

                {/* Model 347 */}
                <Card className="mt-6">
                    <ModelCardHeader model="347 (Operaciones con Terceros)" tutorialLink="http://www.youtube.com/watch?v=2rsiDQPOiQk" link="https://sede.agenciatributaria.gob.es/Sede/procedimientoini/GI27.shtml" tooltip="Declaración informativa anual de clientes y proveedores con los que has superado 3.005,06€ de operaciones." />
                    <div className="mt-4">
                        {fiscalCalculations.model347.length > 0 ? (
                            <ul className="space-y-2 text-sm max-h-60 overflow-y-auto pr-2">{fiscalCalculations.model347.map(op => (
                                <li key={op.nif} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-700 rounded-md">
                                    <div><p className="font-semibold">{op.name}</p><p className="text-xs text-slate-500">{op.nif}</p></div>
                                    <p className="font-bold">{formatCurrency(op.total)}</p>
                                </li>
                            ))}</ul>
                        ) : (
                            <p className="text-center text-slate-500 py-4">No se han detectado operaciones superiores a 3.005,06€ con ningún tercero este año.</p>
                        )}
                    </div>
                    <StatusFooter status={annualStatus347} customText={`para la declaración del año ${rentaYear}`}/>
                </Card>
            </section>
        </div>
    );
};

// --- UI Components for AnalisisFiscalView ---
const ModelCardHeader: React.FC<{model: string, link: string, tooltip: string, tutorialLink: string}> = ({model, link, tooltip, tutorialLink}) => (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h4 className="text-lg font-bold">
            Modelo {model}
        </h4>
        <div className="flex items-center gap-x-2 flex-shrink-0">
            <a href={link} target="_blank" rel="noopener noreferrer" title="Presentar en la Sede Electrónica">
                <Icon name="ExternalLink" className="w-4 h-4 text-primary-500 hover:text-primary-700" />
            </a>
            <a href={tutorialLink} target="_blank" rel="noopener noreferrer" title="Ver tutorial en YouTube">
                <Icon name="Play" className="w-4 h-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" />
            </a>
            <HelpTooltip content={tooltip} />
        </div>
    </div>
);
const ModelRow: React.FC<{label: string, value: number, color?: 'green' | 'red', negative?: boolean}> = ({label, value, color, negative}) => {
    const { formatCurrency } = useContext(AppContext)!;
    const colorClass = color === 'green' ? 'text-green-500' : color === 'red' ? 'text-red-500' : '';
    return <div className="flex justify-between"><p>{label}:</p><p className={`font-semibold ${colorClass}`}>{negative && value > 0 ? '-' : ''}{formatCurrency(value)}</p></div>
};
const ModelResult: React.FC<{label: string, value: number, resultText?: (v: number) => string, isAbsolute?: boolean}> = ({label, value, resultText, isAbsolute}) => {
    const { formatCurrency } = useContext(AppContext)!;
    const finalValue = isAbsolute ? Math.abs(value) : value;
    const colorClass = value >= 0 ? 'text-red-600' : 'text-green-600';
    return <div className="flex justify-between text-base pt-2 border-t dark:border-slate-700"><p className="font-bold">{label}:</p><p className={`font-bold ${colorClass}`}>{formatCurrency(finalValue)} {resultText && `(${resultText(value)})`}</p></div>
};
const StatusFooter: React.FC<{status: {isOpen: boolean, text: string}, customText?: string}> = ({status, customText}) => (
    <div className={`mt-4 text-xs font-semibold text-right ${status.isOpen ? 'text-green-600' : 'text-red-600'}`}>
        {status.text} {customText}
    </div>
);

const GenerarPDFsView: React.FC = () => {
    const { data } = useContext(AppContext)!;
    const [documentType, setDocumentType] = useState<'incomeBook' | 'expenseBook' | 'fullReport'>('fullReport');
    const [period, setPeriod] = useState<{ startDate: Date; endDate: Date }>(() => {
        const now = new Date();
        const year = now.getFullYear();
        const quarter = Math.floor(now.getMonth() / 3);
        return {
            startDate: new Date(year, quarter * 3, 1),
            endDate: new Date(year, quarter * 3 + 3, 0, 23, 59, 59, 999),
        };
    });

    const handlePeriodChange = useCallback((startDate: Date, endDate: Date) => setPeriod({ startDate, endDate }), []);

    const handleGenerate = () => {
        const { startDate, endDate } = period;

        const filteredIncomes = data.incomes.filter(i => new Date(i.date) >= startDate && new Date(i.date) <= endDate);
        const filteredExpenses = data.expenses.filter(e => new Date(e.date) >= startDate && new Date(e.date) <= endDate);
        const filteredInvestmentGoods = data.investmentGoods.filter(g => new Date(g.purchaseDate) >= startDate && new Date(g.purchaseDate) <= endDate);
        const filteredTransfers = data.transfers.filter(t => new Date(t.date) >= startDate && new Date(t.date) <= endDate);

        switch (documentType) {
            case 'incomeBook':
                generateIncomesPDF(filteredIncomes, { allExpenses: data.expenses, allInvestmentGoods: data.investmentGoods, settings: data.settings, period });
                break;
            case 'expenseBook':
                generateExpensesPDF(filteredExpenses, filteredInvestmentGoods, { allIncomes: data.incomes, allInvestmentGoods: data.investmentGoods, settings: data.settings, period });
                break;
            case 'fullReport':
                const deductibleExpenses = filteredExpenses.filter(e => e.isDeductible);
                const totalGrossInvoiced = filteredIncomes.reduce((sum, i) => sum + i.baseAmount, 0);
                const totalExpensesFromInvoices = deductibleExpenses.reduce((sum, e) => sum + (e.deductibleBaseAmount ?? e.baseAmount), 0);

                const totalAmortization = data.investmentGoods.filter(g => g.isDeductible).reduce((sum, good) => {
                    const dailyAmortization = (good.acquisitionValue / good.usefulLife) / 365.25;
                    const goodStartDate = new Date(good.purchaseDate);
                    const goodEndDate = new Date(goodStartDate.getFullYear() + good.usefulLife, goodStartDate.getMonth(), goodStartDate.getDate());
                    const effectiveStartDate = goodStartDate > startDate ? goodStartDate : startDate;
                    const effectiveEndDate = goodEndDate < endDate ? goodEndDate : endDate;
                    if (effectiveEndDate > effectiveStartDate) {
                        const daysInPeriod = (effectiveEndDate.getTime() - effectiveStartDate.getTime()) / (1000 * 3600 * 24) + 1;
                        return sum + (daysInPeriod * dailyAmortization);
                    }
                    return sum;
                }, 0);
                
                const monthsInPeriod = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth()) + 1;
                const cuotaAutonomo = (data.settings.monthlyAutonomoFee || 0) * monthsInPeriod;
                
                const totalDeductibleExpenses = totalExpensesFromInvoices + cuotaAutonomo + totalAmortization;
                const netProfit = totalGrossInvoiced - totalDeductibleExpenses;
                
                const ivaRepercutido = filteredIncomes.reduce((sum, i) => sum + getCuotaIVA(i.baseAmount, i.vatRate), 0);
                const ivaSoportadoFromExpenses = deductibleExpenses.reduce((sum, e) => sum + getCuotaIVA(e.baseAmount, e.vatRate), 0);
                const ivaSoportadoFromGoods = data.investmentGoods.filter(g => g.isDeductible && new Date(g.purchaseDate) >= startDate && new Date(g.purchaseDate) <= endDate).reduce((sum, g) => sum + getCuotaIVA(g.acquisitionValue, g.vatRate), 0);
                const ivaSoportado = ivaSoportadoFromExpenses + ivaSoportadoFromGoods;
                const vatResult = ivaRepercutido - ivaSoportado;
                const irpfToPay = netProfit * 0.2;

                const summary = {
                    totalGrossInvoiced,
                    totalExpenses: totalDeductibleExpenses,
                    netProfit,
                    ivaRepercutido,
                    ivaSoportado,
                    vatResult,
                    irpfToPay: Math.max(0, irpfToPay)
                };

                generateComprehensivePeriodPDF(filteredIncomes, deductibleExpenses, data.investmentGoods.filter(g => g.isDeductible), filteredTransfers, data.settings, { startDate, endDate }, summary);
                break;
        }
    };

    return (
        <Card>
            <h3 className="text-xl font-bold mb-4">Generador de Documentos PDF</h3>
            <div className="space-y-4">
                <Select label="Tipo de Documento" value={documentType} onChange={e => setDocumentType(e.target.value as any)}>
                    <option value="fullReport">Informe Fiscal Completo</option>
                    <option value="incomeBook">Libro de Facturas Emitidas</option>
                    <option value="expenseBook">Libro de Gastos y Bienes de Inversión</option>
                </Select>
                <div>
                    <p className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Selecciona el Periodo</p>
                    <PeriodSelector onPeriodChange={handlePeriodChange} />
                </div>
                <div className="flex justify-end pt-4">
                    <Button onClick={handleGenerate}>
                        <Icon name="Download" className="w-5 h-5" /> Generar PDF
                    </Button>
                </div>
            </div>
        </Card>
    );
};

export default ProfessionalView;