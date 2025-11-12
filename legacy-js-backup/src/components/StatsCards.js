import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
const CountUp = ({ target }) => {
    const [count, setCount] = useState(0);
    useEffect(() => {
        let current = 0;
        const step = Math.ceil(target / 50);
        const interval = setInterval(() => {
            current += step;
            if (current >= target) {
                setCount(target);
                clearInterval(interval);
            }
            else {
                setCount(current);
            }
        }, 20);
        return () => clearInterval(interval);
    }, [target]);
    return _jsx(_Fragment, { children: count });
};
export default function StatsCards({ totalNews, categoryCount, languageCount, trends, activeUsers, aiLogs, }) {
    const navigate = useNavigate();
    const stats = [
        {
            label: '≡ƒô░ Total News',
            value: totalNews,
            trend: trends?.totalNews ?? 0,
            link: '/manage-news',
        },
        {
            label: '≡ƒôé Categories',
            value: categoryCount,
            trend: trends?.category ?? 0,
            link: '/add-category',
        },
        {
            label: '≡ƒîÉ Languages',
            value: languageCount,
            trend: trends?.language ?? 0,
            link: '/language-settings',
        },
        {
            label: '≡ƒæÑ Active Users',
            value: activeUsers,
            trend: 0,
            link: '/admin-users',
        },
        {
            label: '≡ƒºá AI Logs',
            value: aiLogs,
            trend: 0,
            link: '/ai-logs',
        },
    ];
    return (_jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6", children: stats.map((item, i) => (_jsxs("div", { onClick: () => navigate(item.link), className: "cursor-pointer rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow hover:shadow-lg transition hover:scale-[1.02] min-h-[120px]", children: [_jsx("div", { className: "text-sm text-gray-600 dark:text-gray-400 font-medium mb-1", children: item.label }), _jsx("div", { className: "text-4xl font-extrabold text-blue-600 dark:text-blue-400 mb-1", children: _jsx(CountUp, { target: item.value }) }), _jsxs("div", { className: `text-xs font-semibold ${item.trend > 0
                        ? 'text-green-500'
                        : item.trend < 0
                            ? 'text-red-500'
                            : 'text-gray-400'}`, children: [item.trend > 0 && `Γåæ ${item.trend}%`, item.trend < 0 && `Γåô ${Math.abs(item.trend)}%`, item.trend === 0 && 'ΓÇö'] })] }, i))) }));
}
