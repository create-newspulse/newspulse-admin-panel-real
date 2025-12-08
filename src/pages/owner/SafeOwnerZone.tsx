import { useTranslation } from 'react-i18next';

export default function SafeOwnerZone() {
  const { t } = useTranslation();

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold text-white flex items-center gap-2">
        <span role="img" aria-label="shield">🛡️</span>
        {t('safeOwnerZone')}
      </h2>

      {/* Add your zone features/components here */}
    </div>
  );
}
