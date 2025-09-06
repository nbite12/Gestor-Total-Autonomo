import { GoogleGenAI, Type } from "@google/genai";
import { Income, Expense, InvestmentGood, Category } from './types';

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