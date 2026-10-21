import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import SharedDashboard from './SharedDashboard.jsx';
import InviteSignup from './InviteSignup.jsx';
import './styles.css';
import './readability.css';
import './responsive.css';

const sharedToken = new URLSearchParams(window.location.search).get('painel');
const inviteToken = new URLSearchParams(window.location.search).get('convite');

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {sharedToken ? <SharedDashboard token={sharedToken} /> : inviteToken ? <InviteSignup token={inviteToken} /> : <App />}
  </React.StrictMode>,
);

