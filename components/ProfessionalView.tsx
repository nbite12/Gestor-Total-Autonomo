import React, { useState, useContext, useMemo, useCallback } from 'react';
import { AppContext } from '../App';
import { Income, Expense, MoneySource, Attachment, UserSettings, MoneyLocation, Transfer } from '../types';
import { Card, Button, Modal, Input, Select, Icon, HelpTooltip } from './ui';
import { PeriodSelector } from './PeriodSelector';
import { IRPF_MODELO_130_RATE } from '../constants';
import { generateInvoicePDF, generateQuarterlySummaryPDF } from '../services/pdfService';
import { extractInvoiceData } from '../services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// --- Helper Functions ---
const filterByDateRange = <T extends { date: string }>(items: T[], startDate: Date, endDate: Date): T[] => {
    return items.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= startDate && itemDate <= endDate;
    });
};

const formatDateForInput = (isoDate: string) => isoDate.split('T')[0];

const getCurrentQuarterInfo = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    if (month < 3) return { startDate: new Date(year, 0, 1), endDate: new Date(year, 2, 31, 23, 59, 59, 999) };
    if (month < 6) return { startDate: new Date(year, 3, 1), endDate: new Date(year, 5, 30, 23, 59, 59, 999) };
    if (month < 9) return { startDate: new Date(year, 6, 1), endDate: new Date(year, 8, 30, 23, 59, 59, 999) };
    return { startDate: new Date(year, 9, 1), endDate: new Date(year, 11, 31, 23, 59, 59, 999) };
};


// --- AI Import Modal ---
const AiImportModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onAnalysisComplete: (data: Partial<Income> | Partial<Expense>, type: 'income' | 'expense', file: File) => void;
    apiKey: string;
}> = ({ isOpen, onClose, onAnalysisComplete, apiKey }) => {
    const [invoiceType, setInvoiceType] = useState<'income' | 'expense'>('income');
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [fileName, setFileName] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setFileName(selectedFile.name);
            setError('');
        }
    };
    
    const handleAnalyze = async () => {
        if (!file) {
            setError('Por favor, selecciona un archivo.');
            return;
        }
        setIsLoading(true);
        setError('');
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
    
    const handleClose = () => {
        setFile(null);
        setFileName('');
        setError('');
        setIsLoading(false);
        onClose();
    }

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Importar Factura con IA">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Tipo de Factura
                    </label>
                    <div className="flex gap-4">
                        <Button 
                            variant={invoiceType === 'income' ? 'primary' : 'secondary'} 
                            onClick={() => setInvoiceType('income')} 
                            className="flex-1"
                        >
                            Emitida (Ingreso)
                        </Button>
                        <Button 
                            variant={invoiceType === 'expense' ? 'primary' : 'secondary'} 
                            onClick={() => setInvoiceType('expense')} 
                            className="flex-1"
                        >
                           Recibida (Gasto)
                        </Button>
                    </div>
                </div>

                <div>
                     <label htmlFor="file-upload" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Sube la factura (imagen o PDF)
                    </label>
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 dark:border-slate-600 border-dashed rounded-md">
                        <div className="space-y-1 text-center">
                            <svg className="mx-auto h-12 w-12 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <div className="flex text-sm text-slate-600 dark:text-slate-400">
                                <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-slate-800 rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none">
                                    <span>Selecciona un archivo</span>
                                    <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/png, image/jpeg, image/webp, application/pdf" />
                                </label>
                                <p className="pl-1">o arrástralo aquí</p>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-500">PNG, JPG, WEBP, PDF</p>
                        </div>
                    </div>
                    {fileName && <p className="text-sm text-center mt-2 text-slate-600 dark:text-slate-400">{fileName}</p>}
                </div>
                
                {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                <div className="pt-4">
                    <Button onClick={handleAnalyze} disabled={isLoading || !file} className="w-full">
                        {isLoading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Analizando...
                            </>
                        ) : (
                            <>
                                <Icon name="sparkles" className="w-5 h-5" /> Analizar Factura
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};


// --- Income Form ---
const IncomeForm: React.FC<{
  onClose: () => void;
  incomeToEdit?: Partial<Income> | null;
}> = ({ onClose, incomeToEdit }) => {
  const context = useContext(AppContext);
  if (!context) throw new Error("Context not available");
  const { data, setData } = context;

  const [formData, setFormData] = useState<Partial<Income>>({
    id: incomeToEdit?.id || `inc-${Date.now()}`,
    invoiceNumber: incomeToEdit?.invoiceNumber || '',
    date: incomeToEdit?.date ? formatDateForInput(new Date(incomeToEdit.date).toISOString()) : new Date().toISOString().split('T')[0],
    clientName: incomeToEdit?.clientName || '',
    clientNif: incomeToEdit?.clientNif || '',
    clientAddress: incomeToEdit?.clientAddress || '',
    concept: incomeToEdit?.concept || '',
    baseAmount: incomeToEdit?.baseAmount || 0,
    vatRate: incomeToEdit?.vatRate ?? data.settings.defaultVatRate,
    irpfRate: incomeToEdit?.irpfRate ?? data.settings.defaultIrpfRate,
    source: incomeToEdit?.source || MoneySource.AUTONOMO,
    isPaid: incomeToEdit?.isPaid || false,
    location: incomeToEdit?.location || MoneyLocation.PRO_BANK,
    attachment: incomeToEdit?.attachment,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        const checked = (e.target as HTMLInputElement).checked;
        setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
        setFormData(prev => ({ ...prev, [name]: name.includes('Amount') || name.includes('Rate') ? parseFloat(value) : value }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          attachment: {
            name: file.name,
            type: file.type,
            data: (reader.result as string).split(',')[1],
          }
        }));
      };
    }
  };

  const removeAttachment = () => {
    setFormData(prev => {
      const { attachment, ...rest } = prev;
      return rest;
    });
    const fileInput = document.getElementById('attachment-file-input-income') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newIncome = { ...formData, date: new Date(formData.date!).toISOString() } as Income;
    setData(prevData => ({
      ...prevData,
      incomes: incomeToEdit?.id && prevData.incomes.some(i => i.id === incomeToEdit.id)
        ? prevData.incomes.map(i => i.id === incomeToEdit.id ? newIncome : i)
        : [...prevData.incomes, newIncome],
    }));
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
       {incomeToEdit?.attachment && !incomeToEdit.id?.startsWith('inc-') && (
           <div className="p-3 bg-primary-50 dark:bg-slate-700 rounded-md text-sm text-primary-700 dark:text-primary-200">
               <p><strong>Datos extraídos por IA y factura adjuntada.</strong> Por favor, revisa que todo sea correcto.</p>
           </div>
       )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Nº Factura" name="invoiceNumber" value={formData.invoiceNumber} onChange={handleChange} />
        <Input label="Fecha" name="date" type="date" value={formData.date} onChange={handleChange} required />
      </div>
      <fieldset className="border border-slate-300 dark:border-slate-600 p-4 rounded-md space-y-4">
        <legend className="text-sm font-medium px-2">Datos del Cliente</legend>
        <Input label="Nombre o Razón Social" name="clientName" value={formData.clientName} onChange={handleChange} required />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="NIF / CIF" name="clientNif" value={formData.clientNif} onChange={handleChange} />
            <Input label="Dirección" name="clientAddress" value={formData.clientAddress} onChange={handleChange} />
        </div>
      </fieldset>
      <Input label="Concepto" name="concept" value={formData.concept} onChange={handleChange} required />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input label="Base Imponible (€)" name="baseAmount" type="number" step="0.01" value={formData.baseAmount} onChange={handleChange} required />
        <Input label="IVA (%)" name="vatRate" type="number" step="0.01" value={formData.vatRate} onChange={handleChange} required />
        <Input label="IRPF (%)" name="irpfRate" type="number" step="0.01" value={formData.irpfRate} onChange={handleChange} required />
      </div>
       <div className="col-span-full">
            <label htmlFor="attachment-file-input-income" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Adjuntar factura
            </label>
            {formData.attachment ? (
                <div className="flex items-center gap-2 p-2 rounded-md bg-slate-100 dark:bg-slate-700">
                    <Icon name="paperclip" className="w-5 h-5 text-slate-500" />
                    <span className="text-sm truncate flex-grow">{formData.attachment.name}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={removeAttachment}>
                        <Icon name="trash" className="w-4 h-4 text-red-500" />
                    </Button>
                </div>
            ) : (
                <input
                    id="attachment-file-input-income"
                    type="file"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 dark:file:bg-slate-700 dark:file:text-slate-300 dark:hover:file:bg-slate-600"
                />
            )}
        </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select label="Fuente del dinero" name="source" value={formData.source} onChange={handleChange}>
            {Object.values(MoneySource).map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Select label="Ubicación del dinero (al cobrar)" name="location" value={formData.location} onChange={handleChange}>
            {Object.values(MoneyLocation).map(l => <option key={l} value={l}>{l}</option>)}
          </Select>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="isPaid" name="isPaid" checked={formData.isPaid} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
        <label htmlFor="isPaid" className="text-sm font-medium">Marcar como Pagada</label>
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit">{incomeToEdit?.id && data.incomes.some(i => i.id === incomeToEdit.id) ? 'Guardar Cambios' : 'Añadir Ingreso'}</Button>
      </div>
    </form>
  );
};


// --- Expense Form ---
const ExpenseForm: React.FC<{
    onClose: () => void;
    expenseToEdit?: Partial<Expense> | null;
}> = ({ onClose, expenseToEdit }) => {
    const context = useContext(AppContext);
    if (!context) throw new Error("Context not available");
    const { data, setData } = context;

    const [formData, setFormData] = useState<Partial<Expense>>({
        id: expenseToEdit?.id || `exp-${Date.now()}`,
        date: expenseToEdit?.date ? formatDateForInput(new Date(expenseToEdit.date).toISOString()) : new Date().toISOString().split('T')[0],
        providerName: expenseToEdit?.providerName || '',
        concept: expenseToEdit?.concept || '',
        baseAmount: expenseToEdit?.baseAmount || 0,
        vatRate: expenseToEdit?.vatRate ?? data.settings.defaultVatRate,
        categoryId: expenseToEdit?.categoryId || (data.professionalCategories[0]?.id || ''),
        location: expenseToEdit?.location || MoneyLocation.PRO_BANK,
        attachment: expenseToEdit?.attachment,
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name.includes('Amount') || name.includes('Rate') ? parseFloat(value) : value }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onloadend = () => {
            setFormData(prev => ({
              ...prev,
              attachment: {
                name: file.name,
                type: file.type,
                data: (reader.result as string).split(',')[1],
              }
            }));
          };
        }
      };
    
      const removeAttachment = () => {
        setFormData(prev => {
          const { attachment, ...rest } = prev;
          return rest;
        });
        const fileInput = document.getElementById('attachment-file-input-expense') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      };


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const newExpense = { ...formData, date: new Date(formData.date!).toISOString() } as Expense;
        setData(prevData => ({
            ...prevData,
            expenses: expenseToEdit?.id && prevData.expenses.some(e => e.id === expenseToEdit.id)
                ? prevData.expenses.map(ex => ex.id === expenseToEdit.id ? newExpense : ex)
                : [...prevData.expenses, newExpense],
        }));
        onClose();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {expenseToEdit?.attachment && !expenseToEdit.id?.startsWith('exp-') && (
                <div className="p-3 bg-primary-50 dark:bg-slate-700 rounded-md text-sm text-primary-700 dark:text-primary-200">
                    <p><strong>Datos extraídos por IA y factura adjuntada.</strong> Por favor, revisa que todo sea correcto.</p>
                </div>
            )}
            <Input label="Fecha" name="date" type="date" value={formData.date} onChange={handleChange} required />
            <Input label="Proveedor" name="providerName" value={formData.providerName} onChange={handleChange} required />
            <Input label="Concepto" name="concept" value={formData.concept} onChange={handleChange} required />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Base Imponible (€)" name="baseAmount" type="number" step="0.01" value={formData.baseAmount} onChange={handleChange} required />
                <Input label="IVA Soportado (%)" name="vatRate" type="number" step="0.01" value={formData.vatRate} onChange={handleChange} required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <Select label="Categoría" name="categoryId" value={formData.categoryId} onChange={handleChange} required>
                    <option value="" disabled>Selecciona una categoría</option>
                    {data.professionalCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </Select>
                 <Select label="Pagado desde" name="location" value={formData.location} onChange={handleChange} required>
                    {Object.values(MoneyLocation).map(l => <option key={l} value={l}>{l}</option>)}
                </Select>
            </div>
            <div className="col-span-full">
                <label htmlFor="attachment-file-input-expense" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Adjuntar factura
                </label>
                {formData.attachment ? (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-slate-100 dark:bg-slate-700">
                        <Icon name="paperclip" className="w-5 h-5 text-slate-500" />
                        <span className="text-sm truncate flex-grow">{formData.attachment.name}</span>
                        <Button type="button" variant="ghost" size="sm" onClick={removeAttachment}>
                            <Icon name="trash" className="w-4 h-4 text-red-500" />
                        </Button>
                    </div>
                ) : (
                    <input
                        id="attachment-file-input-expense"
                        type="file"
                        onChange={handleFileChange}
                        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 dark:file:bg-slate-700 dark:file:text-slate-300 dark:hover:file:bg-slate-600"
                    />
                )}
            </div>
            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                <Button type="submit">{expenseToEdit?.id && data.expenses.some(e => e.id === expenseToEdit.id) ? 'Guardar Cambios' : 'Añadir Gasto'}</Button>
            </div>
        </form>
    );
};

// --- Financial Summary Component ---
const FinancialSummary: React.FC<{
  summary: any;
  formatCurrency: (amount: number) => string;
  incomes: Income[];
  expenses: Expense[];
  transfers: Transfer[];
  settings: UserSettings;
  period: { startDate: Date; endDate: Date };
}> = React.memo(({ summary, formatCurrency, incomes, expenses, transfers, settings, period }) => {
    
    const kpiData = [
        { title: "Total Bruto Facturado", value: formatCurrency(summary.totalGrossInvoiced), tooltip: "Suma de las bases imponibles de todas tus facturas emitidas en el periodo." },
        { title: "Total Gastos Deducibles", value: formatCurrency(summary.totalExpenses), tooltip: "Suma de las bases imponibles de todos tus gastos relacionados con la actividad." },
        { title: "Beneficio Neto", value: formatCurrency(summary.netProfit), tooltip: "Ingresos (Base Imponible) - Gastos (Base Imponible) - Cuota de Autónomo. Es la base para calcular el IRPF.", className: summary.netProfit >= 0 ? 'text-green-500' : 'text-red-500' },
        { title: "Total Neto Recibido", value: formatCurrency(summary.totalNetReceived), tooltip: "Total facturado (IVA incluido) menos las retenciones de IRPF que te han practicado." },
        { title: "Resultado IVA (Mod. 303)", value: formatCurrency(summary.vatResult), tooltip: "IVA Repercutido (cobrado) - IVA Soportado (pagado). Si es positivo, es a pagar. Si es negativo, a compensar/devolver.", className: summary.vatResult >= 0 ? 'text-red-500' : 'text-green-500' },
        { title: "IRPF a Pagar (Mod. 130)", value: formatCurrency(summary.irpfToPay), tooltip: `Estimación del 20% sobre el Beneficio Neto. Se paga trimestralmente.`, className: 'text-red-500' },
    ];
    
    const handleExport = () => {
        generateQuarterlySummaryPDF(incomes, expenses, transfers, settings, period, summary);
    };

    return (
        <Card className="mb-6">
            <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Resumen Fiscal del Periodo</h2>
                <Button onClick={handleExport} variant="secondary" size="sm">
                    <Icon name="download" className="w-4 h-4" />
                    Exportar Resumen (PDF)
                </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {kpiData.map(kpi => (
                <div key={kpi.title} className="bg-slate-50 dark:bg-slate-700 p-4 rounded-lg">
                    <h3 className="text-sm text-slate-500 dark:text-slate-400 flex items-center">{kpi.title} <HelpTooltip content={kpi.tooltip} /></h3>
                    <p className={`text-2xl font-bold ${kpi.className || ''}`}>{kpi.value}</p>
                </div>
            ))}
          </div>
        </Card>
    );
});

// --- Main Professional View ---
const ProfessionalView: React.FC = () => {
  const context = useContext(AppContext);
  if (!context) return <div>Cargando...</div>;

  const { data, setData, formatCurrency } = context;
  const { incomes, expenses, transfers, settings, professionalCategories } = data;
  
  const [period, setPeriod] = useState<{ startDate: Date; endDate: Date }>(getCurrentQuarterInfo());

  const [isIncomeModalOpen, setIncomeModalOpen] = useState(false);
  const [isExpenseModalOpen, setExpenseModalOpen] = useState(false);
  const [isAiImportModalOpen, setAiImportModalOpen] = useState(false);
  const [incomeToEdit, setIncomeToEdit] = useState<Partial<Income> | null>(null);
  const [expenseToEdit, setExpenseToEdit] = useState<Partial<Expense> | null>(null);

  const handlePeriodChange = useCallback((startDate: Date, endDate: Date) => {
    setPeriod({ startDate, endDate });
  }, []);

  const openAttachment = useCallback((attachment: Attachment) => {
    const dataUrl = `data:${attachment.type};base64,${attachment.data}`;
    window.open(dataUrl, '_blank', 'noopener,noreferrer');
  }, []);


  const filteredIncomes = useMemo(() => filterByDateRange(incomes, period.startDate, period.endDate), [incomes, period]);
  const filteredExpenses = useMemo(() => filterByDateRange(expenses, period.startDate, period.endDate), [expenses, period]);
  const filteredTransfers = useMemo(() => filterByDateRange(transfers, period.startDate, period.endDate), [transfers, period]);

  const summary = useMemo(() => {
    const totalGrossInvoiced = filteredIncomes.reduce((acc, inc) => acc + inc.baseAmount, 0);
    const totalExpenses = filteredExpenses.reduce((acc, exp) => acc + exp.baseAmount, 0);
    const totalVatRepercutido = filteredIncomes.reduce((acc, inc) => acc + (inc.baseAmount * inc.vatRate / 100), 0);
    const totalVatSoportado = filteredExpenses.reduce((acc, exp) => acc + (exp.baseAmount * exp.vatRate / 100), 0);
    const totalIrpfSoportado = filteredIncomes.reduce((acc, inc) => acc + (inc.baseAmount * inc.irpfRate / 100), 0);
    
    // Calculate months in period for autonomo fee
    const end = period.endDate;
    const start = period.startDate;
    const months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
    const totalAutonomoFee = settings.monthlyAutonomoFee * months;

    const netProfit = totalGrossInvoiced - totalExpenses - totalAutonomoFee;
    const vatResult = totalVatRepercutido - totalVatSoportado;
    const irpfToPay = Math.max(0, netProfit * IRPF_MODELO_130_RATE);
    const totalNetReceived = totalGrossInvoiced + totalVatRepercutido - totalIrpfSoportado;

    return { totalGrossInvoiced, totalExpenses, netProfit, vatResult, irpfToPay, totalNetReceived };
  }, [filteredIncomes, filteredExpenses, settings.monthlyAutonomoFee, period]);
  
  const expenseChartData = useMemo(() => {
    const dataByCat = filteredExpenses.reduce((acc, expense) => {
        const categoryName = professionalCategories.find(c => c.id === expense.categoryId)?.name || 'Sin Categoría';
        acc[categoryName] = (acc[categoryName] || 0) + expense.baseAmount;
        return acc;
    }, {} as {[key: string]: number});

    return Object.entries(dataByCat).map(([name, value]) => ({ name, value }));
  }, [filteredExpenses, professionalCategories]);
  
  const incomeChartData = useMemo(() => {
     const dataByClient = filteredIncomes.reduce((acc, income) => {
        acc[income.clientName] = (acc[income.clientName] || 0) + income.baseAmount;
        return acc;
     }, {} as {[key: string]: number});
     return Object.entries(dataByClient).map(([name, value]) => ({ name, value }));
  }, [filteredIncomes]);

  const COLORS = ['#FF8042', '#0088FE', '#00C49F', '#FFBB28', '#AF19FF'];


  const handleOpenIncomeModal = (income?: Partial<Income>) => {
    setIncomeToEdit(income || null);
    setIncomeModalOpen(true);
  };
   const handleOpenExpenseModal = (expense?: Partial<Expense>) => {
    setExpenseToEdit(expense || null);
    setExpenseModalOpen(true);
  };
  
  const handleDelete = useCallback((type: 'income' | 'expense', id: string) => {
    if(window.confirm('¿Estás seguro de que quieres borrar este elemento?')) {
        setData(prev => {
            if (type === 'income') {
                return {...prev, incomes: prev.incomes.filter(i => i.id !== id)};
            }
            if (type === 'expense') {
                return {...prev, expenses: prev.expenses.filter(e => e.id !== id)};
            }
            return prev;
        });
    }
   }, [setData]);
   
   const handleTogglePaidStatus = useCallback((incomeId: string) => {
       setData(prev => ({
           ...prev,
           incomes: prev.incomes.map(inc => 
               inc.id === incomeId ? { ...inc, isPaid: !inc.isPaid } : inc
           )
       }))
   }, [setData]);

   const handleAnalysisComplete = (extractedData: Partial<Income> | Partial<Expense>, type: 'income' | 'expense', file: File) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const attachment: Attachment = {
                name: file.name,
                type: file.type,
                data: (reader.result as string).split(',')[1]
            };
            const dataWithAttachment = { ...extractedData, attachment };

            if (type === 'income') {
                handleOpenIncomeModal(dataWithAttachment);
            } else {
                handleOpenExpenseModal(dataWithAttachment);
            }
        };
        reader.onerror = (error) => {
            console.error("Error converting file to base64:", error);
            if (type === 'income') handleOpenIncomeModal(extractedData);
            else handleOpenExpenseModal(extractedData);
        };
   };


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Área Profesional</h2>
        <div title={!settings.geminiApiKey ? "Configura tu API Key de Gemini en Ajustes para activar" : "Importar factura con IA"}>
            <Button onClick={() => setAiImportModalOpen(true)} disabled={!settings.geminiApiKey}>
                <Icon name="sparkles" className="w-5 h-5"/> Importar con IA
            </Button>
        </div>
      </div>

      <PeriodSelector onPeriodChange={handlePeriodChange} />
      <FinancialSummary 
        summary={summary} 
        formatCurrency={formatCurrency}
        incomes={filteredIncomes}
        expenses={filteredExpenses}
        transfers={filteredTransfers}
        settings={settings}
        period={period}
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <Card>
            <h3 className="text-lg font-bold mb-4">Ingresos por Cliente</h3>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={incomeChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.2)" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(tick) => formatCurrency(tick)} />
                    <Tooltip formatter={(value: number) => formatCurrency(value as number)} />
                    <Legend />
                    <Bar dataKey="value" name="Ingresos" fill="#0088FE" />
                </BarChart>
            </ResponsiveContainer>
         </Card>
         <Card>
            <h3 className="text-lg font-bold mb-4">Gastos por Categoría</h3>
             <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                    <Pie data={expenseChartData} cx="50%" cy="50%" labelLine={false} outerRadius={80} fill="#8884d8" dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {expenseChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>
         </Card>
      </div>
      
      {/* Incomes List */}
      <Card>
          <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Ingresos / Facturas Emitidas</h2>
              <Button onClick={() => handleOpenIncomeModal()}>
                  <Icon name="plus" className="w-5 h-5" /> Añadir Ingreso
              </Button>
          </div>
           <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400">
                      <tr>
                          <th scope="col" className="px-6 py-3">Fecha</th>
                          <th scope="col" className="px-6 py-3">Cliente</th>
                          <th scope="col" className="px-6 py-3">Base</th>
                          <th scope="col" className="px-6 py-3">Total</th>
                          <th scope="col" className="px-6 py-3">Estado</th>
                          <th scope="col" className="px-6 py-3">Acciones</th>
                      </tr>
                  </thead>
                  <tbody>
                      {filteredIncomes.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(inc => (
                          <tr key={inc.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                              <td className="px-6 py-4">{new Date(inc.date).toLocaleDateString('es-ES')}</td>
                              <td className="px-6 py-4">{inc.clientName}</td>
                              <td className="px-6 py-4">{formatCurrency(inc.baseAmount)}</td>
                              <td className="px-6 py-4 font-semibold">{formatCurrency(inc.baseAmount * (1 + inc.vatRate/100) - inc.baseAmount * (inc.irpfRate/100))}</td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${inc.isPaid ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'}`}>
                                    {inc.isPaid ? 'Pagada' : 'Pendiente'}
                                </span>
                              </td>
                              <td className="px-6 py-4 flex gap-1">
                                 {inc.attachment && <Button size="sm" variant="ghost" onClick={() => openAttachment(inc.attachment!)} title="Ver adjunto"><Icon name="paperclip" className="w-4 h-4" /></Button>}
                                 <Button size="sm" variant="ghost" onClick={() => handleTogglePaidStatus(inc.id)} title={inc.isPaid ? 'Marcar como Pendiente' : 'Marcar como Pagada'}><Icon name="credit-card" className="w-4 h-4" /></Button>
                                 <Button size="sm" variant="ghost" onClick={() => generateInvoicePDF(inc, settings)} title="Descargar PDF"><Icon name="file" className="w-4 h-4" /></Button>
                                 <Button size="sm" variant="ghost" onClick={() => handleOpenIncomeModal(inc)} title="Editar"><Icon name="pencil" className="w-4 h-4" /></Button>
                                 <Button size="sm" variant="ghost" onClick={() => handleDelete('income', inc.id)} title="Eliminar"><Icon name="trash" className="w-4 h-4 text-red-500" /></Button>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
           </div>
           {filteredIncomes.length === 0 && <p className="text-center text-slate-500 py-8">No hay ingresos en este periodo.</p>}
      </Card>
      
      {/* Expenses List */}
      <Card>
          <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Gastos / Facturas Recibidas</h2>
              <Button onClick={() => handleOpenExpenseModal()}>
                  <Icon name="plus" className="w-5 h-5" /> Añadir Gasto
              </Button>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400">
                      <tr>
                          <th scope="col" className="px-6 py-3">Fecha</th>
                          <th scope="col" className="px-6 py-3">Proveedor</th>
                           <th scope="col" className="px-6 py-3">Categoría</th>
                          <th scope="col" className="px-6 py-3">Total</th>
                          <th scope="col" className="px-6 py-3">Acciones</th>
                      </tr>
                  </thead>
                   <tbody>
                      {filteredExpenses.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(exp => (
                          <tr key={exp.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                              <td className="px-6 py-4">{new Date(exp.date).toLocaleDateString('es-ES')}</td>
                              <td className="px-6 py-4">{exp.providerName}</td>
                              <td className="px-6 py-4">{professionalCategories.find(c => c.id === exp.categoryId)?.name || '-'}</td>
                              <td className="px-6 py-4 font-semibold">{formatCurrency(exp.baseAmount * (1 + exp.vatRate/100))}</td>
                              <td className="px-6 py-4 flex gap-2">
                                 {exp.attachment && <Button size="sm" variant="ghost" onClick={() => openAttachment(exp.attachment!)} title="Ver adjunto"><Icon name="paperclip" className="w-4 h-4" /></Button>}
                                 <Button size="sm" variant="ghost" onClick={() => handleOpenExpenseModal(exp)} title="Editar"><Icon name="pencil" className="w-4 h-4" /></Button>
                                 <Button size="sm" variant="ghost" onClick={() => handleDelete('expense', exp.id)} title="Eliminar"><Icon name="trash" className="w-4 h-4 text-red-500" /></Button>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
           </div>
            {filteredExpenses.length === 0 && <p className="text-center text-slate-500 py-8">No hay gastos en este periodo.</p>}
      </Card>

      <AiImportModal
        isOpen={isAiImportModalOpen}
        onClose={() => setAiImportModalOpen(false)}
        onAnalysisComplete={handleAnalysisComplete}
        apiKey={settings.geminiApiKey}
      />

      <Modal isOpen={isIncomeModalOpen} onClose={() => setIncomeModalOpen(false)} title={incomeToEdit?.id && data.incomes.some(i => i.id === incomeToEdit.id) ? "Editar Ingreso" : "Nuevo Ingreso"}>
        <IncomeForm onClose={() => setIncomeModalOpen(false)} incomeToEdit={incomeToEdit} />
      </Modal>

      <Modal isOpen={isExpenseModalOpen} onClose={() => setExpenseModalOpen(false)} title={expenseToEdit?.id && data.expenses.some(e => e.id === expenseToEdit.id) ? "Editar Gasto" : "Nuevo Gasto"}>
        <ExpenseForm onClose={() => setExpenseModalOpen(false)} expenseToEdit={expenseToEdit} />
      </Modal>

    </div>
  );
};

export default ProfessionalView;