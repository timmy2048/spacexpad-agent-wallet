import '../buffer-polyfill.ts';
import '../fonts.ts';
import { createRoot } from 'react-dom/client';
import { App } from '../popup/App.tsx';
import '../popup/styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(<App surface="auth" />);
