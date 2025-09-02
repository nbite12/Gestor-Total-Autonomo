import React, { useState, useEffect, useMemo } from 'react';
import { AppView, Theme, AppData, UserSettings, Category, Income, Expense, PersonalMovement, SavingsGoal, PotentialIncome } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { Icon, Button } from './components/ui';
import ProfessionalView from './components/ProfessionalView';
import PersonalView from './components/PersonalView';
import SettingsView from './components/SettingsView';
import GlobalView from './components/GlobalView';
import { DEFAULT_PROFESSIONAL_CATEGORIES, DEFAULT_PERSONAL_CATEGORIES } from './constants';

// AppContext for global state management
interface AppContextType {
    data: AppData;
    setData: React.Dispatch<React.SetStateAction<AppData>>;
    formatCurrency: (amount: number) => string;
}

export const AppContext = React.createContext<AppContextType | null>(null);

const App: React.FC = () => {
    const [theme, setTheme] = useLocalStorage<Theme>('app-theme', Theme.LIGHT);
    const [currentView, setCurrentView] = useState<AppView>(AppView.GLOBAL);

    const initialData: AppData = useMemo(() => ({
        incomes: [],
        expenses: [],
        personalMovements: [],
        savingsGoals: [],
        potentialIncomes: [],
        professionalCategories: DEFAULT_PROFESSIONAL_CATEGORIES,
        personalCategories: DEFAULT_PERSONAL_CATEGORIES,
        settings: {
            nif: '',
            fullName: '',
            address: '',
            defaultVatRate: 21,
            defaultIrpfRate: 15,
            monthlyAutonomoFee: 300,
            geminiApiKey: '',
        },
    }), []);
    
    const [data, setData] = useLocalStorage<AppData>('app-data', initialData);

    // Data migration logic has been moved into the useLocalStorage hook
    // for a more robust and safe initialization, preventing render crashes.

    useEffect(() => {
        if (theme === Theme.DARK) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    const toggleTheme = () => {
        setTheme(theme === Theme.LIGHT ? Theme.DARK : Theme.LIGHT);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
    };

    const contextValue = { data, setData, formatCurrency };
    
    const renderView = () => {
        switch (currentView) {
            case AppView.PROFESSIONAL:
                return <ProfessionalView />;
            case AppView.GLOBAL:
                return <GlobalView />;
            case AppView.PERSONAL:
                return <PersonalView />;
            case AppView.SETTINGS:
                return <SettingsView />;
            default:
                return <ProfessionalView />;
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

    return (
        <AppContext.Provider value={contextValue}>
            <div className="min-h-screen flex flex-col">
                <header className="bg-white dark:bg-slate-800 shadow-md p-4 sticky top-0 z-40">
                    <div className="container mx-auto flex justify-between items-center">
                        <h1 className="text-xl sm:text-2xl font-bold text-primary-500">
                           Gestor Total Autónomo
                        </h1>
                        <div className="flex items-center gap-2">
                             <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="Cambiar tema">
                                <Icon name={theme === 'light' ? 'moon' : 'sun'} className="w-6 h-6" />
                            </Button>
                        </div>
                    </div>
                </header>
                
                <main className="flex-grow container mx-auto p-4 sm:p-6">
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

export default App;