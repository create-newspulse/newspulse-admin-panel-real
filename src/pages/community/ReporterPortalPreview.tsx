import React from "react";
import { Link } from "react-router-dom";

const reporterPortalUrl =
  import.meta.env.VITE_PUBLIC_REPORTER_PORTAL_URL ??
  "https://newspulse.co.in/community-reporter";

const ReporterPortalPreview: React.FC = () => {
  const handleOpenPortal = () => {
    if (!reporterPortalUrl) {
      alert("Reporter Portal URL is not configured yet.");
      return;
    }

    window.open(reporterPortalUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Reporter Portal – Founder Preview
        </h1>
        <p className="text-sm text-muted-foreground">
          This page is only for you (Founder/Admin). Use it to quickly open the
          public Community Reporter Portal in a new tab while keeping your admin
          session active here.
        </p>
      </header>

      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
        <div className="text-sm">
          <div className="font-medium mb-1">Public Reporter Portal URL</div>
          <code className="text-xs break-all">
            {reporterPortalUrl}
          </code>
        </div>

        <div className="mt-2 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleOpenPortal}
            className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            Open Reporter Portal in new tab
          </button>

          <Link
            to="/community/my-stories"
            className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            Open My Community Stories (admin)
          </Link>
        </div>

        <p className="text-xs text-muted-foreground">
          Tip: Keep this admin tab open for Founder control, and use the new tab
          as if you are a public community reporter.
        </p>
      </div>
    </div>
  );
};

export default ReporterPortalPreview;
