return (
  <div className="p-4">
    <h1 className="text-xl font-bold mb-4">🧪 Debug: News Management Page Loaded</h1>

    {loading && <p>Loading...</p>}

    {!loading && news.length === 0 && (
      <p className="text-red-500">⚠️ No news found (news.length = 0)</p>
    )}

    {!loading && news.length > 0 && (
      <ul className="space-y-4">
        {news.map((item) => (
          <li key={item.id} className="border p-4 rounded shadow">
            <h2 className="font-semibold">{item.title}</h2>
            <p>{item.content}</p>
          </li>
        ))}
      </ul>
    )}
  </div>
);
