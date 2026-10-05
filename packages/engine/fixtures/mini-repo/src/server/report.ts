import { createInvoice } from './invoices';

export function monthlyReport(): number {
  const invoice = createInvoice('r-1', 42, '12345678901234');
  return invoice.amount;
}
