import { Income, UserSettings, Expense, Transfer, InvestmentGood } from './types';

declare global {
  interface Window {
    jspdf: any;
  }
}

// --- Shared Helpers ---
const formatDate = (isoDate: string | Date) => new Date(isoDate).toLocaleString('es-ES');
const formatCurrency = (amount: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);

// --- Individual Invoice PDF (remains unchanged) ---
export const generateInvoicePDF = (income: Income, settings: UserSettings) => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURA', 14, 22);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  if (income.isPaid) {
      doc.setTextColor(34, 197, 94); // green-500
      doc.text('PAGADA', 195, 22, { align: 'right' });
  } else {
      doc.setTextColor(239, 68, 68); // red-500
      doc.text('PENDIENTE', 195, 22, { align: 'right' });
  }
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nº Factura: ${income.invoiceNumber}`, 14, 30);
  doc.text(`Fecha: ${formatDate(income.date)}`, 14, 35);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.fullName, 14, 50);
  doc.setFont('helvetica', 'normal');
  doc.text(settings.nif, 14, 55);
  doc.text(settings.address, 14, 60);
  doc.setFont('helvetica', 'bold');
  doc.text('Cliente:', 130, 50);
  doc.setFont('helvetica', 'normal');
  doc.text(income.clientName, 130, 55);
  if(income.clientNif) doc.text(income.clientNif, 130, 60);
  if(income.clientAddress) doc.text(income.clientAddress, 130, 65);
  const vatAmount = (income.baseAmount * income.vatRate) / 100;
  const irpfAmount = (income.baseAmount * income.irpfRate) / 100;
  const total = income.baseAmount + vatAmount - irpfAmount;
  const tableColumn = ["Concepto", "Base Imponible", "IVA (%)", "IRPF (%)", "Total"];
  const tableRows = [[ income.concept, formatCurrency(income.baseAmount), `${income.vatRate}%`, `${income.irpfRate}%`, formatCurrency(income.baseAmount + vatAmount)]];
  doc.autoTable({ head: [tableColumn], body: tableRows, startY: 80, theme: 'grid', headStyles: { fillColor: [249, 115, 22] } });
  const finalY = doc.lastAutoTable.finalY || 120;
  doc.setFontSize(12);
  doc.text(`Base Imponible: ${formatCurrency(income.baseAmount)}`, 130, finalY + 10);
  doc.text(`IVA (${income.vatRate}%): ${formatCurrency(vatAmount)}`, 130, finalY + 17);
  if (irpfAmount > 0) doc.text(`Retención IRPF (${income.irpfRate}%): -${formatCurrency(irpfAmount)}`, 130, finalY + 24);
  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL: ${formatCurrency(total)}`, 130, finalY + 31);
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('Factura generada con Gestor Total Autónomo', 14, 280);
  doc.save(`factura-${income.invoiceNumber}.pdf`);
};

// --- Official Record Books PDFs (remain unchanged, can be used for individual exports) ---
export const generateIncomesPDF = (incomes: Income[]) => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Libro de Registro de Facturas Emitidas', 14, 22);
  const tableColumn = ["Fecha", "Nº Factura", "Cliente", "NIF", "Base", "IVA %", "IVA €", "IRPF %", "IRPF €", "Total"];
  const tableRows = incomes.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(inc => {
      const vatAmount = (inc.baseAmount * inc.vatRate) / 100;
      const irpfAmount = (inc.baseAmount * inc.irpfRate) / 100;
      const total = inc.baseAmount + vatAmount - irpfAmount;
      return [ formatDate(inc.date), inc.invoiceNumber, inc.clientName, inc.clientNif || '-', formatCurrency(inc.baseAmount), `${inc.vatRate}%`, formatCurrency(vatAmount), `${inc.irpfRate}%`, formatCurrency(irpfAmount), formatCurrency(total) ];
  });
  doc.autoTable({ head: [tableColumn], body: tableRows, startY: 35, theme: 'grid', headStyles: { fillColor: [249, 115, 22] } });
  doc.save(`libro-facturas-emitidas-${new Date().toISOString().split('T')[0]}.pdf`);
};
export const generateExpensesPDF = (expenses: Expense[]) => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Libro de Registro de Facturas Recibidas', 14, 22);
  const tableColumn = ["Fecha", "Nº Factura", "Proveedor", "NIF", "Concepto", "Base", "IVA %", "IVA €", "Total", "Deducible"];
  const tableRows = expenses.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(exp => {
      const vatAmount = (exp.baseAmount * exp.vatRate) / 100;
      const total = exp.baseAmount + vatAmount;
      return [ formatDate(exp.date), exp.invoiceNumber || '-', exp.providerName, exp.providerNif || '-', exp.concept, formatCurrency(exp.baseAmount), `${exp.vatRate}%`, formatCurrency(vatAmount), formatCurrency(total), exp.isDeductible ? 'Sí' : 'No' ];
  });
  doc.autoTable({ head: [tableColumn], body: tableRows, startY: 35, theme: 'grid', headStyles: { fillColor: [239, 68, 68] } });
  doc.save(`libro-facturas-recibidas-${new Date().toISOString().split('T')[0]}.pdf`);
};
export const generateInvestmentGoodsPDF = (goods: InvestmentGood[]) => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Libro de Registro de Bienes de Inversión', 14, 22);
    const tableColumn = ["Fecha Compra", "Descripción", "Proveedor NIF", "Nº Factura", "Valor Adquisición", "Vida Útil", "Amortización Anual"];
    const tableRows = goods.sort((a,b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime()).map(good => { return [ formatDate(good.purchaseDate), good.description, good.providerNif || '-', good.invoiceNumber || '-', formatCurrency(good.acquisitionValue), `${good.usefulLife} años`, formatCurrency(good.acquisitionValue / good.usefulLife) ]; });
    doc.autoTable({ head: [tableColumn], body: tableRows, startY: 35, theme: 'grid', headStyles: { fillColor: [100, 116, 139] } });
    doc.save(`libro-bienes-inversion-${new Date().toISOString().split('T')[0]}.pdf`);
};

// --- NEW COMPREHENSIVE PDF REPORT ---
export const generateComprehensivePeriodPDF = (
    incomes: Income[],
    expenses: Expense[],
    investmentGoods: InvestmentGood[],
    transfers: Transfer[],
    settings: UserSettings,
    period: { startDate: Date; endDate: Date },
    summary: {
        totalGrossInvoiced: number;
        totalExpenses: number;
        netProfit: number;
        vatResult: number;
        irpfToPay: number;
    }
) => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const addFooter = () => {
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text('Informe generado con Gestor Total Autónomo', 14, doc.internal.pageSize.height - 10);
            doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10, { align: 'right' });
        }
    };

    // --- PAGE 1: COVER & SUMMARY ---
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('Informe Financiero y Fiscal', 105, 40, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Periodo: ${formatDate(period.startDate)} - ${formatDate(period.endDate)}`, 105, 50, { align: 'center' });
    doc.text(`Titular: ${settings.fullName || 'No especificado'}`, 105, 60, { align: 'center' });
    doc.text(`NIF: ${settings.nif || 'No especificado'}`, 105, 67, { align: 'center' });

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen de Impuestos', 14, 100);
    
    doc.autoTable({
        startY: 108,
        theme: 'plain',
        body: [
            ['Total Ingresos (Base Imponible)', formatCurrency(summary.totalGrossInvoiced)],
            ['Total Gastos Deducibles', formatCurrency(summary.totalExpenses)],
            ['Rendimiento Neto', { content: formatCurrency(summary.netProfit), styles: { fontStyle: 'bold' } }],
            [''], // spacer
            ['IVA Repercutido', formatCurrency(summary.vatResult + expenses.reduce((acc, exp) => acc + (exp.baseAmount * exp.vatRate / 100), 0))],
            ['IVA Soportado Deducible', formatCurrency(expenses.reduce((acc, exp) => acc + (exp.baseAmount * exp.vatRate / 100), 0))],
            ['Resultado IVA (Mod. 303)', { content: formatCurrency(summary.vatResult), styles: { fontStyle: 'bold' } }],
            [''], // spacer
            ['Pago a Cuenta IRPF (Mod. 130)', { content: formatCurrency(summary.irpfToPay), styles: { fontStyle: 'bold' } }],
        ]
    });

    // --- PAGE 2: INCOMES ---
    doc.addPage();
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Libro de Registro de Facturas Emitidas', 14, 22);
    doc.autoTable({
        head: [["Fecha", "Nº Factura", "Cliente", "Base", "IVA", "IRPF", "Total"]],
        body: incomes.map(inc => {
            const vat = inc.baseAmount * inc.vatRate / 100;
            const irpf = inc.baseAmount * inc.irpfRate / 100;
            return [formatDate(inc.date), inc.invoiceNumber, inc.clientName, formatCurrency(inc.baseAmount), formatCurrency(vat), formatCurrency(-irpf), formatCurrency(inc.baseAmount + vat - irpf)];
        }),
        startY: 30, theme: 'grid', headStyles: { fillColor: [34, 197, 94] }
    });
    
    // --- PAGE 3: EXPENSES ---
    doc.addPage();
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Libro de Registro de Gastos Deducibles', 14, 22);
    const months = (period.endDate.getFullYear() - period.startDate.getFullYear()) * 12 + period.endDate.getMonth() - period.startDate.getMonth() + 1;
    const totalAutonomoFee = settings.monthlyAutonomoFee * months;
    const expenseRows = expenses.map(exp => [formatDate(exp.date), exp.providerName, exp.concept, formatCurrency(exp.baseAmount), formatCurrency(exp.baseAmount * exp.vatRate / 100), formatCurrency(exp.baseAmount * (1 + exp.vatRate / 100))]);
    if(totalAutonomoFee > 0) expenseRows.push(['Periodo', 'Seguridad Social', 'Cuota de Autónomo', formatCurrency(totalAutonomoFee), formatCurrency(0), formatCurrency(totalAutonomoFee)]);
    doc.autoTable({
        head: [["Fecha", "Proveedor", "Concepto", "Base", "IVA", "Total"]],
        body: expenseRows,
        startY: 30, theme: 'grid', headStyles: { fillColor: [239, 68, 68] }
    });

    // --- PAGE 4: INVESTMENT GOODS ---
    doc.addPage();
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Libro de Bienes de Inversión (Amortización del Periodo)', 14, 22);
    const investmentRows = investmentGoods.map(good => {
        const dailyAmortization = (good.acquisitionValue / good.usefulLife) / 365.25;
        const goodStartDate = new Date(good.purchaseDate);
        const goodEndDate = new Date(goodStartDate.getFullYear() + good.usefulLife, goodStartDate.getMonth(), goodStartDate.getDate());
        
        const effectiveStartDate = goodStartDate > period.startDate ? goodStartDate : period.startDate;
        const effectiveEndDate = goodEndDate < period.endDate ? goodEndDate : period.endDate;
        
        let periodAmortization = 0;
        if (effectiveEndDate > effectiveStartDate) {
            const daysInPeriod = (effectiveEndDate.getTime() - effectiveStartDate.getTime()) / (1000 * 3600 * 24);
            periodAmortization = daysInPeriod * dailyAmortization;
        }
        
        return [formatDate(good.purchaseDate), good.description, formatCurrency(good.acquisitionValue), `${good.usefulLife} años`, formatCurrency(periodAmortization)];
    });
    doc.autoTable({
        head: [["Fecha Compra", "Descripción", "Valor", "Vida Útil", "Amortización en Periodo"]],
        body: investmentRows,
        startY: 30, theme: 'grid', headStyles: { fillColor: [100, 116, 139] }
    });

    // --- PAGE 5: TRANSFERS ---
    if(transfers.length > 0) {
        doc.addPage();
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('Registro de Movimientos de Capital', 14, 22);
        doc.autoTable({
            head: [["Fecha", "Concepto", "Desde", "Hasta", "Importe"]],
            body: transfers.map(t => [formatDate(t.date), t.concept, t.fromLocation, t.toLocation, formatCurrency(t.amount)]),
            startY: 30, theme: 'grid', headStyles: { fillColor: [96, 165, 250] }
        });
    }

    // --- FINALIZE ---
    addFooter();
    const quarter = Math.floor(period.startDate.getMonth() / 3) + 1;
    const year = period.startDate.getFullYear();
    doc.save(`informe-total-${year}-T${quarter}.pdf`);
};
