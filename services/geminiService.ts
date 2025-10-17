import { GoogleGenAI, Type } from "@google/genai";
// FIX: Removed PotentialIncome and PotentialExpense, added ScheduledTransaction to align with current data model.
import { Income, Expense, InvestmentGood, Category, AppData, MoneyLocation, TransferJustification, MoneySource, PersonalMovement, Transfer, SavingsGoal, ScheduledTransaction } from '../types';

// Extend the window interface for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}


const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      resolve((reader.result as string).split(',')[1]);
    };
    reader.onerror = error => reject(error);
  });
};

const incomeSchema = {
  type: Type.OBJECT,
  properties: {
    invoiceNumber: { type: Type.STRING, description: "Número de la factura" },
    date: { type: Type.STRING, description: "Fecha de la factura en formato YYYY-MM-DD" },
    clientName: { type: Type.STRING, description: "Nombre completo o razón social del cliente" },
    clientNif: { type: Type.STRING, description: "NIF o CIF del cliente, si aparece" },
    clientAddress: { type: Type.STRING, description: "Dirección del cliente, si aparece" },
    concept: { type: Type.STRING, description: "Descripción del servicio o producto" },
    baseAmount: { type: Type.NUMBER, description: "Importe base antes de impuestos" },
    vatRate: { type: Type.NUMBER, description: "Porcentaje de IVA aplicado" },
    irpfRate: { type: Type.NUMBER, description: "Porcentaje de IRPF retenido" },
  },
  required: ["date", "concept", "baseAmount", "vatRate"]
};

const expenseSchema = {
    type: Type.OBJECT,
    properties: {
        invoiceNumber: { type: Type.STRING, description: "Número de la factura, si aparece" },
        date: { type: Type.STRING, description: "Fecha de la factura en formato YYYY-MM-DD" },
        providerName: { type: Type.STRING, description: "Nombre completo o razón social del proveedor" },
        providerNif: { type: Type.STRING, description: "NIF o CIF del proveedor, si aparece" },
        concept: { type: Type.STRING, description: "Descripción del gasto" },
        baseAmount: { type: Type.NUMBER, description: "Importe base antes de impuestos" },
        vatRate: { type: Type.NUMBER, description: "Porcentaje de IVA soportado" },
        isDeductible: { type: Type.BOOLEAN, description: "Determina si el gasto es deducible para la actividad profesional del autónomo. Por defecto, true, a menos que sea claramente un gasto personal." },
        suggestedDeductibleBaseAmount: { type: Type.NUMBER, description: "Opcional. Si el concepto es una comida, hotel, etc. con límite de deducibilidad en España, calcula la base máxima deducible. Si es 100% deducible, no incluyas este campo." },
        suggestedCategoryName: { type: Type.STRING, description: "Analiza el concepto y proveedor para sugerir la categoría más adecuada para este gasto, eligiendo una de las opciones proporcionadas." },
    },
    required: ["date", "providerName", "concept", "baseAmount", "vatRate", "isDeductible"]
};

const investmentGoodSchema = {
    type: Type.OBJECT,
    properties: {
        purchaseDate: { type: Type.STRING, description: "Fecha de la compra del bien en formato YYYY-MM-DD" },
        description: { type: Type.STRING, description: "Descripción clara y concisa del bien de inversión (ej: 'Ordenador Portátil MacBook Pro 14 pulgadas')" },
        providerName: { type: Type.STRING, description: "Nombre completo o razón social del proveedor" },
        providerNif: { type: Type.STRING, description: "NIF o CIF del proveedor, si aparece" },
        invoiceNumber: { type: Type.STRING, description: "Número de la factura de compra, si aparece" },
        acquisitionValue: { type: Type.NUMBER, description: "Valor de adquisición, que es la base imponible de la compra" },
        vatRate: { type: Type.NUMBER, description: "Porcentaje de IVA soportado en la compra" },
        usefulLife: { type: Type.NUMBER, description: "Vida útil en años. Si no se especifica, usa 4 para equipos informáticos, 10 para mobiliario, 8 para maquinaria." },
    },
    required: ["purchaseDate", "description", "providerName", "acquisitionValue", "vatRate", "usefulLife"]
};


export const extractInvoiceData = async (
    file: File, 
    invoiceType: 'income' | 'expense' | 'investment', 
    apiKey: string,
    categories: Category[] = []
): Promise<Partial<Income> | Partial<Expense> | Partial<InvestmentGood>> => {

    if (!apiKey) {
        throw new Error("API Key de Gemini no configurada.");
    }
    
    const ai = new GoogleGenAI({ apiKey });
    
    const base64Data = await fileToBase64(file);
    
    let schema;
    let textPrompt;

    switch (invoiceType) {
        case 'income':
            schema = incomeSchema;
            textPrompt = 'Analiza este documento de una factura emitida (un ingreso) y extrae los detalles estructurados. Responde únicamente con el objeto JSON.';
            break;
        case 'expense':
            const categoryNames = categories.map(c => `'${c.name}'`).join(', ');
            schema = expenseSchema;
            textPrompt = `Analiza este documento de una factura recibida (un gasto) y extrae los detalles estructurados. Como asesor fiscal español, determina si este gasto parece ser deducible para la actividad profesional. Si es un gasto con límite (como una comida o pernocta), calcula y proporciona el campo 'suggestedDeductibleBaseAmount' con el límite aplicable en España. Además, sugiere la categoría más apropiada para este gasto en el campo 'suggestedCategoryName', eligiendo una de las siguientes opciones: ${categoryNames}. Responde únicamente con el objeto JSON.`;
            break;
        case 'investment':
            schema = investmentGoodSchema;
            textPrompt = 'Analiza este documento de una factura de un bien de inversión y extrae los detalles estructurados. Responde únicamente con el objeto JSON.';
            break;
    }

    const filePart = {
        inlineData: {
            mimeType: file.type,
            data: base64Data,
        },
    };
    
    const textPart = { text: textPrompt };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [filePart, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });

        const jsonString = response.text.trim();
        const extractedData = JSON.parse(jsonString);
        
        const dateKey = invoiceType === 'investment' ? 'purchaseDate' : 'date';
        if (extractedData[dateKey] && isNaN(new Date(extractedData[dateKey]).getTime())) {
            console.warn("Invalid date from AI, defaulting to today:", extractedData[dateKey]);
            extractedData[dateKey] = new Date().toISOString().split('T')[0];
        }

        return extractedData;

    } catch (error) {
        console.error("Error al contactar con la API de Gemini:", error);
        throw new Error("No se pudo extraer la información de la factura. Revisa el documento o la configuración de la API.");
    }
};


// --- Natural Language Commands ---
export interface ParsedCommand {
    action: 'income' | 'expense' | 'personal_movement' | 'transfer';
    concept: string;
    amount?: number;
    baseAmount?: number;
    date: string; // YYYY-MM-DD
    partyName?: string;
    categoryHint?: string;
    locationHint?: string;
    fromLocationHint?: string;
    toLocationHint?: string;
    isProfessional: boolean;
    movementType?: 'income' | 'expense';
    suggestedDeductibleBaseAmount?: number;
}

const commandSchema = {
    type: Type.OBJECT,
    properties: {
        action: { type: Type.STRING, description: "La acción: 'income', 'expense', 'personal_movement', 'transfer'." },
        concept: { type: Type.STRING, description: "Descripción del movimiento." },
        amount: { type: Type.NUMBER, description: "El importe monetario principal. Si es un gasto profesional, este es el importe TOTAL de la factura." },
        baseAmount: { type: Type.NUMBER, description: "La base imponible real del gasto. Si se da el total ('amount'), calcúlala asumiendo un 21% de IVA a no ser que se especifique otro." },
        date: { type: Type.STRING, description: "Fecha en formato YYYY-MM-DD. Si se dice 'ayer', 'hoy', etc., conviértelo. Por defecto, hoy." },
        partyName: { type: Type.STRING, description: "Nombre del cliente o proveedor (para 'income'/'expense')." },
        categoryHint: { type: Type.STRING, description: "Pista sobre la categoría del gasto (para 'expense'/'personal_movement')." },
        locationHint: { type: Type.STRING, description: "Pista sobre la ubicación del dinero (para 'income'/'expense'/'personal_movement')." },
        fromLocationHint: { type: Type.STRING, description: "Pista sobre el origen (para 'transfer')." },
        toLocationHint: { type: Type.STRING, description: "Pista sobre el destino (para 'transfer')." },
        isProfessional: { type: Type.BOOLEAN, description: "True si es un movimiento de autónomo/profesional (ej. 'factura', 'gasto deducible')." },
        movementType: { type: Type.STRING, description: "'income' o 'expense' para movimientos personales ('personal_movement')." },
        suggestedDeductibleBaseAmount: { type: Type.NUMBER, description: "La base imponible MÁXIMA deducible para este gasto. Se debe calcular solo si el concepto es una dieta, comida, viaje, hotel o similar con límites de deducibilidad en España." },
    },
    required: ["action", "concept", "date", "isProfessional"]
};

export const parseNaturalLanguageTransaction = async (
    command: string, 
    apiKey: string,
    professionalCategories: Category[],
    personalCategories: Category[]
): Promise<ParsedCommand> => {
    if (!apiKey) throw new Error("API Key de Gemini no configurada.");
    const ai = new GoogleGenAI({ apiKey });

    const proCategoryNames = professionalCategories.map(c => `'${c.name}'`).join(', ');
    const perCategoryNames = personalCategories.map(c => `'${c.name}'`).join(', ');

    const systemInstruction = `Eres un asistente financiero para un autónomo en España. Tu tarea es analizar el texto y estructurarlo en JSON. La fecha de hoy es ${new Date().toISOString().split('T')[0]}.
Reglas para gastos ('expense' o 'personal_movement'):
1.  Si el usuario menciona un importe, asume que es el TOTAL (IVA incluido) y ponlo en 'amount'. Calcula la 'baseAmount' asumiendo un 21% de IVA (dividiendo por 1.21) a no ser que se especifique otro porcentaje.
2.  Si el concepto es una comida, cena, restaurante, hotel, viaje o similar, calcula el 'suggestedDeductibleBaseAmount'.
    -   Para comidas/cenas en España: el máximo deducible es 26,67€.
    -   Para hoteles en España: el máximo deducible por pernocta es 53,34€.
    -   Para gastos de locomoción (transporte público, taxi): es 100% deducible si está justificado. No pongas 'suggestedDeductibleBaseAmount'.
3.  Si es un gasto que no parece tener límite (ej: 'compra de material de oficina'), no incluyas 'suggestedDeductibleBaseAmount'.
4.  Analiza el concepto y el contexto del gasto y sugiere la categoría más apropiada en el campo 'categoryHint'.
    - Si es un gasto profesional ('isProfessional' es true), elige una categoría de esta lista: ${proCategoryNames}.
    - Si es un gasto personal ('isProfessional' es false), elige una de esta lista: ${perCategoryNames}.
Responde únicamente con el objeto JSON.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: command,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: commandSchema,
            }
        });
        const jsonString = response.text.trim();
        return JSON.parse(jsonString) as ParsedCommand;
    } catch (error) {
        console.error("Error en parseNaturalLanguageTransaction:", error);
        throw new Error("No he podido entender la orden. Inténtalo de nuevo siendo más específico, por ejemplo: 'Añadir gasto de 50€ en comida del banco personal'.");
    }
};

// --- Deductibility Suggestion ---
export interface DeductibilitySuggestion {
  isDeductible: boolean;
  deductibleBaseAmount?: number;
  reason: string;
}

const deductibilitySchema = {
    type: Type.OBJECT,
    properties: {
        isDeductible: { type: Type.BOOLEAN, description: "Si el gasto es fiscalmente deducible para un autónomo en España." },
        deductibleBaseAmount: { type: Type.NUMBER, description: "Opcional. Si existe un límite, la base máxima deducible. Para dietas (comidas) en España, es 26.67€. Para pernoctas, 53.34€. Si es 100% deducible, omite este campo." },
        reason: { type: Type.STRING, description: "Una breve explicación en español de la sugerencia (ej: 'Las comidas de negocios tienen un límite de deducibilidad.')." }
    },
    required: ['isDeductible', 'reason']
};

export const suggestDeductibility = async (concept: string, baseAmount: number, apiKey: string): Promise<DeductibilitySuggestion> => {
    if (!apiKey) throw new Error("API Key de Gemini no configurada.");
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Como asesor fiscal experto en España, analiza el siguiente gasto de un autónomo. Concepto: "${concept}", Base Imponible: ${baseAmount}€. Determina si es deducible y si tiene algún límite.`;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: deductibilitySchema,
            }
        });
        
        const jsonString = response.text.trim();
        const result = JSON.parse(jsonString) as DeductibilitySuggestion;

        if (result.deductibleBaseAmount && result.deductibleBaseAmount > baseAmount) {
            result.deductibleBaseAmount = baseAmount;
            result.reason += " (Ajustado al importe total del gasto)."
        }

        return result;
    } catch(error) {
        console.error("Error en suggestDeductibility:", error);
        throw new Error("No se pudo obtener la sugerencia de la IA. Inténtalo de nuevo.");
    }
};

// --- NEW Conversational Tax Assistant ---
export const askWithImageContext = async (
    prompt: string,
    imageFile: File | null,
    apiKey: string,
): Promise<string> => {
    if (!apiKey) throw new Error("API Key de Gemini no configurada.");

    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `Eres un asesor fiscal experto para autónomos en España. Tu nombre es LifeOS Assistant. Responde a las preguntas del usuario de forma clara, concisa y profesional. Si te proporcionan una imagen de un documento o borrador, úsala como contexto principal para tu respuesta. Sé didáctico y ayuda al usuario a entender los conceptos fiscales.`;

    const parts: any[] = [];
    if (imageFile) {
        const base64Data = await fileToBase64(imageFile);
        parts.push({
            inlineData: {
                mimeType: imageFile.type,
                data: base64Data,
            },
        });
    }

    if (prompt) {
        parts.push({ text: prompt });
    }

    if (parts.length === 0) {
        throw new Error("Debes proporcionar una imagen o una pregunta.");
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts },
            config: {
                systemInstruction,
            },
        });

        return response.text;
    } catch (error) {
        console.error("Error en askWithImageContext:", error);
        throw new Error("No se pudo obtener la respuesta del asesor. Revisa tu conexión o la clave de API e inténtalo de nuevo.");
    }
};


// --- Financial Consultant Chat ---
const calculateBalances = (appData: AppData): { [key in MoneyLocation]: number } => {
    const balances: { [key in MoneyLocation]: number } = {
        [MoneyLocation.CASH_PRO]: appData.settings.initialBalances?.[MoneyLocation.CASH_PRO] || 0,
        [MoneyLocation.CASH]: appData.settings.initialBalances?.[MoneyLocation.CASH] || 0,
        [MoneyLocation.PRO_BANK]: appData.settings.initialBalances?.[MoneyLocation.PRO_BANK] || 0,
        [MoneyLocation.PERS_BANK]: appData.settings.initialBalances?.[MoneyLocation.PERS_BANK] || 0,
        [MoneyLocation.OTHER]: appData.settings.initialBalances?.[MoneyLocation.OTHER] || 0,
    };

    appData.incomes.forEach(income => {
        if (income.isPaid && income.location) {
            const netAmount = income.baseAmount + (income.baseAmount * income.vatRate / 100) - (income.baseAmount * income.irpfRate / 100);
            balances[income.location] = (balances[income.location] || 0) + netAmount;
        }
    });
    appData.expenses.forEach(expense => {
        if (expense.isPaid && expense.location) {
            const totalAmount = expense.baseAmount + (expense.baseAmount * expense.vatRate / 100);
            balances[expense.location] = (balances[expense.location] || 0) - totalAmount;
        }
    });
    appData.investmentGoods.forEach(good => {
        if (good.isPaid && good.location) {
            const totalAmount = good.acquisitionValue + (good.acquisitionValue * good.vatRate / 100);
            balances[good.location] = (balances[good.location] || 0) - totalAmount;
        }
    });
    appData.personalMovements.filter(m => m.isPaid).forEach(movement => {
        if (movement.location) {
            if (movement.type === 'income') balances[movement.location] = (balances[movement.location] || 0) + movement.amount;
            else balances[movement.location] = (balances[movement.location] || 0) - movement.amount;
        }
    });
    appData.transfers.forEach(transfer => {
        balances[transfer.fromLocation] = (balances[transfer.fromLocation] || 0) - transfer.amount;
        balances[transfer.toLocation] = (balances[transfer.toLocation] || 0) + transfer.amount;
    });

    return balances;
}

const summarizeDataForAI = (appData: AppData): string => {
    // FIX: Use scheduledTransactions instead of deprecated potentialIncomes/potentialExpenses
    const { settings, incomes, expenses, investmentGoods, personalMovements, transfers, savingsGoals, scheduledTransactions, personalCategories } = appData;

    // --- NET CAPITAL SUMMARY ---
    const allBalances = calculateBalances(appData);
    const professionalBalance = (allBalances[MoneyLocation.PRO_BANK] || 0) + (allBalances[MoneyLocation.CASH_PRO] || 0);
    const personalBalance = (allBalances[MoneyLocation.PERS_BANK] || 0) + (allBalances[MoneyLocation.CASH] || 0) + (allBalances[MoneyLocation.OTHER] || 0);
    const currentTotalBalance = professionalBalance + personalBalance;

    const pendingProfessionalIncome = incomes.filter(i => !i.isPaid).reduce((sum, i) => sum + (i.baseAmount + (i.baseAmount * i.vatRate / 100) - (i.baseAmount * i.irpfRate / 100)), 0);
    const pendingPersonalIncome = personalMovements.filter(m => m.type === 'income' && !m.isPaid).reduce((sum, m) => sum + m.amount, 0);
    const totalPendingIncome = pendingProfessionalIncome + pendingPersonalIncome;

    const pendingProfessionalExpense = expenses.filter(e => !e.isPaid).reduce((sum, e) => sum + (e.baseAmount + (e.baseAmount * e.vatRate / 100)), 0);
    const pendingPersonalExpense = personalMovements.filter(m => m.type === 'expense' && !m.isPaid).reduce((sum, m) => sum + m.amount, 0);
    const totalPendingExpenses = pendingProfessionalExpense + pendingPersonalExpense;
    
    // Tax Calculation (for current quarter)
    const now = new Date();
    const year = now.getFullYear();
    const quarter = Math.floor(now.getMonth() / 3);
    const qPeriod = { startDate: new Date(year, quarter * 3, 1), endDate: new Date(year, quarter * 3 + 3, 0, 23, 59, 59, 999) };

    const getCuotaIVA = (base: number, rate: number) => base * (rate / 100);
    const getCuotaIRPF = (base: number, rate: number) => base * (rate / 100);
    
    const qIncomes = incomes.filter(i => new Date(i.date) >= qPeriod.startDate && new Date(i.date) <= qPeriod.endDate);
    const qDeductibleExpenses = expenses.filter(e => e.isDeductible && new Date(e.date) >= qPeriod.startDate && new Date(e.date) <= qPeriod.endDate);
    
    const ivaRepercutido = qIncomes.reduce((sum, i) => sum + getCuotaIVA(i.baseAmount, i.vatRate), 0);
    const ivaSoportadoFromExpenses = qDeductibleExpenses.reduce((sum, e) => sum + getCuotaIVA(e.baseAmount, e.vatRate), 0);
    const ivaSoportadoFromGoods = investmentGoods.filter(g => g.isDeductible && new Date(g.purchaseDate) >= qPeriod.startDate && new Date(g.purchaseDate) <= qPeriod.endDate).reduce((sum, g) => sum + getCuotaIVA(g.acquisitionValue, g.vatRate), 0);
    const ivaSoportado = ivaSoportadoFromExpenses + ivaSoportadoFromGoods;
    const model303Result = Math.max(0, ivaRepercutido - ivaSoportado);

    const yearOfPeriod = qPeriod.startDate.getFullYear();
    const quarterOfPeriod = quarter + 1;
    const incomesYTD = incomes.filter(i => { const d = new Date(i.date); return d.getFullYear() === yearOfPeriod && d <= qPeriod.endDate; });
    const expensesYTD = expenses.filter(e => { const d = new Date(e.date); return d.getFullYear() === yearOfPeriod && d <= qPeriod.endDate && e.isDeductible; });
    const grossYTD = incomesYTD.reduce((sum, i) => sum + i.baseAmount, 0);
    const expensesFromInvoicesYTD = expensesYTD.reduce((sum, e) => sum + (e.deductibleBaseAmount ?? e.baseAmount), 0);
    
    const amortizationYTD = investmentGoods.filter(g => g.isDeductible && new Date(g.purchaseDate).getFullYear() <= yearOfPeriod).reduce((sum, good) => {
         const dailyAmortization = (good.acquisitionValue / good.usefulLife) / 365.25;
         const goodStartDate = new Date(good.purchaseDate);
         const effectiveStartDate = goodStartDate < new Date(yearOfPeriod, 0, 1) ? new Date(yearOfPeriod, 0, 1) : goodStartDate;
         if (effectiveStartDate > qPeriod.endDate) return sum;
         const effectiveEndDate = qPeriod.endDate;
         const days = (effectiveEndDate.getTime() - effectiveStartDate.getTime()) / (1000 * 3600 * 24) + 1;
         return sum + (days * dailyAmortization);
    }, 0);
    const autonomoFeeYTD = (settings.monthlyAutonomoFee || 0) * (quarterOfPeriod * 3);
    const deductibleExpensesYTD = expensesFromInvoicesYTD + amortizationYTD + autonomoFeeYTD;
    const netProfitYTD = grossYTD - deductibleExpensesYTD;
    const quoteYTD = netProfitYTD * 0.20;
    const retencionesSoportadasYTD = incomesYTD.reduce((sum, i) => sum + getCuotaIRPF(i.baseAmount, i.irpfRate), 0);
    const model130Result = Math.max(0, quoteYTD - retencionesSoportadasYTD);
    
    const qAllExpenses = expenses.filter(e => new Date(e.date) >= qPeriod.startDate && new Date(e.date) <= qPeriod.endDate);
    const model111Result = qAllExpenses.reduce((sum, e) => sum + (e.irpfRetentionAmount && !e.isRentalExpense ? e.irpfRetentionAmount : 0), 0);
    const model115Result = qAllExpenses.reduce((sum, e) => sum + (e.irpfRetentionAmount && e.isRentalExpense ? e.irpfRetentionAmount : 0), 0);
    
    const totalProjectedTaxes = model303Result + model130Result + model111Result + model115Result;
    const netAvailableCapital = currentTotalBalance + totalPendingIncome - totalPendingExpenses - totalProjectedTaxes;

    const net_capital_summary = {
        current_total_balance: Math.round(currentTotalBalance),
        total_pending_income: Math.round(totalPendingIncome),
        total_pending_expenses: Math.round(totalPendingExpenses),
        estimated_current_quarter_taxes: Math.round(totalProjectedTaxes),
        net_available_capital: Math.round(netAvailableCapital)
    };
    
    // --- PERSONAL FINANCE DETAILS ---
    const allPersonalTransactions = [...personalMovements, ...transfers.filter(t => t.justification === TransferJustification.SUELDO_AUTONOMO)];
    const firstDate = allPersonalTransactions.length > 0 ? new Date(Math.min(...allPersonalTransactions.map(m => new Date(m.date).getTime()))) : new Date();
    const monthsOfData = Math.max(1, ((new Date().getTime() - firstDate.getTime()) / (1000 * 3600 * 24 * 30.44)));
    const personalIncomes = personalMovements.filter(m => m.type === 'income').reduce((sum: number, m) => sum + m.amount, 0);
    const sueldoTransfers = transfers.filter(t => t.justification === TransferJustification.SUELDO_AUTONOMO).reduce((sum: number, t) => sum + t.amount, 0);
    const totalPersonalIncome = personalIncomes + sueldoTransfers;
    const personalExpensesByCategory = personalMovements
        .filter(m => m.type === 'expense')
        .reduce((acc: Record<string, number>, m) => {
            const catName = personalCategories.find(c => c.id === m.categoryId)?.name || 'Sin Categoría';
            acc[catName] = (acc[catName] || 0) + m.amount;
            return acc;
        }, {} as Record<string, number>);
    const totalPersonalExpenses = Object.values(personalExpensesByCategory).reduce((sum: number, amount) => sum + amount, 0);

    const personal_finance_details = {
        current_personal_balances: {
            bank: Math.round(allBalances[MoneyLocation.PERS_BANK] || 0),
            cash: Math.round(allBalances[MoneyLocation.CASH] || 0),
            other: Math.round(allBalances[MoneyLocation.OTHER] || 0),
        },
        monthly_average_income: Math.round(totalPersonalIncome / monthsOfData),
        monthly_average_expenses: {
            total: Math.round(totalPersonalExpenses / monthsOfData),
            by_category: Object.fromEntries(
                Object.entries(personalExpensesByCategory).map(([key, value]) => [key, Math.round(value / monthsOfData)])
            )
        },
        savings_goals: savingsGoals.map(g => ({
            name: g.name,
            target_amount: g.targetAmount,
            current_amount: g.currentAmount,
            deadline: g.deadline.split('T')[0],
            planned_monthly_contribution: g.plannedContribution || 0
        })),
    };

    const getNetScheduledIncomeAmount = (st: ScheduledTransaction): number => {
        if (st.scope === 'professional') {
            const base = st.baseAmount || 0;
            const vat = base * (st.vatRate || 0) / 100;
            const irpf = base * (st.irpfRate || 0) / 100;
            return base + vat - irpf;
        }
        return st.amount || 0;
    };

    const getNetScheduledExpenseAmount = (st: ScheduledTransaction): number => {
        if (st.scope === 'professional') {
            const base = st.baseAmount || 0;
            const vat = base * (st.vatRate || 0) / 100;
            return base + vat;
        }
        return st.amount || 0;
    };

    const scheduledIncomes = (scheduledTransactions || []).filter(st => st.type === 'income');
    const scheduledExpenses = (scheduledTransactions || []).filter(st => st.type === 'expense');

    const future_projections_summary = {
        potential_monthly_incomes: scheduledIncomes.filter(st => st.frequency === 'monthly').map(st => ({
            concept: st.concept,
            net_amount: Math.round(getNetScheduledIncomeAmount(st))
        })),
        potential_one_off_incomes: scheduledIncomes.filter(st => st.frequency === 'one-off').map(st => ({
            concept: st.concept,
            net_amount: Math.round(getNetScheduledIncomeAmount(st)),
            date: st.startDate?.split('T')[0]
        })),
        potential_monthly_expenses: scheduledExpenses.filter(st => st.frequency === 'monthly').map(st => ({
            concept: st.concept,
            amount: Math.round(getNetScheduledExpenseAmount(st))
        })),
        potential_one_off_expenses: scheduledExpenses.filter(st => st.frequency === 'one-off').map(st => ({
            concept: st.concept,
            amount: Math.round(getNetScheduledExpenseAmount(st)),
            date: st.startDate?.split('T')[0]
        }))
    };
    
    const combinedSummary = {
        net_capital_summary: net_capital_summary,
        personal_finance_details: personal_finance_details,
        future_projections_summary: future_projections_summary,
        user_settings: {
            fullName: settings.fullName,
            nif: settings.nif,
        }
    };
    
    return JSON.stringify(combinedSummary, null, 2);
};

export const askFinancialConsultant = async (
    question: string, 
    apiKey: string,
    appData: AppData
): Promise<{ text: string, sources: any[] | null }> => {

    if (!apiKey) throw new Error("API Key de Gemini no configurada.");
    const ai = new GoogleGenAI({ apiKey });

    const dataSummary = summarizeDataForAI(appData);

    const fullPrompt = `Este es un resumen de los datos financieros del usuario:
\`\`\`json
${dataSummary}
\`\`\`

Basándote en estos datos y en tu conocimiento como asesor, responde a la siguiente pregunta del usuario.

Pregunta: "${question}"
`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fullPrompt,
            config: {
                systemInstruction: "Eres un asesor financiero y de finanzas personales experto para autónomos en España. Tu nombre es LifeOS Assistant. Tu tono es profesional, cercano y didáctico. Tienes acceso a un resumen de los datos fiscales y personales del usuario.\n- Para preguntas sobre si el usuario se puede permitir algo ('affordability'), tu respuesta DEBE basarse principalmente en el valor 'net_available_capital' del resumen 'net_capital_summary'. Este valor representa el dinero real que le queda al usuario después de todas sus obligaciones. Usa el resto de datos para dar contexto, pero el capital neto es el factor decisivo.\n- Para preguntas fiscales, basa tus cálculos en los datos del usuario y utiliza la búsqueda para verificar normativas y plazos.\n- Para preguntas generales de finanzas personales (ahorro, gastos, presupuestos), analiza los datos de 'personal_finance_details'. Ofrece consejos prácticos y personalizados.\n- Siempre que des consejos financieros, añade una nota aclarando que eres una IA y no un asesor financiero certificado, y que tus sugerencias se basan en los datos proporcionados.\n- Cita siempre tus fuentes si usas la búsqueda de Google.",
                tools: [{googleSearch: {}}],
            }
        });

        const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || null;
        
        return { text: response.text, sources };

    } catch(error) {
        console.error("Error en askFinancialConsultant:", error);
        throw new Error("No se pudo obtener la respuesta del asesor. Inténtalo de nuevo.");
    }
};
