import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AdminApp from './admin/AdminApp.tsx';
import './styles.css';
import './admin/admin.css';
import './site/marque.css';

createRoot(document.getElementById('root')!).render(<StrictMode><AdminApp/></StrictMode>);
