import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import apiClient from '@lib/api';
const roles = ['founder', 'editor', 'intern'];
const AdminRoles = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const fetchUsers = async () => {
        try {
            const res = await apiClient.get('/admin/users'); // Γ£à Proxied via api client
            const data = res?.data ?? res;
            setUsers(data.users ?? []);
        }
        catch (error) {
            console.error('Γ¥î Failed to fetch users', error);
        }
        finally {
            setLoading(false);
        }
    };
    const updateUserRole = async (userId, newRole) => {
        try {
            await apiClient.put(`/admin/update-role/${userId}`, { role: newRole });
            fetchUsers(); // Refresh after update
        }
        catch (error) {
            console.error('Γ¥î Failed to update role', error);
        }
    };
    useEffect(() => {
        fetchUsers();
    }, []);
    return (_jsxs("div", { className: "p-6 max-w-4xl mx-auto", children: [_jsx("h1", { className: "text-2xl font-semibold mb-6", children: "\uD83D\uDC65 Manage Team Roles" }), loading ? (_jsx("p", { children: "Loading..." })) : (_jsxs("table", { className: "w-full border", children: [_jsx("thead", { className: "bg-gray-100 text-left", children: _jsxs("tr", { children: [_jsx("th", { className: "p-2", children: "Name" }), _jsx("th", { className: "p-2", children: "Email" }), _jsx("th", { className: "p-2", children: "Role" }), _jsx("th", { className: "p-2", children: "Action" })] }) }), _jsx("tbody", { children: users.map((user) => (_jsxs("tr", { className: "border-t", children: [_jsx("td", { className: "p-2", children: user.name }), _jsx("td", { className: "p-2", children: user.email }), _jsx("td", { className: "p-2", children: user.role }), _jsx("td", { className: "p-2", children: _jsx("select", { value: user.role, onChange: (e) => updateUserRole(user._id, e.target.value), className: "border px-2 py-1 rounded", children: roles.map((role) => (_jsx("option", { value: role, children: role }, role))) }) })] }, user._id))) })] }))] }));
};
export default AdminRoles;
