import { create } from 'zustand';
import { apiClient, type DashboardQueryFilters } from '../services/api/apiClient';

export interface ServiceCost {
  service_name: string;
  category: string;
  cost: number;
  accounts: Record<string, number>;
}

export interface DashboardData {
  total_cost: number;
  cost_by_account: Record<string, number>;
  cost_by_category: Record<string, number>;
  cost_by_service: ServiceCost[];
  monthly_trend: Record<string, number>;
  errors: Array<{ account: string; error: string }>;
  // Credits-related fields
  total_with_credits?: number;
  total_without_credits?: number;
  applied_credits?: number;
  credits_filter?: string;
}

interface DashboardState {
  data: DashboardData | null;
  isLoading: boolean;
  isExporting: boolean;
  error: string | null;
  fetchCosts: (account?: string, months?: number, filters?: DashboardQueryFilters) => Promise<void>;
  exportCosts: (account?: string, months?: number, filters?: DashboardQueryFilters) => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  data: null,
  isLoading: false,
  isExporting: false,
  error: null,
  fetchCosts: async (account = 'all', months = 6, filters?: DashboardQueryFilters) => {
    set({ isLoading: true, error: null });
    try {
      const result = await apiClient.getDashboardCosts(account, months, filters);
      if (result.success) {
        set({ data: result.data, isLoading: false });
      } else {
        set({ error: result.message || 'Failed to load dashboard data', isLoading: false });
      }
    } catch (error: any) {
      set({ error: error.message || 'An error occurred fetching the dashboard', isLoading: false });
    }
  },
  exportCosts: async (account = 'all', months = 6, filters?: DashboardQueryFilters) => {
    set({ isExporting: true });
    try {
      await apiClient.exportDashboardCosts(account, months, filters);
    } finally {
      set({ isExporting: false });
    }
  },
}));
