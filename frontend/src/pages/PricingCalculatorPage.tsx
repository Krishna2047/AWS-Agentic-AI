import React, { useState } from 'react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Tabs from '@cloudscape-design/components/tabs';
import Button from '@cloudscape-design/components/button';
import FormField from '@cloudscape-design/components/form-field';
import Textarea from '@cloudscape-design/components/textarea';
import Select from '@cloudscape-design/components/select';
import FileUpload from '@cloudscape-design/components/file-upload';
import SegmentedControl from '@cloudscape-design/components/segmented-control';
import Alert from '@cloudscape-design/components/alert';
import Spinner from '@cloudscape-design/components/spinner';
import Box from '@cloudscape-design/components/box';
import Grid from '@cloudscape-design/components/grid';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Checkbox from '@cloudscape-design/components/checkbox';
import { apiClient } from '../services/api/apiClient';
import { useAccountStore } from '../store/accountStore';
import { useToast } from '../components/Toast/ToastContext';

interface PricingResult {
  total_monthly_cost: number;
  total_yearly_cost: number;
  services: Array<{
    name: string;
    monthly_cost: number;
    yearly_cost: number;
    details: string;
  }>;
  currency: string;
  region: string;
}

const INFRA_TYPES = [
  { id: 'new', label: 'New Infrastructure', description: 'Upload Terraform or CDK code' },
  { id: 'existing', label: 'Existing Infrastructure', description: 'Analyze configured AWS account' }
];

const CODE_TYPES = [
  { label: 'Terraform', value: 'terraform' },
  { label: 'AWS CDK', value: 'cdk' },
  { label: 'CloudFormation', value: 'cloudformation' }
];

const AWS_SERVICES = [
  { id: 'ec2', label: 'EC2 (Compute)', description: 'Virtual machines' },
  { id: 'rds', label: 'RDS (Database)', description: 'Managed databases' },
  { id: 's3', label: 'S3 (Storage)', description: 'Object storage' },
  { id: 'lambda', label: 'Lambda (Functions)', description: 'Serverless compute' },
  { id: 'dynamodb', label: 'DynamoDB (NoSQL)', description: 'NoSQL database' },
  { id: 'elasticache', label: 'ElastiCache (Cache)', description: 'In-memory cache' },
  { id: 'elbv2', label: 'ALB/NLB (Load Balancer)', description: 'Load balancing' },
  { id: 'cloudwatch', label: 'CloudWatch (Monitoring)', description: 'Monitoring & logs' },
  { id: 'sns', label: 'SNS (Notifications)', description: 'Message notifications' },
  { id: 'sqs', label: 'SQS (Queues)', description: 'Message queues' },
  { id: 'kms', label: 'KMS (Encryption)', description: 'Key management' },
  { id: 'iam', label: 'IAM (Identity)', description: 'Access management' }
];

export default function PricingCalculatorPage() {
  const { selectedAccount } = useAccountStore();
  const { showToast } = useToast();

  // UI State
  const [infraType, setInfraType] = useState<string>('new');
  const [activeTab, setActiveTab] = useState<string>('input');
  const [isLoading, setIsLoading] = useState(false);

  // New Infrastructure State
  const [codeType, setCodeType] = useState<{ label: string; value: string } | null>(CODE_TYPES[0]);
  const [codeFiles, setCodeFiles] = useState<File[]>([]);
  const [codeText, setCodeText] = useState('');

  // Existing Infrastructure State
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [region, setRegion] = useState<{ label: string; value: string } | null>(
    { label: 'us-east-1', value: 'us-east-1' }
  );

  // Results State
  const [pricingResult, setPricingResult] = useState<PricingResult | null>(null);
  const [error, setError] = useState('');

  const handleServiceToggle = (serviceId: string) => {
    const newServices = new Set(selectedServices);
    if (newServices.has(serviceId)) {
      newServices.delete(serviceId);
    } else {
      newServices.add(serviceId);
    }
    setSelectedServices(newServices);
  };

  const handleCalculatePricing = async () => {
    setError('');
    setIsLoading(true);

    try {
      let result;

      if (infraType === 'new') {
        if (!codeType) {
          throw new Error('Please select a code type');
        }

        let payload = {};
        if (codeFiles.length > 0) {
          // Read file contents
          const fileContents = await Promise.all(
            codeFiles.map(file => {
              return new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsText(file);
              });
            })
          );
          payload = {
            code_type: codeType.value,
            code_content: fileContents.join('\n'),
            account_name: selectedAccount?.id || 'default',
          };
        } else if (codeText.trim()) {
          payload = {
            code_type: codeType?.value || 'terraform',
            code_content: codeText,
            account_name: selectedAccount?.id || 'default',
          };
        } else {
          throw new Error('Please upload files or paste code');
        }

        result = await apiClient.calculatePricingFromCode(payload as { code_type: string; code_content: string; account_name: string });
      } else {
        if (selectedServices.size === 0) {
          throw new Error('Please select at least one service');
        }

        result = await apiClient.calculatePricingFromServices({
          account_name: selectedAccount?.id || 'default',
          services: Array.from(selectedServices),
          region: region?.value || 'us-east-1',
        });
      }

      setPricingResult(result);
      setActiveTab('results');
      showToast('Pricing calculation completed successfully', 'success');
    } catch (err: any) {
      const message = err.message || 'Failed to calculate pricing';
      setError(message);
      showToast(message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="pricing-calculator-page">
      <Tabs
        activeTabId={activeTab}
        onChange={({ detail }) => setActiveTab(detail.activeTabId)}
        tabs={[
          {
            label: 'Pricing Calculator',
            id: 'input',
            content: (
              <SpaceBetween size="l" direction="vertical">
                {/* Infrastructure Type Selection */}
                <Container
                  header={<Header variant="h2">Choose Infrastructure Type</Header>}
                >
                  <SpaceBetween size="m" direction="vertical">
                    <SegmentedControl
                      selectedId={infraType}
                      onChange={({ detail }) => setInfraType(detail.selectedId)}
                      options={INFRA_TYPES.map(type => ({
                        id: type.id,
                        text: type.label,
                      }))}
                    />
                    <Box color="text-body-secondary">
                      {INFRA_TYPES.find(t => t.id === infraType)?.description}
                    </Box>
                  </SpaceBetween>
                </Container>

                {/* New Infrastructure - Code Upload */}
                {infraType === 'new' && (
                  <Container
                    header={<Header variant="h2">Upload Infrastructure Code</Header>}
                  >
                    <SpaceBetween size="m" direction="vertical">
                      <FormField label="Code Type" description="Select your Infrastructure as Code format">
                        <Select
                          selectedOption={codeType}
                          onChange={({ detail }) => setCodeType(detail.selectedOption ? { label: detail.selectedOption.label || 'Terraform', value: detail.selectedOption.value || 'terraform' } : null)}
                          options={CODE_TYPES}
                        />
                      </FormField>

                      <FormField
                        label="Upload Files"
                        description="Upload .tf, .json, or .yaml files"
                      >
                        <FileUpload
                          onChange={({ detail }) => setCodeFiles(detail.value)}
                          value={codeFiles}
                          multiple={true}
                          accept=".tf,.json,.yaml,.yml"
                        />
                      </FormField>

                      <Box color="text-body-secondary">or</Box>

                      <FormField
                        label="Paste Code"
                        description="Or paste your infrastructure code directly"
                      >
                        <Textarea
                          value={codeText}
                          onChange={({ detail }) => setCodeText(detail.value)}
                          placeholder="Paste your Terraform, CloudFormation, or CDK code here..."
                          rows={15}
                        />
                      </FormField>

                      <Alert type="info">
                        💡 <strong>Tip:</strong> Paste your IaC code and we'll analyze it to calculate estimated AWS costs
                      </Alert>
                    </SpaceBetween>
                  </Container>
                )}

                {/* Existing Infrastructure - Service Selection */}
                {infraType === 'existing' && (
                  <Container
                    header={<Header variant="h2">Select AWS Services</Header>}
                  >
                    <SpaceBetween size="m" direction="vertical">
                      <FormField
                        label="Region"
                        description="Select the AWS region for your resources"
                      >
                        <Select
                          selectedOption={region}
                          onChange={({ detail }) => setRegion(detail.selectedOption ? { label: detail.selectedOption.label || 'us-east-1', value: detail.selectedOption.value || 'us-east-1' } : null)}
                          options={[
                            { label: 'us-east-1', value: 'us-east-1' },
                            { label: 'us-west-2', value: 'us-west-2' },
                            { label: 'eu-west-1', value: 'eu-west-1' },
                            { label: 'ap-southeast-1', value: 'ap-southeast-1' },
                          ]}
                        />
                      </FormField>

                      <FormField label="Services">
                        <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
                          {AWS_SERVICES.map(service => (
                            <Box key={service.id} padding="m">
                              <Checkbox
                                checked={selectedServices.has(service.id)}
                                onChange={() => handleServiceToggle(service.id)}
                              >
                                <strong>{service.label}</strong>
                                <br />
                                <Box color="text-body-secondary" fontSize="body-s">
                                  {service.description}
                                </Box>
                              </Checkbox>
                            </Box>
                          ))}
                        </Grid>
                      </FormField>

                      <Alert type="info">
                        ℹ️ <strong>Note:</strong> Estimates are based on typical configurations. Actual costs may vary based on your specific usage patterns.
                      </Alert>
                    </SpaceBetween>
                  </Container>
                )}

                {/* Error Display */}
                {error && (
                  <Alert type="error" header="Calculation Error">
                    {error}
                  </Alert>
                )}

                {/* Calculate Button */}
                <Box textAlign="center">
                  <Button
                    variant="primary"
                    onClick={handleCalculatePricing}
                    loading={isLoading}
                    disabled={
                      isLoading ||
                      (infraType === 'new' && !codeText.trim() && codeFiles.length === 0) ||
                      (infraType === 'existing' && selectedServices.size === 0)
                    }
                  >
                    {isLoading ? 'Calculating...' : 'Calculate Pricing'}
                  </Button>
                </Box>
              </SpaceBetween>
            ),
          },
          {
            label: 'Pricing Results',
            id: 'results',
            disabled: !pricingResult,
            content: pricingResult ? (
              <SpaceBetween size="l" direction="vertical">
                {/* Cost Summary */}
                <Container header={<Header variant="h2">Cost Summary</Header>}>
                  <ColumnLayout columns={3} variant="text-grid">
                    <div>
                      <Box variant="awsui-key-label">Monthly Cost</Box>
                      <Box variant="h1" color="text-status-success">
                        {formatCurrency(pricingResult.total_monthly_cost)}
                      </Box>
                    </div>
                    <div>
                      <Box variant="awsui-key-label">Yearly Cost</Box>
                      <Box variant="h1" color="text-status-success">
                        {formatCurrency(pricingResult.total_yearly_cost)}
                      </Box>
                    </div>
                    <div>
                      <Box variant="awsui-key-label">Region</Box>
                      <Box variant="h1">{pricingResult.region || region?.value}</Box>
                    </div>
                  </ColumnLayout>
                </Container>

                {/* Service Breakdown */}
                <Container header={<Header variant="h2">Service Breakdown</Header>}>
                  <SpaceBetween size="m" direction="vertical">
                    {pricingResult.services.map((service, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '12px',
                          borderBottom: '1px solid #e5e7eb'
                        }}
                      >
                        <SpaceBetween direction="horizontal" size="m">
                          <div style={{ flex: 1 }}>
                            <Box variant="awsui-key-label">{service.name}</Box>
                            <Box color="text-body-secondary" fontSize="body-s">
                              {service.details}
                            </Box>
                          </div>
                          <div>
                            <Box textAlign="right">
                              <Box variant="awsui-key-label">
                                {formatCurrency(service.monthly_cost)}/mo
                              </Box>
                              <Box color="text-body-secondary" fontSize="body-s">
                                {formatCurrency(service.yearly_cost)}/yr
                              </Box>
                            </Box>
                          </div>
                        </SpaceBetween>
                      </div>
                    ))}
                  </SpaceBetween>
                </Container>

                {/* Action Buttons */}
                <SpaceBetween direction="horizontal" size="m">
                  <Button onClick={() => setActiveTab('input')}>← Back to Calculator</Button>
                  <Button variant="primary">Export Estimate</Button>
                </SpaceBetween>
              </SpaceBetween>
            ) : null,
          },
        ]}
      />
    </div>
  );
}
