import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Breadcrumbs.css';

interface Breadcrumb {
  label: string;
  path?: string;
}

const pathToBreadcrumbs = (pathname: string): Breadcrumb[] => {
  const parts = pathname.split('/').filter(Boolean);
  const breadcrumbs: Breadcrumb[] = [{ label: 'Home', path: '/' }];

  let currentPath = '';
  parts.forEach((part, index) => {
    currentPath += `/${part}`;
    const label = part.charAt(0).toUpperCase() + part.slice(1).replace('-', ' ');

    if (index === parts.length - 1) {
      breadcrumbs.push({ label });
    } else {
      breadcrumbs.push({ label, path: currentPath });
    }
  });

  return breadcrumbs;
};

export const Breadcrumbs: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const breadcrumbs = pathToBreadcrumbs(location.pathname);

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol className="breadcrumbs__list">
        {breadcrumbs.map((breadcrumb, index) => (
          <li key={index} className="breadcrumbs__item">
            {breadcrumb.path ? (
              <>
                <button
                  className="breadcrumbs__link"
                  onClick={() => breadcrumb.path && navigate(breadcrumb.path)}
                  aria-current={index === breadcrumbs.length - 1 ? 'page' : undefined}
                >
                  {breadcrumb.label}
                </button>
                {index < breadcrumbs.length - 1 && (
                  <span className="breadcrumbs__separator">/</span>
                )}
              </>
            ) : (
              <>
                <span className="breadcrumbs__current">{breadcrumb.label}</span>
              </>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};
