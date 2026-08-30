import React from 'react';
import ReactDOM from 'react-dom/client';
import '@web/tokens.css';
import '@web/reset.css';
import '@web/components.css';
import './styles.css';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
