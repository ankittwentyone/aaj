import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { qc } from "./api/client.js";
import { InstrumentProvider } from "./context/InstrumentContext.tsx";
import "./index.css";
import "maplibre-gl/dist/maplibre-gl.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <InstrumentProvider>
          <App />
        </InstrumentProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
