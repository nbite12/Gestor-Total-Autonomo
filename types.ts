export enum AppView {
  PROFESSIONAL = 'PROFESSIONAL',
  GLOBAL = 'GLOBAL',
  PERSONAL = 'PERSONAL',
  SETTINGS = 'SETTINGS',
}

export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
}

export enum MoneySource {
  AUTONOMO = 'Autónomo (Declarado)',
  PERSONAL = 'Personal',
  B = 'B (No Declarado)',
}

export enum MoneyLocation {
    CASH = 'Efectivo',
    PRO_BANK = 'Banco Profesional',
    PERS_BANK = 'Banco Personal',
    OTHER = 'Otros (Crypto, etc.)'
}

export interface Category {
  id: string;
  name: string;
}

export interface Attachment {
  name: string;
  type: string;
  data: string; // base64 encoded file content
}

export interface Income {
  id:string;
  invoiceNumber: string;
  date: string; // ISO string
  clientName: string;
  clientNif?: string;
  clientAddress?: string;
  concept: string;
  baseAmount: number;
  vatRate: number; // percentage
  irpfRate: number; // percentage
  source: MoneySource;
  isPaid: boolean;
  location: MoneyLocation;
  attachment?: Attachment;
}

export interface Expense {
  id: string;
  date: string; // ISO string
  providerName: string;
  concept: string;
  baseAmount: number;
  vatRate: number; // percentage
  categoryId: string;
  location: MoneyLocation;
  attachment?: Attachment;
}

export interface PersonalMovement {
  id: string;
  date: string; // ISO string
  concept: string;
  amount: number;
  type: 'income' | 'expense';
  categoryId: string;
  location: MoneyLocation;
  source?: MoneySource; // Only for income
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string; // ISO string
  plannedContribution?: number; // User-defined monthly contribution
}

export interface PotentialIncome {
    id: string;
    concept: string;
    type: 'monthly' | 'one-off';
    date?: string; // ISO string, for one-off type
    source: MoneySource;
    location: MoneyLocation;
    // For Personal or B source
    amount?: number; 
    // For Autonomo source
    baseAmount?: number;
    vatRate?: number;
    irpfRate?: number;
}

export interface UserSettings {
  nif: string;
  fullName: string;
  address: string;
  defaultVatRate: number;
  defaultIrpfRate: number;
  monthlyAutonomoFee: number;
  geminiApiKey: string;
}

export interface AppData {
  incomes: Income[];
  expenses: Expense[];
  personalMovements: PersonalMovement[];
  savingsGoals: SavingsGoal[];
  potentialIncomes: PotentialIncome[];
  professionalCategories: Category[];
  personalCategories: Category[];
  settings: UserSettings;
}