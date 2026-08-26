const fs = require('fs');

const log = fs.readFileSync('C:/Users/lenovo/.gemini/antigravity/brain/f2a36133-3b42-4ad4-9c04-a40396696e70/.system_generated/logs/transcript.jsonl', 'utf8');

const excluded = [
  'apps/web/src/components/settings/SettingsForms.tsx',
  'apps/web/src/components/print/PrintBillingModal.tsx',
  'apps/web/src/pages/PatientProfilePage.tsx',
  'apps/web/src/pages/PatientConsentPage.tsx',
  'apps/web/src/hooks/patients/usePatientProfileFeature.ts',
  'apps/web/src/pages/AppointmentBookingPage.tsx',
  'apps/web/src/pages/DoctorAvailabilityPage.tsx',
  'apps/web/src/pages/PatientEmrTimelinePage.tsx',
  'apps/web/src/pages/DashboardShell.tsx',
  'apps/web/src/pages/PrescriptionQueuePage.tsx',
  'apps/web/src/pages/DoctorSchedulePage.tsx',
  'apps/api/src/modules/settings/settings.schemas.ts',
  'apps/web/src/api/settings.ts',
  'apps/web/src/pages/AppointmentDashboardPage.tsx',
  'apps/api/src/shared/services/service-registry.ts',
  'apps/api/src/modules/patients/patient.repository.ts',
  'apps/api/src/modules/patients/patient.types.ts',
  'apps/api/src/modules/patients/patient.model.ts',
  'HMS_SCOPE2_PHASE3_PHASE_WISE_EXECUTION_PLAN.md'
];

let toolCalls = [];

for (const line of log.split('\n')) {
  if (line.includes('replace_file_content') || line.includes('multi_replace_file_content')) {
    try {
      const obj = JSON.parse(line);
      if (obj.tool_calls) {
        for (const tc of obj.tool_calls) {
          if (tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content') {
            toolCalls.push(tc);
          }
        }
      }
    } catch (e) {}
  }
}

// Reverse the array to undo from latest to earliest
toolCalls.reverse();

for (const tc of toolCalls) {
  let targetFile = tc.args.TargetFile;
  if (!targetFile) continue;
  // unquote if quoted
  if (targetFile.startsWith('"')) targetFile = JSON.parse(targetFile);
  
  targetFile = targetFile.replace(/\\\\/g, '/');
  
  if (!excluded.some(ex => targetFile.includes(ex))) {
    continue;
  }
  
  console.log('Reversing in ' + targetFile);
  
  let content = fs.readFileSync(targetFile, 'utf8');
  
  if (tc.name === 'replace_file_content') {
    let rep = tc.args.ReplacementContent;
    let tar = tc.args.TargetContent;
    if (rep && tar) {
        if (typeof rep === 'string' && rep.startsWith('"')) rep = JSON.parse(rep);
        if (typeof tar === 'string' && tar.startsWith('"')) tar = JSON.parse(tar);
        content = content.replace(rep, tar);
    }
  } else if (tc.name === 'multi_replace_file_content') {
    let chunksStr = tc.args.ReplacementChunks;
    if (typeof chunksStr === 'string' && chunksStr.startsWith('[')) {
       let chunks = JSON.parse(chunksStr);
       for (const chunk of chunks) {
         let rep = chunk.ReplacementContent;
         let tar = chunk.TargetContent;
         content = content.replace(rep, tar);
       }
    }
  }
  
  fs.writeFileSync(targetFile, content, 'utf8');
}
console.log('Done reverting excluded files.');
