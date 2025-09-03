import React, { useState, useContext } from 'react';
import { AppContext } from '../App';
import { Income, Expense, InvestmentGood, Attachment, MoneyLocation, PersonalMovement, MoneySource } from '../types';
import { Button, Input, Select, Icon, Switch } from './ui';

// --- Helper Functions ---
const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
});

const formatDateForInput = (isoDate: string) => isoDate.split('T')[0];

// --- Form Attachment Component ---
const FormAttachment: React.FC<{
    attachment: Attachment | undefined;
    onFileChange: (file: File | null) => void;
}> = ({ attachment, onFileChange }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Adjuntar Factura (Opcional)</label>
        {!attachment ? (
            <Input type="file" label="" onChange={(e) => onFileChange(e.target.files?.[0] || null)} accept="image/*,application/pdf" />
        ) : (
            <div className="flex items-center justify-between p-2 bg-slate-100 dark:bg-slate-700 rounded-md">
                <span className="text-sm truncate"><Icon name="paperclip" className="inline w-4 h-4 mr-2" />{attachment.name}</span>
                <Button variant="ghost" size="sm" onClick={() => onFileChange(null)}><Icon name="x" className="w-4 h-4" /></Button>
            </div>
        )}
    </div>
);


// --- Form Components ---
export const IncomeForm: React.FC<{ onClose: () => void; incomeToEdit?: Partial<Income> | null; defaultIsPaid?: boolean; }> = ({ onClose, incomeToEdit, defaultIsPaid = false }) => {
  const { data, setData } = useContext(AppContext)!;
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
    isPaid: incomeToEdit?.isPaid ?? defaultIsPaid,
    location: incomeToEdit?.location || MoneyLocation.PRO_BANK,
    attachment: incomeToEdit?.attachment,
  });

  const handleFileChange = async (file: File | null) => {
    if (!file) {
        setFormData(prev => ({ ...prev, attachment: undefined }));
        return;
    }
    const base64 = await fileToBase64(file);
    setFormData(prev => ({ ...prev, attachment: { name: file.name, type: file.type, data: base64 } }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
        setFormData(prev => ({ ...prev, [name]: name.includes('Amount') || name.includes('Rate') ? parseFloat(value) : value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newIncome = { ...formData, date: new Date(formData.date!).toISOString() } as Income;
    if (newIncome.isPaid && !newIncome.paymentDate) {
        newIncome.paymentDate = newIncome.date;
    }

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Nº Factura" name="invoiceNumber" value={formData.invoiceNumber} onChange={handleChange} required />
        <Input label="Fecha Expedición" name="date" type="date" value={formData.date} onChange={handleChange} required />
      </div>
       <Input label="Nombre o Razón Social Cliente" name="clientName" value={formData.clientName} onChange={handleChange} required />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="NIF/CIF Cliente" name="clientNif" value={formData.clientNif} onChange={handleChange} />
        <Input label="Dirección Cliente" name="clientAddress" value={formData.clientAddress} onChange={handleChange} />
      </div>
      <Input label="Concepto" name="concept" value={formData.concept} onChange={handleChange} required />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input label="Base Imponible (€)" name="baseAmount" type="number" step="0.01" value={formData.baseAmount} onChange={handleChange} required />
        <Select label="Tipo de IVA (%)" name="vatRate" value={formData.vatRate} onChange={handleChange}>
            <option value="21">21% (General)</option><option value="10">10% (Reducido)</option><option value="4">4% (Superreducido)</option><option value="0">0% (Exento)</option>
        </Select>
        <Select label="Retención IRPF (%)" name="irpfRate" value={formData.irpfRate} onChange={handleChange}>
            <option value="15">15% (General)</option><option value="7">7% (Nuevos autónomos)</option><option value="0">0% (Sin retención)</option>
        </Select>
      </div>
      <Select label="Ubicación del Dinero (si está pagada)" name="location" value={formData.location} onChange={handleChange}>
        {Object.values(MoneyLocation).map(loc => <option key={loc} value={loc}>{loc}</option>)}
      </Select>
      <FormAttachment attachment={formData.attachment} onFileChange={handleFileChange} />
      <Switch label="Marcar como Pagada" checked={formData.isPaid ?? false} onChange={(c) => setFormData(p => ({...p, isPaid: c}))} />
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit">{incomeToEdit?.id && data.incomes.some(i => i.id === incomeToEdit.id) ? 'Guardar Cambios' : 'Añadir Ingreso'}</Button>
      </div>
    </form>
  );
};

export const ExpenseForm: React.FC<{ onClose: () => void; expenseToEdit?: Partial<Expense> | null; defaultIsPaid?: boolean; }> = ({ onClose, expenseToEdit, defaultIsPaid = true }) => {
    const { data, setData } = useContext(AppContext)!;
    const [formData, setFormData] = useState<Partial<Expense>>({
        id: expenseToEdit?.id || `exp-${Date.now()}`,
        date: expenseToEdit?.date ? formatDateForInput(new Date(expenseToEdit.date).toISOString()) : new Date().toISOString().split('T')[0],
        invoiceNumber: expenseToEdit?.invoiceNumber || '',
        providerName: expenseToEdit?.providerName || '',
        providerNif: expenseToEdit?.providerNif || '',
        concept: expenseToEdit?.concept || '',
        baseAmount: expenseToEdit?.baseAmount || 0,
        vatRate: expenseToEdit?.vatRate ?? data.settings.defaultVatRate,
        categoryId: expenseToEdit?.categoryId || (data.professionalCategories[0]?.id || ''),
        location: expenseToEdit?.location || MoneyLocation.PRO_BANK,
        isDeductible: expenseToEdit?.isDeductible ?? true,
        isPaid: expenseToEdit?.isPaid ?? defaultIsPaid,
        attachment: expenseToEdit?.attachment,
    });

    const handleFileChange = async (file: File | null) => {
        if (!file) { setFormData(prev => ({ ...prev, attachment: undefined })); return; }
        const base64 = await fileToBase64(file);
        setFormData(prev => ({ ...prev, attachment: { name: file.name, type: file.type, data: base64 } }));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
         if (type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: name.includes('Amount') || name.includes('Rate') ? parseFloat(value) : value }));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const newExpense = { ...formData, date: new Date(formData.date!).toISOString() } as Expense;
        if (newExpense.isPaid && !newExpense.paymentDate) {
            newExpense.paymentDate = newExpense.date;
        }
        setData(prevData => ({
            ...prevData,
            expenses: expenseToEdit?.id && prevData.expenses.some(ex => ex.id === expenseToEdit.id)
                ? prevData.expenses.map(ex => ex.id === expenseToEdit.id ? newExpense : ex)
                : [...prevData.expenses, newExpense],
        }));
        onClose();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Fecha Expedición" name="date" type="date" value={formData.date} onChange={handleChange} required />
                <Input label="Nº Factura" name="invoiceNumber" value={formData.invoiceNumber} onChange={handleChange} />
            </div>
            <Input label="Nombre o Razón Social Proveedor" name="providerName" value={formData.providerName} onChange={handleChange} required />
            <Input label="NIF/CIF Proveedor" name="providerNif" value={formData.providerNif} onChange={handleChange} />
            <Input label="Concepto" name="concept" value={formData.concept} onChange={handleChange} required />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Base Imponible (€)" name="baseAmount" type="number" step="0.01" value={formData.baseAmount} onChange={handleChange} required />
                <Select label="Tipo de IVA (%)" name="vatRate" value={formData.vatRate} onChange={handleChange}>
                    <option value="21">21%</option><option value="10">10%</option><option value="4">4%</option><option value="0">0%</option>
                </Select>
            </div>
            <Select label="Categoría" name="categoryId" value={formData.categoryId} onChange={handleChange} required>
                {data.professionalCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </Select>
            <Select label="Ubicación del Gasto" name="location" value={formData.location} onChange={handleChange}>
                {Object.values(MoneyLocation).map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </Select>
            <FormAttachment attachment={formData.attachment} onFileChange={handleFileChange} />
            <Switch label="Gasto Deducible" checked={formData.isDeductible ?? true} onChange={(c) => setFormData(p => ({...p, isDeductible: c}))} />
            <Switch label="Marcar como Pagado" checked={formData.isPaid ?? true} onChange={(c) => setFormData(p => ({...p, isPaid: c}))} />
            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                <Button type="submit">{expenseToEdit?.id ? 'Guardar Cambios' : 'Añadir Gasto'}</Button>
            </div>
        </form>
    );
};

export const InvestmentGoodForm: React.FC<{ onClose: () => void; goodToEdit?: Partial<InvestmentGood> | null; }> = ({ onClose, goodToEdit }) => {
    const { setData } = useContext(AppContext)!;
    const [formData, setFormData] = useState<Partial<InvestmentGood>>({
        id: goodToEdit?.id || `inv-${Date.now()}`,
        purchaseDate: goodToEdit?.purchaseDate ? formatDateForInput(new Date(goodToEdit.purchaseDate).toISOString()) : new Date().toISOString().split('T')[0],
        description: goodToEdit?.description || '',
        providerNif: goodToEdit?.providerNif || '',
        invoiceNumber: goodToEdit?.invoiceNumber || '',
        acquisitionValue: goodToEdit?.acquisitionValue || 0,
        usefulLife: goodToEdit?.usefulLife || 4,
        attachment: goodToEdit?.attachment,
    });

     const handleFileChange = async (file: File | null) => {
        if (!file) { setFormData(prev => ({ ...prev, attachment: undefined })); return; }
        const base64 = await fileToBase64(file);
        setFormData(prev => ({ ...prev, attachment: { name: file.name, type: file.type, data: base64 } }));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name.includes('Value') || name.includes('Life') ? parseFloat(value) : value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const newGood = { ...formData, purchaseDate: new Date(formData.purchaseDate!).toISOString() } as InvestmentGood;
        setData(prev => ({
            ...prev,
            investmentGoods: goodToEdit?.id && prev.investmentGoods.some(g => g.id === goodToEdit.id)
                ? prev.investmentGoods.map(g => g.id === goodToEdit.id ? newGood : g)
                : [...prev.investmentGoods, newGood],
        }));
        onClose();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Fecha de Compra" name="purchaseDate" type="date" value={formData.purchaseDate} onChange={handleChange} required />
            <Input label="Descripción del Bien" name="description" value={formData.description} onChange={handleChange} required />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="NIF/CIF Proveedor" name="providerNif" value={formData.providerNif} onChange={handleChange} />
                <Input label="Nº Factura" name="invoiceNumber" value={formData.invoiceNumber} onChange={handleChange} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Valor de Adquisición (Base Imponible)" name="acquisitionValue" type="number" step="0.01" min="0" value={formData.acquisitionValue} onChange={handleChange} required />
                <Input label="Vida Útil (Años)" name="usefulLife" type="number" step="1" min="1" value={formData.usefulLife} onChange={handleChange} required />
            </div>
            <FormAttachment attachment={formData.attachment} onFileChange={handleFileChange} />
            <p className="text-sm text-slate-500 dark:text-slate-400">Método de amortización: Lineal (automático)</p>
            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                <Button type="submit">{goodToEdit?.id ? 'Guardar Cambios' : 'Añadir Bien'}</Button>
            </div>
        </form>
    );
};

export const MovementForm: React.FC<{
    onClose: () => void;
    movementToEdit?: Partial<PersonalMovement> | null;
    defaultIsPaid?: boolean;
    defaultType?: 'income' | 'expense';
  }> = ({ onClose, movementToEdit, defaultIsPaid = true, defaultType = 'expense' }) => {
    const context = useContext(AppContext);
    if (!context) throw new Error("Context not available");
    const { data, setData } = context;
  
    const [formData, setFormData] = useState<Partial<PersonalMovement>>({
      id: movementToEdit?.id || `pm-${Date.now()}`,
      date: movementToEdit?.date ? formatDateForInput(new Date(movementToEdit.date).toISOString()) : new Date().toISOString().split('T')[0],
      concept: movementToEdit?.concept || '',
      amount: movementToEdit?.amount || 0,
      type: movementToEdit?.type || defaultType,
      categoryId: movementToEdit?.categoryId || (data.personalCategories[0]?.id || ''),
      source: movementToEdit?.source || MoneySource.PERSONAL,
      location: movementToEdit?.location || MoneyLocation.PERS_BANK,
      isPaid: movementToEdit?.isPaid ?? defaultIsPaid,
      paymentDate: movementToEdit?.paymentDate,
    });
  
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: name === 'amount' ? parseFloat(value) : value }));
    };
  
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const newMovement = { ...formData, date: new Date(formData.date!).toISOString() } as PersonalMovement;
      if (newMovement.isPaid && !newMovement.paymentDate) {
        newMovement.paymentDate = newMovement.date;
      }

      setData(prevData => ({
        ...prevData,
        personalMovements: movementToEdit?.id && prevData.personalMovements.some(m => m.id === movementToEdit.id)
          ? prevData.personalMovements.map(m => m.id === movementToEdit.id ? newMovement : m)
          : [...prevData.personalMovements, newMovement],
      }));
      onClose();
    };
  
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-4 mb-4">
            <Button type="button" variant={formData.type === 'expense' ? 'primary' : 'secondary'} onClick={() => setFormData(p => ({...p, type: 'expense'}))} className="flex-1">Gasto</Button>
            <Button type="button" variant={formData.type === 'income' ? 'primary' : 'secondary'} onClick={() => setFormData(p => ({...p, type: 'income'}))} className="flex-1">Ingreso</Button>
        </div>
        <Input label="Fecha" name="date" type="date" value={formData.date} onChange={handleChange} required />
        <Input label="Concepto" name="concept" value={formData.concept} onChange={handleChange} required />
        <Input label="Importe (€)" name="amount" type="number" step="0.01" min="0" value={formData.amount} onChange={handleChange} required />
        <Select label="Categoría" name="categoryId" value={formData.categoryId} onChange={handleChange} required>
            {data.personalCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
        </Select>
        <Select label="Ubicación del dinero" name="location" value={formData.location} onChange={handleChange} required>
          {Object.values(MoneyLocation).map(l => <option key={l} value={l}>{l}</option>)}
        </Select>
        {formData.type === 'income' && (
          <Select label="Fuente" name="source" value={formData.source} onChange={handleChange}>
             {Object.values(MoneySource).map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        )}
        <Switch label="Marcar como Pagado/Recibido" checked={formData.isPaid ?? false} onChange={(c) => setFormData(p => ({...p, isPaid: c}))} />
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit">{movementToEdit?.id ? 'Guardar Cambios' : 'Añadir Movimiento'}</Button>
        </div>
      </form>
    );
  };