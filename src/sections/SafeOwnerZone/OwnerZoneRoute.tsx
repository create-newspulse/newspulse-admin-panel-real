import { useParams } from 'react-router-dom';
import FounderOnly from '@/lib/guards/founderOnly';
import { OwnerModulePage } from './ownerzone.registry';

export default function OwnerZoneRoute() {
  const { module } = useParams();
  const mod = (module || 'founder');
  return (
    <FounderOnly>
      <OwnerModulePage moduleId={mod} />
    </FounderOnly>
  );
}
