import { z } from 'zod';

// Date validation
export const isValidDate = (dateString: string): boolean => {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
};

// Dashboard Filter Validation
export const DashboardFilterSchema = z.object({
  projectName: z.string().max(100, 'Project name too long').optional().or(z.literal('')),
  environment: z.string().max(50, 'Environment too long').optional().or(z.literal('')),
  ownership: z.string().max(100, 'Ownership too long').optional().or(z.literal('')),
  costType: z.enum([
    '',
    'Compute',
    'Storage',
    'Database',
    'Networking',
    'Security',
    'Governance',
    'Analytics',
    'Machine Learning',
  ]).optional(),
  startDate: z.string()
    .optional()
    .or(z.literal(''))
    .refine(val => !val || isValidDate(val), 'Invalid start date format (use YYYY-MM-DD)'),
  endDate: z.string()
    .optional()
    .or(z.literal(''))
    .refine(val => !val || isValidDate(val), 'Invalid end date format (use YYYY-MM-DD)'),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  { message: 'Start date must be before end date', path: ['startDate'] }
);

export type DashboardFilter = z.infer<typeof DashboardFilterSchema>;

// Date Range Validation
export const DateRangeSchema = z.object({
  startDate: z.string().refine(isValidDate, 'Invalid start date'),
  endDate: z.string().refine(isValidDate, 'Invalid end date'),
}).refine(
  (data) => new Date(data.startDate) <= new Date(data.endDate),
  { message: 'Start date must be before end date' }
);

export type DateRange = z.infer<typeof DateRangeSchema>;

// Period Validation
export const PeriodSchema = z.enum(['3', '6', '12']).default('6');

// Validation helper
export const validateInput = <T,>(schema: z.ZodSchema<T>, data: unknown): { valid: boolean; data?: T; error?: string } => {
  try {
    const validated = schema.parse(data);
    return { valid: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return {
        valid: false,
        error: firstError.message,
      };
    }
    return { valid: false, error: 'Validation failed' };
  }
};

// Export default validation schema
export default DashboardFilterSchema;
