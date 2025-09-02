import React, { useState, useContext } from 'react';
import { AppContext } from '../App';
import { UserSettings, Category, Income, Expense } from '../types';
import { Card, Button, Input, Icon } from './ui';

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
  const { data, setData } = context;

  const [settings, setSettings] = useState<UserSettings>(data.settings);
  const [geminiApiKey, setGeminiApiKey] = useState(data.settings.geminiApiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({...prev, [name]: name.includes('Rate') || name.includes('Fee') ? parseFloat(value) : value }));
  };
  
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setData(prev => ({...prev, settings}));
    alert('Ajustes guardados con éxito.');
  };

  const handleSaveApiKey = () => {
      setData(prev => ({...prev, settings: {...prev.settings, geminiApiKey}}));
      alert('Clave de API de Gemini guardada.');
  }

  const handleAddCategory = (type: 'professional' | 'personal', name: string) => {
      const newCategory: Category = { id: `cat-${type}-${Date.now()}`, name };
      setData(prev => {
          if (type === 'professional') {
              return {...prev, professionalCategories: [...prev.professionalCategories, newCategory]};
          }
          return {...prev, personalCategories: [...prev.personalCategories, newCategory]};
      });
  };

  const handleDeleteCategory = (type: 'professional' | 'personal', id: string) => {
       if (window.confirm('¿Seguro que quieres borrar esta categoría?')) {
           setData(prev => {
               if (type === 'professional') {
                   return {...prev, professionalCategories: prev.professionalCategories.filter(c => c.id !== id)};
               }
               return {...prev, personalCategories: prev.personalCategories.filter(c => c.id !== id)};
           });
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
            setData(importedData);
            alert('Datos importados correctamente.');
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
             localStorage.removeItem('app-data');
             window.location.reload();
        }
    }
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Configuración</h2>

      {/* Fiscal & App Settings */}
      <Card>
        <form onSubmit={handleSaveSettings} className="space-y-4">
          <h3 className="text-lg font-bold">Datos Fiscales y Preferencias</h3>
          <p className="text-sm text-slate-500">Esta información se usará para generar tus facturas.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Nombre Completo" name="fullName" value={settings.fullName} onChange={handleChange} />
              <Input label="NIF / CIF" name="nif" value={settings.nif} onChange={handleChange} />
          </div>
          <Input label="Domicilio Fiscal" name="address" value={settings.address} onChange={handleChange} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <Input label="IVA por defecto (%)" name="defaultVatRate" type="number" value={settings.defaultVatRate} onChange={handleChange} />
             <Input label="IRPF por defecto (%)" name="defaultIrpfRate" type="number" value={settings.defaultIrpfRate} onChange={handleChange} />
             <Input label="Cuota de Autónomo Mensual (€)" name="monthlyAutonomoFee" type="number" step="0.01" value={settings.monthlyAutonomoFee} onChange={handleChange} />
          </div>
          <div className="flex justify-end">
            <Button type="submit">Guardar Ajustes</Button>
          </div>
        </form>
      </Card>

      {/* AI Settings */}
        <Card>
            <h3 className="text-lg font-bold">IA (Gemini)</h3>
            <p className="text-sm text-slate-500 mb-4">Introduce tu clave de API de Google Gemini para activar la función de importación de facturas.</p>
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
          <CategoryManager 
              title="Categorías de Gastos Profesionales" 
              categories={data.professionalCategories} 
              onAdd={(name) => handleAddCategory('professional', name)}
              onDelete={(id) => handleDeleteCategory('professional', id)}
          />
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
    </div>
  );
};

export default SettingsView;