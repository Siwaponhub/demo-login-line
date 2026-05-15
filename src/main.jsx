import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./AuthContext";
import { ThemeProvider } from "./ThemeContext";
import { ImageViewerProvider } from "./ImageViewerContext";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "./index.css";
import "./App.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  // <React.StrictMode>
  <BrowserRouter>
    <AuthProvider>
      <ThemeProvider>
        <ImageViewerProvider>
          <App />
        </ImageViewerProvider>
      </ThemeProvider>
    </AuthProvider>
  </BrowserRouter>
  // </React.StrictMode>
);
