import { createFileRoute } from "@tanstack/react-router";
import { FraudApp } from "@/components/FraudApp";

export const Route = createFileRoute("/")({
  head: () => {
    const isStaging = import.meta.env.VITE_APP_ENV === "staging";
    const title = isStaging ? "[STAGING] Opscore Argus" : "Opscore Argus — Fraud Analyzer";
    return {
      meta: [
        { title },
        {
          name: "description",
          content:
            "Scalable mobile ad fraud analysis console with click-fraud, bot, and event-integrity detection.",
        },
        { property: "og:title", content: title },
        {
          property: "og:description",
          content:
            "Detect click injection, install hijacking, bot farms, and event fraud from AppsFlyer raw exports.",
        },
      ],
    };
  },
  component: Index,
});

function Index() {
  return <FraudApp />;
}
