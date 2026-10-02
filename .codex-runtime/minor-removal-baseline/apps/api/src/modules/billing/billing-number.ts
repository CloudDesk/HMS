import { randomBytes } from 'node:crypto';

const dateCode = (date = new Date()) => date.toISOString().slice(0, 10).replaceAll('-', '');

export const createBillingNumber = (prefix: 'INV' | 'PAY') =>
  `${prefix}-${dateCode()}-${randomBytes(4).toString('hex').toUpperCase()}`;
