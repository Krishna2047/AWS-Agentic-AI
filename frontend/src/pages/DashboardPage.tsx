import React, { useEffect, useState, useMemo } from 'react';
import Header from '@cloudscape-design/components/header';
import Container from '@cloudscape-design/components/container';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Grid from '@cloudscape-design/components/grid';
import PieChart from '@cloudscape-design/components/pie-chart';
import BarChart from '@cloudscape-design/components/bar-chart';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import SegmentedControl from '@cloudscape-design/components/segmented-control';
import TextFilter from '@cloudscape-design/components/text-filter';
import Alert from '@cloudscape-design/components/alert';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Select from '@cloudscape-design/components/select';
import { useDashboardStore } from '../store/dashboardStore';
import { useAccountStore } from '../store/accountStore';
import { useToast } from '../components/Toast/ToastContext';
import { useConfirm } from '../components/ConfirmModal';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { SkeletonKPIs, SkeletonChart, SkeletonTable } from '../components/SkeletonLoader';
import { DashboardFilterSchema, validateInput } from '../utils/validation';
import type { DashboardQueryFilters } from '../services/api/apiClient';

export default function DashboardPage() {
  const { data, isLoading, isExporting, fetchCosts, exportCosts, error } = useDashboardStore();
  const { selectedAccount } = useAccountStore();
  const { showToast } = useToast();
  const { confirm, ConfirmModal } = useConfirm();
  const [scope, setScope] = useState<'all' | 'selected'>('all');
  const [periodMonths, setPeriodMonths] = useState<3 | 6 | 12>(6);
  const [filteringText, setFilteringText] = useState('');
  const [filterErrors, setFilterErrors] = useState<string>('');
  const [dashboardFilters, setDashboardFilters] = useState<DashboardQueryFilters>({
    projectName: '',
    environment: '',
    ownership: '',
    costType: '',
    startDate: '',
    endDate: '',
  });
  const [appliedFilters, setAppliedFilters] = useState<DashboardQueryFilters>({});

  const selectedScopeAccount = scope === 'all' ? 'all' : (selectedAccount?.id || 'default');
  const normalizedFilters = useMemo<DashboardQueryFilters>(() => ({
    projectName: dashboardFilters.projectName?.trim() || undefined,
    environment: dashboardFilters.environment?.trim() || undefined,
    ownership: dashboardFilters.ownership?.trim() || undefined,
    costType: dashboardFilters.costType?.trim() || undefined,
    startDate: dashboardFilters.startDate || undefined,
    endDate: dashboardFilters.endDate || undefined,
  }), [dashboardFilters]);
  
  // Refetch when the scope or selected account changes
  useEffect(() => {
    fetchCosts(selectedScopeAccount, periodMonths, appliedFilters);
  }, [selectedScopeAccount, periodMonths, appliedFilters, fetchCosts]);

  const currencyFormatter = (value: number) => `$${value.toFixed(2)}`;

  const handleApplyFilters = async () => {
    const validation = validateInput(DashboardFilterSchema, dashboardFilters);
    if (!validation.valid) {
      setFilterErrors(validation.error || 'Validation failed');
      showToast(validation.error || 'Please fix the errors below', 'error');
      return;
    }

    setFilterErrors('');
    setAppliedFilters(normalizedFilters);
    showToast('Filters applied successfully', 'success');
  };

  const handleReset = async () => {
    const confirmed = await confirm({
      title: 'Reset Filters',
      message: 'Are you sure you want to reset all filters to default values?',
      confirmText: 'Reset',
      cancelText: 'Cancel',
      confirmType: 'danger',
      onConfirm: () => {
        const resetFilters = {
          projectName: '',
          environment: '',
          ownership: '',
          costType: '',
          startDate: '',
          endDate: '',
        };
        setDashboardFilters(resetFilters);
        setAppliedFilters({});
        setFilterErrors('');
        showToast('Filters reset successfully', 'success');
      },
    });
  };

  const handleExport = async () => {
    const confirmed = await confirm({
      title: 'Export to Excel',
      message: 'This will export all cost data for the selected period and filters. Continue?',
      confirmText: 'Export',
      cancelText: 'Cancel',
      confirmType: 'primary',
      onConfirm: async () => {
        await exportCosts(selectedScopeAccount, periodMonths, appliedFilters);
        showToast('Export completed successfully', 'success');
      },
    });
  };

  // Map the aggregated category data to the Cloudscape PieChart format
  const categoryChartData = useMemo(() => {
    return data ? Object.entries(data.cost_by_category).map(([category, cost]) => ({
      title: category,
      value: cost
    })) : [];
  }, [data]);

  // Map the aggregated account data to the Cloudscape BarChart format
  const accountChartData = useMemo(() => {
    return data ? [
      {
        title: "Cost by Account",
        type: "bar" as const,
        data: Object.entries(data.cost_by_account).map(([acc, cost]) => ({ x: acc, y: cost }))
      }
    ] : [];
  }, [data]);

  const monthlyTrendData = useMemo(() => {
    return data ? [
      {
        title: "Monthly Cost Trend",
        type: "bar" as const,
        data: Object.entries(data.monthly_trend || {}).map(([month, cost]) => ({ x: month, y: cost }))
      }
    ] : [];
  }, [data]);

  // Filter services locally for the table
  const filteredServices = useMemo(() => {
    if (!data?.cost_by_service) return [];
    return data.cost_by_service.filter(item => 
      item.service_name.toLowerCase().includes(filteringText.toLowerCase()) ||
      item.category.toLowerCase().includes(filteringText.toLowerCase())
    );
  }, [data, filteringText]);

  // Calculate top-level KPIs
  const topCategory = data ? Object.entries(data.cost_by_category).sort((a, b) => b[1] - a[1])[0]?.[0] : 'N/A';
  const topService = data?.cost_by_service[0]?.service_name || 'N/A';
  const accountsCount = data ? Object.keys(data.cost_by_account).length : 0;

  return (
    <div className="dashboard-page">
      <Breadcrumbs />
      <div className="dashboard-hero">
        <Header 
          variant="h1" 
          description="Professional visibility into account-level billing, service concentration, and current spend trends."
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <SegmentedControl
                selectedId={scope}
                onChange={({ detail }) => setScope(detail.selectedId as 'all' | 'selected')}
                options={[
                  { text: "All Configured Accounts", id: "all" },
                  { text: `Selected Account (${selectedAccount?.name || 'None'})`, id: "selected", disabled: !selectedAccount }
                ]}
              />
              <SegmentedControl
                selectedId={String(periodMonths)}
                onChange={({ detail }) => setPeriodMonths(Number(detail.selectedId) as 3 | 6 | 12)}
                options={[
                  { text: "3M", id: "3" },
                  { text: "6M", id: "6" },
                  { text: "12M", id: "12" }
                ]}
              />
              <Button
                iconName="download"
                loading={isExporting}
                onClick={handleExport}
              >
                Export Excel
              </Button>
            </SpaceBetween>
          }
        >
          AWS Cost & Service Dashboard
        </Header>
        <Box margin={{ top: 'm' }} color="text-body-secondary">
          This view now pairs executive-style cost rollups with account-level drilldowns so MSP operators can quickly spot outliers, concentration risk, and uneven spend distribution.
        </Box>
      </div>

      {error && (
        <Alert type="error" header="Dashboard load failed">
          {error}
        </Alert>
      )}

      {!error && data?.errors?.length ? (
        <Alert type="warning" header="Some configured accounts could not be queried">
          {data.errors.map((item) => `${item.account}: ${item.error}`).join(' | ')}
        </Alert>
      ) : null}

      <div className="dashboard-panel">
      <Container header={<Header variant="h2">Cost Filters</Header>}>
        <Grid gridDefinition={[{ colspan: { default: 12, m: 3 } }, { colspan: { default: 12, m: 3 } }, { colspan: { default: 12, m: 3 } }, { colspan: { default: 12, m: 3 } }]}>
          <FormField label="Project Name tag">
            <Input
              value={dashboardFilters.projectName || ''}
              placeholder="e.g., MyProject (optional)"
              onChange={({ detail }) => setDashboardFilters((prev) => ({ ...prev, projectName: detail.value }))}
            />
          </FormField>
          <FormField label="Environment tag">
            <Input
              value={dashboardFilters.environment || ''}
              placeholder="Production"
              onChange={({ detail }) => setDashboardFilters((prev) => ({ ...prev, environment: detail.value }))}
            />
          </FormField>
          <FormField label="Ownership tag">
            <Input
              value={dashboardFilters.ownership || ''}
              placeholder="e.g., TeamName (optional)"
              onChange={({ detail }) => setDashboardFilters((prev) => ({ ...prev, ownership: detail.value }))}
            />
          </FormField>
          <FormField label="Type">
            <Select
              selectedOption={dashboardFilters.costType ? { label: dashboardFilters.costType, value: dashboardFilters.costType } : null}
              onChange={({ detail }) => setDashboardFilters((prev) => ({ ...prev, costType: detail.selectedOption?.value || '' }))}
              options={[
                { label: 'All Types', value: '' },
                { label: 'Compute', value: 'Compute' },
                { label: 'Storage', value: 'Storage' },
                { label: 'Database', value: 'Database' },
                { label: 'Networking', value: 'Networking' },
                { label: 'Security', value: 'Security' },
                { label: 'Governance', value: 'Governance' },
                { label: 'Analytics', value: 'Analytics' },
                { label: 'Machine Learning', value: 'Machine Learning' },
              ]}
            />
          </FormField>
        </Grid>
        <Box padding={{ top: 'm' }}>
          <Grid gridDefinition={[{ colspan: { default: 12, m: 4 } }, { colspan: { default: 12, m: 4 } }, { colspan: { default: 12, m: 4 } }]}>
            <FormField label="Start date">
              <Input
                value={dashboardFilters.startDate || ''}
                placeholder="YYYY-MM-DD"
                onChange={({ detail }) => setDashboardFilters((prev) => ({ ...prev, startDate: detail.value }))}
              />
            </FormField>
            <FormField label="End date">
              <Input
                value={dashboardFilters.endDate || ''}
                placeholder="YYYY-MM-DD"
                onChange={({ detail }) => setDashboardFilters((prev) => ({ ...prev, endDate: detail.value }))}
              />
            </FormField>
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                onClick={handleApplyFilters}
                loading={isLoading}
              >
                Apply Filters
              </Button>
              <Button
                variant="link"
                onClick={handleReset}
              >
                Reset
              </Button>
            </SpaceBetween>
          </Grid>
        </Box>
      </Container>
      </div>

      {/* KPI Summary Section */}
      {isLoading ? (
        <SkeletonKPIs />
      ) : (
        <div className="dashboard-kpis">
          <div className="dashboard-kpi">
            <div className="dashboard-kpi__label">Total Unblended Cost ({periodMonths} Month{periodMonths > 1 ? 's' : ''})</div>
            <div className="dashboard-kpi__value dashboard-kpi__value--highlight">
              {currencyFormatter(data?.total_cost || 0)}
            </div>
          </div>
          <div className="dashboard-kpi">
            <div className="dashboard-kpi__label">Highest Cost Category</div>
            <div className="dashboard-kpi__value">
              {topCategory}
            </div>
          </div>
          <div className="dashboard-kpi">
            <div className="dashboard-kpi__label">Highest Cost Service</div>
            <div className="dashboard-kpi__value">
              {topService}
            </div>
          </div>
          <div className="dashboard-kpi">
            <div className="dashboard-kpi__label">Accounts Scanned</div>
            <div className="dashboard-kpi__value dashboard-kpi__value--accent">
              {accountsCount}
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <Grid gridDefinition={scope === 'all'
        ? [{ colspan: { default: 12, l: 6 } }, { colspan: { default: 12, l: 6 } }]
        : [{ colspan: { default: 12 } }, { colspan: { default: 12 } }]}
      >
        <div className="dashboard-panel">
        <Container header={<Header variant="h2">Cost by Category</Header>}>
          <PieChart
            data={categoryChartData}
            detailPopoverContent={(datum, sum) => [
              { key: "Category", value: datum.title },
              { key: "Cost", value: currencyFormatter(datum.value) },
              { key: "Percentage", value: `${((datum.value / sum) * 100).toFixed(1)}%` }
            ]}
            segmentDescription={(datum, sum) => `${((datum.value / sum) * 100).toFixed(1)}%`}
            empty={<Box textAlign="center" color="text-status-inactive">No category data available</Box>}
            statusType={isLoading ? 'loading' : error ? 'error' : 'finished'}
            hideFilter
            size="large"
          />
        </Container>
        </div>

        <div className="dashboard-panel">
        <Container header={<Header variant="h2">Monthly Trend</Header>}>
          <BarChart
            series={monthlyTrendData}
            xDomain={data ? Object.keys(data.monthly_trend || {}) : []}
            yDomain={[0, data && Object.keys(data.monthly_trend || {}).length > 0 ? Math.max(...Object.values(data.monthly_trend)) * 1.1 : 10]}
            detailPopoverSeriesContent={(datum) => [
              { key: "Month", value: String(datum.x) },
              { key: "Total Cost", value: currencyFormatter(datum.y as number) },
            ] as any}
            empty={<Box textAlign="center" color="text-status-inactive">No monthly trend data available</Box>}
            statusType={isLoading ? 'loading' : error ? 'error' : 'finished'}
            hideFilter
            hideLegend
          />
        </Container>
        </div>
      </Grid>

      {scope === 'all' && (
        <div className="dashboard-panel">
        <Container header={<Header variant="h2">Cost by Account</Header>}>
          <BarChart
            series={accountChartData}
            xDomain={data ? Object.keys(data.cost_by_account) : []}
            yDomain={[0, data && Object.keys(data.cost_by_account).length > 0 ? Math.max(...Object.values(data.cost_by_account)) * 1.1 : 10]}
            detailPopoverSeriesContent={(datum) => [
              { key: "Account", value: String(datum.x) },
              { key: "Total Cost", value: currencyFormatter(datum.y as number) },
            ] as any}
            empty={<Box textAlign="center" color="text-status-inactive">No account data available</Box>}
            statusType={isLoading ? 'loading' : error ? 'error' : 'finished'}
            hideFilter
            hideLegend
          />
        </Container>
        </div>
      )}

      {/* Detailed Services Table */}
      <div className="dashboard-panel">
      <Container>
        <Table
          header={
            <Header 
              variant="h2" 
              counter={filteredServices.length ? `(${filteredServices.length})` : ''}
              description={`Itemized list of all AWS services incurring costs over the last ${periodMonths} month${periodMonths > 1 ? 's' : ''}.`}
            >
              All AWS Services
            </Header>
          }
          items={filteredServices}
          loading={isLoading}
          loadingText="Retrieving service costs..."
          filter={
            <TextFilter
              filteringText={filteringText}
              onChange={({ detail }) => setFilteringText(detail.filteringText)}
              filteringPlaceholder="Search by service name or category..."
            />
          }
          columnDefinitions={[
            { id: 'service', header: 'Service Name', cell: item => <span style={{fontWeight: 'bold'}}>{item.service_name}</span> },
            { id: 'category', header: 'Category', cell: item => item.category },
            { id: 'cost', header: 'Total Cost', cell: item => currencyFormatter(item.cost) },
            { 
              id: 'percentage', 
              header: '% of Total', 
              cell: item => (
                <Box color={item.cost / (data?.total_cost || 1) > 0.2 ? "text-status-error" : "text-status-info"}>
                  {((item.cost / (data?.total_cost || 1)) * 100).toFixed(2)}%
                </Box>
              )
            },
          ]}
          empty={
            <Box textAlign="center" padding={{ bottom: "s" }} variant="p" color="inherit">
              {error ? `Error: ${error}` : "No services found matching your criteria."}
            </Box>
          }
          variant="embedded"
          stripedRows
        />
      </Container>
      </div>
      {ConfirmModal}
    </div>
  );
}
