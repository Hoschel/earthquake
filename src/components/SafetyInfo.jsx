import React from 'react';
import { useTranslation } from 'react-i18next';
import './SafetyInfo.css'; // We'll create this CSS file next

function SafetyInfo({ onClose }) {
  const { t } = useTranslation();

  return (
    <div className="safety-info-overlay">
      <div className="safety-info-content">
        <h2>{t('safetyInfoTitle')}</h2>
        <ul>
          <li>
            <strong>{t('safetyDropCoverHoldOnTitle')}:</strong> {t('safetyDropCoverHoldOnDesc')}
          </li>
          <li>
            <strong>{t('safetyIndoorsTitle')}:</strong> {t('safetyIndoorsDesc')}
          </li>
          <li>
            <strong>{t('safetyOutdoorsTitle')}:</strong> {t('safetyOutdoorsDesc')}
          </li>
          <li>
            <strong>{t('safetyDrivingTitle')}:</strong> {t('safetyDrivingDesc')}
          </li>
          <li>
            <strong>{t('safetyAftershocksTitle')}:</strong> {t('safetyAftershocksDesc')}
          </li>
        </ul>
        <button onClick={onClose} className="close-safety-button">{t('safetyCloseButton')}</button>
      </div>
    </div>
  );
}

export default SafetyInfo;