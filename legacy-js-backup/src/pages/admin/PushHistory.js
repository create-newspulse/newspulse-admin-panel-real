import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import apiClient from '@lib/api';
import { FaTrash } from 'react-icons/fa';
import moment from 'moment';
export default function PushHistory() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const fetchHistory = async () => {
        try {
            const res = await apiClient.get('/push-history');
            const data = res?.data ?? res;
            setData(data.data || []);
        }
        catch (err) {
            console.error('Γ¥î Failed to fetch push history:', err);
            setError('Γ¥î Failed to fetch push history');
        }
        finally {
            setLoading(false);
        }
    };
    const deleteAll = async () => {
        if (!confirm('Are you sure you want to delete all push history?'))
            return;
        try {
            await apiClient.delete('/push-history');
            setData([]);
        }
        catch (err) {
            console.error('Γ¥î Delete failed:', err);
            alert('Γ¥î Failed to delete push history');
        }
    };
    useEffect(() => {
        fetchHistory();
    }, []);
    return (_jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h2", { className: "text-xl font-semibold", children: "\uD83D\uDD14 Push History" }), _jsxs("button", { onClick: deleteAll, className: "bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded flex items-center gap-2", children: [_jsx(FaTrash, {}), " Delete All"] })] }), loading ? (_jsx("div", { className: "text-gray-600", children: "Loading..." })) : error ? (_jsx("div", { className: "text-red-600", children: error })) : data.length === 0 ? (_jsx("div", { className: "text-gray-500", children: "\uD83D\uDCED No push history found." })) : (_jsx("div", { className: "overflow-x-auto border rounded", children: _jsxs("table", { className: "min-w-full text-sm table-auto", children: [_jsx("thead", { className: "bg-gray-100 dark:bg-gray-800", children: _jsxs("tr", { className: "text-left", children: [_jsx("th", { className: "px-4 py-2", children: "TITLE" }), _jsx("th", { className: "px-4 py-2", children: "CATEGORY" }), _jsx("th", { className: "px-4 py-2", children: "SCORE" }), _jsx("th", { className: "px-4 py-2", children: "TYPE" }), _jsx("th", { className: "px-4 py-2", children: "TIME" })] }) }), _jsx("tbody", { children: data.map((item) => (_jsxs("tr", { className: "border-t hover:bg-gray-50 dark:hover:bg-gray-700", children: [_jsx("td", { className: "px-4 py-2", children: item.title }), _jsx("td", { className: "px-4 py-2", children: item.category || 'ΓÇö' }), _jsx("td", { className: "px-4 py-2", children: item.score ?? 0 }), _jsx("td", { className: "px-4 py-2 capitalize", children: item.type }), _jsx("td", { className: "px-4 py-2", children: item.triggeredAt && moment(new Date(item.triggeredAt)).isValid()
                                            ? moment(item.triggeredAt).format('DD MMM YYYY, hh:mm A')
                                            : 'ΓÇö' })] }, item._id))) })] }) }))] }));
}
