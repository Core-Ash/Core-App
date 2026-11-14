import { BrowserRouter } from "react-router";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { AppRoutes } from "./router";
import { AppDataProvider } from "./AppDataProvider";

export function App() {
  return (
    <AuthProvider>
      <AppDataProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AppDataProvider>
    </AuthProvider>
  );
}
