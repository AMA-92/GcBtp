import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import SharedReport from "@/pages/SharedReport";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import AuthGate from "./components/AuthGate";
import { ThemeProvider } from "./contexts/ThemeContext";
import AndroidHome from "./pages/AndroidHome";

function Router() {
  return (
    <Switch>
      <Route path="/partage/:token" component={SharedReport} />
      <Route path="/">
        <AuthGate>
          <AndroidHome />
        </AuthGate>
      </Route>
      <Route path="/404" component={NotFound} />
      <Route>
        <AuthGate>
          <NotFound />
        </AuthGate>
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
