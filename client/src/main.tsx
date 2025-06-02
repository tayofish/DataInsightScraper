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

// Load and apply app name to document title
async function loadAppName() {
  try {
    const response = await fetch('/api/app-settings/app-name');
    if (response.ok) {
      const appNameSetting = await response.json();
      if (appNameSetting?.value) {
        document.title = appNameSetting.value;
      }
    } else {
      // Default title if no custom name is set
      document.title = 'Task Management System';
    }
  } catch (error) {
    // Default title if there's an error
    document.title = 'Task Management System';
    console.log('Using default app name');
  }
}

// Load favicon and app name when app starts
loadFavicon();
loadAppName();

createRoot(document.getElementById("root")!).render(<App />);
