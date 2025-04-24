import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css';
import 'leaflet/dist/leaflet.css';
import App from './App.jsx'
import './i18n'; // Initialize i18next

createRoot(document.getElementById('root')).render(
  // <StrictMode>
    /* <Suspense fallback="Loading..."> */
      <App />
    /* </Suspense> */
  // </StrictMode>,
)
