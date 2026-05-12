// API Response Types - Phase 2 Type Safety

export interface CostData {
  total_cost: number;
  cost_by_category: Record<string, number>;
  cost_by_account: Record<string, number>;
  cost_by_service: ServiceCost[];
  monthly_trend: Record<string, number>;
  errors?: Array<{ account: string; error: string }>;
  // Credits-related fields
  total_with_credits?: number;
  total_without_credits?: number;
  applied_credits?: number;
  credits_filter?: string;
}

export interface ServiceCost {
  service_name: string;
  category: string;
  cost: number;
  usage_units?: number;
  unit?: string;
}

export interface DashboardData extends CostData {
  timestamp?: string;
  period?: { start: string; end: string };
}

export interface Account {
  id: string;
  name: string;
  status: 'connected' | 'error' | 'pending';
  lastUpdated?: string;
}

export interface AgentResponse {
  id: string;
  agent: string;
  type: 'cost' | 'cloudwatch' | 'security' | 'advisor' | 'youtrack' | 'knowledge';
  message: string;
  data?: Record<string, unknown>;
  executionTime: number;
  status: 'success' | 'error' | 'partial';
  error?: string;
  timestamp: string;
  confidenceScore?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  agentResponses?: AgentResponse[];
  metadata?: Record<string, unknown>;
}

export interface WorkflowExecution {
  id: string;
  workflowName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  result?: Record<string, unknown>;
  error?: string;
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: Record<string, unknown>;
  error?: string;
}

export interface HealthMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: Record<string, ComponentHealth>;
  timestamp: string;
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  lastChecked: string;
  responseTime?: number;
}

export interface Alarm {
  id: string;
  name: string;
  state: 'OK' | 'ALARM' | 'INSUFFICIENT_DATA';
  description: string;
  timestamp: string;
  account: string;
  metric?: string;
  value?: number;
  threshold?: number;
}

export interface CostAnomaly {
  id: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  currentCost: number;
  expectedCost: number;
  percentageIncrease: number;
  services?: string[];
  timestamp: string;
}

export interface AnalyticsEvent {
  eventId: string;
  eventType: 'agent_used' | 'query_submitted' | 'action_performed' | 'page_visited' | 'error_occurred';
  userId?: string;
  timestamp: string;
  metadata: Record<string, unknown>;
  duration?: number;
}

export interface AgentMetrics {
  agent: string;
  totalUsage: number;
  successRate: number;
  averageResponseTime: number;
  popularQueries: Array<{ query: string; count: number }>;
  errors: Array<{ error: string; count: number }>;
  lastUsed: string;
}

export interface UsageAnalytics {
  period: { start: string; end: string };
  totalQueries: number;
  agentUsage: Record<string, number>;
  topAgents: AgentMetrics[];
  topQueries: Array<{ query: string; count: number; agent: string }>;
  averageResponseTime: number;
  errorRate: number;
}

export interface CostComparison {
  period1: { start: string; end: string; cost: number };
  period2: { start: string; end: string; cost: number };
  difference: number;
  percentageChange: number;
  trend: 'up' | 'down' | 'stable';
  byService?: Array<{ service: string; period1Cost: number; period2Cost: number; change: number }>;
}

export interface WebSocketMessage {
  type: 'cost_update' | 'alarm_notification' | 'anomaly_alert' | 'agent_status' | 'agent_response';
  data: Record<string, unknown>;
  timestamp: string;
}

export interface ApiErrorResponse {
  error: string;
  code: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface PaginationMetadata {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMetadata;
}

// API Request Types
export interface DashboardQueryFilters {
  projectName?: string;
  environment?: string;
  ownership?: string;
  costType?: string;
  startDate?: string;
  endDate?: string;
}

export interface GetCostsRequest {
  account: string;
  periodMonths: 3 | 6 | 12;
  filters?: DashboardQueryFilters;
}

export interface GetCostsResponse extends CostData {
  cached?: boolean;
  cacheAge?: number;
}
