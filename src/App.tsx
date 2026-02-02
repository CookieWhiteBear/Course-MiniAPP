import { BrowserRouter } from "react-router-dom"
import { AppRoutes } from "@/components/layout/AppRoutes"
import { LanguageProvider } from "@/lib/i18n"

function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </LanguageProvider>
  )
}


export default App
