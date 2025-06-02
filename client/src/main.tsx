import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Load and apply favicon on app initialization
async function loadFavicon() {
  try {
    const response = await fetch('/api/app-settings/favicon');
    if (response.ok) {
      const faviconSetting = await response.json();
      if (faviconSetting?.value) {
        // Remove existing favicon links
        const existingFavicons = document.querySelectorAll('link[rel*="icon"]');
        existingFavicons.forEach(link => link.remove());

        // Add new favicon
        const link = document.createElement('link');
        link.type = 'image/x-icon';
        link.rel = 'shortcut icon';
        link.href = faviconSetting.value;
        document.getElementsByTagName('head')[0].appendChild(link);
      }
    }
  } catch (error) {
    console.log('No custom favicon configured');
  }
}

// Load favicon when app starts
loadFavicon();

createRoot(document.getElementById("root")!).render(<App />);
