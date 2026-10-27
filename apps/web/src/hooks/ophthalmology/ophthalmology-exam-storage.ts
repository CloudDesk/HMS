export type OphthalmicExamState = {
  vaMode: 'without' | 'with';
  vaOdUnaided: string;
  vaOsUnaided: string;
  vaOdPh: string;
  vaOsPh: string;
  vaOdNearUn: string;
  vaOsNearUn: string;
  vaCorrType: string;
  vaOdCorr: string;
  vaOsCorr: string;
  vaOdNearCorr: string;
  vaOsNearCorr: string;
  vaLensWorn: string;
  vaColorVision: string;
  vaNotes: string;

  refTab: 'ar' | 'subj' | 'final';
  arOdSph: string;
  arOdCyl: string;
  arOdAxis: string;
  arOsSph: string;
  arOsCyl: string;
  arOsAxis: string;
  arPd: string;
  arNotes: string;
  subjType: 'dry' | 'wet';
  subjOdSph: string;
  subjOdCyl: string;
  subjOdAxis: string;
  subjOsSph: string;
  subjOsCyl: string;
  subjOsAxis: string;
  subjAdd: string;
  subjDuochrome: string;

  iopMethod: string;
  iopOd: string;
  iopOs: string;
  iopTime: string;
  iopNotes: string;

  slitTab: 'anterior' | 'posterior';
  slitOdLids: string;
  slitOsLids: string;
  slitOdConj: string;
  slitOsConj: string;
  slitOdCornea: string;
  slitOsCornea: string;
  slitOdAc: string;
  slitOsAc: string;
  slitOdIris: string;
  slitOsIris: string;
  slitOdLens: string;
  slitOsLens: string;
  slitAntNotes: string;
  slitOdVitreous: string;
  slitOsVitreous: string;
  slitOdOnh: string;
  slitOsOnh: string;
  slitOdMacula: string;
  slitOsMacula: string;
  slitOdVessels: string;
  slitOsVessels: string;
  slitOdPole: string;
  slitOsPole: string;
  slitPostNotes: string;

  fundusTab: 'direct' | 'indirect' | 'camera';
  fundusOdDisc: string;
  fundusOsDisc: string;
  fundusOdMacula: string;
  fundusOsMacula: string;
  fundusOdVessels: string;
  fundusOsVessels: string;
  fundusDirectNotes: string;
  fundusIndirectNotes: string;
};

export const defaultOphthalmicExamState: OphthalmicExamState = {
  vaMode: 'without',
  vaOdUnaided: '',
  vaOsUnaided: '',
  vaOdPh: '',
  vaOsPh: '',
  vaOdNearUn: '',
  vaOsNearUn: '',
  vaCorrType: 'Presenting Spectacles',
  vaOdCorr: '',
  vaOsCorr: '',
  vaOdNearCorr: '',
  vaOsNearCorr: '',
  vaLensWorn: '',
  vaColorVision: '',
  vaNotes: '',

  refTab: 'ar',
  arOdSph: '',
  arOdCyl: '',
  arOdAxis: '',
  arOsSph: '',
  arOsCyl: '',
  arOsAxis: '',
  arPd: '',
  arNotes: '',
  subjType: 'dry',
  subjOdSph: '',
  subjOdCyl: '',
  subjOdAxis: '',
  subjOsSph: '',
  subjOsCyl: '',
  subjOsAxis: '',
  subjAdd: '',
  subjDuochrome: '',

  iopMethod: 'Applanation Tonometry (Goldmann GAT)',
  iopOd: '',
  iopOs: '',
  iopTime: '',
  iopNotes: '',

  slitTab: 'anterior',
  slitOdLids: '',
  slitOsLids: '',
  slitOdConj: '',
  slitOsConj: '',
  slitOdCornea: '',
  slitOsCornea: '',
  slitOdAc: '',
  slitOsAc: '',
  slitOdIris: '',
  slitOsIris: '',
  slitOdLens: '',
  slitOsLens: '',
  slitAntNotes: '',
  slitOdVitreous: '',
  slitOsVitreous: '',
  slitOdOnh: '',
  slitOsOnh: '',
  slitOdMacula: '',
  slitOsMacula: '',
  slitOdVessels: '',
  slitOsVessels: '',
  slitOdPole: '',
  slitOsPole: '',
  slitPostNotes: '',

  fundusTab: 'direct',
  fundusOdDisc: '',
  fundusOsDisc: '',
  fundusOdMacula: '',
  fundusOsMacula: '',
  fundusOdVessels: '',
  fundusOsVessels: '',
  fundusDirectNotes: '',
  fundusIndirectNotes: '',
};

const EXAM_DATA_MARKER_START = '<!-- OPHTHALMIC_EXAM_JSON:';
const EXAM_DATA_MARKER_END = ' -->';

export function serializeOphthalmicExam(state: OphthalmicExamState): string {
  const jsonStr = JSON.stringify(state);
  const narrative: string[] = ['--- OPHTHALMOLOGY PRELIMINARY EXAMINATION FINDINGS ---'];

  if (state.vaOdUnaided || state.vaOsUnaided || state.vaOdCorr || state.vaOsCorr) {
    narrative.push(`Visual Acuity: OD Unaided=${state.vaOdUnaided || 'N/A'}, Corr=${state.vaOdCorr || 'N/A'}; OS Unaided=${state.vaOsUnaided || 'N/A'}, Corr=${state.vaOsCorr || 'N/A'}`);
  }
  if (state.iopOd || state.iopOs) {
    narrative.push(`IOP (${state.iopMethod}): OD=${state.iopOd || '-'} mmHg, OS=${state.iopOs || '-'} mmHg`);
  }
  if (state.subjOdSph || state.subjOsSph) {
    narrative.push(`Subjective Refraction: OD ${state.subjOdSph || '0.00'}/${state.subjOdCyl || '0.00'}x${state.subjOdAxis || '0'}, OS ${state.subjOsSph || '0.00'}/${state.subjOsCyl || '0.00'}x${state.subjOsAxis || '0'} (Add: ${state.subjAdd || 'None'})`);
  }
  if (state.slitAntNotes || state.slitOdCornea || state.slitOsCornea) {
    narrative.push(`Slit Lamp: Cornea OD=${state.slitOdCornea || 'Normal'}, OS=${state.slitOsCornea || 'Normal'}. ${state.slitAntNotes || ''}`.trim());
  }
  if (state.fundusDirectNotes || state.fundusOdDisc || state.fundusOsDisc) {
    narrative.push(`Fundus: Disc OD=${state.fundusOdDisc || 'Normal'}, OS=${state.fundusOsDisc || 'Normal'}. ${state.fundusDirectNotes || ''}`.trim());
  }

  return `${EXAM_DATA_MARKER_START}${jsonStr}${EXAM_DATA_MARKER_END}\n\n${narrative.join('\n')}`;
}

export function parseOphthalmicExam(raw: string | null | undefined): Partial<OphthalmicExamState> | null {
  if (!raw || typeof raw !== 'string') return null;
  const startIndex = raw.indexOf(EXAM_DATA_MARKER_START);
  if (startIndex === -1) return null;
  const jsonStart = startIndex + EXAM_DATA_MARKER_START.length;
  const endIndex = raw.indexOf(EXAM_DATA_MARKER_END, jsonStart);
  if (endIndex === -1) return null;

  try {
    const jsonStr = raw.substring(jsonStart, endIndex);
    const parsed = JSON.parse(jsonStr);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as Partial<OphthalmicExamState>;
    }
  } catch {
    // Malformed JSON fallback
    return null;
  }
  return null;
}
