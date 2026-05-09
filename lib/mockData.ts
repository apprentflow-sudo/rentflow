export type PaymentStatus = 'pending' | 'paid' | 'overdue';

export interface Tenant {
  id: string;
  fullName: string;
  documentId: string;
  phone: string;
  email: string;
  propertyAddress: string;
  propertyNumber?: string;
  floor?: string;
  apt?: string;
  neighborhood?: string;
  province?: string;
  country?: string;
  landlordId: string;
  contractStart: string;
  contractEnd: string;
  contractUrl?: string;
}

export interface Payment {
  id: string;
  tenantId: string;
  status: PaymentStatus;
  method?: string;
  date?: string;
  amount: number;
  currency: string;
  month: string;
  monthIndex: number; // To help with sorting/filtering
  notes?: string;
  receiptUrl?: string;
}

export const MOCK_TENANTS: Tenant[] = [
  {
    id: 't-1',
    fullName: 'Ana Martínez',
    documentId: '12345678',
    phone: '+34 600 000 001',
    email: 'ana.martinez@email.com',
    propertyAddress: 'Carrer de Mallorca 123',
    propertyNumber: '123',
    floor: '2',
    apt: 'A',
    neighborhood: 'Eixample',
    province: 'Barcelona',
    country: 'España',
    landlordId: 'l-1',
    contractStart: '2025-01-01',
    contractEnd: '2026-01-01',
  },
  {
    id: 't-2',
    fullName: 'Carlos Ruiz',
    documentId: '87654321',
    phone: '+34 600 000 002',
    email: 'cruiz@email.com',
    propertyAddress: 'Av. Diagonal 440',
    propertyNumber: '440',
    floor: '1',
    apt: 'B',
    neighborhood: 'Gràcia',
    province: 'Barcelona',
    country: 'España',
    landlordId: 'l-1',
    contractStart: '2024-06-01',
    contractEnd: '2025-06-01',
    contractUrl: 'contrato_carlos.pdf'
  },
  {
    id: 't-3',
    fullName: 'Laura Gómez',
    documentId: 'A1234567',
    phone: '+34 600 000 003',
    email: 'laurag@email.com',
    propertyAddress: 'Carrer de Balmes 50',
    propertyNumber: '50',
    floor: '4',
    apt: 'C',
    neighborhood: 'Eixample',
    province: 'Barcelona',
    country: 'España',
    landlordId: 'l-1',
    contractStart: '2023-09-01',
    contractEnd: '2028-09-01',
  }
];

export const MOCK_PAYMENTS: Payment[] = [
  // Tenant 1 payments
  { id: 'p-1', tenantId: 't-1', status: 'paid', method: 'Transferencia', date: '2026-05-01', amount: 1100, currency: 'EUR', month: 'Mayo 2026', monthIndex: 202605, receiptUrl: 'dummy-receipt.jpg' },
  { id: 'p-1-4', tenantId: 't-1', status: 'paid', method: 'Transferencia', date: '2026-04-03', amount: 1100, currency: 'EUR', month: 'Abril 2026', monthIndex: 202604, receiptUrl: 'recibo_abril.jpg' },
  { id: 'p-1-3', tenantId: 't-1', status: 'paid', method: 'Transferencia', date: '2026-03-02', amount: 1100, currency: 'EUR', month: 'Marzo 2026', monthIndex: 202603, receiptUrl: 'recibo_marzo.jpg' },
  
  // Tenant 2 payments
  { id: 'p-2', tenantId: 't-2', status: 'pending', amount: 950, currency: 'EUR', month: 'Mayo 2026', monthIndex: 202605 },
  { id: 'p-2-4', tenantId: 't-2', status: 'paid', method: 'Efectivo', date: '2026-04-05', amount: 950, currency: 'EUR', month: 'Abril 2026', monthIndex: 202604, receiptUrl: 'efectivo_abril.jpg' },
  { id: 'p-2-3', tenantId: 't-2', status: 'paid', method: 'Efectivo', date: '2026-03-04', amount: 950, currency: 'EUR', month: 'Marzo 2026', monthIndex: 202603, receiptUrl: 'efectivo_marzo.jpg' },
  { id: 'p-2-2', tenantId: 't-2', status: 'paid', method: 'Transferencia', date: '2026-02-05', amount: 950, currency: 'EUR', month: 'Febrero 2026', monthIndex: 202602, receiptUrl: 'tf_febrero.pdf' },

  // Tenant 3 payments
  { id: 'p-3', tenantId: 't-3', status: 'overdue', amount: 1300, currency: 'EUR', month: 'Mayo 2026', monthIndex: 202605 },
  { id: 'p-3-4', tenantId: 't-3', status: 'overdue', amount: 1300, currency: 'EUR', month: 'Abril 2026', monthIndex: 202604 },
  { id: 'p-3-3', tenantId: 't-3', status: 'paid', method: 'Transferencia', date: '2026-03-10', amount: 1300, currency: 'EUR', month: 'Marzo 2026', monthIndex: 202603, receiptUrl: 'recibo_marzo.jpg' },
];
