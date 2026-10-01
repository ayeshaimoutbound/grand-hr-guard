import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installErrorExplanations } from "@/lib/errorExplain";

installErrorExplanations();

createRoot(document.getElementById("root")!).render(<App />);
