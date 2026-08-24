import { admissionsConfigurationApi } from '../api/admissions-configuration';

export const admissionsConfigurationService = {
  ...admissionsConfigurationApi,
  async requestAndCompleteTransfer(
    admissionId: string,
    body: Parameters<typeof admissionsConfigurationApi.createTransfer>[1],
    crossBranch: boolean,
  ) {
    const transfer = await admissionsConfigurationApi.createTransfer(admissionId, body, crossBranch);
    return admissionsConfigurationApi.completeTransfer(transfer.id, { branch_id: body.branch_id }, crossBranch);
  },
};
