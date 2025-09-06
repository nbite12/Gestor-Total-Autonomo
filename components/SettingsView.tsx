import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../App';
import { UserSettings, Category, Income, Expense, MoneyLocation } from '../types';
import { Card, Button, Input, Icon, Switch, HelpTooltip, UnsupportedModelsModal, Modal } from './ui';
import { OnboardingModal } from './OnboardingModal';

declare const JSZip: any;

// --- Category Manager ---
const CategoryManager: React.FC<{
    title: string;
    categories: Category[];
    onAdd: (name: string) => void;
    onDelete: (id: string) => void;
}> = ({ title, categories, onAdd, onDelete }) => {
    const [newCategoryName, setNewCategoryName] = useState('');

    const handleAdd = () => {
        if (newCategoryName.trim()) {
            onAdd(newCategoryName.trim());
            setNewCategoryName('');
        }
    };

    return (
        <Card>
            <h3 className="text-lg font-bold mb-4">{title}</h3>
            <div className="flex gap-2 mb-4">
                <Input
                    label="Nueva categoría"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    placeholder="Nombre de la categoría"
                    containerClassName="flex-grow"
                />
                <Button onClick={handleAdd} className="self-end">
                    <Icon name="plus" className="w-5 h-5" />
                </Button>
            </div>
            <ul className="space-y-2">
                {categories.map(cat => (
                    <li key={cat.id} className="flex justify-between items-center p-2 bg-slate-100 dark:bg-slate-700 rounded">
                        <span>{cat.name}</span>
                        <Button size="sm" variant="ghost" onClick={() => onDelete(cat.id)}>
                            <Icon name="trash" className="w-4 h-4 text-red-500" />
                        </Button>
                    </li>
                ))}
            </ul>
        </Card>
    );
};

// --- Main Settings View ---
const SettingsView: React.FC = () => {
  const context = useContext(AppContext);
  if (!context) return <div>Cargando...</div>;
  const { data, saveData, resetData, isProfessionalModeEnabled } = context;

  const [settings, setSettings] = useState<UserSettings>(data.settings);
  const [geminiApiKey, setGeminiApiKey] = useState(data.settings.geminiApiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isUnsupportedModalOpen, setIsUnsupportedModalOpen] = useState(false);
  const [isCreditsModalOpen, setIsCreditsModalOpen] = useState(false);
  const [isSetupWizardOpen, setIsSetupWizardOpen] = useState(false);

  useEffect(() => {
    setSettings(data.settings);
  }, [data.settings]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
     if (type === 'checkbox') {
        setSettings(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
        setSettings(prev => ({...prev, [name]: name.includes('Rate') || name.includes('Fee') ? parseFloat(value) : value }));
    }
  };

  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({
        ...prev,
        initialBalances: {
            ...(prev.initialBalances || {}),
            [name]: parseFloat(value) || 0
        }
    }));
  };
  
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveData(prev => ({...prev, settings}), "Ajustes guardados.");
  };

  const handleSaveApiKey = () => {
      saveData(prev => ({...prev, settings: {...prev.settings, geminiApiKey}}), "Clave de API de Gemini guardada.");
  }

  const handleAddCategory = (type: 'professional' | 'personal', name: string) => {
      const newCategory: Category = { id: `cat-${type}-${Date.now()}`, name };
      saveData(prev => {
          if (type === 'professional') {
              return {...prev, professionalCategories: [...prev.professionalCategories, newCategory]};
          }
          return {...prev, personalCategories: [...prev.personalCategories, newCategory]};
      }, "Categoría añadida.");
  };

  const handleDeleteCategory = (type: 'professional' | 'personal', id: string) => {
       if (window.confirm('¿Seguro que quieres borrar esta categoría?')) {
           saveData(prev => {
               if (type === 'professional') {
                   return {...prev, professionalCategories: prev.professionalCategories.filter(c => c.id !== id)};
               }
               return {...prev, personalCategories: prev.personalCategories.filter(c => c.id !== id)};
           }, "Categoría eliminada.");
       }
  };

  const handleExportData = async () => {
    try {
        const zip = new JSZip();
        // Deep copy to avoid mutating state
        const dataToExport = JSON.parse(JSON.stringify(data)); 

        const attachmentsFolder = zip.folder("attachments");
        if (!attachmentsFolder) {
            throw new Error("No se pudo crear la carpeta de adjuntos en el ZIP.");
        }

        const processAttachments = (items: (Income | Expense)[]) => {
            for (const item of items) {
                if (item.attachment && item.attachment.data) {
                    const filePath = `${item.id}_${item.attachment.name}`;
                    // Add file to zip (JSZip decodes the base64 string)
                    attachmentsFolder.file(filePath, item.attachment.data, { base64: true });
                    // Remove heavy base64 data from the JSON file
                    delete item.attachment.data; 
                }
            }
        };

        processAttachments(dataToExport.incomes);
        processAttachments(dataToExport.expenses);

        zip.file("backup.json", JSON.stringify(dataToExport, null, 2));

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(zipBlob);
        link.download = `gestor-autonomo-backup-${new Date().toISOString().split('T')[0]}.zip`;
        link.click();
        URL.revokeObjectURL(link.href);

    } catch (error) {
        console.error("Error al exportar los datos:", error);
        alert("Hubo un error al crear el archivo de respaldo.");
    }
  };
  
  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,application/zip,application/x-zip-compressed';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const zip = await JSZip.loadAsync(file);
        const backupFile = zip.file("backup.json");

        if (!backupFile) {
          throw new Error("El archivo ZIP no contiene 'backup.json'.");
        }

        const jsonContent = await backupFile.async("string");
        const importedData = JSON.parse(jsonContent);
        
        const requiredKeys = ['incomes', 'expenses', 'settings', 'personalCategories', 'professionalCategories', 'transfers'];
        const hasAllKeys = requiredKeys.every(key => key in importedData);

        if (!hasAllKeys) {
          throw new Error('El archivo de respaldo no tiene el formato correcto.');
        }

        const rehydrateAttachments = async (items: (Income | Expense)[]) => {
            for (const item of items) {
                if (item.attachment && !item.attachment.data) { // Attachment exists but data needs rehydration
                    const filePath = `attachments/${item.id}_${item.attachment.name}`;
                    const attachmentFile = zip.file(filePath);
                    if (attachmentFile) {
                        const base64Data = await attachmentFile.async("base64");
                        item.attachment.data = base64Data;
                    } else {
                        console.warn(`Adjunto no encontrado en el ZIP: ${filePath}`);
                    }
                }
            }
        };

        await rehydrateAttachments(importedData.incomes);
        await rehydrateAttachments(importedData.expenses);
          
        if (window.confirm('¿Estás seguro? Al importar se sobrescribirán TODOS tus datos actuales. Esta acción es irreversible.')) {
            saveData(importedData, "Datos importados correctamente.");
        }
      } catch (error) {
        console.error("Error al importar datos:", error);
        alert(`Error al procesar el archivo ZIP. Asegúrate de que es un archivo de backup válido. Detalles: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    input.click();
  };

  const handleDeleteAllData = () => {
    if(window.confirm('¡ATENCIÓN! ESTA ACCIÓN ES IRREVERSIBLE.\n¿Estás absolutamente seguro de que quieres borrar TODOS tus datos?')) {
        if(window.confirm('ÚLTIMA CONFIRMACIÓN.\nTodos tus ingresos, gastos, objetivos y ajustes se borrarán para siempre. ¿Continuar?')) {
             resetData();
        }
    }
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Configuración</h2>
      
      <Card>
        <h3 className="text-lg font-bold mb-2">Asistente de Configuración</h3>
        <p className="text-sm text-slate-500 mb-4">
            Vuelve a ejecutar el asistente inicial para reconfigurar los ajustes principales de la aplicación de forma guiada.
        </p>
        <Button variant="secondary" onClick={() => setIsSetupWizardOpen(true)}>
            <Icon name="cog" className="w-5 h-5" />
            Iniciar Asistente de Configuración
        </Button>
      </Card>

      {isProfessionalModeEnabled && (
        <Card>
            <h3 className="text-lg font-bold mb-4">Información de la Aplicación</h3>
            <p className="text-sm text-slate-500 mb-4">
                Consulta información importante sobre las funcionalidades y limitaciones actuales de la aplicación.
            </p>
            <Button variant="secondary" onClick={() => setIsUnsupportedModalOpen(true)}>
                <Icon name="info" className="w-5 h-5" />
                Ver Modelos Fiscales No Soportados
            </Button>
        </Card>
      )}

      {/* Usage Mode Settings */}
       <Card>
          <h3 className="text-lg font-bold">Modo de Uso</h3>
          <p className="text-sm text-slate-500 mt-1 mb-4">Simplifica la interfaz si solo necesitas la aplicación para tus finanzas personales.</p>
           <div className="flex items-center">
                <Switch 
                    label="Habilitar Área Profesional"
                    checked={settings.professionalModeEnabled ?? true} 
                    onChange={(c) => setSettings(p => ({...p, professionalModeEnabled: c}))} 
                />
                <HelpTooltip content="Desactiva esto para ocultar las secciones de facturación, impuestos y proyecciones, dejando solo la gestión de cuentas y objetivos personales." />
            </div>
      </Card>

      {/* Fiscal & App Settings */}
      <Card>
        <form onSubmit={handleSaveSettings} className="space-y-6">
            {isProfessionalModeEnabled && (
                <div>
                    <h3 className="text-lg font-bold">Datos Fiscales y Preferencias</h3>
                    <p className="text-sm text-slate-500 mt-1">Esta información se usará para generar tus facturas y calcular tus impuestos.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <Input label="Nombre Completo" name="fullName" value={settings.fullName} onChange={handleChange} />
                        <Input label="NIF / CIF" name="nif" value={settings.nif} onChange={handleChange} />
                    </div>
                    <Input label="Domicilio Fiscal" name="address" value={settings.address} onChange={handleChange} containerClassName="mt-4" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <Input label="IVA por defecto (%)" name="defaultVatRate" type="number" value={settings.defaultVatRate} onChange={handleChange} />
                        <Input label="IRPF por defecto (%)" name="defaultIrpfRate" type="number" value={settings.defaultIrpfRate} onChange={handleChange} />
                        <Input label="Cuota de Autónomo Mensual (€)" name="monthlyAutonomoFee" type="number" step="0.01" value={settings.monthlyAutonomoFee} onChange={handleChange} />
                    </div>
                    <div className="mt-6 space-y-4 border-t dark:border-slate-700 pt-4">
                        <div className="flex items-center">
                            <Switch label="Estoy en el régimen de Recargo de Equivalencia" checked={settings.isInRecargoEquivalencia} onChange={(c) => setSettings(p => ({...p, isInRecargoEquivalencia: c}))} />
                            <HelpTooltip content="Activa esta opción si eres comerciante minorista. Esto cambiará la forma en que se gestiona el IVA de tus compras." />
                        </div>
                        <div className="flex items-center">
                            <Switch label="Aplicar deducción del 7% por gastos de difícil justificación" checked={settings.applySevenPercentDeduction} onChange={(c) => setSettings(p => ({...p, applySevenPercentDeduction: c}))} />
                            <HelpTooltip content="Activa esta opción si tributas por estimación directa simplificada para aplicar una deducción de hasta 2.000€ en tu IRPF." />
                        </div>
                    </div>
                </div>
            )}

            {isProfessionalModeEnabled && (
                 <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                    <h3 className="text-lg font-bold">Perfil Fiscal del Autónomo</h3>
                    <p className="text-sm text-slate-500 mt-1">Marca las opciones que apliquen a tu actividad para personalizar los modelos fiscales que se muestran.</p>
                    <div className="mt-4 space-y-4">
                        <div className="flex items-center">
                            <Switch label="Alquilo una oficina o local para mi actividad" checked={settings.rentsOffice ?? false} onChange={(c) => setSettings(p => ({...p, rentsOffice: c}))} />
                            <HelpTooltip content="Activa esta opción si pagas un alquiler por tu lugar de trabajo. Esto habilitará los modelos 115 y 180." />
                        </div>
                        <div className="flex items-center">
                            <Switch label="Estoy dado de alta en el ROI (Op. Intracomunitarias)" checked={settings.isInROI ?? false} onChange={(c) => setSettings(p => ({...p, isInROI: c}))} />
                            <HelpTooltip content="Activa esta opción si compras o vendes a empresas de la Unión Europea. Esto habilitará el modelo 349." />
                        </div>
                        <div className="flex items-center">
                            <Switch label="Contrato a otros profesionales con retención" checked={settings.hiresProfessionals ?? false} onChange={(c) => setSettings(p => ({...p, hiresProfessionals: c}))} />
                            <HelpTooltip content="Activa esta opción si pagas facturas que llevan retención de IRPF (a abogados, diseñadores, etc.). Esto habilitará los modelos 111 y 190." />
                        </div>
                    </div>
                </div>
            )}
            
            <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                <h3 className="text-lg font-bold">Saldos Iniciales</h3>
                <p className="text-sm text-slate-500 mt-1">Establece el valor inicial de cada cuenta para un cálculo de saldos preciso.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {isProfessionalModeEnabled && (
                         <>
                            <Input 
                                label="Banco Profesional (€)" 
                                name={MoneyLocation.PRO_BANK}
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={settings.initialBalances?.[MoneyLocation.PRO_BANK] || ''}
                                onChange={handleBalanceChange}
                            />
                            <Input 
                                label="Efectivo Profesional (€)" 
                                name={MoneyLocation.CASH_PRO}
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={settings.initialBalances?.[MoneyLocation.CASH_PRO] || ''}
                                onChange={handleBalanceChange}
                            />
                        </>
                    )}
                     <Input 
                        label="Banco Personal (€)" 
                        name={MoneyLocation.PERS_BANK}
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={settings.initialBalances?.[MoneyLocation.PERS_BANK] || ''}
                        onChange={handleBalanceChange}
                    />
                    <Input 
                        label="Efectivo (€)" 
                        name={MoneyLocation.CASH}
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={settings.initialBalances?.[MoneyLocation.CASH] || ''}
                        onChange={handleBalanceChange}
                    />
                    <Input 
                        label="Otros (Crypto, etc.) (€)" 
                        name={MoneyLocation.OTHER}
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={settings.initialBalances?.[MoneyLocation.OTHER] || ''}
                        onChange={handleBalanceChange}
                    />
                </div>
            </div>

          <div className="flex justify-end pt-4">
            <Button type="submit">Guardar Todos los Ajustes</Button>
          </div>
        </form>
      </Card>
      
      {/* Privacy Settings */}
      <Card>
          <h3 className="text-lg font-bold">Privacidad</h3>
          <p className="text-sm text-slate-500 mt-1 mb-4">Controla la visibilidad de tus datos financieros.</p>
           <div className="flex items-center">
                <Switch 
                    label="Ocultar saldos por defecto al iniciar la app"
                    checked={settings.defaultPrivacyMode ?? false} 
                    onChange={(c) => setSettings(p => ({...p, defaultPrivacyMode: c}))} 
                />
                <HelpTooltip content="Activa esta opción para que todos los importes monetarios aparezcan ocultos cada vez que abras la aplicación." />
            </div>
      </Card>

      {/* AI Settings */}
        <Card>
            <h3 className="text-lg font-bold">IA (Gemini)</h3>
            <p className="text-sm text-slate-500 mb-4">Introduce tu clave de API de Google Gemini para activar el asistente inteligente por voz y la importación de documentos.</p>
            <div className="flex gap-2 items-end">
                <div className="flex-grow">
                    <label htmlFor="gemini-api-key-input" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Clave de API de Gemini
                    </label>
                    <div className="relative">
                        <input
                            id="gemini-api-key-input"
                            type={showApiKey ? 'text' : 'password'}
                            value={geminiApiKey}
                            onChange={(e) => setGeminiApiKey(e.target.value)}
                            placeholder="Pega tu clave aquí"
                            className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm dark:bg-slate-800 dark:border-slate-600 dark:placeholder-slate-500 pr-10"
                        />
                        <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            aria-label={showApiKey ? "Ocultar clave" : "Mostrar clave"}
                        >
                            <Icon name={showApiKey ? 'eye-off' : 'eye'} className="h-5 w-5" />
                        </button>
                    </div>
                </div>
                <Button onClick={handleSaveApiKey}>Guardar Clave</Button>
            </div>
            {data.settings.geminiApiKey && (
                <p className="text-sm text-green-600 mt-2">✓ Clave de API guardada correctamente.</p>
            )}
        </Card>
      
      {/* Category Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {isProfessionalModeEnabled && (
            <CategoryManager 
                title="Categorías de Gastos Profesionales" 
                categories={data.professionalCategories} 
                onAdd={(name) => handleAddCategory('professional', name)}
                onDelete={(id) => handleDeleteCategory('professional', id)}
            />
          )}
          <CategoryManager 
              title="Categorías de Gastos Personales" 
              categories={data.personalCategories} 
              onAdd={(name) => handleAddCategory('personal', name)}
              onDelete={(id) => handleDeleteCategory('personal', id)}
          />
      </div>

      {/* Data Management */}
       <Card>
          <h3 className="text-lg font-bold mb-4">Gestión de Datos</h3>
          <div className="flex flex-col sm:flex-row gap-4">
              <Button onClick={handleExportData} variant="secondary">
                  <Icon name="download" className="w-5 h-5"/> Exportar Todos Mis Datos (ZIP)
              </Button>
               <Button onClick={handleImportData} variant="secondary">
                  <Icon name="upload" className="w-5 h-5"/> Importar Todos Mis Datos (ZIP)
              </Button>
          </div>
       </Card>

      {/* Danger Zone */}
       <div className="border-2 border-dashed border-red-500 rounded-lg p-6">
          <h3 className="text-xl font-bold text-red-500 mb-4">Zona de Peligro</h3>
          <p className="mb-4 text-slate-600 dark:text-slate-400">
              Estas acciones son irreversibles. Asegúrate de tener una copia de seguridad si no quieres perder tus datos.
          </p>
          <Button variant="danger" onClick={handleDeleteAllData}>
            <Icon name="trash" className="w-5 h-5"/> Borrar Todos los Datos
          </Button>
       </div>
       
       <Card className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors" onClick={() => setIsCreditsModalOpen(true)}>
          <div className="flex justify-between items-center">
              <div>
                  <h3 className="text-lg font-bold">Créditos y Términos y Condiciones</h3>
                  <p className="text-sm text-slate-500">Ver información sobre el autor y los términos de uso.</p>
              </div>
              <Icon name="external-link" className="w-5 h-5 text-slate-400" />
          </div>
       </Card>

       <UnsupportedModelsModal isOpen={isUnsupportedModalOpen} onClose={() => setIsUnsupportedModalOpen(false)} />
       <Modal isOpen={isCreditsModalOpen} onClose={() => setIsCreditsModalOpen(false)} title="Créditos y Términos y Condiciones">
          <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
              <p>
                  <strong>Creador y Propietario:</strong> Eric Alejandro Munive García.
              </p>
              <p>
                  Esta aplicación y todo su contenido son propiedad intelectual de su creador. Cualquier uso, reproducción o distribución no autorizada está estrictamente prohibido.
              </p>
              <p>
                  El acceso y uso de la aplicación están permitidos únicamente a colaboradores autorizados o a clientes mediante una membresía activa.
              </p>
              <p className="italic mt-4">
                  Aviso: Los términos y condiciones completos, así como las políticas de privacidad y avisos legales, se detallarán en futuras actualizaciones.
              </p>
          </div>
        </Modal>
        <OnboardingModal isOpen={isSetupWizardOpen} onClose={() => setIsSetupWizardOpen(false)} isRelaunchable={true} />
    </div>
  );
};

export default SettingsView;