import React from 'react';
import './SkeletonLoader.css';

interface SkeletonLoaderProps {
  type?: 'text' | 'chart' | 'table' | 'card' | 'line';
  count?: number;
  width?: string;
  height?: string;
  className?: string;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  type = 'text',
  count = 1,
  width = '100%',
  height = '20px',
  className = '',
}) => {
  const renderSkeletons = () => {
    const skeletons = [];
    for (let i = 0; i < count; i++) {
      skeletons.push(
        <div
          key={i}
          className={`skeleton skeleton--${type}`}
          style={{
            width: type === 'chart' ? '100%' : width,
            height: type === 'chart' ? '300px' : height,
          }}
        />
      );
    }
    return skeletons;
  };

  return (
    <div className={`skeleton-container ${className}`}>
      {renderSkeletons()}
    </div>
  );
};

export const SkeletonChart: React.FC<{ className?: string }> = ({ className }) => (
  <SkeletonLoader type="chart" className={className} />
);

export const SkeletonTable: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="skeleton-table">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="skeleton-table__row">
        <SkeletonLoader type="text" width="20%" height="16px" />
        <SkeletonLoader type="text" width="25%" height="16px" />
        <SkeletonLoader type="text" width="20%" height="16px" />
        <SkeletonLoader type="text" width="35%" height="16px" />
      </div>
    ))}
  </div>
);

export const SkeletonKPIs: React.FC = () => (
  <div className="skeleton-kpis">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="skeleton-kpi">
        <SkeletonLoader type="text" width="80%" height="12px" />
        <div style={{ marginTop: '8px' }}>
          <SkeletonLoader type="text" width="60%" height="24px" />
        </div>
      </div>
    ))}
  </div>
);
