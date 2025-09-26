// Example: src/pages/SystemHealth.tsx

import { useEffect, useState } from 'react';
import api from '../utils/api';

const SystemHealth = () => {
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    api.get('/safezone/system-health')
      .then(res => setHealth(res.data))
      .catch(err => console.error('❌ System Health Error:', err.message));
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">System Health Check</h1>
      <pre>{JSON.stringify(health, null, 2)}</pre>
    </div>
  );
};

export default SystemHealth;
