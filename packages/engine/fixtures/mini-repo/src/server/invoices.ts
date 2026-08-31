import type { Invoice } from '../shared/types';

export function validateSiret(siret: string): boolean {
  return /^\d{14}$/.test(siret);
}

export function createInvoice(id: string, amount: number, siret: string): Invoice {
  if (!validateSiret(siret)) {
    throw new Error('SIRET invalide');
  }
  return { id, amount, siret };
}
