import React, { useState, useEffect } from 'react';
import {
  Container,
  Header,
  Button,
  Box,
  SpaceBetween,
  Alert,
  ProgressBar,
  Badge,
  FormField,
  Input,
  ColumnLayout,
  Cards,
  Tabs,
} from '@cloudscape-design/components';
import { apiClient } from '../services/api/apiClient';
import '../styles/monitoring-dashboard.css';

interface MonitoringAlert {
  alert_id: string;
  alert_type: string;
  severity: string;
  title: string;
  description: string;
  resource_id?: string;
  account_id?: string;
  timestamp: string;
  metrics?: Record<string, any>;
  context?: Record<string, any>;
  status: string;
}

interface MonitoringStatus {
  status: string;
  is_running: boolean;
  configuration?: {
    check_interval_minutes: number;
    cost_spike_threshold: number;
    monitored_accounts: number;
  };
  alerts_pending: number;
}

interface NotificationConfig {
  channel: 'TEAMS' | 'SLACK';
  webhook_url: string;
}

export const MonitoringDashboard: React.FC = () => {
  const [monitoringStatus, setMonitoringStatus] = useState<MonitoringStatus | null>(null);
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingNotification, setTestingNotification] = useState(false);
  const [notificationConfig, setNotificationConfig] = useState<NotificationConfig>({
    channel: 'TEAMS',
    webhook_url: '',
  });
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);

  useEffect(() => {
    loadMonitoringStatus();
    loadAlerts();
    const interval = setInterval(() => {
      loadMonitoringStatus();
      loadAlerts();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadMonitoringStatus = async () => {
    try {
      const response = await apiClient.get('/monitoring/status');
      setMonitoringStatus(response.data);
    } catch (error) {
      console.error('Error loading monitoring status:', error);
    }
  };

  const loadAlerts = async () => {
    try {
      const response = await apiClient.get('/monitoring/alerts');
      if (response.data.alerts) {
        setAlerts(response.data.alerts);
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartMonitoring = async () => {
    setLoading(true);
    try {
      await apiClient.post('/monitoring/start', {}, {
        params: {
          check_interval_minutes: 15,
          cost_spike_threshold: 20.0,
        },
      });
      await loadMonitoringStatus();
    } catch (error) {
      console.error('Error starting monitoring:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStopMonitoring = async () => {
    setLoading(true);
    try {
      await apiClient.post('/monitoring/stop');
      await loadMonitoringStatus();
    } catch (error) {
      console.error('Error stopping monitoring:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestAlert = async () => {
    setTestingNotification(true);
    try {
      const response = await apiClient.post('/monitoring/send-test-alert', {}, {
        params: { channel: notificationConfig.channel },
      });
      alert(`Test alert sent to ${notificationConfig.channel}!`);
    } catch (error) {
      alert(`Error sending test alert: ${error}`);
    } finally {
      setTestingNotification(false);
    }
  };

  const handleSaveNotificationConfig = async () => {
    try {
      await apiClient.post('/monitoring/configure-notification', {}, {
        params: {
          channel: notificationConfig.channel,
          webhook_url: notificationConfig.webhook_url,
        },
      });
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
      setShowConfigModal(false);
    } catch (error) {
      alert(`Error saving configuration: ${error}`);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return '#FF0000';
      case 'HIGH':
        return '#FF6600';
      case 'MEDIUM':
        return '#FFA500';
      case 'LOW':
        return '#FFFF00';
      default:
        return '#0078D4';
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, any> = {
      CRITICAL: { color: 'red' },
      HIGH: { color: 'orange' },
      MEDIUM: { color: 'yellow' },
      LOW: { color: 'blue' },
      INFO: { color: 'green' },
    };
    return colors[severity] || colors.INFO;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="monitoring-dashboard">
      <Container>
        <SpaceBetween size="l">
          <Header
            variant="h1"
            description="24/7 Autonomous Monitoring for Cost Spikes, Alarms, and Security Vulnerabilities"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                {monitoringStatus?.is_running ? (
                  <Button onClick={handleStopMonitoring} loading={loading}>
                    Stop Monitoring
                  </Button>
                ) : (
                  <Button onClick={handleStartMonitoring} loading={loading} variant="primary">
                    Start Monitoring
                  </Button>
                )}
                <Button onClick={() => setShowConfigModal(true)} variant="normal">
                  Configure Notifications
                </Button>
              </SpaceBetween>
            }
          >
            Continuous Monitoring
          </Header>

          {configSaved && (
            <Alert type="success" dismissible>
              Notification configuration saved successfully!
            </Alert>
          )}

          {monitoringStatus && (
            <Container>
              <ColumnLayout columns={3} variant="text-grid">
                <div>
                  <Box variant="h4">Status</Box>
                  <Badge color={monitoringStatus.is_running ? 'green' : 'red'}>
                    {monitoringStatus.is_running ? 'Running' : 'Stopped'}
                  </Badge>
                </div>
                <div>
                  <Box variant="h4">Check Interval</Box>
                  <Box color="text-status-inactive">
                    {monitoringStatus.configuration?.check_interval_minutes} minutes
                  </Box>
                </div>
                <div>
                  <Box variant="h4">Pending Alerts</Box>
                  <Box color="text-status-warning">{monitoringStatus.alerts_pending}</Box>
                </div>
              </ColumnLayout>
            </Container>
          )}

          <Tabs
            tabs={[
              {
                label: `Alerts (${alerts.length})`,
                id: 'alerts',
                content: (
                  <SpaceBetween size="m">
                    {alerts.length === 0 ? (
                      <Alert type="info">No alerts received yet.</Alert>
                    ) : (
                      <Cards
                        items={alerts}
                        cardDefinition={{
                          header: (item) => (
                            <SpaceBetween direction="horizontal" size="s">
                              <span>{item.title}</span>
                              <Badge {...getSeverityBadge(item.severity)}>
                                {item.severity}
                              </Badge>
                            </SpaceBetween>
                          ),
                          sections: [
                            {
                              id: 'content',
                              content: (item) => (
                                <SpaceBetween size="s">
                                  <div>
                                    <strong>Type:</strong> {item.alert_type}
                                  </div>
                                  <div>
                                    <strong>Description:</strong> {item.description}
                                  </div>
                                  {item.account_id && (
                                    <div>
                                      <strong>Account:</strong> {item.account_id}
                                    </div>
                                  )}
                                  {item.resource_id && (
                                    <div>
                                      <strong>Resource:</strong> {item.resource_id}
                                    </div>
                                  )}
                                  <div>
                                    <strong>Timestamp:</strong> {formatTimestamp(item.timestamp)}
                                  </div>
                                  {item.metrics && Object.keys(item.metrics).length > 0 && (
                                    <div>
                                      <strong>Metrics:</strong>
                                      <ul>
                                        {Object.entries(item.metrics).map(([key, value]) => (
                                          <li key={key}>
                                            {key}: {JSON.stringify(value)}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </SpaceBetween>
                              ),
                            },
                          ],
                        }}
                        visibleSections={['header', 'content']}
                      />
                    )}
                  </SpaceBetween>
                ),
              },
              {
                label: 'Configuration',
                id: 'config',
                content: (
                  <SpaceBetween size="l">
                    <Alert type="info">
                      Configure Microsoft Teams or Slack webhooks to receive automated alerts.
                    </Alert>

                    <Box>
                      <h3>Test Notification</h3>
                      <SpaceBetween size="s" direction="horizontal">
                        <Button
                          onClick={handleSendTestAlert}
                          loading={testingNotification}
                          disabled={!notificationConfig.webhook_url}
                        >
                          Send Test Alert
                        </Button>
                        <Box color="text-status-inactive">
                          {notificationConfig.webhook_url
                            ? `Testing ${notificationConfig.channel}`
                            : 'Configure webhook URL first'}
                        </Box>
                      </SpaceBetween>
                    </Box>

                    <Box>
                      <h3>Active Configuration</h3>
                      {notificationConfig.webhook_url ? (
                        <Alert type="success">
                          {notificationConfig.channel} webhook is configured and active
                        </Alert>
                      ) : (
                        <Alert type="warning">
                          No notification webhook configured. Alerts will be stored but not sent.
                        </Alert>
                      )}
                    </Box>

                    <Button onClick={() => setShowConfigModal(true)} variant="primary">
                      Update Configuration
                    </Button>
                  </SpaceBetween>
                ),
              },
            ]}
          />

          {showConfigModal && (
            <Container>
              <SpaceBetween size="m">
                <Alert type="info">
                  Add your Microsoft Teams or Slack webhook URL to receive automated notifications.
                </Alert>

                <FormField label="Notification Channel">
                  <select
                    value={notificationConfig.channel}
                    onChange={(e) =>
                      setNotificationConfig({
                        ...notificationConfig,
                        channel: e.target.value as 'TEAMS' | 'SLACK',
                      })
                    }
                    style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                  >
                    <option value="TEAMS">Microsoft Teams</option>
                    <option value="SLACK">Slack</option>
                  </select>
                </FormField>

                <FormField label="Webhook URL">
                  <Input
                    value={notificationConfig.webhook_url}
                    onChange={(e) =>
                      setNotificationConfig({
                        ...notificationConfig,
                        webhook_url: e.detail.value,
                      })
                    }
                    placeholder={
                      notificationConfig.channel === 'TEAMS'
                        ? 'https://outlook.webhook.office.com/...'
                        : 'https://hooks.slack.com/services/...'
                    }
                  />
                </FormField>

                <SpaceBetween direction="horizontal" size="xs">
                  <Button onClick={handleSaveNotificationConfig} variant="primary">
                    Save Configuration
                  </Button>
                  <Button onClick={() => setShowConfigModal(false)}>Cancel</Button>
                </SpaceBetween>
              </SpaceBetween>
            </Container>
          )}
        </SpaceBetween>
      </Container>
    </div>
  );
};
