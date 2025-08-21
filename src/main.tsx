import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "@/App";
import { Providers } from "@/providers";
import "@/index.css";

const root = document.getElementById("root");

ReactDOM.createRoot(root!).render(
  <BrowserRouter>
    <Providers>
      <App />
    </Providers>
  </BrowserRouter>
);
