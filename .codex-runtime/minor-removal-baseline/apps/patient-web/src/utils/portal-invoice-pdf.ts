import type { PortalInvoiceDetails } from '../api/patient-portal';

export const date = (value: string) =>
  new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(value),
  );

export const money = (value: number) =>
  new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 0,
  }).format(value);

export const label = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const downloadInvoicePdf = async (invoice: PortalInvoiceDetails) => {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const amount = (value: number) =>
    `KES ${new Intl.NumberFormat('en-KE', { maximumFractionDigits: 2 }).format(value)}`;
  const patientAddress = invoice.patient
    ? Object.values(invoice.patient.address).filter(Boolean).join(', ')
    : '';
  const branchAddress = invoice.branch
    ? [
        invoice.branch.address,
        invoice.branch.city,
        invoice.branch.state,
        invoice.branch.country,
        invoice.branch.postal_code,
      ]
        .filter(Boolean)
        .join(', ')
    : '';
  let y = 18;
  const ensureSpace = (height: number) => {
    if (y + height <= 282) return;
    pdf.addPage();
    y = 18;
  };

  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(19);
  pdf.text('HMS', 16, y);
  pdf.setFontSize(14);
  pdf.text('OFFICIAL HOSPITAL INVOICE', 194, y, { align: 'right' });
  y += 8;
  pdf.setDrawColor(37, 99, 235);
  pdf.setLineWidth(0.8);
  pdf.line(16, y, 194, y);
  y += 9;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text(invoice.branch?.name || 'HMS Hospital', 16, y);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Invoice: ${invoice.invoice_number}`, 194, y, { align: 'right' });
  y += 5;
  if (branchAddress) pdf.text(pdf.splitTextToSize(branchAddress, 85), 16, y);
  pdf.text(`Issued: ${date(invoice.invoice_date)}`, 194, y, { align: 'right' });
  y += branchAddress ? 12 : 7;

  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(16, y, 178, 25, 2, 2, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.text('BILL TO', 20, y + 6);
  pdf.setFont('helvetica', 'normal');
  pdf.text(invoice.patient?.name || 'Patient', 20, y + 12);
  pdf.text(`MRN: ${invoice.patient?.patient_number || '-'}`, 20, y + 18);
  if (patientAddress) pdf.text(pdf.splitTextToSize(patientAddress, 80), 105, y + 12);
  y += 34;

  pdf.setFont('helvetica', 'bold');
  pdf.text('DESCRIPTION', 18, y);
  pdf.text('QTY', 130, y, { align: 'right' });
  pdf.text('UNIT RATE', 160, y, { align: 'right' });
  pdf.text('AMOUNT', 192, y, { align: 'right' });
  y += 3;
  pdf.setLineWidth(0.2);
  pdf.line(16, y, 194, y);
  y += 7;
  pdf.setFont('helvetica', 'normal');
  invoice.items.forEach((item) => {
    const description = pdf.splitTextToSize(item.service_name, 92) as string[];
    const rowHeight = Math.max(7, description.length * 5);
    ensureSpace(rowHeight + 3);
    pdf.text(description, 18, y);
    pdf.text(String(item.quantity), 130, y, { align: 'right' });
    pdf.text(amount(item.unit_price), 160, y, { align: 'right' });
    pdf.text(amount(item.line_total), 192, y, { align: 'right' });
    y += rowHeight;
  });
  if (!invoice.items.length) {
    pdf.text('No billed service lines recorded.', 18, y);
    y += 8;
  }
  ensureSpace(50);
  pdf.line(110, y, 194, y);
  y += 7;
  const totalLine = (labelText: string, value: number, bold = false) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.text(labelText, 140, y, { align: 'right' });
    pdf.text(amount(value), 192, y, { align: 'right' });
    y += 6;
  };
  totalLine('Subtotal', invoice.subtotal);
  totalLine('Discount', invoice.discount_amount);
  totalLine('Tax', invoice.tax_amount);
  totalLine('Invoice total', invoice.total_amount, true);
  totalLine('Amount paid', invoice.paid_amount);
  totalLine('Balance due', invoice.balance_amount, true);

  if (invoice.payments.length) {
    ensureSpace(18 + invoice.payments.length * 7);
    y += 4;
    pdf.setFont('helvetica', 'bold');
    pdf.text('PAYMENT HISTORY', 16, y);
    y += 7;
    pdf.setFont('helvetica', 'normal');
    invoice.payments.forEach((payment) => {
      pdf.text(
        `${date(payment.payment_date)}  ${payment.payment_number}  ${label(payment.payment_method)}`,
        18,
        y,
      );
      pdf.text(amount(payment.amount), 192, y, { align: 'right' });
      y += 7;
    });
  }
  ensureSpace(18);
  y += 7;
  pdf.setFont('helvetica', 'bold');
  pdf.text(
    invoice.balance_amount > 0 ? `AMOUNT DUE: ${amount(invoice.balance_amount)}` : 'PAID IN FULL',
    194,
    y,
    { align: 'right' },
  );
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text('This invoice was generated from the HMS hospital billing record.', 16, 290);
  pdf.save(`${invoice.invoice_number}.pdf`);
};
