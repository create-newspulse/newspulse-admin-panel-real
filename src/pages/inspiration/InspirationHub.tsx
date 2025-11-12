// Deprecated InspirationHub page. Provide a minimal component so legacy imports don't break.
import React from 'react';

const InspirationHubRemoved: React.FC = () => (
	<div className="p-8 text-center text-sm text-slate-500">
		Inspiration Hub has been retired. Remove any imports of this page to eliminate this shim.
	</div>
);

export default InspirationHubRemoved;
