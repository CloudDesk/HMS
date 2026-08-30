import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './tokens.css';
import './reset.css';
import './components.css';
import './domains/opd.css';
import './domains/emergency.css';
import './domains/surgery.css';
import './domains/inpatient.css';
import './domains/admin.css';
import './features/patient.css';
import './features/appointments.css';
import './features/clinical.css';
import './features/doctor-directory.css';
import './features/pharmacy.css';
import './features/billing.css';
import './styles.css';
import './diagnostics.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
