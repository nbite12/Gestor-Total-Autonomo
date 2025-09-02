import { Income, UserSettings, Expense, Transfer, InvestmentGood } from './types';

declare global {
  interface Window {
    jspdf: any;
  }
}

// --- Shared Helpers ---
const formatDate = (isoDate: string | Date) => new Date(isoDate).toLocaleDateString('es-ES');
const formatCurrency = (amount: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);


export const generateInvoicePDF = (income: Income, settings: UserSettings) => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURA', 14, 22);

  // Payment Status
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  if (income.isPaid) {
      doc.setTextColor(34, 197, 94); // green-500
      doc.text('PAGADA', 195, 22, { align: 'right' });
  } else {
      doc.setTextColor(239, 68, 68); // red-500
      doc.text('PENDIENTE', 195, 22, { align: 'right' });
  }
  doc.setTextColor(0, 0, 0); // Reset color


  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nº Factura: ${income.invoiceNumber}`, 14, 30);
  doc.text(`Fecha: ${formatDate(income.date)}`, 14, 35);

  // Emitter info
  doc.setFont('helvetica', 'bold');
  doc.text(settings.fullName, 14, 50);
  doc.setFont('helvetica', 'normal');
  doc.text(settings.nif, 14, 55);
  doc.text(settings.address, 14, 60);

  // Client info
  doc.setFont('helvetica', 'bold');
  doc.text('Cliente:', 130, 50);
  doc.setFont('helvetica', 'normal');
  doc.text(income.clientName, 130, 55);
  if(income.clientNif) doc.text(income.clientNif, 130, 60);
  if(income.clientAddress) doc.text(income.clientAddress, 130, 65);


  // Table
  const vatAmount = (income.baseAmount * income.vatRate) / 100;
  const irpfAmount = (income.baseAmount * income.irpfRate) / 100;
  const total = income.baseAmount + vatAmount - irpfAmount;

  const tableColumn = ["Concepto", "Base Imponible", "IVA (%)", "IRPF (%)", "Total"];
  const tableRows = [[
    income.concept,
    formatCurrency(income.baseAmount),
    `${income.vatRate}%`,
    `${income.irpfRate}%`,
    formatCurrency(income.baseAmount + vatAmount)
  ]];

  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 80,
    theme: 'grid',
    headStyles: { fillColor: [249, 115, 22] } // Orange accent
  });

  // Totals
  const finalY = doc.lastAutoTable.finalY || 120;
  doc.setFontSize(12);
  doc.text(`Base Imponible: ${formatCurrency(income.baseAmount)}`, 130, finalY + 10);
  doc.text(`IVA (${income.vatRate}%): ${formatCurrency(vatAmount)}`, 130, finalY + 17);
  if (irpfAmount > 0) {
    doc.text(`Retención IRPF (${income.irpfRate}%): -${formatCurrency(irpfAmount)}`, 130, finalY + 24);
  }

  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL: ${formatCurrency(total)}`, 130, finalY + 31);

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('Factura generada con Gestor Total Autónomo', 14, 280);

  doc.save(`factura-${income.invoiceNumber}.pdf`);
};


export const generateQuarterlySummaryPDF = (
    incomes: Income[],
    expenses: Expense[],
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

    // --- HEADER ---
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen Fiscal Trimestral', 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${settings.fullName || 'No especificado'} - ${settings.nif || 'No especificado'}`, 14, 30);
    doc.text(`Periodo: ${formatDate(period.startDate)} - ${formatDate(period.endDate)}`, 14, 35);

    let finalY = 45;

    // --- INCOMES TABLE ---
    if (incomes.length > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Ingresos (Facturas Emitidas)', 14, finalY);
        finalY += 8;

        const incomeColumns = ["Nº Factura", "Fecha", "Cliente", "Base", "IVA", "IRPF", "Total"];
        const incomeRows = incomes.map(inc => {
            const vatAmount = inc.baseAmount * (inc.vatRate / 100);
            const irpfAmount = inc.baseAmount * (inc.irpfRate / 100);
            const total = inc.baseAmount + vatAmount - irpfAmount;
            return [
                inc.invoiceNumber,
                formatDate(inc.date),
                inc.clientName,
                formatCurrency(inc.baseAmount),
                formatCurrency(vatAmount),
                formatCurrency(-irpfAmount),
                formatCurrency(total)
            ];
        });

        doc.autoTable({
            head: [incomeColumns],
            body: incomeRows,
            startY: finalY,
            theme: 'grid',
            headStyles: { fillColor: [34, 197, 94] }
        });
        finalY = doc.lastAutoTable.finalY + 15;
    }

    // --- EXPENSES TABLE ---
    // Calculate autonomo fee explicitly
    const months = (period.endDate.getFullYear() - period.startDate.getFullYear()) * 12 + period.endDate.getMonth() - period.startDate.getMonth() + 1;
    const totalAutonomoFee = settings.monthlyAutonomoFee * months;

    if (expenses.length > 0 || totalAutonomoFee > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Gastos Deducibles', 14, finalY);
        finalY += 8;

        const expenseColumns = ["Fecha", "Proveedor", "Concepto", "Base", "IVA", "Total"];
        const expenseRows = expenses.map(exp => {
            const vatAmount = exp.baseAmount * (exp.vatRate / 100);
            const total = exp.baseAmount + vatAmount;
            return [
                formatDate(exp.date),
                exp.providerName,
                exp.concept,
                formatCurrency(exp.baseAmount),
                formatCurrency(vatAmount),
                formatCurrency(total)
            ];
        });
        
        // Add the autonomo fee as an expense row in the table
        if (totalAutonomoFee > 0) {
            expenseRows.push([
                `Periodo (${months} mes${months > 1 ? 'es' : ''})`,
                'Seguridad Social',
                'Cuota de Autónomo',
                formatCurrency(totalAutonomoFee),
                formatCurrency(0),
                formatCurrency(totalAutonomoFee)
            ]);
        }

        doc.autoTable({
            head: [expenseColumns],
            body: expenseRows,
            startY: finalY,
            theme: 'grid',
            headStyles: { fillColor: [239, 68, 68] }
        });
        finalY = doc.lastAutoTable.finalY + 15;
    }
    
    // --- TRANSFERS TABLE ---
    if (transfers.length > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Movimientos de Capital (No Deducibles)', 14, finalY);
        finalY += 8;

        const transferColumns = ["Fecha", "Concepto", "Justificación", "Importe"];
        const transferRows = transfers.map(tr => [
            formatDate(tr.date),
            tr.concept,
            tr.justification,
            formatCurrency(tr.amount),
        ]);

        doc.autoTable({
            head: [transferColumns],
            body: transferRows,
            startY: finalY,
            theme: 'grid',
            headStyles: { fillColor: [100, 116, 139] } // slate-500
        });
        finalY = doc.lastAutoTable.finalY + 15;
    }


    // --- TAX SUMMARY ---
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Liquidación de Impuestos', 14, finalY);
    finalY += 10;
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('IVA (Modelo 303)', 14, finalY);
    finalY += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const totalVatRepercutido = incomes.reduce((acc, inc) => acc + (inc.baseAmount * inc.vatRate / 100), 0);
    const totalVatSoportado = expenses.reduce((acc, exp) => acc + (exp.baseAmount * exp.vatRate / 100), 0);

    doc.text(`Total IVA Repercutido (Cobrado):`, 20, finalY);
    doc.text(formatCurrency(totalVatRepercutido), 195, finalY, { align: 'right' });
    finalY += 6;
    doc.text(`Total IVA Soportado (Pagado):`, 20, finalY);
    doc.text(formatCurrency(totalVatSoportado), 195, finalY, { align: 'right' });
    finalY += 8;
    doc.setFont('helvetica', 'bold');
    doc.text(`Resultado (A Pagar / Compensar):`, 20, finalY);
    doc.text(formatCurrency(summary.vatResult), 195, finalY, { align: 'right' });
    finalY += 12;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('IRPF (Modelo 130)', 14, finalY);
    finalY += 7;
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Ingresos Computables (Base Imponible):`, 20, finalY);
    doc.text(formatCurrency(summary.totalGrossInvoiced), 195, finalY, { align: 'right' });
    finalY += 6;
    doc.text(`Total Gastos Deducibles (Facturas + Cuota Autónomo):`, 20, finalY);
    doc.text(formatCurrency(summary.totalExpenses + totalAutonomoFee), 195, finalY, { align: 'right' });
    finalY += 6;
    doc.text(`Rendimiento Neto:`, 20, finalY);
    doc.text(formatCurrency(summary.netProfit), 195, finalY, { align: 'right' });
    finalY += 8;
    doc.setFont('helvetica', 'bold');
    doc.text(`Pago a Cuenta (Estimación Mod. 130):`, 20, finalY);
    doc.text(formatCurrency(summary.irpfToPay), 195, finalY, { align: 'right' });
    
    // --- FOOTER ---
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Informe generado con Gestor Total Autónomo', 14, doc.internal.pageSize.height - 10);

    const quarter = Math.floor(period.startDate.getMonth() / 3) + 1;
    const year = period.startDate.getFullYear();
    doc.save(`resumen-fiscal-${year}-T${quarter}.pdf`);
};


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
      return [
        formatDate(inc.date),
        inc.invoiceNumber,
        inc.clientName,
        inc.clientNif || '-',
        formatCurrency(inc.baseAmount),
        `${inc.vatRate}%`,
        formatCurrency(vatAmount),
        `${inc.irpfRate}%`,
        formatCurrency(irpfAmount),
        formatCurrency(total)
      ];
  });

  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 35,
    theme: 'grid',
    headStyles: { fillColor: [249, 115, 22] }
  });

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
      return [
          formatDate(exp.date),
          exp.invoiceNumber || '-',
          exp.providerName,
          exp.providerNif || '-',
          exp.concept,
          formatCurrency(exp.baseAmount),
          `${exp.vatRate}%`,
          formatCurrency(vatAmount),
          formatCurrency(total),
          exp.isDeductible ? 'Sí' : 'No'
      ];
  });

  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 35,
    theme: 'grid',
    headStyles: { fillColor: [239, 68, 68] }
  });

  doc.save(`libro-facturas-recibidas-${new Date().toISOString().split('T')[0]}.pdf`);
};

export const generateInvestmentGoodsPDF = (goods: InvestmentGood[]) => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Libro de Registro de Bienes de Inversión', 14, 22);
    
    const tableColumn = ["Fecha Compra", "Descripción", "Proveedor NIF", "Nº Factura", "Valor Adquisición", "Vida Útil", "Amortización Anual"];
    const tableRows = goods.sort((a,b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime()).map(good => {
        return [
            formatDate(good.purchaseDate),
            good.description,
            good.providerNif || '-',
            good.invoiceNumber || '-',
            formatCurrency(good.acquisitionValue),
            `${good.usefulLife} años`,
            formatCurrency(good.acquisitionValue / good.usefulLife)
        ];
    });

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [100, 116, 139] }
    });

    doc.save(`libro-bienes-inversion-${new Date().toISOString().split('T')[0]}.pdf`);
};