import { GoogleGenAI, Type } from "@google/genai";
import { Income, Expense, InvestmentGood } from './types';

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
    },
    required: ["date", "providerName", "concept", "baseAmount", "vatRate"]
};

const investmentGoodSchema = {
    type: Type.OBJECT,
    properties: {
        purchaseDate: { type: Type.STRING, description: "Fecha de la compra del bien en formato YYYY-MM-DD" },
        description: { type: Type.STRING, description: "Descripción clara y concisa del bien de inversión (ej: 'Ordenador Portátil MacBook Pro 14 pulgadas')" },
        providerNif: { type: Type.STRING, description: "NIF o CIF del proveedor, si aparece" },
        invoiceNumber: { type: Type.STRING, description: "Número de la factura de compra, si aparece" },
        acquisitionValue: { type: Type.NUMBER, description: "Valor de adquisición, que es la base imponible de la compra" },
        usefulLife: { type: Type.NUMBER, description: "Vida útil en años. Si no se especifica, usa 4 para equipos informáticos, 10 para mobiliario, 8 para maquinaria." },
    },
    required: ["purchaseDate", "description", "acquisitionValue", "usefulLife"]
};


export const extractInvoiceData = async (
    file: File, 
    invoiceType: 'income' | 'expense' | 'investment', 
    apiKey: string
): Promise<Partial<Income> | Partial<Expense> | Partial<InvestmentGood>> => {

    if (!apiKey) {
        throw new Error("API Key de Gemini no configurada.");
    }
    
    const ai = new GoogleGenAI({ apiKey });
    
    const base64Data = await fileToBase64(file);
    
    let schema;
    let typeText;

    switch (invoiceType) {
        case 'income':
            schema = incomeSchema;
            typeText = 'emitida (un ingreso)';
            break;
        case 'expense':
            schema = expenseSchema;
            typeText = 'recibida (un gasto)';
            break;
        case 'investment':
            schema = investmentGoodSchema;
            typeText = 'de un bien de inversión';
            break;
    }

    const filePart = {
        inlineData: {
            mimeType: file.type,
            data: base64Data,
        },
    };
    
    const textPart = {
        text: `Analiza este documento de una factura ${typeText} y extrae los detalles estructurados. Responde únicamente con el objeto JSON.`,
    };

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


// --- New function for Natural Language Commands ---
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
}

const commandSchema = {
    type: Type.OBJECT,
    properties: {
        action: { type: Type.STRING, description: "La acción: 'income', 'expense', 'personal_movement', 'transfer'." },
        concept: { type: Type.STRING, description: "Descripción del movimiento." },
        amount: { type: Type.NUMBER, description: "El importe monetario principal. Si es un gasto profesional, intenta deducir si es el total o la base. Por defecto, asume que es la base." },
        date: { type: Type.STRING, description: "Fecha en formato YYYY-MM-DD. Si se dice 'ayer', 'hoy', etc., conviértelo. Por defecto, hoy." },
        partyName: { type: Type.STRING, description: "Nombre del cliente o proveedor (para 'income'/'expense')." },
        categoryHint: { type: Type.STRING, description: "Pista sobre la categoría del gasto (para 'expense'/'personal_movement')." },
        locationHint: { type: Type.STRING, description: "Pista sobre la ubicación del dinero (para 'income'/'expense'/'personal_movement')." },
        fromLocationHint: { type: Type.STRING, description: "Pista sobre el origen (para 'transfer')." },
        toLocationHint: { type: Type.STRING, description: "Pista sobre el destino (para 'transfer')." },
        isProfessional: { type: Type.BOOLEAN, description: "True si es un movimiento de autónomo/profesional (ej. 'factura', 'gasto deducible')." },
        movementType: { type: Type.STRING, description: "'income' o 'expense' para movimientos personales ('personal_movement')." },
    },
    required: ["action", "concept", "date", "isProfessional"]
};

export const parseNaturalLanguageTransaction = async (command: string, apiKey: string): Promise<ParsedCommand> => {
    if (!apiKey) {
        throw new Error("API Key de Gemini no configurada.");
    }
    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `Eres un asistente financiero para un autónomo en España. Tu tarea es analizar el siguiente texto y estructurarlo en un objeto JSON. El usuario quiere registrar un movimiento. Identifica si es un ingreso profesional ('income'), gasto profesional ('expense'), movimiento personal ('personal_movement') o transferencia ('transfer'). Extrae los detalles. La fecha de hoy es ${new Date().toISOString().split('T')[0]}. Responde únicamente con el objeto JSON.`;

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