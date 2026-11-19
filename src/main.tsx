import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ensureDefaultAccount } from './utils/authHandlers';

// 앱 시작 시 시연용 기본 계정(jeonju / 1234)을 localStorage 에 시드한다
void ensureDefaultAccount();

createRoot(document.getElementById('root')!).render(<App />);
