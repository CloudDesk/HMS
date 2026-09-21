import { DepartmentRepository } from '../departments/department.repository.js';
import { isDentalClinicalContext } from './opd-dental-examination.service.js';
import type { OpdVisit } from './opd-visit.types.js';

export async function areVitalsOptional(visit: OpdVisit): Promise<boolean> {
  if (isDentalClinicalContext(visit.doctor_specialization)) return true;
  const department = await new DepartmentRepository().getById(visit.department_id);
  return isDentalClinicalContext(visit.doctor_specialization, department);
}
