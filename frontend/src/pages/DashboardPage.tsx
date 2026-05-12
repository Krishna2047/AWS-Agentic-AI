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
import Select from '@cloudscape-design/components/select';
import DatePicker from '@cloudscape-design/components/date-picker';
import { useDashboardStore } from '../store/dashboardStore';
import { useAccountStore } from '../store/accountStore';
import { useToast } from '../components/Toast/ToastContext';
import { useConfirm } from '../components/ConfirmModal';
import { useAnalytics } from '../hooks/useAnalytics';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { Pagination } from '../components/Pagination';
import { SkeletonKPIs, SkeletonChart, SkeletonTable } from '../components/SkeletonLoader';
import { DashboardFilterSchema, validateInput } from '../utils/validation';
import { apiClient, type DashboardQueryFilters } from '../services/api/apiClient';

export default function DashboardPage() {
  const { data, isLoading, isExporting, fetchCosts, exportCosts, error } = useDashboardStore();
  const { selectedAccount } = useAccountStore();
  const { showToast } = useToast();
  const { confirm, ConfirmModal } = useConfirm();
  const { trackActionPerformed } = useAnalytics('DashboardPage');
  const [scope, setScope] = useState<'all' | 'selected'>('all');
  const [periodMonths, setPeriodMonths] = useState<3 | 6 | 12>(6);
  const [filteringText, setFilteringText] = useState('');
  const [filterErrors, setFilterErrors] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [dashboardFilters, setDashboardFilters] = useState<DashboardQueryFilters>({
    projectName: '',
    environment: '',
    ownership: '',
    costType: '',
    startDate: '',
    endDate: '',
  });
  const [appliedFilters, setAppliedFilters] = useState<DashboardQueryFilters>({});
  const [creditsFilter, setCreditsFilter] = useState<{ label: string; value: string } | null>({
    label: 'All Costs',
    value: 'all'
  });
  const [appliedCreditsFilter, setAppliedCreditsFilter] = useState('all');

  // Tag dropdowns
  const [availableTags, setAvailableTags] = useState<Record<string, { label: string; value: string }[]>>({
    projectName: [],
    environment: [],
    ownership: []
  });
  const [loadingTags, setLoadingTags] = useState(true);

  const selectedScopeAccount = scope === 'all' ? 'all' : (selectedAccount?.id || 'default');
  const normalizedFilters = useMemo<DashboardQueryFilters>(() => ({
    projectName: dashboardFilters.projectName?.trim() || undefined,
    environment: dashboardFilters.environment?.trim() || undefined,
    ownership: dashboardFilters.ownership?.trim() || undefined,
    costType: dashboardFilters.costType?.trim() || undefined,
    startDate: dashboardFilters.startDate || undefined,
    endDate: dashboardFilters.endDate || undefined,
  }), [dashboardFilters]);
  
  // Fetch available tags on component mount
  useEffect(() => {
    const fetchAvailableTags = async () => {
      try {
        setLoadingTags(true);
        const response = await apiClient.getAvailableTags('Project Name tag,Environment tag,Ownership tag');

        if (response.success && response.data) {
          const tags = response.data;

          // Transform tags into Cloudscape Select format
          const projectTags = (tags['Project Name tag'] || []).map((tag: string) => ({
            label: tag,
            value: tag
          }));
          const environmentTags = (tags['Environment tag'] || []).map((tag: string) => ({
            label: tag,
            value: tag
          }));
          const ownershipTags = (tags['Ownership tag'] || []).map((tag: string) => ({
            label: tag,
            value: tag
          }));

          setAvailableTags({
            projectName: projectTags,
            environment: environmentTags,
            ownership: ownershipTags
          });
        }
      } catch (error) {
        console.error('Error fetching tags:', error);
      } finally {
        setLoadingTags(false);
      }
    };

    fetchAvailableTags();
  }, []);

  // Refetch when the scope or selected account changes
  useEffect(() => {
    fetchCosts(selectedScopeAccount, periodMonths, appliedFilters);
  }, [selectedScopeAccount, periodMonths, appliedFilters, appliedCreditsFilter, fetchCosts]);

  const currencyFormatter = (value: number) => `$${value.toFixed(2)}`;

  const handleApplyFilters = async () => {
    const validation = validateInput(DashboardFilterSchema, dashboardFilters);
    if (!validation.valid) {
      setFilterErrors(validation.error || 'Validation failed');
      showToast(validation.error || 'Please fix the errors below', 'error');
      return;
    }

    setFilterErrors('');
    setCurrentPage(1);
    setAppliedFilters(normalizedFilters);
    setAppliedCreditsFilter(creditsFilter?.value || 'all');
    trackActionPerformed('apply_filters', {
      filters: normalizedFilters,
      creditsFilter: creditsFilter?.value || 'all'
    });
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
        setCreditsFilter({ label: 'All Costs', value: 'all' });
        setAppliedCreditsFilter('all');
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

  // Paginate filtered services
  const paginatedServices = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredServices.slice(startIdx, startIdx + pageSize);
  }, [filteredServices, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredServices.length / pageSize);

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
            <Select
              selectedOption={
                dashboardFilters.projectName
                  ? { label: dashboardFilters.projectName, value: dashboardFilters.projectName }
                  : null
              }
              onChange={({ detail }) =>
                setDashboardFilters((prev) => ({
                  ...prev,
                  projectName: detail.selectedOption?.value || ''
                }))
              }
              options={[
                { label: 'All Projects', value: '' },
                ...availableTags.projectName
              ]}
              disabled={loadingTags}
              placeholder={loadingTags ? 'Loading projects...' : 'Select project'}
              filteringType="auto"
            />
          </FormField>
          <FormField label="Environment tag">
            <Select
              selectedOption={
                dashboardFilters.environment
                  ? { label: dashboardFilters.environment, value: dashboardFilters.environment }
                  : null
              }
              onChange={({ detail }) =>
                setDashboardFilters((prev) => ({
                  ...prev,
                  environment: detail.selectedOption?.value || ''
                }))
              }
              options={[
                { label: 'All Environments', value: '' },
                ...availableTags.environment
              ]}
              disabled={loadingTags}
              placeholder={loadingTags ? 'Loading environments...' : 'Select environment'}
              filteringType="auto"
            />
          </FormField>
          <FormField label="Ownership tag">
            <Select
              selectedOption={
                dashboardFilters.ownership
                  ? { label: dashboardFilters.ownership, value: dashboardFilters.ownership }
                  : null
              }
              onChange={({ detail }) =>
                setDashboardFilters((prev) => ({
                  ...prev,
                  ownership: detail.selectedOption?.value || ''
                }))
              }
              options={[
                { label: 'All Owners', value: '' },
                ...availableTags.ownership
              ]}
              disabled={loadingTags}
              placeholder={loadingTags ? 'Loading owners...' : 'Select owner'}
              filteringType="auto"
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
            <FormField label="Credits Filter" description="View costs with or without applied credits">
              <Select
                selectedOption={creditsFilter}
                onChange={({ detail }) => {
                  if (detail.selectedOption) {
                    setCreditsFilter({
                      label: detail.selectedOption.label || 'All Costs',
                      value: detail.selectedOption.value || 'all'
                    });
                  }
                }}
                options={[
                  { label: 'All Costs', value: 'all', description: 'Show net costs after credits' },
                  { label: 'Without Credits', value: 'without_credits', description: 'Show actual usage costs' },
                  { label: 'With Credits Applied', value: 'with_credits', description: 'Show costs after credits' },
                ] as any}
              />
            </FormField>
          </Grid>
        </Box>
        <Box padding={{ top: 'm' }}>
          <Grid gridDefinition={[{ colspan: { default: 12, m: 4 } }, { colspan: { default: 12, m: 4 } }, { colspan: { default: 12, m: 4 } }]}>
            <div style={{ position: 'relative', zIndex: 10 }}>
              <FormField label="Start date" description="Select start date for analysis">
                <DatePicker
                  value={dashboardFilters.startDate || ''}
                  onChange={({ detail }) => setDashboardFilters((prev) => ({ ...prev, startDate: detail.value }))}
                  placeholder="YYYY-MM-DD"
                />
              </FormField>
            </div>
            <div style={{ position: 'relative', zIndex: 10 }}>
              <FormField label="End date" description="Select end date for analysis">
                <DatePicker
                  value={dashboardFilters.endDate || ''}
                  onChange={({ detail }) => setDashboardFilters((prev) => ({ ...prev, endDate: detail.value }))}
                  placeholder="YYYY-MM-DD"
                />
              </FormField>
            </div>
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
        <>
          {appliedCreditsFilter !== 'all' && data?.applied_credits && (
            <Alert type="info" header="Credits Filter Active">
              Showing costs {appliedCreditsFilter === 'without_credits' ? 'without' : 'with'} applied credits.
              {data?.applied_credits && (
                <span style={{ fontWeight: 'bold' }}>
                  {' '}Applied Credits: {currencyFormatter(Math.abs(data.applied_credits))}
                </span>
              )}
            </Alert>
          )}
          <div className="dashboard-kpis">
            <div className="dashboard-kpi">
              <div className="dashboard-kpi__label">
                Total Cost ({periodMonths} Month{periodMonths > 1 ? 's' : ''})
                {appliedCreditsFilter === 'without_credits' && <span style={{ fontSize: '0.8em' }}> (Actual Usage)</span>}
                {appliedCreditsFilter === 'with_credits' && <span style={{ fontSize: '0.8em' }}> (Net Cost)</span>}
              </div>
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
        </>
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
          items={paginatedServices}
          loading={isLoading}
          loadingText="Retrieving service costs..."
          filter={
            <TextFilter
              filteringText={filteringText}
              onChange={({ detail }) => {
                setFilteringText(detail.filteringText);
                setCurrentPage(1);
              }}
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
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredServices.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
            trackActionPerformed('change_page_size', { pageSize: newSize });
          }}
        />
      </Container>
      </div>
      {ConfirmModal}
    </div>
  );
}
