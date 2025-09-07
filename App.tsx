import React, { useState, useEffect, useMemo, createContext, useRef } from 'react';
import { AppView, Theme, AppData } from './types';
import { Icon, Button } from './components/ui';
import ProfessionalView from './components/ProfessionalView';
import PersonalView from './components/PersonalView';
import SettingsView from './components/SettingsView';
import GlobalView from './components/GlobalView';
import { DEFAULT_PROFESSIONAL_CATEGORIES, DEFAULT_PERSONAL_CATEGORIES } from './constants';
import { AuthProvider, useAuth } from './hooks/AuthContext';
import Auth from './components/Auth';
import { api } from './services/api';
import { AICommandModal } from './components/AICommandModal';
import { UndoToast } from './components/UndoToast';
import { OnboardingModal } from './components/OnboardingModal';


// --- AppContext for global state management ---
interface AppContextType {
    data: AppData;
    saveData: (value: AppData | ((prevState: AppData) => AppData), message: string) => void;
    formatCurrency: (amount: number) => string;
    resetData: () => void;
    isPrivacyMode: boolean;
    togglePrivacyMode: () => void;
    isProfessionalModeEnabled: boolean;
}
export const AppContext = createContext<AppContextType | null>(null);

// --- Main Application Component (Protected) ---
const AppContainer: React.FC = () => {
    const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('app-theme') as Theme) || Theme.LIGHT);
    const [currentView, setCurrentView] = useState<AppView>(AppView.GLOBAL);
    const { logout, user } = useAuth();
    const [isAiModalOpen, setAiModalOpen] = useState(false);
    const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

    const initialData: AppData = useMemo(() => ({
        incomes: [], expenses: [], personalMovements: [], transfers: [],
        investmentGoods: [],
        savingsGoals: [], potentialIncomes: [], potentialExpenses: [],
        professionalCategories: DEFAULT_PROFESSIONAL_CATEGORIES,
        personalCategories: DEFAULT_PERSONAL_CATEGORIES,
        settings: {
            nif: '', fullName: '', address: '',
            defaultVatRate: 21, defaultIrpfRate: 15, monthlyAutonomoFee: 80,
            geminiApiKey: '',
            isInRecargoEquivalencia: false,
            applySevenPercentDeduction: false,
            rentsOffice: false,
            isInROI: false,
            hiresProfessionals: false,
            professionalModeEnabled: true,
            defaultPrivacyMode: false,
            initialBalances: {},
            hasCompletedOnboarding: false,
        },
    }), []);

    const [data, setDataState] = useState<AppData>(initialData);
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [isPrivacyMode, setIsPrivacyMode] = useState(initialData.settings.defaultPrivacyMode);
    
    // --- Undo Functionality State ---
    const [undoState, setUndoState] = useState<AppData | null>(null);
    const [undoMessage, setUndoMessage] = useState('');
    const [isUndoToastVisible, setIsUndoToastVisible] = useState(false);
    const undoTimeoutRef = useRef<number | null>(null);


    useEffect(() => {
        const fetchAllData = async () => {
            if (user?.isGuest) {
                setDataState(initialData);
                setIsOnboardingOpen(true);
                setIsDataLoading(false);
                return;
            }

            try {
                setIsDataLoading(true);
                const remoteData = await api<AppData>('/data'); 
                const hydratedData = {
                    ...initialData,
                    ...remoteData,
                    settings: {
                        ...initialData.settings,
                        ...(remoteData.settings || {}),
                    },
                };
                setDataState(hydratedData);
                setIsPrivacyMode(hydratedData.settings.defaultPrivacyMode);
                
                if (!hydratedData.settings.hasCompletedOnboarding) {
                    setIsOnboardingOpen(true);
                }

            } catch (error) {
                console.error("Failed to fetch user data:", error);
            } finally {
                setIsDataLoading(false);
            }
        };
        fetchAllData();
    }, [initialData, user?.isGuest]);

    const saveData = (value: AppData | ((prevState: AppData) => AppData), message: string) => {
        if (undoTimeoutRef.current) {
            clearTimeout(undoTimeoutRef.current);
        }

        const previousData = data;

        const updater = (prev: AppData) => {
            const newState = typeof value === 'function' ? value(prev) : value;
             // Check if professional mode was just disabled
            if (prev.settings.professionalModeEnabled && !newState.settings.professionalModeEnabled) {
                // If the user is on a now-hidden view, switch them to the personal view
                if (currentView === AppView.PROFESSIONAL) {
                    setCurrentView(AppView.PERSONAL);
                }
            }
            if (!user?.isGuest) {
                api('/data', { method: 'POST', body: newState })
                    .catch(err => {
                        console.error("Failed to save data:", err);
                        alert("Error: No se pudieron guardar los cambios en el servidor. Revisa tu conexión.");
                    });
            }
            return newState;
        };
        
        setDataState(updater);
        
        // Setup Undo
        setUndoState(previousData);
        setUndoMessage(message);
        setIsUndoToastVisible(true);

        undoTimeoutRef.current = window.setTimeout(() => {
            setIsUndoToastVisible(false);
            setUndoState(null);
        }, 5000);
    };
    
    const handleUndo = () => {
        if (undoState) {
            setDataState(undoState); // Revert state
            if (!user?.isGuest) {
                 api('/data', { method: 'POST', body: undoState })
                    .catch(err => console.error("Failed to save undone data:", err));
            }
            setUndoState(null);
            setIsUndoToastVisible(false);
            if (undoTimeoutRef.current) {
                clearTimeout(undoTimeoutRef.current);
            }
        }
    };

    const resetData = () => {
        const resetState = { ...initialData, settings: { ...initialData.settings, hasCompletedOnboarding: true }};
        saveData(resetState, "Todos los datos han sido eliminados.");
    };

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === Theme.DARK);
        localStorage.setItem('app-theme', theme);
    }, [theme]);
    
    useEffect(() => {
        if (!data.settings.professionalModeEnabled && currentView === AppView.PROFESSIONAL) {
            setCurrentView(AppView.PERSONAL);
        }
    }, [data.settings.professionalModeEnabled, currentView]);

    const toggleTheme = () => setTheme(prev => prev === Theme.LIGHT ? Theme.DARK : Theme.LIGHT);
    const togglePrivacyMode = () => setIsPrivacyMode(prev => !prev);
    
    const formatCurrency = (amount: number) => {
        if (isPrivacyMode) return '*****';
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
    };
    
    const isProfessionalModeEnabled = data.settings.professionalModeEnabled;

    const renderView = () => {
        if (!isProfessionalModeEnabled) {
            switch(currentView) {
                case AppView.PERSONAL: return <PersonalView />;
                case AppView.GLOBAL: return <GlobalView />;
                case AppView.SETTINGS: return <SettingsView />;
                default: return <GlobalView />;
            }
        }
        switch (currentView) {
            case AppView.PROFESSIONAL: return <ProfessionalView />;
            case AppView.GLOBAL: return <GlobalView />;
            case AppView.PERSONAL: return <PersonalView />;
            case AppView.SETTINGS: return <SettingsView />;
            default: return <GlobalView />;
        }
    };
    
    const NavButton: React.FC<{view: AppView, icon: string, label: string, className?: string}> = ({view, icon, label, className = ''}) => (
        <Button 
            variant={currentView === view ? 'primary' : 'ghost'} 
            onClick={() => setCurrentView(view)}
            className={`flex flex-col sm:flex-row h-full items-center justify-center gap-2 w-full ${className}`}
            aria-label={`Ir a ${label}`}
        >
            <Icon name={icon} />
            <span className="text-xs sm:text-base">{label}</span>
        </Button>
    );
    
    const AiButton = ({isDesktop = false}: {isDesktop?: boolean}) => (
         <Button 
            variant="primary" 
            onClick={() => setAiModalOpen(true)}
            className={`rounded-full shadow-lg ${isDesktop ? 'w-14 h-14' : 'w-16 h-16'}`}
            aria-label="Asistente IA"
            disabled={!data.settings.geminiApiKey}
            title={!data.settings.geminiApiKey ? "Configura tu API Key de Gemini en Ajustes para activar" : "Asistente IA"}
        >
            <Icon name="microphone" className={isDesktop ? 'w-7 h-7' : 'w-8 h-8'}/>
        </Button>
    );

    if (isDataLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p>Cargando tus datos...</p>
            </div>
        );
    }
    
    return (
        <AppContext.Provider value={{ data, saveData, formatCurrency, resetData, isPrivacyMode, togglePrivacyMode, isProfessionalModeEnabled }}>
            <div className="min-h-screen flex flex-col">
                <header className="bg-white dark:bg-slate-800 shadow-md p-4 sticky top-0 z-50">
                    <div className="container mx-auto flex justify-between items-center">
                        <h1 className="text-xl sm:text-2xl font-bold text-primary-500">
                           Gestor Total Autónomo
                        </h1>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-500 dark:text-slate-400 hidden sm:block">Hola, {user?.username}</span>
                            <Button variant="ghost" size="sm" onClick={togglePrivacyMode} aria-label="Ocultar/Mostrar saldos">
                                <Icon name={isPrivacyMode ? 'eye-off' : 'eye'} className="w-6 h-6" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="Cambiar tema">
                                <Icon name={theme === 'light' ? 'moon' : 'sun'} className="w-6 h-6" />
                            </Button>
                             <Button variant={currentView === AppView.SETTINGS ? 'secondary' : 'ghost'} size="sm" onClick={() => setCurrentView(AppView.SETTINGS)} aria-label="Configuración">
                                <Icon name="cog" className="w-6 h-6" />
                            </Button>
                            <Button variant="secondary" size="sm" onClick={logout}>
                                Cerrar Sesión
                            </Button>
                        </div>
                    </div>
                </header>
                
                <main className="flex-grow container mx-auto p-4 sm:p-6 pb-24 sm:pb-6">
                    {renderView()}
                </main>

                <nav className="sticky bottom-0 bg-white dark:bg-slate-800 shadow-[0_-2px_5px_rgba(0,0,0,0.1)] p-2 sm:hidden z-40">
                    <div className="relative h-14">
                        <div className="absolute top-0 left-0 right-0 h-full flex justify-between items-stretch gap-1">
                            {/* Left Column */}
                            <div className="flex-1 flex justify-center items-center">
                                <NavButton view={AppView.GLOBAL} icon="sparkles" label="Global" />
                            </div>

                            {/* Center Spacer */}
                            <div className="w-16 flex-shrink-0" />

                            {/* Right Column */}
                            <div className="flex-1 flex justify-center items-center gap-1">
                                {isProfessionalModeEnabled ? (
                                    <>
                                        <NavButton view={AppView.PROFESSIONAL} icon="briefcase" label="Profesional" />
                                        <NavButton view={AppView.PERSONAL} icon="home" label="Personal" />
                                    </>
                                ) : (
                                    <NavButton view={AppView.PERSONAL} icon="home" label="Personal" />
                                )}
                            </div>
                        </div>
                        {/* AI Button Overlay */}
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                           <AiButton />
                        </div>
                    </div>
                </nav>

                <nav className="hidden sm:block container mx-auto p-4 sm:p-0 sm:pb-6">
                   <div className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-md flex items-center gap-2 h-16">
                        {/* Left Column */}
                        <div className="flex-1 flex justify-center">
                            <NavButton view={AppView.GLOBAL} icon="sparkles" label="Visión Global" className="max-w-xs" />
                        </div>
                        
                        {/* Center AI Button */}
                        <div className="flex-shrink-0">
                           <AiButton isDesktop={true} />
                        </div>

                        {/* Right Column */}
                        <div className={`flex-1 flex ${isProfessionalModeEnabled ? 'justify-end' : 'justify-center'} gap-2`}>
                        {isProfessionalModeEnabled ? (
                                <>
                                    <NavButton view={AppView.PROFESSIONAL} icon="briefcase" label="Área Profesional" className="max-w-xs"/>
                                    <NavButton view={AppView.PERSONAL} icon="home" label="Área Personal" className="max-w-xs"/>
                                </>
                            ) : (
                                <NavButton view={AppView.PERSONAL} icon="home" label="Área Personal" className="max-w-xs"/>
                            )}
                        </div>
                   </div>
                </nav>
            </div>
            {isAiModalOpen && <AICommandModal isOpen={isAiModalOpen} onClose={() => setAiModalOpen(false)} />}
             <UndoToast
                isVisible={isUndoToastVisible}
                message={undoMessage}
                onUndo={handleUndo}
                onClose={() => setIsUndoToastVisible(false)}
            />
            <OnboardingModal isOpen={isOnboardingOpen} onClose={() => setIsOnboardingOpen(false)} />
        </AppContext.Provider>
    );
};

// --- App Wrapper for Authentication ---
const App: React.FC = () => {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p>Inicializando...</p>
            </div>
        );
    }
    
    return isAuthenticated ? <AppContainer /> : <Auth />;
};

// --- Final export with AuthProvider ---
const AppWithProvider: React.FC = () => (
    <AuthProvider>
        <App />
    </AuthProvider>
);

export default AppWithProvider;