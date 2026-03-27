import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initGTM } from "./lib/gtm";

initGTM();

createRoot(document.getElementById("root")!).render(<App />);
