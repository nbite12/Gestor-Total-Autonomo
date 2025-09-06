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


// --- AppContext for global state management ---
interface AppContextType {
    data: AppData;
    saveData: (value: AppData | ((prevState: AppData) => AppData), message: string) => void;
    formatCurrency: (amount: number) => string;
}
export const AppContext = createContext<AppContextType | null>(null);

// --- Main Application Component (Protected) ---
const AppContainer: React.FC = () => {
    const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('app-theme') as Theme) || Theme.LIGHT);
    const [currentView, setCurrentView] = useState<AppView>(AppView.GLOBAL);
    const { logout, user } = useAuth();
    const [isAiModalOpen, setAiModalOpen] = useState(false);

    const initialData: AppData = useMemo(() => ({
        incomes: [], expenses: [], personalMovements: [], transfers: [],
        investmentGoods: [],
        savingsGoals: [], potentialIncomes: [], potentialExpenses: [],
        professionalCategories: DEFAULT_PROFESSIONAL_CATEGORIES,
        personalCategories: DEFAULT_PERSONAL_CATEGORIES,
        settings: {
            nif: '', fullName: '', address: '',
            defaultVatRate: 21, defaultIrpfRate: 15, monthlyAutonomoFee: 300,
            geminiApiKey: '',
            isInRecargoEquivalencia: false,
            applySevenPercentDeduction: false,
            rentsOffice: false,
            isInROI: false,
            hiresProfessionals: false,
            initialBalances: {},
        },
    }), []);

    const [data, setDataState] = useState<AppData>(initialData);
    const [isDataLoading, setIsDataLoading] = useState(true);
    
    // --- Undo Functionality State ---
    const [undoState, setUndoState] = useState<AppData | null>(null);
    const [undoMessage, setUndoMessage] = useState('');
    const [isUndoToastVisible, setIsUndoToastVisible] = useState(false);
    const undoTimeoutRef = useRef<number | null>(null);


    useEffect(() => {
        const fetchAllData = async () => {
            if (user?.isGuest) {
                setDataState(initialData);
                setIsDataLoading(false);
                return;
            }

            try {
                setIsDataLoading(true);
                const remoteData = await api<AppData>('/data'); 
                setDataState({
                    ...initialData,
                    ...remoteData,
                    settings: {
                        ...initialData.settings,
                        ...(remoteData.settings || {}),
                    },
                });
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

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === Theme.DARK);
        localStorage.setItem('app-theme', theme);
    }, [theme]);

    const toggleTheme = () => setTheme(theme === Theme.LIGHT ? Theme.DARK : Theme.LIGHT);
    const formatCurrency = (amount: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);

    const renderView = () => {
        switch (currentView) {
            case AppView.PROFESSIONAL: return <ProfessionalView />;
            case AppView.GLOBAL: return <GlobalView />;
            case AppView.PERSONAL: return <PersonalView />;
            case AppView.SETTINGS: return <SettingsView />;
            default: return <ProfessionalView />;
        }
    };
    
    const NavButton: React.FC<{view: AppView, icon: string, label: string}> = ({view, icon, label}) => (
        <Button 
            variant={currentView === view ? 'primary' : 'ghost'} 
            onClick={() => setCurrentView(view)}
            className="flex-1 flex flex-col sm:flex-row h-14 sm:h-auto items-center justify-center gap-2"
            aria-label={`Ir a ${label}`}
        >
            <Icon name={icon} />
            <span className="text-xs sm:text-base">{label}</span>
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
        <AppContext.Provider value={{ data, saveData, formatCurrency }}>
            <div className="min-h-screen flex flex-col">
                <header className="bg-white dark:bg-slate-800 shadow-md p-4 sticky top-0 z-40">
                    <div className="container mx-auto flex justify-between items-center">
                        <h1 className="text-xl sm:text-2xl font-bold text-primary-500">
                           Gestor Total Autónomo
                        </h1>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-500 dark:text-slate-400 hidden sm:block">Hola, {user?.username}</span>
                            <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="Cambiar tema">
                                <Icon name={theme === 'light' ? 'moon' : 'sun'} className="w-6 h-6" />
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
                        <div className="absolute top-0 left-0 right-0 h-full grid grid-cols-5 items-center">
                            <NavButton view={AppView.PROFESSIONAL} icon="briefcase" label="Profesional" />
                            <NavButton view={AppView.GLOBAL} icon="sparkles" label="Global" />
                            <div></div> {/* Placeholder for the central button */}
                            <NavButton view={AppView.PERSONAL} icon="home" label="Personal" />
                            <NavButton view={AppView.SETTINGS} icon="cog" label="Ajustes" />
                        </div>
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                            <Button 
                                variant="primary" 
                                onClick={() => setAiModalOpen(true)}
                                className="rounded-full w-16 h-16 shadow-lg"
                                aria-label="Asistente IA"
                                disabled={!data.settings.geminiApiKey}
                                title={!data.settings.geminiApiKey ? "Configura tu API Key de Gemini en Ajustes para activar" : "Asistente IA"}
                            >
                                <Icon name="microphone" className="w-8 h-8"/>
                            </Button>
                        </div>
                    </div>
                </nav>

                <nav className="hidden sm:block container mx-auto p-4 sm:p-0 sm:pb-6">
                   <div className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-md grid grid-cols-5 items-center gap-2">
                       <NavButton view={AppView.PROFESSIONAL} icon="briefcase" label="Área Profesional" />
                       <NavButton view={AppView.GLOBAL} icon="sparkles" label="Visión Global" />
                       <div className="flex justify-center">
                         <Button 
                            variant="primary" 
                            onClick={() => setAiModalOpen(true)}
                            className="rounded-full w-14 h-14"
                            aria-label="Asistente IA"
                            disabled={!data.settings.geminiApiKey}
                            title={!data.settings.geminiApiKey ? "Configura tu API Key de Gemini en Ajustes para activar" : "Asistente IA"}
                          >
                              <Icon name="microphone" className="w-7 h-7"/>
                          </Button>
                       </div>
                       <NavButton view={AppView.PERSONAL} icon="home" label="Área Personal" />
                       <NavButton view={AppView.SETTINGS} icon="cog" label="Configuración" />
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