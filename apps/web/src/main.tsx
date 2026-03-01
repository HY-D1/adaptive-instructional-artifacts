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
  createRoot(rootElement).render(<App />);
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