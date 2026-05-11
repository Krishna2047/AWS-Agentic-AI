import React, { useEffect } from 'react';
import './ConfirmModal.css';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmType?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmType = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="confirm-modal-overlay">
      <div className="confirm-modal" role="alertdialog">
        <h2 className="confirm-modal__title">{title}</h2>
        <p className="confirm-modal__message">{message}</p>
        <div className="confirm-modal__actions">
          <button
            className="confirm-modal__button confirm-modal__button--cancel"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            className={`confirm-modal__button confirm-modal__button--${confirmType}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// Hook for using confirm modal
export const useConfirm = () => {
  const [state, setState] = React.useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmType?: 'danger' | 'primary';
    loading?: boolean;
    onConfirm?: () => void | Promise<void>;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const confirm = (options: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmType?: 'danger' | 'primary';
    onConfirm: () => void | Promise<void>;
    onCancel?: () => void;
  }): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        title: options.title,
        message: options.message,
        confirmText: options.confirmText,
        cancelText: options.cancelText,
        confirmType: options.confirmType,
        loading: false,
        onConfirm: async () => {
          setState(prev => ({ ...prev, loading: true }));
          try {
            await options.onConfirm();
            setState(prev => ({ ...prev, isOpen: false, loading: false }));
            resolve(true);
          } catch (error) {
            setState(prev => ({ ...prev, loading: false }));
            resolve(false);
          }
        },
        onCancel: () => {
          setState(prev => ({ ...prev, isOpen: false }));
          options.onCancel?.();
          resolve(false);
        },
      });
    });
  };

  return {
    confirm,
    ConfirmModal: (
      <ConfirmModal
        isOpen={state.isOpen}
        title={state.title}
        message={state.message}
        confirmText={state.confirmText}
        cancelText={state.cancelText}
        confirmType={state.confirmType}
        loading={state.loading}
        onConfirm={state.onConfirm || (() => {})}
        onCancel={state.onCancel || (() => {})}
      />
    ),
  };
};
