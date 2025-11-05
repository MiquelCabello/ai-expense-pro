import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Importar test de Dropbox para desarrollo
if (import.meta.env.DEV) {
  import('./test-dropbox').then(module => {
    (window as any).testDropboxUpload = module.testDropboxUpload;
    console.log('💡 Test de Dropbox disponible: ejecuta testDropboxUpload() en la consola');
  });
}

createRoot(document.getElementById("root")!).render(<App />);
