import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router'
import { ClerkProvider } from '@clerk/clerk-react'
import {Provider} from "react-redux"
import { store } from './app/store.js'
import { RealtimeProvider } from './realtime/RealtimeProvider.jsx'

// Import your Publishable Key
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error('Add your Clerk Publishable Key to the .env file')
}


createRoot(document.getElementById('root')).render(
  
  <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
     <BrowserRouter>
     <Provider store={store}>
      <RealtimeProvider>
       <App />
      </RealtimeProvider>
     </Provider>
  </BrowserRouter>
    </ClerkProvider>
  
)
