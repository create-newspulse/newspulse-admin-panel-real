// Quick local test for the summarizer service

const { generateSummaryAndTags } = require('../backend/services/ai/summarize');

async function main() {
  const title = 'India launches new lunar mission to explore Moon\'s south pole';
  const text = `The Indian Space Research Organisation (ISRO) announced the successful launch of a new
  lunar mission aiming to explore the Moon's south pole region. The mission will deploy a lander and
  rover equipped with advanced instruments to analyze surface composition and thermal properties.
  Scientists hope the mission will provide key insights into the presence of water ice and support
  future human exploration.`;

  const out = await generateSummaryAndTags({ title, text });
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('Test failed', e);
  process.exit(1);
});
