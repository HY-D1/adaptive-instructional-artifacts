// Add diagnostic logging for production debugging
if (typeof window !== 'undefined') {
  console.log('[App] Starting up...', {
    env: import.meta.env.MODE,
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '(not set)',
    userAgent: navigator.userAgent.slice(0, 50) + '...'
  });
}

import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles/index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  console.error("[Main] Fatal: Root element #root not found in DOM");
  document.body.innerHTML = `
    <div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;">
      <div style="text-align:center;">
        <h1 style="color:#dc2626;">Application Error</h1>
        <p>Could not initialize application. Please refresh the page.</p>
      </div>
    </div>
  `;
  throw new Error("Root element #root not found");
}

try {
  console.log('[App] Mounting React application...');
  createRoot(rootElement).render(<App />);
  console.log('[App] React application mounted successfully');
} catch (error) {
  console.error("[Main] Fatal error rendering application:", error);
  rootElement.innerHTML = `
    <div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;">
      <div style="text-align:center;">
        <h1 style="color:#dc2626;">Application Error</h1>
        <p>The application failed to start. Please refresh the page.</p>
        <pre style="background:#f3f4f6;padding:1rem;margin-top:1rem;text-align:left;max-width:500px;">${String(error)}</pre>
      </div>
    </div>
  `;
}