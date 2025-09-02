import React, { useState, useEffect, useMemo, createContext } from 'react';
import { AppView, Theme, AppData } from './types';
import { Icon, Button } from './components/ui';
import ProfessionalView from './components/ProfessionalView';
import PersonalView from './components/PersonalView';
import SettingsView from './components/SettingsView';
import GlobalView from './components/GlobalView';
import { DEFAULT_PROFESSIONAL_CATEGORIES, DEFAULT_PERSONAL_CATEGORIES } from './constants';
import { useLocalStorage } from './hooks/useLocalStorage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Auth from './components/Auth';
import { api } from './services/api';

// --- AppContext for global state management ---
interface AppContextType {
    data: AppData;
    setData: (value: AppData | ((prevState: AppData) => AppData)) => void;
    formatCurrency: (amount: number) => string;
}
export const AppContext = createContext<AppContextType | null>(null);

// --- Main Application Component (Protected) ---
const AppContainer: React.FC = () => {
    const [theme, setTheme] = useLocalStorage<Theme>('app-theme', Theme.LIGHT);
    const [currentView, setCurrentView] = useState<AppView>(AppView.GLOBAL);
    const { logout, user } = useAuth();

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
        },
    }), []);

    const [data, setDataState] = useState<AppData>(initialData);
    const [isDataLoading, setIsDataLoading] = useState(true);

    useEffect(() => {
        const fetchAllData = async () => {
            try {
                setIsDataLoading(true);
                // This endpoint should return the entire AppData object for the logged-in user
                const remoteData = await api<AppData>('/data'); 
                // Merge remote data with initial data to ensure all keys are present
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
    }, [initialData]);

    const setData = (value: AppData | ((prevState: AppData) => AppData)) => {
        const updater = (prev: AppData) => {
            const newState = typeof value === 'function' ? value(prev) : value;
            api('/data', { method: 'POST', body: newState })
                .catch(err => {
                    console.error("Failed to save data:", err);
                    alert("Error: No se pudieron guardar los cambios en el servidor. Revisa tu conexión.");
                });
            return newState;
        };
        setDataState(updater);
    };

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === Theme.DARK);
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
        <AppContext.Provider value={{ data, setData, formatCurrency }}>
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

                <nav className="sticky bottom-0 bg-white dark:bg-slate-800 shadow-top p-2 sm:hidden z-40">
                     <div className="flex justify-around items-center gap-1">
                         <NavButton view={AppView.PROFESSIONAL} icon="briefcase" label="Profesional" />
                         <NavButton view={AppView.GLOBAL} icon="sparkles" label="Global" />
                         <NavButton view={AppView.PERSONAL} icon="home" label="Personal" />
                         <NavButton view={AppView.SETTINGS} icon="cog" label="Ajustes" />
                     </div>
                </nav>
                 <nav className="hidden sm:block container mx-auto p-4 sm:p-0 sm:pb-6">
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-md flex justify-around items-center gap-2">
                         <NavButton view={AppView.PROFESSIONAL} icon="briefcase" label="Área Profesional" />
                         <NavButton view={AppView.GLOBAL} icon="sparkles" label="Visión Global" />
                         <NavButton view={AppView.PERSONAL} icon="home" label="Área Personal" />
                         <NavButton view={AppView.SETTINGS} icon="cog" label="Configuración" />
                    </div>
                </nav>
            </div>
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