import './beta/runtime.ts';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './styles.css';
import './site/nav.css';
import './site/nav.ts';
import './site/marque.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
