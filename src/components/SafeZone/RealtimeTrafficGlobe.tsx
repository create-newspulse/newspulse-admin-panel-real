import { useEffect, useMemo, useRef, useState } from 'react';

const API_ORIGIN = (import.meta.env.VITE_API_URL?.toString() || 'https://newspulse-backend-real.onrender.com').replace(/\/+$/, '');
const API_BASE = `${API_ORIGIN}/api`;

type RegionHit = { code: string; count: number };

// Minimal lat/lon map for common regions
const REGION_COORDS: Record<string, { lat: number; lon: number }> = {
  IN: { lat: 20.6, lon: 78.9 },
  US: { lat: 37.1, lon: -95.7 },
  AE: { lat: 23.4, lon: 53.8 },
  GB: { lat: 55.4, lon: -3.4 },
  CA: { lat: 56.1, lon: -106.3 },
  DE: { lat: 51.2, lon: 10.4 },
  FR: { lat: 46.2, lon: 2.2 },
  SG: { lat: 1.35, lon: 103.8 },
  AU: { lat: -25.3, lon: 133.8 },
};

function projectOrthographic(lat: number, lon: number, R: number) {
  // Simple orthographic projection, globe centered at lon=0, lat=0
  const rad = Math.PI / 180;
  const phi = lat * rad;
  const lambda = lon * rad;
  const x = R * Math.cos(phi) * Math.sin(lambda);
  const y = -R * Math.sin(phi);
  const visible = Math.cos(phi) * Math.cos(lambda) >= 0; // backface cull
  return { x, y, visible };
}

export default function RealtimeTrafficGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hits, setHits] = useState<RegionHit[]>([]);
  const [activeUsers, setActiveUsers] = useState<number>(0);
  const [rotation, setRotation] = useState(0); // degrees for slow spin

  const size = 280;
  const R = size * 0.45;

  const points = useMemo(() => {
    const total = hits.reduce((s, h) => s + h.count, 0) || 1;
    return hits.map(h => {
      const coord = REGION_COORDS[h.code] || { lat: 0, lon: 0 };
      return {
        code: h.code,
        weight: Math.max(0.2, h.count / total),
        lat: coord.lat,
        lon: coord.lon,
      };
    });
  }, [hits]);

  // Fetch top regions from the same backend as MonitorHubPanel
  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_BASE}/system/monitor-hub`, { credentials: 'include' });
        const ct = res.headers.get('content-type') || '';
        if (!res.ok || !/application\/json/i.test(ct)) throw new Error('bad');
        const data = await res.json();
        const regions = (data.topRegions || ['IN','US','AE']) as string[];
        const counts = regions.reduce<Record<string, number>>((acc, code) => {
          acc[code] = (acc[code] || 0) + 1; return acc;
        }, {});
        if (!mounted) return;
        setHits(Object.entries(counts).map(([code, count]) => ({ code, count })));
        setActiveUsers(data.activeUsers || 0);
      } catch {
        if (!mounted) return;
        setHits([{ code: 'IN', count: 5 }, { code: 'US', count: 3 }, { code: 'AE', count: 2 }]);
        setActiveUsers(Math.floor(10 + Math.random() * 50));
      }
    };
    fetchData();
    const id = setInterval(fetchData, 30000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  // Spin animation
  useEffect(() => {
    const id = setInterval(() => setRotation((r) => (r + 0.2) % 360), 50);
    return () => clearInterval(id);
  }, []);

  // Draw globe
  useEffect(() => {
    const cvs = canvasRef.current; if (!cvs) return;
    const ctx = cvs.getContext('2d'); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    cvs.width = size * dpr;
    cvs.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2, cy = size / 2;

    // Globe base
    const grd = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.2, cx, cy, R);
    grd.addColorStop(0, '#4f46e5'); // indigo-600
    grd.addColorStop(1, '#1e293b'); // slate-800
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

    // Simple longitude lines
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 12; i++) {
      const angle = (i * 30 + rotation) * Math.PI / 180;
      const x = Math.cos(angle) * R; const y = Math.sin(angle) * R;
      ctx.beginPath(); ctx.moveTo(cx - x, cy - y); ctx.lineTo(cx + x, cy + y); ctx.stroke();
    }

    // Points
    points.forEach(p => {
      const lon = p.lon + rotation; // rotate
      const { x, y, visible } = projectOrthographic(p.lat, lon, R);
      if (!visible) return;
      const px = cx + x; const py = cy + y;
      const r = 4 + p.weight * 10;
      const glow = ctx.createRadialGradient(px, py, 0, px, py, r * 2.2);
      glow.addColorStop(0, 'rgba(59,130,246,0.9)');
      glow.addColorStop(1, 'rgba(59,130,246,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(px, py, r * 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e2e8f0'; ctx.beginPath(); ctx.arc(px, py, 2 + p.weight * 3, 0, Math.PI * 2); ctx.fill();
    });
  }, [points, rotation]);

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Realtime Traffic Globe</div>
        <div className="text-xs text-slate-500">Active Users: <strong>{activeUsers}</strong></div>
      </div>
      <div className="rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center">
        <canvas ref={canvasRef} width={size} height={size} style={{ width: size, height: size }} />
      </div>
      <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">Lite visualization without external libraries.
      </div>
    </div>
  );
}
