import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslation } from 'react-i18next';
export default function SafeOwnerZone() {
    const { t } = useTranslation();
    return (_jsx("div", { className: "p-4", children: _jsxs("h2", { className: "text-xl font-semibold text-white flex items-center gap-2", children: [_jsx("span", { role: "img", "aria-label": "shield", children: "\uD83D\uDEE1\uFE0F" }), t('safeOwnerZone')] }) }));
}
