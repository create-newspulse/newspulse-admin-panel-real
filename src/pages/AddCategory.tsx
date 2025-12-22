import { useEffect, useState } from 'react';
import { api } from '@/lib/http';

export default function CategoryManager() {
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    api<{ categories?: string[] }>('/categories')
      .then((data) => setCategories(data?.categories || []))
      .catch(() => setCategories([]));
  }, []);

  const handleAdd = async () => {
    if (!newCategory) return;
    try {
      const data: any = await api('/add-category', {
        method: 'POST',
        json: { name: newCategory },
      });
      if (data.success) {
        setCategories([...categories, newCategory]);
        setNewCategory('');
        setMessage('✅ Category added');
      } else {
        setMessage('❌ Failed to add category');
      }
    } catch {
      setMessage('❌ Server error');
    }
  };

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-bold mb-4">🗂️ Manage Categories</h1>
      <div className="space-y-3">
        <input
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          placeholder="New category name"
          className="w-full px-4 py-2 border rounded"
        />
        <button onClick={handleAdd} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-500">
          Add Category
        </button>
        {message && <p className="text-sm mt-2">{message}</p>}
      </div>
      <ul className="mt-6 space-y-1">
        {categories.map((cat, i) => (
          <li key={i} className="text-sm px-3 py-1 bg-gray-100 rounded">{cat}</li>
        ))}
      </ul>
    </div>
  );
}