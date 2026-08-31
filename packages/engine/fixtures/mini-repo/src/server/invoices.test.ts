import { createInvoice } from './invoices';

export function testCreateInvoice(): void {
  const invoice = createInvoice('f-1', 100, '12345678901234');
  if (invoice.amount !== 100) throw new Error('échec');
}
