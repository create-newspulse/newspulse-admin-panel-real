import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
export default function CategoryManager() {
    const [categories, setCategories] = useState([]);
    const [newCategory, setNewCategory] = useState('');
    const [message, setMessage] = useState('');
    useEffect(() => {
        fetch('http://localhost:5000/api/categories')
            .then(res => res.json())
            .then(data => setCategories(data.categories || []));
    }, []);
    const handleAdd = async () => {
        if (!newCategory)
            return;
        try {
            const res = await fetch('http://localhost:5000/api/add-category', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newCategory }),
            });
            const data = await res.json();
            if (data.success) {
                setCategories([...categories, newCategory]);
                setNewCategory('');
                setMessage('Γ£à Category added');
            }
            else {
                setMessage('Γ¥î Failed to add category');
            }
        }
        catch {
            setMessage('Γ¥î Server error');
        }
    };
    return (_jsxs("div", { className: "p-6 max-w-xl", children: [_jsx("h1", { className: "text-2xl font-bold mb-4", children: "\uD83D\uDDC2\uFE0F Manage Categories" }), _jsxs("div", { className: "space-y-3", children: [_jsx("input", { value: newCategory, onChange: (e) => setNewCategory(e.target.value), placeholder: "New category name", className: "w-full px-4 py-2 border rounded" }), _jsx("button", { onClick: handleAdd, className: "bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-500", children: "Add Category" }), message && _jsx("p", { className: "text-sm mt-2", children: message })] }), _jsx("ul", { className: "mt-6 space-y-1", children: categories.map((cat, i) => (_jsx("li", { className: "text-sm px-3 py-1 bg-gray-100 rounded", children: cat }, i))) })] }));
}
