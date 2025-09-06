import React, { useState } from 'react';
import { Modal, Button, Icon, Select } from './ui';
import { extractInvoiceData } from '../services/geminiService';
import { Income, Expense, InvestmentGood, Category } from '../types';

type DocumentType = 'income' | 'expense' | 'investment';

interface AiModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAnalysisComplete: (data: Partial<Income | Expense | InvestmentGood>, type: DocumentType, file: File) => void;
    apiKey: string;
    // If fixedType is provided, the select dropdown is hidden.
    fixedType?: DocumentType;
    professionalCategories?: Category[];
}

export const AiModal: React.FC<AiModalProps> = ({ isOpen, onClose, onAnalysisComplete, apiKey, fixedType, professionalCategories = [] }) => {
    const [documentType, setDocumentType] = useState<DocumentType>(fixedType || 'income');
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
            const typeToAnalyze = fixedType || documentType;
            const extractedData = await extractInvoiceData(file, typeToAnalyze, apiKey, professionalCategories);
            onAnalysisComplete(extractedData, typeToAnalyze, file);
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
        <Modal isOpen={isOpen} onClose={handleClose} title="Importar Documento con IA">
            <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">La IA rellenará el formulario con los datos del documento que subas. Revisa siempre los datos antes de guardar.</p>
                
                {!fixedType && (
                    <Select label="Tipo de Documento" value={documentType} onChange={(e) => setDocumentType(e.target.value as DocumentType)}>
                        <option value="income">Factura Emitida (Ingreso)</option>
                        <option value="expense">Factura Recibida (Gasto)</option>
                        <option value="investment">Bien de Inversión</option>
                    </Select>
                )}

                <div>
                    <label htmlFor="ai-file-upload" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Sube el documento (imagen o PDF)</label>
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 dark:border-slate-600 border-dashed rounded-md">
                        <div className="space-y-1 text-center">
                            <Icon name="upload" className="mx-auto h-12 w-12 text-slate-400" />
                            <div className="flex text-sm text-slate-600 dark:text-slate-400">
                                <label htmlFor="ai-file-upload" className="relative cursor-pointer bg-white dark:bg-slate-800 rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none">
                                    <span>Selecciona un archivo</span>
                                    <input id="ai-file-upload" name="ai-file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/png, image/jpeg, image/webp, application/pdf" />
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
                        {isLoading ? 'Analizando...' : <><Icon name="sparkles" className="w-5 h-5" /> Analizar Documento</>}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};