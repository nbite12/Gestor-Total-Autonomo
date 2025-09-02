import { GoogleGenAI, Type } from "@google/genai";
import { Income, Expense, InvestmentGood } from './types';

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