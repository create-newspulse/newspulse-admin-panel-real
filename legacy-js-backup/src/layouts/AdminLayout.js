import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Sidebar from '../components/Sidebar';
import { useDarkMode } from '../context/DarkModeContext';
const AdminLayout = ({ children }) => {
    const { isDark } = useDarkMode();
    return (_jsxs("div", { className: `flex ${isDark ? 'bg-black text-white' : 'bg-gray-100 text-black'}`, children: [_jsx(Sidebar, {}), _jsx("main", { className: "flex-1 min-h-screen p-6", children: children })] }));
};
export default AdminLayout;
