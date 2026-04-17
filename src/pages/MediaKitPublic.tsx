const offerings = [
  {
    title: 'Sponsored Feature',
    description: 'Premium homepage promo card with image, headline, short summary, CTA, and click destination.',
  },
  {
    title: 'Sponsored Article',
    description: 'Full sponsored article page on NewsPulse with sponsor disclosure, article content, and CTA.',
  },
  {
    title: 'Combo Campaign',
    description: 'Sponsored Feature plus Sponsored Article planned together as one campaign.',
  },
];

const guidelines = [
  'All sponsored content is clearly separated from normal editorial content.',
  'Creative, schedule, and availability are confirmed directly with the NewsPulse ads team.',
  'Detailed campaign pricing is shared privately during booking, not on the public page.',
];

export default function MediaKitPublic() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="max-w-3xl">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-700">Media Kit</div>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">NewsPulse Sponsorship Options</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Explore the sponsorship formats available on NewsPulse. This public page is intentionally pricing-free.
            Final availability, campaign structure, and commercial terms are shared directly by the ads team.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {offerings.map((offering) => (
            <section key={offering.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-lg font-semibold text-slate-950">{offering.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{offering.description}</p>
            </section>
          ))}
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-[1.4fr_0.9fr]">
          <section className="rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-950">Booking Notes</h2>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              {guidelines.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="text-lg font-semibold text-amber-950">Book A Campaign</h2>
            <p className="mt-3 text-sm leading-6 text-amber-900">
              For current rates, custom packages, and slot availability, contact the NewsPulse ads desk.
            </p>
            <a
              href="mailto:newspulse.ads@gmail.com"
              className="mt-5 inline-flex rounded-full bg-amber-600 px-5 py-3 text-sm font-semibold text-white"
            >
              newspulse.ads@gmail.com
            </a>
          </section>
        </div>
      </div>
    </div>
  );
}