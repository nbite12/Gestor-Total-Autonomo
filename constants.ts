

import { Category } from './types';

export const IRPF_BRACKETS: { limit: number, rate: number }[] = [
    { limit: 12450, rate: 0.19 },
    { limit: 20200, rate: 0.24 },
    { limit: 35200, rate: 0.30 },
    { limit: 60000, rate: 0.37 },
    { limit: 300000, rate: 0.45 },
    { limit: Infinity, rate: 0.47 },
];

export const DEFAULT_PROFESSIONAL_CATEGORIES: Category[] = [
    { id: 'cat-pro-1', name: 'Software y suscripciones' },
    { id: 'cat-pro-2', name: 'Hardware y equipo' },
    { id: 'cat-pro-3', name: 'Gestoría / Asesoría' },
    { id: 'cat-pro-4', name: 'Publicidad y Marketing' },
    { id: 'cat-pro-5', name: 'Transporte y Viajes' },
    { id: 'cat-pro-6', name: 'Suministros (Oficina)' },
];

export const DEFAULT_PERSONAL_CATEGORIES: Category[] = [
    { id: 'cat-per-1', name: 'Vivienda (Alquiler/Hipoteca)' },
    { id: 'cat-per-2', name: 'Supermercado' },
    { id: 'cat-per-3', name: 'Restaurantes y Ocio' },
    { id: 'cat-per-4', name: 'Transporte (Público/Coche)' },
    { id: 'cat-per-5', name: 'Facturas (Luz, Agua, Internet)' },
    { id: 'cat-per-6', name: 'Ahorro/Inversión' },
];