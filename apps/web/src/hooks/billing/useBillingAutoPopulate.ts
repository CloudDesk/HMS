import { useEffect } from 'react';
import { type SaveBillingInvoiceItem } from '../../api/billing';
import { useOpdConsultation, useOpdClinicalOrder, useOpdPrescription } from '../opd/useOpd';
import { useServicesList } from '../services/useServices';
import { usePharmacyBatches } from '../pharmacy/usePharmacy';

export type DraftItem = SaveBillingInvoiceItem & {
  service_name: string;
  unit_price: number;
  line_total: number;
};

export function useBillingAutoPopulate({
  visitId,
  branchId,
  createMode,
  onPopulate,
}: {
  visitId: string;
  branchId: string;
  createMode: boolean;
  onPopulate: (items: DraftItem[]) => void;
}) {
  const enabled = createMode && Boolean(visitId);

  const { data: consultation } = useOpdConsultation(visitId, enabled);
  const { data: labOrder } = useOpdClinicalOrder(visitId, 'LABORATORY', enabled);
  const { data: imagingOrder } = useOpdClinicalOrder(visitId, 'IMAGING', enabled);
  const { data: prescription } = useOpdPrescription(visitId, enabled);
  
  const { data: servicesResponse } = useServicesList({ status: 'ACTIVE', limit: 100 }, enabled);
  const { data: batchesResponse } = usePharmacyBatches(
    { branch_id: branchId, status: 'ACTIVE', limit: 100 },
    enabled && Boolean(branchId)
  );

  useEffect(() => {
    if (!enabled) return;
    if (!servicesResponse || !batchesResponse) return; // Wait for base data to resolve

    try {
      const services = servicesResponse.data;
      const batches = batchesResponse.data;
      const newDraftItems: DraftItem[] = [];

      // Auto-add Consultation if completed
      if (consultation && consultation.status === 'COMPLETED') {
        const consultService = services.find(
          (s) => s.service_type === 'GENERAL' && s.name.toLowerCase().includes('consultation')
        );
        if (consultService) {
          newDraftItems.push({
            service_id: consultService.id,
            service_type: 'CONSULTATION',
            quantity: 1,
            service_name: consultService.name,
            unit_price: consultService.standard_price,
            line_total: consultService.standard_price,
          });
        }
      }

      // Auto-add Lab Tests
      if (labOrder && labOrder.status !== 'DRAFT') {
        for (const item of labOrder.items) {
          const service = services.find((s) => s.id === item.service_id);
          if (service) {
            newDraftItems.push({
              service_id: service.id,
              service_type: 'LAB_TEST',
              quantity: 1,
              service_name: service.name,
              unit_price: service.standard_price,
              line_total: service.standard_price,
            });
          }
        }
      }

      // Auto-add Imaging
      if (imagingOrder && imagingOrder.status !== 'DRAFT') {
        for (const item of imagingOrder.items) {
          const service = services.find((s) => s.id === item.service_id);
          if (service) {
            newDraftItems.push({
              service_id: service.id,
              service_type: 'IMAGING_SERVICE',
              quantity: 1,
              service_name: service.name,
              unit_price: service.standard_price,
              line_total: service.standard_price,
            });
          }
        }
      }

      // Auto-add Pharmacy
      if (prescription && prescription.status !== 'DRAFT') {
        for (const item of prescription.items) {
          const batch = batches.find((b) => b.medicine?.name === item.medicine_name);
          if (batch) {
            newDraftItems.push({
              service_id: batch.id,
              service_type: 'PHARMACY',
              quantity: item.quantity || 1,
              service_name: `${batch.medicine?.name} (Batch: ${batch.batch_number})`,
              unit_price: batch.unit_price,
              line_total: batch.unit_price * (item.quantity || 1),
            });
          }
        }
      }

      onPopulate(newDraftItems);
    } catch (error) {
      console.error('Failed to auto-populate services', error);
    }
  }, [consultation, labOrder, imagingOrder, prescription, servicesResponse, batchesResponse, enabled, onPopulate]);
}
