import React, { useState } from 'react';
import type {
  DentalTreatmentStageResponse,
} from '../../../api/opd';
import { useEpisodeDentalLabOrders } from '../../../hooks/opd/useOpd';
import { DentalProstheticLabModal } from './DentalProstheticLabModal';
import styles from './DentalProstheticLab.module.css';

interface DentalProstheticLabSectionProps {
  episodeId?: string | null;
  patientId?: string | null;
  stages?: DentalTreatmentStageResponse[];
  disabled?: boolean;
}

export const DentalProstheticLabSection: React.FC<DentalProstheticLabSectionProps> = ({
  episodeId,
  patientId,
  stages = [],
  disabled = false,
}) => {
  const { data: labOrders = [], isLoading } = useEpisodeDentalLabOrders(episodeId);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [createForStage, setCreateForStage] = useState<DentalTreatmentStageResponse | null>(null);

  const getStatusBadgeClass = (s: string) => {
    switch (s) {
      case 'ORDERED':
        return styles.badgeOrdered;
      case 'RECEIVED':
        return styles.badgeReceived;
      case 'IN_PROGRESS':
        return styles.badgeInProgress;
      case 'QUALITY_CHECK':
        return styles.badgeQualityCheck;
      case 'READY':
        return styles.badgeReady;
      case 'CANCELLED':
        return styles.badgeCancelled;
      case 'DRAFT':
      default:
        return styles.badgeDraft;
    }
  };

  return (
    <div className={styles.detailsCard} style={{ marginTop: '16px' }} data-testid="dental-prosthetic-lab-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.9rem', color: '#1e3a8a' }}>
          <i className="ph ph-wrench" style={{ color: '#2563eb' }} />
          <span>Dental Prosthetic Lab Orders</span>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
            ({labOrders.length})
          </span>
        </div>
      </div>

      {isLoading ? (
        <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
          Loading lab orders…
        </div>
      ) : labOrders.length === 0 ? (
        <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
          No prosthetic lab orders created for this episode yet. Create lab orders from individual treatment stages below.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {labOrders.map((order) => {
            const matchedStage = stages.find((s) => s.id === order.treatment_stage_id);
            return (
              <div
                key={order.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#ffffff',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className={styles.stageLabNumber}>{order.order_number}</span>
                  <span
                    className={`${styles.badge} ${
                      order.prosthetic_type === 'CROWN'
                        ? styles.badgeCrown
                        : order.prosthetic_type === 'BRIDGE'
                        ? styles.badgeBridge
                        : styles.badgeOther
                    }`}
                  >
                    {order.prosthetic_type}
                  </span>
                  {order.tooth_number && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                      Tooth #{order.tooth_number}
                    </span>
                  )}
                  {matchedStage && (
                    <span style={{ fontSize: '0.725rem', color: '#64748b' }}>
                      (Stage {matchedStage.sequence}: {matchedStage.stage_name})
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`${styles.badge} ${getStatusBadgeClass(order.status)}`}>
                    {order.status}
                  </span>
                  <button
                    type="button"
                    className={styles.btnViewLabOrder}
                    onClick={() => setSelectedOrderId(order.id)}
                    title="View lab order details"
                  >
                    <i className="ph ph-eye" /> View
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View Modal */}
      {selectedOrderId && (
        <DentalProstheticLabModal
          isOpen={Boolean(selectedOrderId)}
          onClose={() => setSelectedOrderId(null)}
          existingOrderId={selectedOrderId}
          readOnly={disabled}
        />
      )}

      {/* Create Modal */}
      {createForStage && (
        <DentalProstheticLabModal
          isOpen={Boolean(createForStage)}
          onClose={() => setCreateForStage(null)}
          stage={createForStage}
          patientId={patientId}
          readOnly={disabled}
        />
      )}
    </div>
  );
};
