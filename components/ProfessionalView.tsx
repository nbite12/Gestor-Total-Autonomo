import React, { useState, useContext, useMemo, useCallback } from 'react';
import { AppContext } from '../App';
import { Income, Expense, Attachment, InvestmentGood, AppData, MoneyLocation } from '../types';
import { Card, Button, Modal, Input, Select, Icon, HelpTooltip, Switch } from './ui';
import { IRPF_BRACKETS } from '../constants';
import { extractInvoiceData } from '../services/geminiService';
import { generateIncomesPDF, generateExpensesPDF, generateInvestmentGoodsPDF, generateComprehensivePeriodPDF } from '../services/pdfService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
// FIX: Imported PeriodSelector component to fix 'Cannot find name' error.
import { PeriodSelector } from './PeriodSelector';
import { IncomeForm, ExpenseForm, InvestmentGoodForm } from './TransactionForms';

// --- Type definitions ---
type ProViewTab = 'libros' | 'impuestos' | 'renta' | 'resumen';
type Quarter = 1 | 2 | 3 | 4;

// --- Helper Functions ---
const formatDate = (isoDate: string | Date) => new Date(isoDate).toLocaleDateString('es-ES');
const getCuotaIVA = (base: number, rate: number) => base * (rate / 100);
const getCuotaIRPF = (base: number, rate: number) => base * (rate / 100);
const getTotalFacturaEmitida = (inc: Income) => inc.baseAmount + getCuotaIVA(inc.baseAmount, inc.vatRate) - getCuotaIRPF(inc.baseAmount, inc.irpfRate);
const getTotalFacturaRecibida = (exp: Expense) => exp.baseAmount + getCuotaIVA(exp.baseAmount, exp.vatRate);
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
const calculateAnnualIRPF = (annualIncome: number): number => {
    let tax = 0;
    let lastLimit = 0;
    for (const bracket of IRPF_BRACKETS) {
        if (annualIncome > lastLimit) {
            const taxableAmount = Math.min(annualIncome, bracket.limit) - lastLimit;
            tax += taxableAmount * bracket.rate;
        } else { break; }
        lastLimit = bracket.limit;
    }
    return tax;
};

// --- Main Professional View ---
const ProfessionalView: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return <div>Cargando...</div>;
    const { data, setData } = context;
    const [activeTab, setActiveTab] = useState<ProViewTab>('libros');
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
        setData(prev => {
            if (type === 'income') return { ...prev, incomes: prev.incomes.filter(i => i.id !== id) };
            if (type === 'expense') return { ...prev, expenses: prev.expenses.filter(e => e.id !== id) };
            if (type === 'investment') return { ...prev, investmentGoods: prev.investmentGoods.filter(g => g.id !== id) };
            return prev;
        });
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
        <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Área Profesional</h2>
                <div title={!data.settings.geminiApiKey ? "Configura tu API Key de Gemini en Ajustes para activar" : "Importar factura con IA"}>
                    <Button onClick={() => setAiImportModalOpen(true)} disabled={!data.settings.geminiApiKey}><Icon name="sparkles" className="w-5 h-5"/> Importar con IA</Button>
                </div>
            </div>
            <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="-mb-px flex space-x-6 sm:space-x-8 overflow-x-auto" aria-label="Tabs">
                    <TabButton tabName="libros" label="Libros de Registro" />
                    <TabButton tabName="impuestos" label="Mis Impuestos" />
                    <TabButton tabName="renta" label="Calculadora Renta" />
                    <TabButton tabName="resumen" label="Resumen Gráfico" />
                </nav>
            </div>
            <div className="pt-4">
                {activeTab === 'libros' && <LibrosRegistroView onEditIncome={handleOpenIncomeModal} onEditExpense={handleOpenExpenseModal} onEditInvestment={handleOpenInvestmentModal} onDelete={handleDelete} />}
                {activeTab === 'impuestos' && <MisImpuestosView />}
                {activeTab === 'renta' && <CalculadoraRentaView />}
                {activeTab === 'resumen' && <ResumenGraficoView />}
            </div>
            <AiImportModal isOpen={isAiImportModalOpen} onClose={() => setAiImportModalOpen(false)} onAnalysisComplete={handleAnalysisComplete} apiKey={data.settings.geminiApiKey} />
            <Modal isOpen={isIncomeModalOpen} onClose={() => setIncomeModalOpen(false)} title={incomeToEdit?.id ? "Editar Factura Emitida" : "Nueva Factura Emitida"}><IncomeForm onClose={() => setIncomeModalOpen(false)} incomeToEdit={incomeToEdit} /></Modal>
            <Modal isOpen={isExpenseModalOpen} onClose={() => setExpenseModalOpen(false)} title={expenseToEdit?.id ? "Editar Factura Recibida" : "Nueva Factura Recibida"}><ExpenseForm onClose={() => setExpenseModalOpen(false)} expenseToEdit={expenseToEdit} /></Modal>
            <Modal isOpen={isInvestmentModalOpen} onClose={() => setInvestmentModalOpen(false)} title={investmentToEdit?.id ? "Editar Bien de Inversión" : "Nuevo Bien de Inversión"}><InvestmentGoodForm onClose={() => setInvestmentModalOpen(false)} goodToEdit={investmentToEdit} /></Modal>
        </div>
    );
};

// --- View Components for Tabs ---
const LibrosRegistroView: React.FC<{
    onEditIncome: (income?: Partial<Income>) => void; onEditExpense: (expense?: Partial<Expense>) => void; onEditInvestment: (good?: Partial<InvestmentGood>) => void; onDelete: (type: 'income' | 'expense' | 'investment', id: string) => void;
}> = ({ onEditIncome, onEditExpense, onEditInvestment, onDelete }) => {
    const { data, formatCurrency } = useContext(AppContext)!;
    const { incomes, expenses, investmentGoods } = data;
    const [libroFilter, setLibroFilter] = useState<'all' | 'incomes' | 'expenses' | 'investments'>('all');

    const allTransactions = useMemo(() => {
        const combined = [
            ...incomes.map(i => ({ ...i, type: 'income' as const })),
            ...expenses.map(e => ({ ...e, type: 'expense' as const }))
        ];
        return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [incomes, expenses]);

    const IncomeTable = () => (
        <Card>
            <div className="flex flex-wrap gap-2 justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Libro de Registro de Facturas Emitidas</h3>
                <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => generateIncomesPDF(incomes)} disabled={incomes.length === 0}><Icon name="download" className="w-4 h-4" /> PDF</Button>
                    <Button onClick={() => onEditIncome()}><Icon name="plus" /> Añadir Ingreso</Button>
                </div>
            </div>
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400"><tr><th className="px-4 py-2">Fecha</th><th className="px-4 py-2">Nº Factura</th><th className="px-4 py-2">Cliente</th><th className="px-4 py-2 text-right">Base</th><th className="px-4 py-2 text-right">IVA</th><th className="px-4 py-2 text-right">IRPF</th><th className="px-4 py-2 text-right">Total</th><th className="px-2 py-2">Adj.</th><th className="px-4 py-2 text-center">Acciones</th></tr></thead>
                    <tbody>{incomes.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(inc => (<tr key={inc.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600"><td className="px-4 py-2">{formatDate(inc.date)}</td><td className="px-4 py-2">{inc.invoiceNumber}</td><td className="px-4 py-2">{inc.clientName}</td><td className="px-4 py-2 text-right">{formatCurrency(inc.baseAmount)}</td><td className="px-4 py-2 text-right">{formatCurrency(getCuotaIVA(inc.baseAmount, inc.vatRate))} ({inc.vatRate}%)</td><td className="px-4 py-2 text-right">{formatCurrency(getCuotaIRPF(inc.baseAmount, inc.irpfRate))} ({inc.irpfRate}%)</td><td className="px-4 py-2 text-right font-bold">{formatCurrency(getTotalFacturaEmitida(inc))}</td><td className="px-2 py-2 text-center">{inc.attachment && <Button size="sm" variant="ghost" onClick={() => handleDownloadAttachment(inc.attachment!)} title={inc.attachment.name}><Icon name="paperclip" className="w-4 h-4" /></Button>}</td><td className="px-4 py-2 flex justify-center gap-1"><Button size="sm" variant="ghost" onClick={() => onEditIncome(inc)} title="Editar"><Icon name="pencil" className="w-4 h-4" /></Button><Button size="sm" variant="ghost" onClick={() => onDelete('income', inc.id)} title="Eliminar"><Icon name="trash" className="w-4 h-4 text-red-500" /></Button></td></tr>))}</tbody></table></div>
        </Card>
    );

    const ExpenseTable = () => (
        <Card>
            <div className="flex flex-wrap gap-2 justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Libro de Registro de Facturas Recibidas</h3>
                <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => generateExpensesPDF(expenses)} disabled={expenses.length === 0}><Icon name="download" className="w-4 h-4" /> PDF</Button>
                    <Button onClick={() => onEditExpense()}><Icon name="plus" /> Añadir Gasto</Button>
                </div>
            </div>
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400"><tr><th className="px-4 py-2">Fecha</th><th className="px-4 py-2">Proveedor</th><th className="px-4 py-2">Concepto</th><th className="px-4 py-2 text-right">Base</th><th className="px-4 py-2 text-right">IVA</th><th className="px-4 py-2 text-right">Total</th><th className="px-4 py-2 text-center">Deducible</th><th className="px-2 py-2">Adj.</th><th className="px-4 py-2 text-center">Acciones</th></tr></thead>
                    <tbody>{expenses.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(exp => (<tr key={exp.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600"><td className="px-4 py-2">{formatDate(exp.date)}</td><td className="px-4 py-2">{exp.providerName}</td><td className="px-4 py-2">{exp.concept}</td><td className="px-4 py-2 text-right">{formatCurrency(exp.baseAmount)}</td><td className="px-4 py-2 text-right">{formatCurrency(getCuotaIVA(exp.baseAmount, exp.vatRate))} ({exp.vatRate}%)</td><td className="px-4 py-2 text-right font-bold">{formatCurrency(getTotalFacturaRecibida(exp))}</td><td className="px-4 py-2 text-center">{exp.isDeductible ? 'Sí' : 'No'}</td><td className="px-2 py-2 text-center">{exp.attachment && <Button size="sm" variant="ghost" onClick={() => handleDownloadAttachment(exp.attachment!)} title={exp.attachment.name}><Icon name="paperclip" className="w-4 h-4" /></Button>}</td><td className="px-4 py-2 flex justify-center gap-1"><Button size="sm" variant="ghost" onClick={() => onEditExpense(exp)} title="Editar"><Icon name="pencil" className="w-4 h-4" /></Button><Button size="sm" variant="ghost" onClick={() => onDelete('expense', exp.id)} title="Eliminar"><Icon name="trash" className="w-4 h-4 text-red-500" /></Button></td></tr>))}</tbody></table></div>
        </Card>
    );
    
    const InvestmentTable = () => (
        <Card>
            <div className="flex flex-wrap gap-2 justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Libro de Registro de Bienes de Inversión</h3>
                <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => generateInvestmentGoodsPDF(investmentGoods)} disabled={investmentGoods.length === 0}><Icon name="download" className="w-4 h-4" /> PDF</Button>
                    <Button onClick={() => onEditInvestment()}><Icon name="plus" /> Añadir Bien</Button>
                </div>
            </div>
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400"><tr><th className="px-4 py-2">Fecha Compra</th><th className="px-4 py-2">Descripción</th><th className="px-4 py-2 text-right">Valor Adquisición</th><th className="px-4 py-2 text-center">Vida Útil</th><th className="px-4 py-2 text-right">Amortización Anual</th><th className="px-2 py-2">Adj.</th><th className="px-4 py-2 text-center">Acciones</th></tr></thead>
                    <tbody>{investmentGoods.sort((a,b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()).map(good => (<tr key={good.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600"><td className="px-4 py-2">{formatDate(good.purchaseDate)}</td><td className="px-4 py-2">{good.description}</td><td className="px-4 py-2 text-right">{formatCurrency(good.acquisitionValue)}</td><td className="px-4 py-2 text-center">{good.usefulLife} años</td><td className="px-4 py-2 text-right font-bold">{formatCurrency(good.acquisitionValue / good.usefulLife)}</td><td className="px-2 py-2 text-center">{good.attachment && <Button size="sm" variant="ghost" onClick={() => handleDownloadAttachment(good.attachment!)} title={good.attachment.name}><Icon name="paperclip" className="w-4 h-4" /></Button>}</td><td className="px-4 py-2 flex justify-center gap-1"><Button size="sm" variant="ghost" onClick={() => onEditInvestment(good)} title="Editar"><Icon name="pencil" className="w-4 h-4" /></Button><Button size="sm" variant="ghost" onClick={() => onDelete('investment', good.id)} title="Eliminar"><Icon name="trash" className="w-4 h-4 text-red-500" /></Button></td></tr>))}</tbody></table></div>
        </Card>
    );

    const AllTransactionsTable = () => (
         <Card>
            <div className="flex flex-wrap gap-2 justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Registro Contable Unificado</h3>
                <div className="flex gap-2">
                    <Button onClick={() => onEditIncome()}><Icon name="plus" /> Añadir Ingreso</Button>
                    <Button onClick={() => onEditExpense()}><Icon name="plus" /> Añadir Gasto</Button>
                </div>
            </div>
             <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400"><tr><th className="px-4 py-2">Fecha</th><th className="px-4 py-2">Tipo</th><th className="px-4 py-2">Nº Factura</th><th className="px-4 py-2">Cliente/Proveedor</th><th className="px-4 py-2">Concepto</th><th className="px-4 py-2 text-right">Total</th><th className="px-2 py-2">Adj.</th><th className="px-4 py-2 text-center">Acciones</th></tr></thead>
                    <tbody>{allTransactions.map(item => {
                        const isIncome = item.type === 'income';
                        const total = isIncome ? getTotalFacturaEmitida(item as Income) : getTotalFacturaRecibida(item as Expense);
                        const partyName = isIncome ? (item as Income).clientName : (item as Expense).providerName;

                        return (
                        <tr key={item.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                            <td className="px-4 py-2">{formatDate(item.date)}</td>
                            <td className="px-4 py-2">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${isIncome ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                                    {isIncome ? 'Ingreso' : 'Gasto'}
                                </span>
                            </td>
                            <td className="px-4 py-2">{item.invoiceNumber || '-'}</td>
                            <td className="px-4 py-2">{partyName}</td>
                            <td className="px-4 py-2">{item.concept}</td>
                            <td className={`px-4 py-2 text-right font-bold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(total)}</td>
                            <td className="px-2 py-2 text-center">{item.attachment && <Button size="sm" variant="ghost" onClick={() => handleDownloadAttachment(item.attachment!)} title={item.attachment.name}><Icon name="paperclip" className="w-4 h-4" /></Button>}</td>
                            <td className="px-4 py-2 flex justify-center gap-1">
                                <Button size="sm" variant="ghost" onClick={() => isIncome ? onEditIncome(item) : onEditExpense(item)} title="Editar"><Icon name="pencil" className="w-4 h-4" /></Button>
                                <Button size="sm" variant="ghost" onClick={() => onDelete(item.type, item.id)} title="Eliminar"><Icon name="trash" className="w-4 h-4 text-red-500" /></Button>
                            </td>
                        </tr>
                        );
                    })}</tbody></table></div>
        </Card>
    );

    return (
        <div className="space-y-6">
            <Card>
                <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant={libroFilter === 'all' ? 'primary' : 'secondary'} onClick={() => setLibroFilter('all')}>Todos los Movimientos</Button>
                    <Button size="sm" variant={libroFilter === 'incomes' ? 'primary' : 'secondary'} onClick={() => setLibroFilter('incomes')}>Facturas Emitidas</Button>
                    <Button size="sm" variant={libroFilter === 'expenses' ? 'primary' : 'secondary'} onClick={() => setLibroFilter('expenses')}>Facturas Recibidas</Button>
                    <Button size="sm" variant={libroFilter === 'investments' ? 'primary' : 'secondary'} onClick={() => setLibroFilter('investments')}>Bienes de Inversión</Button>
                </div>
            </Card>

            <div className="space-y-8">
                {libroFilter === 'all' && (
                    <>
                        <AllTransactionsTable />
                        <InvestmentTable />
                    </>
                )}
                {libroFilter === 'incomes' && <IncomeTable />}
                {libroFilter === 'expenses' && <ExpenseTable />}
                {libroFilter === 'investments' && <InvestmentTable />}
            </div>
        </div>
    );
};

const MisImpuestosView: React.FC = () => {
    const { data, formatCurrency } = useContext(AppContext)!;
    const [year, setYear] = useState(new Date().getFullYear());
    const [quarter, setQuarter] = useState<Quarter>(1);
    const [annualYear, setAnnualYear] = useState(new Date().getFullYear());

    const [modelo303, setModelo303] = useState<any>(null);
    const [modelo130, setModelo130] = useState<any>(null);
    const [modelo390, setModelo390] = useState<any>(null);
    const [modelo347, setModelo347] = useState<any>(null);
    
    const years = useMemo(() => Array.from(new Set([...data.incomes, ...data.expenses].map(i => new Date(i.date).getFullYear()))).sort((a, b) => b - a), [data]);

    const getQuarterDates = (y: number, q: Quarter) => ({
        startDate: new Date(y, (q - 1) * 3, 1),
        endDate: new Date(y, q * 3, 0, 23, 59, 59, 999)
    });

    const calculateModelo303 = () => {
        const { startDate, endDate } = getQuarterDates(year, quarter);
        const incomes = data.incomes.filter(i => new Date(i.date) >= startDate && new Date(i.date) <= endDate);
        const expenses = data.expenses.filter(e => e.isDeductible && new Date(e.date) >= startDate && new Date(e.date) <= endDate);
        const ivaRepercutido = incomes.reduce((sum, i) => sum + getCuotaIVA(i.baseAmount, i.vatRate), 0);
        const ivaSoportado = expenses.reduce((sum, e) => sum + getCuotaIVA(e.baseAmount, e.vatRate), 0);
        setModelo303({ repercutido: ivaRepercutido, soportado: ivaSoportado, resultado: ivaRepercutido - ivaSoportado });
    };

    const calculateModelo130 = () => {
        const { startDate, endDate } = getQuarterDates(year, quarter);
        const incomes = data.incomes.filter(i => new Date(i.date) >= startDate && new Date(i.date) <= endDate);
        const expenses = data.expenses.filter(e => e.isDeductible && new Date(e.date) >= startDate && new Date(e.date) <= endDate);
        
        const totalIngresos = incomes.reduce((sum, i) => sum + i.baseAmount, 0);
        const totalGastosFacturas = expenses.reduce((sum, e) => sum + e.baseAmount, 0);
        const cuotaAutonomoTrimestral = (data.settings.monthlyAutonomoFee || 0) * 3;

        const amortizacionTrimestral = data.investmentGoods.reduce((sum, good) => {
            const purchaseDate = new Date(good.purchaseDate);
            if (purchaseDate <= endDate) {
                 const endDateUsefulLife = new Date(purchaseDate.getFullYear() + good.usefulLife, purchaseDate.getMonth(), purchaseDate.getDate());
                 if(endDate < endDateUsefulLife) {
                    return sum + (good.acquisitionValue / good.usefulLife) / 4;
                 }
            }
            return sum;
        }, 0);

        const totalGastos = totalGastosFacturas + amortizacionTrimestral + cuotaAutonomoTrimestral;
        const rendimientoNeto = totalIngresos - totalGastos;
        const totalInvoicedWithRetention = incomes.filter(i => i.irpfRate > 0).reduce((sum, i) => sum + i.baseAmount, 0);
        const highRetentionWarning = totalIngresos > 0 && (totalInvoicedWithRetention / totalIngresos) > 0.7;

        setModelo130({ ingresos: totalIngresos, gastos: totalGastos, rendimiento: rendimientoNeto, pago: Math.max(0, rendimientoNeto * 0.2), highRetentionWarning });
    };

    const handleGenerateReport = () => {
        const { startDate, endDate } = getQuarterDates(year, quarter);
        const incomesInPeriod = data.incomes.filter(i => new Date(i.date) >= startDate && new Date(i.date) <= endDate);
        const expensesInPeriod = data.expenses.filter(e => e.isDeductible && new Date(e.date) >= startDate && new Date(e.date) <= endDate);
        const transfersInPeriod = data.transfers.filter(t => new Date(t.date) >= startDate && new Date(t.date) <= endDate);
        
        const totalGrossInvoiced = incomesInPeriod.reduce((sum, i) => sum + i.baseAmount, 0);
        const totalExpensesFromInvoices = expensesInPeriod.reduce((sum, e) => sum + e.baseAmount, 0);
        const cuotaAutonomo = (data.settings.monthlyAutonomoFee || 0) * 3;
        
        const totalAmortization = data.investmentGoods.reduce((sum, good) => {
             const dailyAmortization = (good.acquisitionValue / good.usefulLife) / 365.25;
             const goodStartDate = new Date(good.purchaseDate);
             const goodEndDate = new Date(goodStartDate.getFullYear() + good.usefulLife, goodStartDate.getMonth(), goodStartDate.getDate());
             const effectiveStartDate = goodStartDate > startDate ? goodStartDate : startDate;
             const effectiveEndDate = goodEndDate < endDate ? goodEndDate : endDate;
             if(effectiveEndDate > effectiveStartDate) {
                const daysInPeriod = (effectiveEndDate.getTime() - effectiveStartDate.getTime()) / (1000 * 3600 * 24) + 1;
                return sum + (daysInPeriod * dailyAmortization);
             }
             return sum;
        },0)

        const totalDeductibleExpenses = totalExpensesFromInvoices + cuotaAutonomo + totalAmortization;
        const netProfit = totalGrossInvoiced - totalDeductibleExpenses;
        
        const ivaRepercutido = incomesInPeriod.reduce((sum, i) => sum + getCuotaIVA(i.baseAmount, i.vatRate), 0);
        const ivaSoportado = expensesInPeriod.reduce((sum, e) => sum + getCuotaIVA(e.baseAmount, e.vatRate), 0);
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
        
        generateComprehensivePeriodPDF(incomesInPeriod, expensesInPeriod, data.investmentGoods, transfersInPeriod, data.settings, { startDate, endDate }, summary);
    };

    const calculateAnnualModels = () => {
        const startDate = new Date(annualYear, 0, 1);
        const endDate = new Date(annualYear, 11, 31, 23, 59, 59, 999);
        const incomes = data.incomes.filter(i => new Date(i.date) >= startDate && new Date(i.date) <= endDate);
        const expenses = data.expenses.filter(e => e.isDeductible && new Date(e.date) >= startDate && new Date(e.date) <= endDate);
        // Modelo 390
        const ivaRepercutido = incomes.reduce((sum, i) => sum + getCuotaIVA(i.baseAmount, i.vatRate), 0);
        const ivaSoportado = expenses.reduce((sum, e) => sum + getCuotaIVA(e.baseAmount, e.vatRate), 0);
        setModelo390({ repercutido: ivaRepercutido, soportado: ivaSoportado });
        // Modelo 347
        const operations: { [nif: string]: { name: string, total: number } } = {};
        incomes.forEach(i => {
            if (i.clientNif) {
                if (!operations[i.clientNif]) operations[i.clientNif] = { name: i.clientName, total: 0 };
                operations[i.clientNif].total += getTotalFacturaEmitida(i);
            }
        });
        expenses.forEach(e => {
            if (e.providerNif) {
                if (!operations[e.providerNif]) operations[e.providerNif] = { name: e.providerName, total: 0 };
                operations[e.providerNif].total += getTotalFacturaRecibida(e);
            }
        });
        const final347 = Object.entries(operations).map(([nif, data]) => ({ nif, ...data })).filter(op => op.total > 3005.06);
        setModelo347(final347);
    };

    return (<div className="space-y-6">
        <Card><h3 className="text-xl font-bold mb-4">Impuestos Trimestrales</h3><div className="flex flex-wrap items-end gap-4"><Select label="Año" value={year} onChange={e => setYear(parseInt(e.target.value))}>{years.map(y => <option key={y} value={y}>{y}</option>)}</Select><Select label="Trimestre" value={quarter} onChange={e => setQuarter(parseInt(e.target.value) as Quarter)}><option value="1">1T</option><option value="2">2T</option><option value="3">3T</option><option value="4">4T</option></Select><Button onClick={calculateModelo303}>Preparar Modelo 303 (IVA)</Button><Button onClick={calculateModelo130}>Preparar Modelo 130 (IRPF)</Button><Button variant="secondary" onClick={handleGenerateReport}><Icon name="download" className="w-4 h-4" /> Generar Informe Total PDF</Button></div>{modelo303 && <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg"><h4>Resultado Modelo 303:</h4><p>IVA Repercutido: {formatCurrency(modelo303.repercutido)}</p><p>IVA Soportado Deducible: {formatCurrency(modelo303.soportado)}</p><p className="font-bold">Resultado: {formatCurrency(modelo303.resultado)} ({modelo303.resultado >= 0 ? 'A ingresar' : 'A compensar'})</p></div>}{modelo130 && <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg"><h4>Resultado Modelo 130:</h4><p>Total Ingresos: {formatCurrency(modelo130.ingresos)}</p><p>Total Gastos Deducibles: {formatCurrency(modelo130.gastos)}</p><p>Rendimento Neto: {formatCurrency(modelo130.rendimiento)}</p><p className="font-bold">Pago a cuenta (20%): {formatCurrency(modelo130.pago)}</p>{modelo130.highRetentionWarning && <p className="text-sm text-orange-500 mt-2">Aviso: Más del 70% de tu facturación tiene retención. Podrías no estar obligado a presentar este modelo.</p>}</div>}</Card>
        <Card><h3 className="text-xl font-bold mb-4">Resúmenes Anuales</h3><div className="flex flex-wrap items-end gap-4"><Select label="Año" value={annualYear} onChange={e => setAnnualYear(parseInt(e.target.value))}>{years.map(y => <option key={y} value={y}>{y}</option>)}</Select><Button onClick={calculateAnnualModels}>Generar Resúmenes</Button></div>{modelo390 && <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg"><h4>Resumen Modelo 390 (IVA Anual)</h4><p>Total IVA Repercutido: {formatCurrency(modelo390.repercutido)}</p><p>Total IVA Soportado: {formatCurrency(modelo390.soportado)}</p></div>}{modelo347 && <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg"><h4>Resumen Modelo 347 (Operaciones con Terceros &gt; 3.005,06€)</h4>{modelo347.length > 0 ? <ul>{modelo347.map((op:any) => <li key={op.nif}>{op.name} ({op.nif}): {formatCurrency(op.total)}</li>)}</ul> : <p>Ninguna operación supera el umbral.</p>}</div>}</Card>
    </div>);
}

const CalculadoraRentaView: React.FC = () => {
    const { data, formatCurrency } = useContext(AppContext)!;
    const [year, setYear] = useState(new Date().getFullYear() - 1);
    const [result, setResult] = useState<any>(null);
    const years = useMemo(() => Array.from(new Set([...data.incomes, ...data.expenses].map(i => new Date(i.date).getFullYear()))).sort((a, b) => b - a), [data]);
    
    const calculateRenta = () => {
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
        const incomes = data.incomes.filter(i => new Date(i.date) >= startDate && new Date(i.date) <= endDate);
        const expenses = data.expenses.filter(e => e.isDeductible && new Date(e.date) >= startDate && new Date(e.date) <= endDate);
        
        const totalIngresos = incomes.reduce((sum, i) => sum + i.baseAmount, 0);
        const totalGastosFacturas = expenses.reduce((sum, e) => sum + e.baseAmount, 0);
        const cuotaAutonomoAnual = (data.settings.monthlyAutonomoFee || 0) * 12;

        const amortizacionAnual = data.investmentGoods.reduce((sum, good) => {
             const purchaseDate = new Date(good.purchaseDate);
             if (purchaseDate.getFullYear() <= year) {
                const endDateUsefulLife = new Date(purchaseDate.getFullYear() + good.usefulLife, purchaseDate.getMonth(), purchaseDate.getDate());
                 if(endDate < endDateUsefulLife) {
                    return sum + (good.acquisitionValue / good.usefulLife);
                 }
             }
             return sum;
        }, 0);

        const totalGastosDeducibles = totalGastosFacturas + amortizacionAnual + cuotaAutonomoAnual;
        const rendimientoNeto = totalIngresos - totalGastosDeducibles;
        const cuotaIntegra = calculateAnnualIRPF(rendimientoNeto);
        const retencionesSoportadas = incomes.reduce((sum, i) => sum + getCuotaIRPF(i.baseAmount, i.irpfRate), 0);

        let pagosACuenta130 = 0;
        for (let q = 1; q <= 4; q++) {
            const qStartDate = new Date(year, (q - 1) * 3, 1);
            const qEndDate = new Date(year, q * 3, 0, 23, 59, 59, 999);
            const qIncomes = data.incomes.filter(i => new Date(i.date) >= qStartDate && new Date(i.date) <= qEndDate);
            const qExpenses = data.expenses.filter(e => e.isDeductible && new Date(e.date) >= qStartDate && new Date(e.date) <= qEndDate);
            const qIngresos = qIncomes.reduce((sum, i) => sum + i.baseAmount, 0);
            const qGastosFacturas = qExpenses.reduce((sum, e) => sum + e.baseAmount, 0);
            const qCuotaAutonomo = (data.settings.monthlyAutonomoFee || 0) * 3;
            const qAmortizacion = data.investmentGoods.reduce((sum, good) => {
                const purchaseDate = new Date(good.purchaseDate);
                if (purchaseDate <= qEndDate) {
                    const endDateUsefulLife = new Date(purchaseDate.getFullYear() + good.usefulLife, purchaseDate.getMonth(), purchaseDate.getDate());
                    if(qEndDate < endDateUsefulLife) return sum + (good.acquisitionValue / good.usefulLife) / 4;
                }
                return sum;
            }, 0);
            const qRendimiento = qIngresos - (qGastosFacturas + qAmortizacion + qCuotaAutonomo);
            pagosACuenta130 += Math.max(0, qRendimiento * 0.2);
        }
        
        const resultadoFinal = cuotaIntegra - retencionesSoportadas - pagosACuenta130;
        setResult({ rendimientoNeto, cuotaIntegra, retencionesSoportadas, pagosACuenta130, resultadoFinal });
    };

    return (<Card>
        <h3 className="text-xl font-bold mb-4">Calculadora de Renta Anual (Modelo 100)</h3>
        <div className="flex items-end gap-4">
            <Select label="Año Fiscal" value={year} onChange={e => setYear(parseInt(e.target.value))}>{years.map(y => <option key={y} value={y}>{y}</option>)}</Select>
            <Button onClick={calculateRenta}>Calcular Renta</Button>
        </div>
        {result && <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-2">
            <p><strong>Rendimiento Neto Anual:</strong> {formatCurrency(result.rendimientoNeto)}</p>
            <p><strong>Cuota Íntegra (Total IRPF a pagar):</strong> {formatCurrency(result.cuotaIntegra)}</p><hr className="dark:border-slate-700"/>
            <p className="text-sm">(-) Retenciones IRPF Soportadas: {formatCurrency(result.retencionesSoportadas)}</p>
            <p className="text-sm">(-) Pagos a Cuenta (Mod. 130): {formatCurrency(result.pagosACuenta130)}</p><hr className="dark:border-slate-700"/>
            <p className={`text-lg font-bold ${result.resultadoFinal >= 0 ? 'text-red-500' : 'text-green-500'}`}>Resultado Final Declaración: {formatCurrency(Math.abs(result.resultadoFinal))} ({result.resultadoFinal >= 0 ? 'A PAGAR' : 'A DEVOLVER'})</p>
        </div>}
    </Card>);
}

const ResumenGraficoView: React.FC = () => {
    const context = useContext(AppContext)!;
    const { data, formatCurrency } = context;
    const { incomes, expenses, professionalCategories } = data;
    const [period, setPeriod] = useState<{ startDate: Date; endDate: Date }>(() => {
        const now = new Date(); const year = now.getFullYear(); const month = now.getMonth();
        if (month < 3) return { startDate: new Date(year, 0, 1), endDate: new Date(year, 2, 31, 23, 59, 59, 999) };
        if (month < 6) return { startDate: new Date(year, 3, 1), endDate: new Date(year, 5, 30, 23, 59, 59, 999) };
        if (month < 9) return { startDate: new Date(year, 6, 1), endDate: new Date(year, 8, 30, 23, 59, 59, 999) };
        return { startDate: new Date(year, 9, 1), endDate: new Date(year, 11, 31, 23, 59, 59, 999) };
    });
    const handlePeriodChange = useCallback((startDate: Date, endDate: Date) => setPeriod({ startDate, endDate }), []);

    const filteredIncomes = useMemo(() => incomes.filter(i => new Date(i.date) >= period.startDate && new Date(i.date) <= period.endDate), [incomes, period]);
    const filteredExpenses = useMemo(() => expenses.filter(e => new Date(e.date) >= period.startDate && new Date(e.date) <= period.endDate), [expenses, period]);

    const incomeChartData = useMemo(() => {
        const dataByClient = filteredIncomes.reduce((acc, income) => { acc[income.clientName] = (acc[income.clientName] || 0) + income.baseAmount; return acc; }, {} as {[k:string]:number});
        return Object.entries(dataByClient).map(([name, value]) => ({ name, value }));
    }, [filteredIncomes]);

    const expenseChartData = useMemo(() => {
        const dataByCat = filteredExpenses.reduce((acc, expense) => {
            const categoryName = professionalCategories.find(c => c.id === expense.categoryId)?.name || 'Sin Categoría';
            acc[categoryName] = (acc[categoryName] || 0) + expense.baseAmount;
            return acc;
        }, {} as {[k:string]:number});
        return Object.entries(dataByCat).map(([name, value]) => ({ name, value }));
    }, [filteredExpenses, professionalCategories]);
    
    const COLORS = ['#FF8042', '#0088FE', '#00C49F', '#FFBB28', '#AF19FF'];

    return (
        <div className="space-y-6">
            <PeriodSelector onPeriodChange={handlePeriodChange} />
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <Card><h3 className="text-lg font-bold mb-4">Ingresos por Cliente</h3><ResponsiveContainer width="100%" height={300}><BarChart data={incomeChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.2)" /><XAxis dataKey="name" /><YAxis tickFormatter={(tick) => formatCurrency(tick)} /><Tooltip formatter={(value: number) => formatCurrency(value as number)} /><Legend /><Bar dataKey="value" name="Ingresos" fill="#0088FE" /></BarChart></ResponsiveContainer></Card>
                 <Card><h3 className="text-lg font-bold mb-4">Gastos por Categoría</h3><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={expenseChartData} cx="50%" cy="50%" labelLine={false} outerRadius={80} fill="#8884d8" dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>{expenseChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value: number) => formatCurrency(value)} /><Legend /></PieChart></ResponsiveContainer></Card>
            </div>
        </div>
    );
};


// --- AI Import Modal ---
const AiImportModal: React.FC<{
    isOpen: boolean; onClose: () => void;
    onAnalysisComplete: (data: Partial<Income> | Partial<Expense> | Partial<InvestmentGood>, type: 'income' | 'expense' | 'investment', file: File) => void;
    apiKey: string;
}> = ({ isOpen, onClose, onAnalysisComplete, apiKey }) => {
    const [invoiceType, setInvoiceType] = useState<'income' | 'expense' | 'investment'>('income');
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [fileName, setFileName] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) { setFile(selectedFile); setFileName(selectedFile.name); setError(''); }
    };
    
    const handleAnalyze = async () => {
        if (!file) { setError('Por favor, selecciona un archivo.'); return; }
        setIsLoading(true); setError('');
        try {
            const extractedData = await extractInvoiceData(file, invoiceType, apiKey);
            onAnalysisComplete(extractedData, invoiceType, file);
            handleClose();
        } catch (err: any) {
            setError(err.message || 'Ha ocurrido un error inesperado.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleClose = () => { setFile(null); setFileName(''); setError(''); setIsLoading(false); onClose(); }

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Importar Factura con IA">
            <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">La IA rellenará el formulario con los datos de la factura que subas. Revisa siempre los datos antes de guardar.</p>
                <Select label="Tipo de Documento" value={invoiceType} onChange={(e) => setInvoiceType(e.target.value as any)}>
                    <option value="income">Factura Emitida (Ingreso)</option>
                    <option value="expense">Factura Recibida (Gasto)</option>
                    <option value="investment">Bien de Inversión</option>
                </Select>
                <div>
                     <label htmlFor="file-upload" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Sube la factura (imagen o PDF)</label>
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 dark:border-slate-600 border-dashed rounded-md"><div className="space-y-1 text-center"><Icon name="upload" className="mx-auto h-12 w-12 text-slate-400" /><div className="flex text-sm text-slate-600 dark:text-slate-400"><label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-slate-800 rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none"><span>Selecciona un archivo</span><input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/png, image/jpeg, image/webp, application/pdf" /></label><p className="pl-1">o arrástralo aquí</p></div><p className="text-xs text-slate-500 dark:text-slate-500">PNG, JPG, WEBP, PDF</p></div></div>
                    {fileName && <p className="text-sm text-center mt-2 text-slate-600 dark:text-slate-400">{fileName}</p>}
                </div>
                {error && <p className="text-sm text-red-500 text-center">{error}</p>}
                <div className="pt-4"><Button onClick={handleAnalyze} disabled={isLoading || !file} className="w-full">{isLoading ? 'Analizando...' : <><Icon name="sparkles" className="w-5 h-5" /> Analizar Documento</>}</Button></div>
            </div>
        </Modal>
    );
};

export default ProfessionalView;