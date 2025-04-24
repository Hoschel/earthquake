import React from 'react';
import { useTranslation } from 'react-i18next';
import './DataSourceSelector.css';

function DataSourceSelector({ availableSources, selectedSource, onSourceChange }) {
  const { t } = useTranslation();

  return (
    <div className="filter-container data-source-selector">
      <label htmlFor="dataSourceSelect">{t('dataSourceLabel', 'Data Source')}:</label>
      <div className="source-buttons">
        {availableSources.map(source => (
          <button
            key={source}
            id={`dataSourceSelect-${source}`}
            className={selectedSource === source ? 'active' : ''}
            onClick={() => onSourceChange(source)}
          >
            {source} {/* Display source name directly */}
          </button>
        ))}
      </div>
    </div>
  );
}

export default DataSourceSelector;