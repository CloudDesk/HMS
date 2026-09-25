import { jsPDF } from 'jspdf';
import type {
  DentalTreatmentPlanItem,
  DentalTreatmentStageResponse,
  DentalTreatmentQuotationResponse,
  DentalProstheticLabOrderResponse,
} from '../api/opd';
import { getToothName } from '../pages/dental-utils';

export interface DentalStagesPdfOptions {
  item: DentalTreatmentPlanItem;
  stages: DentalTreatmentStageResponse[];
  episodeLabOrders?: DentalProstheticLabOrderResponse[];
  patientName?: string | null;
  patientId?: string | null;
  episodeNumber?: string | number | null;
}

export interface DentalQuotationPdfOptions {
  quotation: DentalTreatmentQuotationResponse;
  patientName?: string | null;
  patientId?: string | null;
  episodeNumber?: string | number | null;
  formatCurrency?: (val: number) => string;
}

export function downloadDentalStagesPdf(options: DentalStagesPdfOptions): void {
  const { item, stages, episodeLabOrders = [], patientName, patientId, episodeNumber } = options;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });

  let y = 18;
  const ensureSpace = (height: number) => {
    if (y + height <= 280) return;
    pdf.addPage();
    y = 18;
  };

  // Header
  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text('HMS', 16, y);
  pdf.setFontSize(13);
  pdf.text('DENTAL TREATMENT STAGES SUMMARY', 194, y, { align: 'right' });
  y += 7;

  pdf.setDrawColor(37, 99, 235);
  pdf.setLineWidth(0.8);
  pdf.line(16, y, 194, y);
  y += 8;

  // Metadata block
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(16, y, 178, 26, 2, 2, 'F');
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(16, y, 178, 26, 2, 2, 'D');

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(100, 116, 139);
  pdf.text('PROCEDURE:', 20, y + 6);
  pdf.text('TOOTH SITE:', 110, y + 6);

  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(10);
  pdf.text(item.procedure_name, 20, y + 11);
  const toothLabel = item.tooth_number
    ? `Tooth #${item.tooth_number} (${getToothName(item.tooth_number) || 'Dental'})`
    : 'General / Non-tooth specific';
  pdf.text(toothLabel, 110, y + 11);

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(100, 116, 139);
  pdf.text('PATIENT:', 20, y + 18);
  pdf.text('EPISODE / DATE:', 110, y + 18);

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(15, 23, 42);
  pdf.text(patientName ? `${patientName} (${patientId || '—'})` : patientId || '—', 20, y + 23);
  pdf.text(
    `${episodeNumber ? `Episode #${episodeNumber} · ` : ''}${new Date().toLocaleDateString()}`,
    110,
    y + 23,
  );
  y += 32;

  // Table header
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(15, 23, 42);
  pdf.text('STAGE', 18, y);
  pdf.text('CLINICAL STAGE NAME', 34, y);
  pdf.text('DOCTOR', 105, y);
  pdf.text('STATUS', 142, y);
  pdf.text('SCHEDULE / LAB', 165, y);
  y += 3;

  pdf.setDrawColor(203, 213, 225);
  pdf.setLineWidth(0.4);
  pdf.line(16, y, 194, y);
  y += 6;

  // Table rows
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);

  stages.forEach((stg, idx) => {
    ensureSpace(14);
    const stageLabOrder = episodeLabOrders.find(
      (lo) =>
        lo.treatment_stage_id === stg.id ||
        (stg.prosthetic_lab_order_id && lo.id === stg.prosthetic_lab_order_id),
    );

    // Sequence
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(37, 99, 235);
    pdf.text(`#${stg.sequence || idx + 1}`, 18, y);

    // Stage Name & Tooth
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 23, 42);
    const nameLines = pdf.splitTextToSize(stg.stage_name, 68) as string[];
    pdf.text(nameLines, 34, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 116, 139);
    const toothInfo = `Tooth #${stg.tooth_number ?? item.tooth_number ?? '—'} · Planned: ${stg.created_at ? new Date(stg.created_at).toLocaleDateString() : '—'}`;
    pdf.text(toothInfo, 34, y + nameLines.length * 3.8);

    // Assigned Doctor
    pdf.setFontSize(8.5);
    pdf.setTextColor(51, 65, 85);
    pdf.text(stg.assigned_doctor_name || '—', 105, y);

    // Status
    pdf.setFont('helvetica', 'bold');
    if (stg.status === 'COMPLETED') pdf.setTextColor(22, 101, 52);
    else if (stg.status === 'IN_PROGRESS') pdf.setTextColor(30, 64, 175);
    else pdf.setTextColor(71, 85, 105);
    pdf.text(stg.status, 142, y);

    // Schedule & Lab
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(51, 65, 85);
    let schedLabText = '';
    if (stg.planned_date) {
      schedLabText = `Planned: ${stg.planned_date}`;
    } else if (stg.appointment_id) {
      schedLabText = `Appt: #${stg.appointment_id.slice(-6)}`;
    } else {
      schedLabText = 'Appt: None';
    }
    if (stageLabOrder) {
      schedLabText += `\nLab: ${stageLabOrder.order_number} (${stageLabOrder.status})`;
    }
    const schedLines = pdf.splitTextToSize(schedLabText, 28) as string[];
    pdf.text(schedLines, 165, y);

    const rowHeight = Math.max(12, nameLines.length * 4 + 4, schedLines.length * 3.5 + 4);
    y += rowHeight;
    pdf.setDrawColor(241, 245, 249);
    pdf.line(16, y - 2, 194, y - 2);
  });

  if (stages.length === 0) {
    ensureSpace(12);
    pdf.setTextColor(100, 116, 139);
    pdf.text('No multi-doctor clinical treatment stages assigned yet.', 18, y + 4);
    y += 10;
  }

  // Footer
  ensureSpace(20);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(148, 163, 184);
  pdf.text('HMS Hospital Management System · Dental Staging Record', 16, 290);
  pdf.text(`Generated on ${new Date().toLocaleString()}`, 194, 290, { align: 'right' });

  const toothPart = item.tooth_number ? `Tooth_${item.tooth_number}` : 'General';
  const filename = `HMS_Dental_Treatment_Stages_${toothPart}.pdf`;
  pdf.save(filename);
}

export function downloadDentalQuotationPdf(options: DentalQuotationPdfOptions): void {
  const { quotation, patientName, patientId, episodeNumber, formatCurrency = (v) => `KES ${v.toLocaleString()}` } = options;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });

  let y = 18;
  const ensureSpace = (height: number) => {
    if (y + height <= 280) return;
    pdf.addPage();
    y = 18;
  };

  // Header
  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text('HMS', 16, y);
  pdf.setFontSize(13);
  pdf.text('DENTAL TREATMENT QUOTATION', 194, y, { align: 'right' });
  y += 7;

  pdf.setDrawColor(2, 132, 199);
  pdf.setLineWidth(0.8);
  pdf.line(16, y, 194, y);
  y += 8;

  // Metadata block
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(16, y, 178, 26, 2, 2, 'F');
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(16, y, 178, 26, 2, 2, 'D');

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(100, 116, 139);
  pdf.text('QUOTATION #:', 20, y + 6);
  pdf.text('DATE / VALIDITY:', 80, y + 6);
  pdf.text('STATUS:', 145, y + 6);

  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(10);
  pdf.text(quotation.quotation_number, 20, y + 11);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(
    `Date: ${new Date(quotation.created_at).toLocaleDateString()}${quotation.valid_until ? ` · Valid: ${new Date(quotation.valid_until).toLocaleDateString()}` : ''}`,
    80,
    y + 11,
  );
  pdf.setFont('helvetica', 'bold');
  if (quotation.status === 'ACCEPTED') pdf.setTextColor(22, 101, 52);
  else if (quotation.status === 'REJECTED') pdf.setTextColor(185, 28, 28);
  else pdf.setTextColor(3, 105, 161);
  pdf.text(quotation.status, 145, y + 11);

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(100, 116, 139);
  pdf.text('DOCTOR:', 20, y + 18);
  pdf.text('PATIENT / EPISODE:', 80, y + 18);

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(15, 23, 42);
  pdf.text(quotation.doctor_name || 'Attending Dentist', 20, y + 23);
  const patientText = patientName ? `${patientName} (${patientId || '—'})` : patientId || '—';
  pdf.text(`${patientText}${episodeNumber ? ` · Episode #${episodeNumber}` : ''}`, 80, y + 23);
  y += 32;

  // Options or single plan items
  if (quotation.options && quotation.options.length > 0) {
    quotation.options.forEach((opt, optIdx) => {
      ensureSpace(24);
      const isAccepted = quotation.status === 'ACCEPTED' && quotation.selected_option_id === opt.id;
      
      pdf.setFillColor(isAccepted ? 240 : 248, isAccepted ? 253 : 250, isAccepted ? 244 : 252);
      pdf.roundedRect(16, y, 178, 8, 1.5, 1.5, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.5);
      pdf.setTextColor(isAccepted ? 22 : 15, isAccepted ? 101 : 23, isAccepted ? 52 : 42);
      pdf.text(
        `Option ${optIdx + 1}: ${opt.name}${isAccepted ? '  [ACCEPTED OPTION]' : ''}`,
        19,
        y + 5.5,
      );
      pdf.text(`Total: ${formatCurrency(opt.total)}`, 191, y + 5.5, { align: 'right' });
      y += 11;

      // Option Table Header
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(100, 116, 139);
      pdf.text('PROCEDURE', 19, y);
      pdf.text('TOOTH', 105, y);
      pdf.text('QTY', 128, y, { align: 'right' });
      pdf.text('UNIT PRICE', 158, y, { align: 'right' });
      pdf.text('LINE TOTAL', 191, y, { align: 'right' });
      y += 2.5;

      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.3);
      pdf.line(16, y, 194, y);
      y += 4.5;

      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(51, 65, 85);
      opt.items.forEach((it) => {
        ensureSpace(7);
        pdf.text(it.procedure_name, 19, y);
        pdf.text(it.tooth_number ? `Tooth #${it.tooth_number}` : '—', 105, y);
        pdf.text(String(it.quantity), 128, y, { align: 'right' });
        pdf.text(formatCurrency(it.unit_price), 158, y, { align: 'right' });
        pdf.text(formatCurrency(it.line_total), 191, y, { align: 'right' });
        y += 5;
      });

      // Option subtotal/discount/total summary
      ensureSpace(12);
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Subtotal: ${formatCurrency(opt.subtotal)}`, 130, y);
      if (opt.discount_amount > 0) {
        pdf.text(`Discount: -${formatCurrency(opt.discount_amount)}`, 160, y);
      }
      y += 7;
    });
  } else {
    // Single Plan Table Header
    pdf.setFontSize(8.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 23, 42);
    pdf.text('PROCEDURE', 19, y);
    pdf.text('TOOTH', 105, y);
    pdf.text('QTY', 128, y, { align: 'right' });
    pdf.text('UNIT PRICE', 158, y, { align: 'right' });
    pdf.text('LINE TOTAL', 191, y, { align: 'right' });
    y += 3;

    pdf.setDrawColor(203, 213, 225);
    pdf.setLineWidth(0.4);
    pdf.line(16, y, 194, y);
    y += 5.5;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(51, 65, 85);
    quotation.items.forEach((it) => {
      ensureSpace(7);
      pdf.text(it.procedure_name, 19, y);
      pdf.text(it.tooth_number ? `Tooth #${it.tooth_number}` : '—', 105, y);
      pdf.text(String(it.quantity), 128, y, { align: 'right' });
      pdf.text(formatCurrency(it.unit_price), 158, y, { align: 'right' });
      pdf.text(formatCurrency(it.line_total), 191, y, { align: 'right' });
      y += 5.5;
    });
  }

  // Grand Total Summary Box
  ensureSpace(32);
  y += 4;
  pdf.setDrawColor(226, 232, 240);
  pdf.line(110, y, 194, y);
  y += 6;

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(71, 85, 105);
  pdf.text('Subtotal:', 140, y, { align: 'right' });
  pdf.text(formatCurrency(quotation.subtotal), 191, y, { align: 'right' });
  y += 5.5;

  if (quotation.discount_amount > 0) {
    pdf.setTextColor(22, 163, 74);
    pdf.text('Discount:', 140, y, { align: 'right' });
    pdf.text(`-${formatCurrency(quotation.discount_amount)}`, 191, y, { align: 'right' });
    y += 5.5;
  }

  if (quotation.tax_amount > 0) {
    pdf.setTextColor(71, 85, 105);
    pdf.text('Tax:', 140, y, { align: 'right' });
    pdf.text(`+${formatCurrency(quotation.tax_amount)}`, 191, y, { align: 'right' });
    y += 5.5;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(2, 132, 199);
  pdf.text('Grand Total:', 140, y, { align: 'right' });
  pdf.text(formatCurrency(quotation.total), 191, y, { align: 'right' });
  y += 8;

  if (quotation.notes) {
    ensureSpace(16);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(100, 116, 139);
    pdf.text('CLINICAL NOTES / REMARKS:', 18, y);
    y += 4;
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(51, 65, 85);
    const noteLines = pdf.splitTextToSize(quotation.notes, 174) as string[];
    pdf.text(noteLines, 18, y);
    y += noteLines.length * 4;
  }

  // Footer
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(148, 163, 184);
  pdf.text('HMS Hospital Management System · Dental Treatment Quotation', 16, 290);
  pdf.text(`Generated on ${new Date().toLocaleString()}`, 194, 290, { align: 'right' });

  const filename = `HMS_Dental_Quotation_${quotation.quotation_number}.pdf`;
  pdf.save(filename);
}
