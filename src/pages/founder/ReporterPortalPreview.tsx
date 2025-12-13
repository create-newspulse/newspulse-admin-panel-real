import React from "react";
import { useNavigate } from "react-router-dom";

const reporterPortalUrl =
  import.meta.env.VITE_PUBLIC_REPORTER_PORTAL_URL ||
  "https://newspulse.co.in/community-reporter";

const ReporterPortalPreview: React.FC = () => {
  const navigate = useNavigate();

  const handleOpenPortal = () => {
    if (!reporterPortalUrl) {
      alert("Reporter Portal URL is not configured yet.");
      return;
    }

    window.open(reporterPortalUrl, "_blank", "noopener,noreferrer");
  };

  const handleOpenMyStories = () => {
    navigate("/community/my-stories");
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Reporter Portal – Founder Preview
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          This page is only for you (<span className="font-medium">Founder/Admin</span>).
          Use it to quickly open the public Community Reporter Portal in a new tab
          while keeping your admin session active here.
        </p>
      </div>

      {/* Main card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Card header */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-xl">
            🧑‍🤝‍🧑
          </div>
          <div>
            <h2 className="text-base font-semibold">Public Community Reporter Portal</h2>
            <p className="text-xs text-slate-500">
              This is what community reporters see on <span className="font-medium">newspulse.co.in</span>.
            </p>
          </div>
        </div>

        {/* Card body */}
        <div className="space-y-4 px-6 py-5">
          {/* URL display */}
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Portal URL
            </div>
            <div className="mt-1 inline-flex max-w-full items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="truncate">{reporterPortalUrl}</span>
            </div>
          </div>

          {/* Buttons row */}
          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="button"
              onClick={handleOpenPortal}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            >
              Open Reporter Portal in new tab
            </button>

            <button
              type="button"
              onClick={handleOpenMyStories}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-1"
            >
              Open My Community Stories (admin)
            </button>
          </div>

          {/* Tip text */}
          <p className="pt-2 text-xs text-slate-500">
            Tip: Keep this admin tab open for Founder control, and use the new tab as if you are a
            public community reporter.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReporterPortalPreview;