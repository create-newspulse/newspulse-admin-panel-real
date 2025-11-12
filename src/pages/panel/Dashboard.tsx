import QuickCards from '@/components/dashboard/QuickCards';
import SystemAlerts from '@/components/alerts/SystemAlerts';

export default function PanelDashboard() {
  return (
    <div className="space-y-6">
      <QuickCards />
      <SystemAlerts />
    </div>
  );
}
