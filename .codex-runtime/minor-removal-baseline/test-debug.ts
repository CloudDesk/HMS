import { mock } from 'node:test';
import { AppError } from './apps/api/src/shared/errors/app-error.js';
import { EmergencyService } from './apps/api/src/modules/emergency/emergency.service.js';

async function run() {
    const mockRepo = {
        session: async () => ({
            withTransaction: async (cb) => cb()
        }),
        hasBranchAccess: async () => true,
        getRecord: async () => ({
            _id: '123',
            status: 'READY_FOR_DISPOSITION',
            consultation: {},
            assignedDoctorId: '123',
            orders: [],
            patientId: '123'
        }),
        transition: async () => true
    };
    const mockBilling = {
        isEncounterFinanciallyClosed: async () => false
    };
    const service = new EmergencyService(mockRepo, {}, {}, {}, {}, mockBilling);
    try {
        await service.disposition('1', '2', {decision: 'DISCHARGE'}, '3', {});
    } catch(e) {
        console.error("CAUGHT:", e);
    }
}
run();
