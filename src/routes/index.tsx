import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/lib/theme";
import { AuthProvider } from "@/lib/auth";
import { FraudApp } from "@/components/FraudApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AppsFlyer PAF Fraud Analysis" },
      { name: "description", content: "Scalable AppsFlyer protect-against-fraud analysis console with click-fraud, bot, and event-integrity detection." },
      { property: "og:title", content: "AppsFlyer PAF Fraud Analysis" },
      { property: "og:description", content: "Detect click injection, install hijacking, bot farms, and event fraud from AppsFlyer raw exports." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <FraudApp />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </ThemeProvider>
  );
}
