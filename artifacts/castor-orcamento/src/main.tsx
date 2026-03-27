import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initGTM, initGA4 } from "./lib/gtm";

initGTM();
initGA4();

createRoot(document.getElementById("root")!).render(<App />);
