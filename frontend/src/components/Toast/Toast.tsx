import React, { useEffect } from 'react';
import { Toast as ToastType, useToast } from './ToastContext';
import './Toast.css';

interface ToastProps {
  toast: ToastType;
}

const ToastComponent: React.FC<ToastProps> = ({ toast }) => {
  const { removeToast } = useToast();

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => removeToast(toast.id), toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast, removeToast]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
      default:
        return 'ⓘ';
    }
  };

  return (
    <div className={`toast toast--${toast.type}`} role="alert">
      <span className="toast__icon">{getIcon()}</span>
      <span className="toast__message">{toast.message}</span>
      <button
        className="toast__close"
        onClick={() => removeToast(toast.id)}
        aria-label="Close notification"
      >
        ✕
      </button>
    </div>
  );
};

export function ToastContainer() {
  const { toasts } = useToast();

  return (
    <div className="toast-container" role="region" aria-live="polite" aria-atomic="true">
      {toasts.map(toast => (
        <ToastComponent key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
