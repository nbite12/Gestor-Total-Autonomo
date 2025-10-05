import { Income, UserSettings, Expense, Transfer, InvestmentGood } from '../types';

declare global {
  interface Window {
    jspdf: any;
  }
}

// --- Shared Helpers ---
const formatDate = (isoDate: string | Date) => new Date(isoDate).toLocaleDateString('es-ES');
const formatCurrency = (amount: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);

const addFooterToPDF = (doc: any) => {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('Informe generado con Gestor Total Autónomo', 14, doc.internal.pageSize.height - 10);
        doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10, { align: 'right' });
    }
};

const addSummaryToPDF = (doc: any, summary: any, isNewPage: boolean = false) => {
    let startY = (doc.lastAutoTable?.finalY || doc.y) + 15;

    if (isNewPage) {
        doc.addPage();
        startY = 20;
    } else if (startY > (doc.internal.pageSize.orientation === 'landscape' ? 120 : 180)) {
        doc.addPage();
        startY = 20;
    }

    // --- Resumen del Periodo ---
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen del Periodo', 14, startY);

    doc.autoTable({
        startY: startY + 8,
        theme: 'plain',
        styles: { cellPadding: 2 },
        body: [
            ['Total Ingresos (Base Imponible)', formatCurrency(summary.period.grossInvoiced)],
            ['Total Gastos Deducibles', formatCurrency(summary.period.totalDeductibleExpenses)],
            ['Rendimiento Neto del Periodo', { content: formatCurrency(summary.period.netProfit), styles: { fontStyle: 'bold' } }],
            ['', ''],
            ['IVA Repercutido', formatCurrency(summary.period.ivaRepercutido)],
            ['IVA Soportado Deducible', formatCurrency(summary.period.ivaSoportado)],
            ['Resultado IVA (Mod. 303)', { content: formatCurrency(summary.period.vatResult), styles: { fontStyle: 'bold' } }],
        ]
    });
    
    // --- Cálculo Acumulado IRPF ---
    let irpfStartY = (doc.lastAutoTable?.finalY || startY) + 15;
    if (irpfStartY > 180) {
        doc.addPage();
        irpfStartY = 20;
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Cálculo Acumulado IRPF (Mod. 130)', 14, irpfStartY);

    const model130 = summary.cumulative.model130;
    doc.autoTable({
        startY: irpfStartY + 8,
        theme: 'plain',
        styles: { cellPadding: 2 },
        body: [
            ['(+) Ingresos Acumulados', formatCurrency(model130.grossYTD)],
            ['(-) Gastos Deducibles Acumulados', formatCurrency(model130.deductibleExpensesYTD)],
            ['(=) Rendimiento Neto Acumulado', { content: formatCurrency(model130.netProfitYTD), styles: { fontStyle: 'bold' } }],
            ['(x) 20% Pago a Cuenta', formatCurrency(model130.quoteYTD)],
            ['(-) Retenciones Soportadas Acumuladas', formatCurrency(model130.retencionesSoportadasYTD)],
            ['(-) Pagos de Trimestres Anteriores', formatCurrency(model130.pagosAnteriores130)],
            ['', ''],
            ['(=) Total a Ingresar (Mod. 130)', { content: formatCurrency(model130.result), styles: { fontStyle: 'bold' } }],
        ]
    });
};

// --- Individual Invoice PDF ---
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

// --- Official Record Books PDFs ---
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
  addFooterToPDF(doc);
  doc.save(`libro-facturas-emitidas-${new Date().toISOString().split('T')[0]}.pdf`);
};

export const generateExpensesPDF = (expenses: Expense[], investmentGoods: InvestmentGood[]) => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Libro de Registro de Gastos y Bienes de Inversión', 14, 22);
  
  const tableColumn = ["Fecha", "Tipo", "Proveedor", "Concepto", "Base", "IVA %", "IVA €", "Total", "Deducibilidad"];

  const expenseRows = expenses.map(exp => {
      const vatAmount = (exp.baseAmount * exp.vatRate) / 100;
      const total = exp.baseAmount + vatAmount;
      let deductibilityInfo = 'No Deducible';
      if (exp.isDeductible) {
          if (exp.deductibleBaseAmount != null) {
              deductibilityInfo = `Parcial (${formatCurrency(exp.deductibleBaseAmount)})`;
          } else {
              deductibilityInfo = `Total (${formatCurrency(exp.baseAmount)})`;
          }
      }
      return [ formatDate(exp.date), 'Gasto', exp.providerName, exp.concept, formatCurrency(exp.baseAmount), `${exp.vatRate}%`, formatCurrency(vatAmount), formatCurrency(total), deductibilityInfo ];
  });
  
  const investmentRows = investmentGoods.map(good => {
      const vatAmount = good.acquisitionValue * (good.vatRate / 100);
      const total = good.acquisitionValue + vatAmount;
      const deductibilityInfo = good.isDeductible ? `Amortizable (${formatCurrency(good.acquisitionValue / good.usefulLife)}/año)` : 'No Deducible';
      return [ formatDate(good.purchaseDate), 'Bien Inversión', good.providerName, good.description, formatCurrency(good.acquisitionValue), `${good.vatRate}%`, formatCurrency(vatAmount), formatCurrency(total), deductibilityInfo ];
  });

  const allRows = [...expenseRows, ...investmentRows].sort((a,b) => new Date(a[0] as string).getTime() - new Date(b[0] as string).getTime());

  doc.autoTable({ head: [tableColumn], body: allRows, startY: 35, theme: 'grid', headStyles: { fillColor: [239, 68, 68] } });
  addFooterToPDF(doc);
  doc.save(`libro-gastos-${new Date().toISOString().split('T')[0]}.pdf`);
};


// --- NEW COMPREHENSIVE PDF REPORT ---
export const generateComprehensivePeriodPDF = (
    incomes: Income[],
    expenses: Expense[],
    investmentGoods: InvestmentGood[],
    transfers: Transfer[],
    settings: UserSettings,
    period: { startDate: Date; endDate: Date },
    summary: any // This will be the new comprehensive summary object
) => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // --- PAGE 1: COVER ---
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('Informe Financiero y Fiscal', 105, 40, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Periodo: ${formatDate(period.startDate)} - ${formatDate(period.endDate)}`, 105, 50, { align: 'center' });
    doc.text(`Titular: ${settings.fullName || 'No especificado'}`, 105, 60, { align: 'center' });
    doc.text(`NIF: ${settings.nif || 'No especificado'}`, 105, 67, { align: 'center' });

    // --- PAGE 2: INCOMES ---
    if (incomes.length > 0) {
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
    }
    
    // --- PAGE 3: EXPENSES ---
    if (expenses.length > 0) {
        doc.addPage();
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('Libro de Registro de Gastos Deducibles', 14, 22);
        doc.autoTable({
            head: [["Fecha", "Proveedor", "Concepto", "Base Total", "Base Deducible", "IVA", "Total"]],
            body: expenses.map(exp => {
                const deductibleBase = exp.isDeductible ? (exp.deductibleBaseAmount ?? exp.baseAmount) : 0;
                return [
                    formatDate(exp.date),
                    exp.providerName,
                    exp.concept,
                    formatCurrency(exp.baseAmount),
                    formatCurrency(deductibleBase),
                    formatCurrency(exp.baseAmount * exp.vatRate / 100),
                    formatCurrency(exp.baseAmount * (1 + exp.vatRate / 100))
                ];
            }),
            startY: 30, theme: 'grid', headStyles: { fillColor: [239, 68, 68] }
        });
    }

    // --- PAGE 4: INVESTMENT GOODS ---
    if (investmentGoods.length > 0) {
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
                const daysInPeriod = (effectiveEndDate.getTime() - effectiveStartDate.getTime()) / (1000 * 3600 * 24) + 1;
                periodAmortization = daysInPeriod * dailyAmortization;
            }
            
            return [formatDate(good.purchaseDate), good.description, formatCurrency(good.acquisitionValue), `${good.usefulLife} años`, formatCurrency(periodAmortization)];
        }).filter(row => row[4] !== formatCurrency(0)); // Only show goods that amortized in the period

        if (investmentRows.length > 0) {
            doc.autoTable({
                head: [["Fecha Compra", "Descripción", "Valor", "Vida Útil", "Amortización en Periodo"]],
                body: investmentRows,
                startY: 30, theme: 'grid', headStyles: { fillColor: [100, 116, 139] }
            });
        } else {
            doc.setFontSize(12);
            doc.text('No hay bienes de inversión con amortización computable en este periodo.', 14, 35);
        }
    }

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

    // --- FINAL PAGE: SUMMARY ---
    addSummaryToPDF(doc, summary, true);

    // --- FINALIZE ---
    addFooterToPDF(doc);
    const quarter = Math.floor(period.startDate.getMonth() / 3) + 1;
    const year = period.startDate.getFullYear();
    doc.save(`informe-total-${year}-T${quarter}.pdf`);
};