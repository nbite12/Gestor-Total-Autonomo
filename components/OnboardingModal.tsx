import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../App';
import { UserSettings, MoneyLocation, Category } from '../types';
import { Modal, Button, Icon, Input, Switch } from './ui';
import { DEFAULT_PROFESSIONAL_CATEGORIES, DEFAULT_PERSONAL_CATEGORIES } from '../constants';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  isRelaunchable?: boolean;
}

const ProgressBar: React.FC<{ currentStep: number, totalSteps: number }> = ({ currentStep, totalSteps }) => (
    <div className="flex justify-center items-center gap-3 my-4">
        {Array.from({ length: totalSteps }).map((_, i) => (
            <div
                key={i}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    i < currentStep ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'
                }`}
            />
        ))}
    </div>
);


const CategoryEditor: React.FC<{
    title: string;
    categories: Category[];
    setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
}> = ({ title, categories, setCategories }) => {
    const [newCatName, setNewCatName] = useState('');

    const handleAdd = () => {
        if (newCatName.trim() === '') return;
        const newCat = { id: `cat-temp-${Date.now()}`, name: newCatName.trim() };
        setCategories(prev => [...prev, newCat]);
        setNewCatName('');
    };

    const handleDelete = (id: string) => {
        setCategories(prev => prev.filter(c => c.id !== id));
    };

    return (
        <div>
            <h4 className="font-semibold mb-2 text-slate-700 dark:text-slate-200">{title}</h4>
            <div className="flex gap-2 mb-2">
                <Input
                    label=""
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }}}
                    placeholder="Nueva categoría"
                    containerClassName="flex-grow"
                />
                <Button type="button" onClick={handleAdd} className="self-end">
                    <Icon name="plus" />
                </Button>
            </div>
            <ul className="space-y-1 max-h-32 overflow-y-auto pr-2 border rounded-md p-2 bg-slate-50 dark:bg-slate-800/50">
                {categories.map(cat => (
                    <li key={cat.id} className="flex justify-between items-center p-1 bg-slate-100 dark:bg-slate-700 rounded text-sm">
                        <span>{cat.name}</span>
                        <Button type="button" size="sm" variant="ghost" onClick={() => handleDelete(cat.id)}>
                            <Icon name="trash" className="w-4 h-4 text-red-500" />
                        </Button>
                    </li>
                ))}
            </ul>
        </div>
    );
};


export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose, isRelaunchable = false }) => {
    const context = useContext(AppContext);
    if (!context) return null;
    const { data, saveData } = context;

    const [step, setStep] = useState(1);
    const [settingsData, setSettingsData] = useState<Partial<UserSettings>>({
        ...data.settings,
        professionalModeEnabled: data.settings.professionalModeEnabled ?? true,
    });
    const [profCategories, setProfCategories] = useState<Category[]>(
        data.professionalCategories.length > 0 ? data.professionalCategories : DEFAULT_PROFESSIONAL_CATEGORIES
    );
    const [persCategories, setPersCategories] = useState<Category[]>(
        data.personalCategories.length > 0 ? data.personalCategories : DEFAULT_PERSONAL_CATEGORIES
    );


    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            setSettingsData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
        } else {
            setSettingsData(prev => ({...prev, [name]: name.includes('Rate') || name.includes('Fee') ? parseFloat(value) || 0 : value }));
        }
    };

    const handleSwitchChange = (name: keyof UserSettings, checked: boolean) => {
        setSettingsData(prev => ({...prev, [name]: checked}));
    };
    
    const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setSettingsData(prev => ({
            ...prev,
            initialBalances: { ...(prev.initialBalances || {}), [name]: parseFloat(value) || 0 }
        }));
    };

    const stepsConfig = useMemo(() => [
        { id: 'welcome', proOnly: false },
        { id: 'usageMode', proOnly: false },
        { id: 'coreInfo', proOnly: false },
        { id: 'proProfile', proOnly: true },
        { id: 'proDefaults', proOnly: true },
        { id: 'categories', proOnly: false },
        { id: 'integrations', proOnly: false },
        { id: 'balances', proOnly: false },
        { id: 'finish', proOnly: false },
    ], []);
    
    const visibleSteps = useMemo(() => stepsConfig.filter(s => !s.proOnly || settingsData.professionalModeEnabled), [stepsConfig, settingsData.professionalModeEnabled]);
    const totalSteps = visibleSteps.length;
    
    const handleNext = () => setStep(s => Math.min(s + 1, totalSteps));
    const handleBack = () => setStep(s => Math.max(s - 1, 1));
    
    const handleFinish = () => {
        saveData(prev => ({
            ...prev,
            settings: { ...prev.settings, ...settingsData, hasCompletedOnboarding: true },
            professionalCategories: profCategories.map((cat, i) => ({
                id: cat.id.startsWith('cat-temp-') ? `cat-pro-${Date.now()}${i}` : cat.id,
                name: cat.name
            })),
            personalCategories: persCategories.map((cat, i) => ({
                id: cat.id.startsWith('cat-temp-') ? `cat-per-${Date.now()}${i}` : cat.id,
                name: cat.name
            })),
        }), "Configuración guardada. ¡Bienvenido!");
        onClose();
    };

    const handleModalClose = () => {
        if (isRelaunchable) {
            onClose();
        } else {
            // For initial onboarding, closing via X or backdrop is equivalent to skipping/finishing.
            // This prevents the user from being stuck with the modal on every reload.
            handleFinish();
        }
    };

    const renderContent = () => {
        const currentStepId = visibleSteps[step - 1]?.id;

        switch(currentStepId) {
            case 'welcome':
                return (
                    <div className="text-center space-y-4">
                        <Icon name="sparkles" className="w-16 h-16 mx-auto text-primary-500" />
                        <h2 className="text-2xl font-bold">¡Bienvenido a Gestor Total Autónomo!</h2>
                        <p className="text-slate-600 dark:text-slate-400">
                            Vamos a configurar tu cuenta en unos pocos y sencillos pasos para personalizar la aplicación a tus necesidades.
                        </p>
                    </div>
                );
            case 'usageMode':
                 return (
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold text-center">¿Cómo usarás la aplicación?</h3>
                        <p className="text-sm text-center text-slate-500 pb-4">Esto determinará qué funcionalidades estarán activas.</p>
                        <button onClick={() => handleSwitchChange('professionalModeEnabled', true)} className={`w-full p-4 border-2 rounded-lg text-left transition-all ${settingsData.professionalModeEnabled ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-900' : 'border-slate-300 dark:border-slate-600 hover:border-primary-400'}`}>
                            <h4 className="font-bold">Profesional y Personal</h4>
                            <p className="text-sm text-slate-500">Gestión completa de facturas, impuestos, y finanzas personales.</p>
                        </button>
                        <button onClick={() => handleSwitchChange('professionalModeEnabled', false)} className={`w-full p-4 border-2 rounded-lg text-left transition-all ${!settingsData.professionalModeEnabled ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-900' : 'border-slate-300 dark:border-slate-600 hover:border-primary-400'}`}>
                            <h4 className="font-bold">Solo Personal</h4>
                            <p className="text-sm text-slate-500">Gestión de cuentas, gastos personales y objetivos de ahorro.</p>
                        </button>
                    </div>
                );
            case 'coreInfo':
                return (
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold text-center">Información Principal</h3>
                        <Input label="Tu Nombre Completo" name="fullName" value={settingsData.fullName} onChange={handleChange} required />
                        {settingsData.professionalModeEnabled && (
                            <>
                                <Input label="NIF / CIF" name="nif" value={settingsData.nif} onChange={handleChange} required/>
                                <Input label="Domicilio Fiscal" name="address" value={settingsData.address} onChange={handleChange} />
                            </>
                        )}
                    </div>
                );
            case 'proProfile':
                 return (
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold text-center">Tu Perfil Fiscal</h3>
                        <p className="text-sm text-center text-slate-500 pb-2">Selecciona las opciones que apliquen a tu actividad.</p>
                        <Switch label="Alquilo una oficina o local" checked={settingsData.rentsOffice ?? false} onChange={(c) => handleSwitchChange('rentsOffice', c)} />
                        <Switch label="Opero con empresas de la UE (ROI)" checked={settingsData.isInROI ?? false} onChange={(c) => handleSwitchChange('isInROI', c)} />
                        <Switch label="Contrato a otros profesionales" checked={settingsData.hiresProfessionals ?? false} onChange={(c) => handleSwitchChange('hiresProfessionals', c)} />
                        <Switch label="Estoy en Recargo de Equivalencia" checked={settingsData.isInRecargoEquivalencia ?? false} onChange={(c) => handleSwitchChange('isInRecargoEquivalencia', c)} />
                        <Switch label="Aplico deducción del 7% (gastos de difícil justificación)" checked={settingsData.applySevenPercentDeduction ?? false} onChange={(c) => handleSwitchChange('applySevenPercentDeduction', c)} />
                    </div>
                );
            case 'proDefaults':
                 return (
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold text-center">Valores por Defecto</h3>
                        <p className="text-sm text-center text-slate-500 pb-4">Esto agilizará la creación de facturas.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                           <Input label="IVA por defecto (%)" name="defaultVatRate" type="number" value={settingsData.defaultVatRate} onChange={handleChange} />
                           <Input label="IRPF por defecto (%)" name="defaultIrpfRate" type="number" value={settingsData.defaultIrpfRate} onChange={handleChange} />
                           <Input label="Cuota Autónomo (€/mes)" name="monthlyAutonomoFee" type="number" step="0.01" value={settingsData.monthlyAutonomoFee} onChange={handleChange} containerClassName="sm:col-span-2 lg:col-span-1" />
                        </div>
                    </div>
                );
            case 'categories':
                return (
                    <div className="space-y-6">
                         <h3 className="text-xl font-semibold text-center">Tus Categorías de Gastos</h3>
                         <p className="text-sm text-center text-slate-500 pb-2">Empieza con estas sugerencias, puedes añadir o quitar las que quieras.</p>
                         {settingsData.professionalModeEnabled && (
                            <CategoryEditor title="Profesionales" categories={profCategories} setCategories={setProfCategories} />
                         )}
                         <CategoryEditor title="Personales" categories={persCategories} setCategories={setPersCategories} />
                    </div>
                );
            case 'integrations':
                return (
                     <div className="space-y-4">
                        <h3 className="text-xl font-semibold text-center">Ajustes Avanzados</h3>
                        <Input label="Clave de API de Gemini (Opcional)" name="geminiApiKey" type="password" placeholder="Pega tu clave aquí" value={settingsData.geminiApiKey} onChange={handleChange} />
                        <p className="text-xs text-slate-500 -mt-2">Activa el asistente por voz y la importación inteligente de documentos.</p>
                        <Switch label="Ocultar saldos por defecto al abrir la app" checked={settingsData.defaultPrivacyMode ?? false} onChange={(c) => handleSwitchChange('defaultPrivacyMode', c)} />
                    </div>
                );
            case 'balances':
                return (
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold text-center">Saldos Iniciales</h3>
                        <p className="text-sm text-center text-slate-500 pb-4">Introduce el dinero que tienes actualmente en cada cuenta.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {settingsData.professionalModeEnabled && (
                                <>
                                    <Input label="Banco Profesional (€)" name={MoneyLocation.PRO_BANK} type="number" step="0.01" placeholder="0.00" value={settingsData.initialBalances?.[MoneyLocation.PRO_BANK] || ''} onChange={handleBalanceChange}/>
                                    <Input label="Efectivo Profesional (€)" name={MoneyLocation.CASH_PRO} type="number" step="0.01" placeholder="0.00" value={settingsData.initialBalances?.[MoneyLocation.CASH_PRO] || ''} onChange={handleBalanceChange}/>
                                </>
                            )}
                            <Input label="Banco Personal (€)" name={MoneyLocation.PERS_BANK} type="number" step="0.01" placeholder="0.00" value={settingsData.initialBalances?.[MoneyLocation.PERS_BANK] || ''} onChange={handleBalanceChange}/>
                            <Input label="Efectivo (€)" name={MoneyLocation.CASH} type="number" step="0.01" placeholder="0.00" value={settingsData.initialBalances?.[MoneyLocation.CASH] || ''} onChange={handleBalanceChange}/>
                            <Input label="Otros (Crypto, etc.) (€)" name={MoneyLocation.OTHER} type="number" step="0.01" placeholder="0.00" value={settingsData.initialBalances?.[MoneyLocation.OTHER] || ''} onChange={handleBalanceChange}/>
                        </div>
                    </div>
                );
            case 'finish':
                return (
                     <div className="text-center space-y-4">
                         <Icon name="check-circle" className="w-16 h-16 mx-auto text-green-500" />
                         <h2 className="text-2xl font-bold">¡Todo listo!</h2>
                         <p className="text-slate-600 dark:text-slate-400">
                             Has completado la configuración. Pulsa Finalizar para guardar y empezar a usar la aplicación.
                         </p>
                     </div>
                 );
            default: return null;
        }
    }

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={handleModalClose}
            title={isRelaunchable ? "Asistente de Configuración" : "Configuración Inicial"}
        >
            <div className="min-h-[350px] flex flex-col justify-between">
                <div>
                   {renderContent()}
                </div>

                <div className="mt-8">
                    {step < totalSteps && <ProgressBar currentStep={step} totalSteps={totalSteps} />}
                    <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700">
                        <Button variant="secondary" onClick={handleBack} disabled={step === 1}>
                            Atrás
                        </Button>
                        
                        {step >= totalSteps ? (
                             <Button onClick={handleFinish}>
                                Finalizar
                            </Button>
                        ) : (
                             <Button onClick={handleNext}>
                                Siguiente
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};
