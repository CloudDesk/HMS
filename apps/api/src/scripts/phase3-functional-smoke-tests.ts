interface LoginResponse {
  data: {
    user: {
      id: string;
      username: string;
      roles: Array<{ code: string; name: string }>;
    };
    tokens: {
      accessToken: string;
      tokenType: string;
      expiresIn: number;
    };
  };
}

interface TestResult {
  module: string;
  endpoint: string;
  status: number;
  recordsRetrieved: number;
  sampleIdentifier?: string;
  verdict: 'PASSED' | 'FAILED';
  note?: string;
}

const API_BASE = 'http://127.0.0.1:4000/api';

async function login(identifier: string, plainPassword: string): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password: plainPassword }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Login failed for ${identifier} (${res.status}): ${body}`);
  }
  const json: LoginResponse = await res.json();
  return json.data.tokens.accessToken;
}

async function testEndpoint(
  module: string,
  path: string,
  token: string,
  dataExtractor?: (data: any) => { count: number; sample?: string }
): Promise<TestResult> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    return {
      module,
      endpoint: path,
      status: res.status,
      recordsRetrieved: 0,
      verdict: 'FAILED',
      note: `HTTP error ${res.status}: ${res.statusText}`,
    };
  }

  const json = await res.json();
  const payload = json.data ?? json;

  let count = 0;
  let sample: string | undefined;

  if (dataExtractor) {
    const extracted = dataExtractor(payload);
    count = extracted.count;
    sample = extracted.sample;
  } else if (Array.isArray(payload)) {
    count = payload.length;
    sample = payload[0] ? (payload[0].id || payload[0]._id || payload[0].code || payload[0].name) : undefined;
  } else if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.data)) {
      count = payload.data.length;
      sample = payload.data[0] ? (payload.data[0].id || payload.data[0]._id || payload.data[0].name || payload.data[0].patient_number) : undefined;
    } else if (Array.isArray(payload.items)) {
      count = payload.items.length;
      sample = payload.items[0] ? (payload.items[0].id || payload.items[0]._id || payload.items[0].code) : undefined;
    } else {
      count = Object.keys(payload).length;
      sample = 'Record object retrieved';
    }
  }

  return {
    module,
    endpoint: path,
    status: res.status,
    recordsRetrieved: count,
    sampleIdentifier: sample,
    verdict: 'PASSED',
  };
}

async function main() {
  console.log('===============================================================');
  console.log('PHASE 3: FUNCTIONAL READ-ONLY SMOKE TESTS ON RESTORED DATABASE');
  console.log('===============================================================\n');

  // 1. Authenticate Admin
  console.log('1. Authenticating as Administrator (admin)...');
  const adminToken = await login('admin', 'Admin123!');
  console.log('   Admin login: SUCCESSFUL');

  // 2. Authenticate Clinician (Dr. Aravind)
  console.log('2. Authenticating as Attending Ophthalmologist (aravind)...');
  const doctorToken = await login('aravind', 'Aravind123!');
  console.log('   Doctor login: SUCCESSFUL\n');

  const results: TestResult[] = [];

  // Module 1: Patient Directory
  results.push(
    await testEndpoint('Patient Directory', '/patients', adminToken, (d) => {
      const items = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
      return {
        count: items.length,
        sample: items[0] ? `${items[0].patient_number || items[0].id}: ${items[0].first_name} ${items[0].last_name}` : undefined,
      };
    })
  );

  // Module 2: Appointment Listing
  results.push(
    await testEndpoint('Appointments', '/appointments', adminToken, (d) => {
      const items = Array.isArray(d?.data) ? d.data : Array.isArray(d?.appointments) ? d.appointments : Array.isArray(d) ? d : [];
      return {
        count: items.length,
        sample: items[0] ? `Appt ${items[0].appointmentNumber || items[0].id} (${items[0].status})` : undefined,
      };
    })
  );

  // Module 3: OPD Visits
  let firstVisitId = '';
  results.push(
    await testEndpoint('OPD Visits', '/opd/visits', doctorToken, (d) => {
      const items = Array.isArray(d?.visits) ? d.visits : Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
      if (items[0]) firstVisitId = items[0].id || items[0]._id;
      return {
        count: items.length,
        sample: items[0] ? `Visit ${items[0].visitNumber || items[0].id}` : undefined,
      };
    })
  );

  // Module 4: OPD Consultation (scoped to active visit)
  if (firstVisitId) {
    results.push(
      await testEndpoint('OPD Consultation', `/opd/visits/${firstVisitId}/consultation`, doctorToken, (d) => {
        return {
          count: d ? 1 : 0,
          sample: d ? `Visit ${firstVisitId} consultation record loaded` : undefined,
        };
      })
    );
  }

  // Module 5: Ophthalmology Configurations (scoped to Main Branch MB01)
  results.push(
    await testEndpoint('Ophthalmology Configs', '/ophthalmology/configurations?branch_id=6a7c495d94e1a711fb3d7b23', doctorToken, (d) => {
      const items = Array.isArray(d?.data) ? d.data : Array.isArray(d?.configurations) ? d.configurations : Array.isArray(d) ? d : [];
      return {
        count: items.length,
        sample: items[0] ? `${items[0].name} (${items[0].type || items[0].code || 'Config'})` : undefined,
      };
    })
  );

  // Module 6: Ophthalmology Workflow Profiles (scoped to Main Branch MB01)
  results.push(
    await testEndpoint('Ophthalmology Profiles', '/ophthalmology/workflow-profiles?branch_id=6a7c495d94e1a711fb3d7b23', doctorToken, (d) => {
      const items = Array.isArray(d?.data) ? d.data : Array.isArray(d?.profiles) ? d.profiles : Array.isArray(d) ? d : [];
      return {
        count: items.length,
        sample: items[0] ? `${items[0].name} (${items[0].code})` : undefined,
      };
    })
  );

  // Module 7: Clinical & Lab Services
  results.push(
    await testEndpoint('Clinical & Lab Services', '/services', adminToken, (d) => {
      const items = Array.isArray(d?.services) ? d.services : Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
      return {
        count: items.length,
        sample: items[0] ? `${items[0].name} (${items[0].code})` : undefined,
      };
    })
  );

  // Module 8: Pharmacy Medicines
  results.push(
    await testEndpoint('Pharmacy Medicines', '/medicines', adminToken, (d) => {
      const items = Array.isArray(d?.medicines) ? d.medicines : Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
      return {
        count: items.length,
        sample: items[0] ? `${items[0].name} (${items[0].code || 'MED'})` : undefined,
      };
    })
  );

  // Module 9: Billing Invoices
  results.push(
    await testEndpoint('Billing Invoices', '/billing/invoices', adminToken, (d) => {
      const items = Array.isArray(d?.invoices) ? d.invoices : Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
      return {
        count: items.length,
        sample: items[0] ? `Invoice ${items[0].invoiceNumber || items[0].id} (Total: ${items[0].totalAmount || items[0].total})` : undefined,
      };
    })
  );

  // Module 10: Administration Dashboard Snapshot
  results.push(
    await testEndpoint('Admin Dashboard', '/administration/dashboard', adminToken, (d) => {
      return {
        count: d ? Object.keys(d).length : 0,
        sample: d ? `Snapshot generated at ${d.generatedAt || 'present'}` : undefined,
      };
    })
  );

  console.log('--- FUNCTIONAL SMOKE TEST RESULTS ---');
  console.table(
    results.map((r) => ({
      Module: r.module,
      Endpoint: r.endpoint,
      Status: r.status,
      Records: r.recordsRetrieved,
      Sample: r.sampleIdentifier ?? 'None',
      Verdict: r.verdict,
    }))
  );

  const allPassed = results.every((r) => r.verdict === 'PASSED');
  if (!allPassed) {
    throw new Error('One or more functional smoke tests failed!');
  }

  console.log('\nAll functional smoke tests PASSED on live restored Atlas Free Tier database.');
}

main().catch((err) => {
  console.error('\nSmoke tests failed:', err.message);
  process.exitCode = 1;
});
