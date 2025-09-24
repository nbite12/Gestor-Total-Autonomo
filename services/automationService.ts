import { AppData, ScheduledTransaction, Income, Expense, PersonalMovement, MoneyLocation, MoneySource } from '../types';

const getNextDate = (currentDate: Date, frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly'): Date => {
    const next = new Date(currentDate);
    switch (frequency) {
        case 'weekly':
            next.setDate(next.getDate() + 7);
            break;
        case 'monthly':
            next.setMonth(next.getMonth() + 1);
            break;
        case 'quarterly':
            next.setMonth(next.getMonth() + 3);
            break;
        case 'yearly':
            next.setFullYear(next.getFullYear() + 1);
            break;
    }
    return next;
};

export const runRecurringTransactionsAutomation = (data: AppData): { updatedData: AppData; hasChanged: boolean } => {
    // DISABLING THIS SERVICE. It creates pending transactions that confuse the user.
    // A new "Pending Actions" card will be implemented on the Global View to handle this in a user-driven way.
    return { updatedData: data, hasChanged: false };
};