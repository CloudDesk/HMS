import { pharmacyDispensingApi, type SaveDispensingPayload } from '../api/pharmacy-dispensing';

export const pharmacyDispensingService = {
  list: pharmacyDispensingApi.list,
  get: pharmacyDispensingApi.get,
  save: (id: string, payload: SaveDispensingPayload) => pharmacyDispensingApi.save(id, payload),
  confirm: pharmacyDispensingApi.confirm,
  cancel: pharmacyDispensingApi.cancel,
  reverse: pharmacyDispensingApi.reverse,
};
