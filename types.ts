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
    PRO_BANK = 'Banco Profesional',
    CASH_PRO = 'Efectivo Profesional',
    PERS_BANK = 'Banco Personal',
    CASH = 'Efectivo',
    OTHER = 'Otros (Crypto, etc.)'
}

export enum TransferJustification {
    SUELDO_AUTONOMO = 'Sueldo del Autónomo',
    GASTO_NO_RELACIONADO = 'Gasto No Relacionado con la Actividad',
    RETIRO_EFECTIVO_NEGOCIO = 'Retiro de efectivo para el negocio'
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
  paymentDate?: string;
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
  isIntraCommunity?: boolean;
}

export interface Expense {
  id: string;
  date: string; // ISO string
  paymentDate?: string;
  isPaid: boolean;
  invoiceNumber?: string;
  providerName: string;
  providerNif?: string;
  concept: string;
  baseAmount: number;
  deductibleBaseAmount?: number;
  vatRate: number; // percentage
  recargoEquivalenciaRate?: number; // percentage
  recargoEquivalenciaAmount?: number; // calculated amount
  irpfRetentionRate?: number; // percentage
  irpfRetentionAmount?: number; // calculated amount
  categoryId: string;
  location?: MoneyLocation;
  attachment?: Attachment;
  isDeductible: boolean;
  isIntraCommunity?: boolean;
  isRentalExpense?: boolean;
  landlordNif?: string;
  propertyCadastralRef?: string;
}

export interface InvestmentGood {
    id: string;
    purchaseDate: string; // ISO string
    description: string;
    providerName: string;
    providerNif?: string;
    invoiceNumber?: string;
    acquisitionValue: number; // Base imponible
    vatRate: number;
    usefulLife: number; // in years
    isDeductible: boolean;
    categoryId: string;
    isPaid: boolean;
    paymentDate?: string;
    location?: MoneyLocation;
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
  isPaid?: boolean;
  paymentDate?: string;
}

export interface Transfer {
    id: string;
    date: string; // ISO string
    amount: number;
    fromLocation: MoneyLocation;
    toLocation: MoneyLocation;
    concept: string;
    justification: TransferJustification;
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

export interface PotentialExpense {
  id: string;
  concept: string;
  type: 'monthly' | 'one-off';
  date?: string; // ISO string, for one-off type
  amount: number;
  categoryId: string;
}

export interface UserSettings {
  nif: string;
  fullName: string;
  address: string;
  defaultVatRate: number;
  defaultIrpfRate: number;
  monthlyAutonomoFee: number;
  geminiApiKey: string;
  isInRecargoEquivalencia: boolean;
  applySevenPercentDeduction: boolean;
  rentsOffice: boolean;
  isInROI: boolean;
  hiresProfessionals: boolean;
  initialBalances?: {
      [key in MoneyLocation]?: number;
  };
}

export interface AppData {
  incomes: Income[];
  expenses: Expense[];
  investmentGoods: InvestmentGood[];
  personalMovements: PersonalMovement[];
  transfers: Transfer[];
  savingsGoals: SavingsGoal[];
  potentialIncomes: PotentialIncome[];
  potentialExpenses: PotentialExpense[];
  professionalCategories: Category[];
  personalCategories: Category[];
  settings: UserSettings;
}