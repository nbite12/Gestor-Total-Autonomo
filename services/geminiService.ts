import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Income, Expense } from './types';

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


export const extractInvoiceData = async (
    file: File, 
    invoiceType: 'income' | 'expense', 
    apiKey: string
): Promise<Partial<Income> | Partial<Expense>> => {

    if (!apiKey) {
        throw new Error("API Key de Gemini no configurada.");
    }
    
    const ai = new GoogleGenAI({ apiKey });
    
    const base64Data = await fileToBase64(file);
    const schema = invoiceType === 'income' ? incomeSchema : expenseSchema;
    const typeText = invoiceType === 'income' ? 'emitida (un ingreso)' : 'recibida (un gasto)';

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
        
        // Ensure date is valid, otherwise default to today
        if (extractedData.date && isNaN(new Date(extractedData.date).getTime())) {
            console.warn("Invalid date from AI, defaulting to today:", extractedData.date);
            extractedData.date = new Date().toISOString().split('T')[0];
        }

        return extractedData;

    } catch (error) {
        console.error("Error al contactar con la API de Gemini:", error);
        throw new Error("No se pudo extraer la información de la factura. Revisa el documento o la configuración de la API.");
    }
};