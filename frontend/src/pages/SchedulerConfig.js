import React, { useEffect, useState } from 'react';
import {
  Table,
  Card,
  Button,
  Space,
  Tag,
  Switch,
  Modal,
  Form,
  Input,
  Select,
  Typography,
  Alert,
  App,
  Row
} from 'antd';
import {
  EditOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  QuestionCircleOutlined,
  FileSyncOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import apiClient from '../config/api';
import { formatJakartaTime } from '../utils/dayjs';

const { Title, Text } = Typography;

const integrationModes = ['API', 'CSV', 'BOTH'];
const retryModes = ['AUTOMATIC', 'MANUAL'];

const SchedulerConfig = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [refreshMs, setRefreshMs] = useState(30000);
  const [form] = Form.useForm();
  const [currentIntegrationMode, setCurrentIntegrationMode] = useState(null);
  
  // Watch integration_mode changes
  const integrationMode = Form.useWatch('integration_mode', form);
  
  // Update state when integration mode changes
  useEffect(() => {
    if (integrationMode) {
      setCurrentIntegrationMode(integrationMode);
    } else if (selectedConfig?.integration_mode) {
      setCurrentIntegrationMode(selectedConfig.integration_mode);
    }
  }, [integrationMode, selectedConfig]);

  useEffect(() => {
    fetchConfigs();
  }, []);

  // Auto-refresh with selectable interval
  useEffect(() => {
    const id = setInterval(() => {
      fetchConfigs();
    }, refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/schedulers');
      setConfigs(response.data.data || []);
    } catch (error) {
      console.error('Error fetching scheduler configs:', error);
      message.error('Failed to load scheduler configurations');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (config) => {
    setSelectedConfig(config);
    setCurrentIntegrationMode(config.integration_mode); // Set immediately
    let configJson = config.config_json || {};
    if (typeof configJson === 'string') {
      try {
        configJson = JSON.parse(configJson);
      } catch (e) {
        configJson = {};
      }
    }
    form.setFieldsValue({
      execution_interval: config.execution_interval,
      integration_mode: config.integration_mode,
      retry_mode: config.retry_mode || 'MANUAL',
      is_active: config.is_active,
      sap_endpoint: config.sap_endpoint,
      coupa_endpoint: config.coupa_endpoint,
      csv_naming_format: configJson.csv_naming_format || 'ExchangeRate_{timestamp}.csv',
      sftp_folder: configJson.sftp_folder || '',
      archive_path: configJson.archive_path || '',
      config_json: JSON.stringify(configJson, null, 2),
      email_notification_enabled: config.email_notification_enabled ?? false,
      email_on_success: config.email_on_success ?? false,
      email_on_failure: config.email_on_failure ?? true,
      email_on_partial: config.email_on_partial ?? true
    });
    setEditModalVisible(true);
  };

  const handleUpdate = async () => {
    try {
      const values = await form.validateFields();
      const parts = values.execution_interval.trim().split(/\s+/);
      if (parts.length < 5) {
        message.error('Cron expression should have at least 5 parts (e.g. */5 * * * *)');
        return;
      }
      
      // Build config_json based on integration mode
      let parsedConfig = {};
      
      if (values.integration_mode === 'CSV' || values.integration_mode === 'BOTH') {
        // Start from existing config_json on the selected config (if any)
        let existingConfig = {};
        if (selectedConfig?.config_json) {
          if (typeof selectedConfig.config_json === 'string') {
            try {
              existingConfig = JSON.parse(selectedConfig.config_json);
            } catch (e) {
              existingConfig = {};
            }
          } else {
            existingConfig = selectedConfig.config_json;
          }
        }

        parsedConfig = {
          ...existingConfig,
          csv_naming_format: values.csv_naming_format || existingConfig.csv_naming_format || 'ExchangeRate_{timestamp}.csv',
          ...(values.sftp_folder !== undefined ? { sftp_folder: values.sftp_folder } : {}),
          ...(values.archive_path !== undefined ? { archive_path: values.archive_path } : {}),
        };
      } else {
        // For API mode, parse config_json if provided
        // Allow template strings with unquoted variables (e.g., contract_header_staging.contract_id)
        if (values.config_json) {
          const configJsonStr = values.config_json.trim();
          
          // Check if it contains template variables (unquoted identifiers like contract_header_staging.contract_id)
          const templatePattern = /[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)+/;
          const hasTemplateVars = templatePattern.test(configJsonStr);
          
          if (hasTemplateVars) {
            // Contains template variables - store as template string
            parsedConfig = {
              _template: configJsonStr
            };
          } else {
            // No template variables - try to parse as regular JSON
            try {
              parsedConfig = JSON.parse(configJsonStr);
            } catch (e) {
              message.error('Config JSON is invalid. Must be valid JSON or contain template variables like contract_header_staging.contract_id');
              return;
            }
          }
        }
      }

      await apiClient.put(`/schedulers/${selectedConfig.module_name}`, {
        execution_interval: values.execution_interval,
        integration_mode: values.integration_mode,
        retry_mode: values.retry_mode,
        is_active: values.is_active,
        sap_endpoint: values.sap_endpoint,
        coupa_endpoint: values.coupa_endpoint,
        config_json: parsedConfig,
        email_notification_enabled: values.email_notification_enabled ?? false,
        email_on_success: values.email_on_success ?? false,
        email_on_failure: values.email_on_failure ?? true,
        email_on_partial: values.email_on_partial ?? true
      });

      message.success('Scheduler configuration updated');
      setEditModalVisible(false);
      setSelectedConfig(null);
      fetchConfigs();
    } catch (error) {
      if (error?.errorFields) return;
      console.error('Error updating scheduler:', error);
      message.error('Failed to update scheduler configuration');
    }
  };

  const handleToggleActive = async (config, checked) => {
    try {
      await apiClient.put(`/schedulers/${config.module_name}`, {
        ...config,
        is_active: checked,
        config_json: config.config_json || {},
      });
      message.success(`Scheduler ${checked ? 'activated' : 'deactivated'}`);
      fetchConfigs();
    } catch (error) {
      console.error('Error toggling scheduler:', error);
      message.error('Failed to update scheduler status');
    }
  };

  const handleManualTrigger = async (config) => {
    try {
      const response = await apiClient.post(`/schedulers/${config.module_name}/trigger`);
      message.success(response.data?.message || 'Manual trigger queued');
    } catch (error) {
      console.error('Error triggering scheduler:', error);
      message.error('Failed to trigger integration');
    }
  };

  const columns = [
    {
      title: 'Module',
      dataIndex: 'module_name',
      key: 'module_name',
      render: (text) => <Tag>{text}</Tag>
    },
    {
      title: 'Last Status',
      dataIndex: 'last_status',
      key: 'last_status',
      render: (status) => {
        const map = {
          SUCCESS: { color: 'green', text: 'Success' },
          FAILED: { color: 'red', text: 'Failed' },
          PARTIAL: { color: 'orange', text: 'Partial' },
        };
        const cfg = map[status] || { color: 'default', text: status || 'N/A' };
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      },
    },
    {
      title: 'Last Run',
      dataIndex: 'last_run_at',
      key: 'last_run_at',
      render: (date) => (date ? formatJakartaTime(date) : '—'),
    },
    {
      title: 'Next Run',
      dataIndex: 'next_run_at',
      key: 'next_run_at',
      render: (date) => (date ? formatJakartaTime(date) : '—'),
    },
    {
      title: 'Last Errors',
      key: 'last_error_count',
      render: (_, record) => (
        <Space>
          <Tag color="success">OK: {record.last_success_count || 0}</Tag>
          <Tag color="error">Err: {record.last_error_count || 0}</Tag>
        </Space>
      ),
    },
    {
      title: 'Execution Interval',
      dataIndex: 'execution_interval',
      key: 'execution_interval',
      render: (text) => (
        <Space>
          <ClockCircleOutlined />
          <Text>{text}</Text>
        </Space>
      )
    },
    {
      title: 'Mode',
      dataIndex: 'integration_mode',
      key: 'integration_mode',
      render: (mode) => <Tag color="blue">{mode}</Tag>
    },
    {
      title: 'Retry Mode',
      dataIndex: 'retry_mode',
      key: 'retry_mode',
      render: (mode) => <Tag color="purple">{mode || 'MANUAL'}</Tag>
    },
    {
      title: 'Active',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active, record) => (
        <Switch
          checked={active}
          onChange={(checked) => handleToggleActive(record, checked)}
          checkedChildren="On"
          unCheckedChildren="Off"
        />
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 250,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            Edit
          </Button>
          <Button
            type="link"
            icon={<PlayCircleOutlined />}
            onClick={() => handleManualTrigger(record)}
          >
            Trigger
          </Button>
          {(record.module_name === 'contracts-header-to-coupa' || 
            record.module_name === 'supplieritem-to-coupa' || 
            record.module_name === 'token-to-coupa') && (
            <Button
              type="link"
              icon={<FileSyncOutlined />}
              onClick={() => navigate('/contracts')}
            >
              View Contracts
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={2} style={{ marginBottom: 0 }}>Scheduler Configuration</Title>
        <Button
          type="primary"
          icon={<FileSyncOutlined />}
          onClick={() => navigate('/contracts')}
        >
          View Contracts Integration
        </Button>
      </Row>
      <Card
        title="Integration Schedules"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchConfigs}>
              Refresh
            </Button>
            <Select value={refreshMs} onChange={setRefreshMs} style={{ width: 140 }}>
              <Select.Option value={15000}>Refresh 15s</Select.Option>
              <Select.Option value={30000}>Refresh 30s</Select.Option>
              <Select.Option value={60000}>Refresh 60s</Select.Option>
            </Select>
          </Space>
        }
      >
        <Table
          dataSource={configs}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      <Modal
        title={`Edit Scheduler - ${selectedConfig?.module_name || ''}`}
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setSelectedConfig(null);
        }}
        onOk={handleUpdate}
        width={720}
        okText="Save"
        destroyOnClose={true}
      >
        <Form layout="vertical" form={form} key={selectedConfig?.module_name || 'form'}>
          <Form.Item
            label="Execution Interval (cron expression)"
            name="execution_interval"
            rules={[{ required: true, message: 'Execution interval is required' }]}
            tooltip={{
              title: (
                <div style={{ maxWidth: 400 }}>
                  <p><strong>Cron Format:</strong> 5 fields separated by spaces</p>
                  <p><strong>Format:</strong> <code>minute hour day month weekday</code></p>
                  <p><strong>Examples:</strong></p>
                  <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                    <li><code>0 * * * *</code> - Every hour at minute 0</li>
                    <li><code>*/5 * * * *</code> - Every 5 minutes</li>
                    <li><code>0 0 * * *</code> - Daily at midnight</li>
                    <li><code>0 9 * * 1-5</code> - Weekdays at 9 AM</li>
                    <li><code>0 0 1 * *</code> - First day of every month</li>
                  </ul>
                  <p><strong>Wildcards:</strong> * (any), */n (every n), n-m (range), n,m (list)</p>
                </div>
              ),
              icon: <QuestionCircleOutlined />
            }}
          >
            <Input placeholder="e.g. 0 * * * *" />
          </Form.Item>

          <Form.Item
            label="Integration Mode"
            name="integration_mode"
            rules={[{ required: true, message: 'Integration mode is required' }]}
          >
            <Select onChange={(value) => setCurrentIntegrationMode(value)}>
              {integrationModes.map((mode) => (
                <Select.Option key={mode} value={mode}>
                  {mode}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="Retry Mode"
            name="retry_mode"
            rules={[{ required: true, message: 'Retry mode is required' }]}
          >
            <Select>
              {retryModes.map((mode) => (
                <Select.Option key={mode} value={mode}>
                  {mode}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="Active"
            name="is_active"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>

          <Form.Item label="SAP Endpoint" name="sap_endpoint">
            <Input placeholder="/sap/opu/odata/..." />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => 
              prevValues.integration_mode !== currentValues.integration_mode
            }
          >
            {({ getFieldValue }) => {
              const integrationMode = getFieldValue('integration_mode');
              const isCSVMode = integrationMode === 'CSV' || integrationMode === 'BOTH';
              
              if (isCSVMode) {
                return (
                  <>
                    <Form.Item 
                      label="Coupa SFTP Folder Path"
                      name="sftp_folder"
                      tooltip="Absolute SFTP folder path where CSV files are read/written (e.g., /Outgoing/Contract or /Outgoing/Supplier Items)"
                    >
                      <Input placeholder="/Outgoing/Contract" />
                    </Form.Item>
                    <Form.Item 
                      label="Archive Path"
                      name="archive_path"
                      tooltip="Absolute SFTP folder path where successfully processed CSV files will be moved (e.g., /Archive/Outgoing/Contracts). Leave empty to disable archiving."
                    >
                      <Input placeholder="/Archive/Outgoing/Contracts" />
                    </Form.Item>
                    <Form.Item 
                      label="Coupa Endpoint (optional)"
                      name="coupa_endpoint"
                      tooltip="For CSV-based integrations this is usually not used; keep for backward compatibility or for modules that still rely on it"
                    >
                      <Input placeholder="/api/..." />
                    </Form.Item>
                  </>
                );
              }

              return (
                <Form.Item 
                  label="Coupa Endpoint" 
                  name="coupa_endpoint"
                  tooltip="API endpoint for Coupa integration"
                >
                  <Input placeholder="/api/..." />
                </Form.Item>
              );
            }}
          </Form.Item>

          {/* Archive Path - Force render for CSV/BOTH */}
          {(selectedConfig?.integration_mode === 'CSV' || selectedConfig?.integration_mode === 'BOTH' || currentIntegrationMode === 'CSV' || currentIntegrationMode === 'BOTH') && (
            <Form.Item 
              label="Archive Path"
              name="archive_path"
              tooltip="Absolute SFTP folder path where successfully processed CSV files will be moved (e.g., /Archive/Outgoing/Contracts). Leave empty to disable archiving."
            >
              <Input placeholder="/Archive/Outgoing/Contracts" />
            </Form.Item>
          )}

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => 
              prevValues.integration_mode !== currentValues.integration_mode
            }
          >
            {({ getFieldValue }) => {
              const integrationMode = getFieldValue('integration_mode');
              const isCSVMode = integrationMode === 'CSV' || integrationMode === 'BOTH';
              
              if (isCSVMode) {
                return (
                  <Form.Item
                    label="CSV Naming Format"
                    name="csv_naming_format"
                    rules={[{ required: true, message: 'CSV naming format is required' }]}
                    tooltip={{
                      title: (
                        <div style={{ maxWidth: 400 }}>
                          <p><strong>CSV File Naming Format</strong></p>
                          <p>Use placeholders that will be replaced when generating the CSV file:</p>
                          <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                            <li><code>{'{timestamp}'}</code> - ISO timestamp (e.g., 20251209120000)</li>
                            <li><code>{'{date}'}</code> - Date in YYYYMMDD format</li>
                            <li><code>{'{datetime}'}</code> - Date and time in YYYYMMDD_HHMMSS format</li>
                            <li><code>{'{module}'}</code> - Module name (e.g., exchange-rate)</li>
                          </ul>
                          <p><strong>Example:</strong> <code>ExchangeRate_{'{timestamp}'}.csv</code></p>
                          <p><strong>Result:</strong> <code>ExchangeRate_20251209120000.csv</code></p>
                          <p style={{ marginTop: 8, fontSize: '12px', color: '#ff4d4f' }}>
                            <strong>Note:</strong> The CSV file will be uploaded to the Coupa SFTP endpoint specified above.
                          </p>
                        </div>
                      ),
                      icon: <QuestionCircleOutlined />
                    }}
                  >
                    <Input 
                      placeholder="ExchangeRate_{timestamp}.csv" 
                      suffix=".csv"
                    />
                  </Form.Item>
                );
              } else {
                return (
                  <Form.Item
                    label="Config JSON"
                    name="config_json"
                    tooltip="Additional configuration stored as JSON"
                  >
                    <Input.TextArea rows={6} placeholder='{"sftp_folder": "ExchangeRates"}' />
                  </Form.Item>
                );
              }
            }}
          </Form.Item>

          <Form.Item
            label="Email Notifications"
            style={{ marginTop: 24, marginBottom: 0 }}
          >
            <Form.Item
              name="email_notification_enabled"
              valuePropName="checked"
              style={{ marginBottom: 16 }}
            >
              <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
              <span style={{ marginLeft: 8 }}>Enable email notifications for this scheduler</span>
            </Form.Item>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => 
              prevValues.email_notification_enabled !== currentValues.email_notification_enabled
            }
          >
            {({ getFieldValue }) => {
              const emailEnabled = getFieldValue('email_notification_enabled');
              
              if (!emailEnabled) {
                return null;
              }
              
              return (
                <>
                  <Form.Item
                    label="Send Email On"
                    style={{ marginTop: 16 }}
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Form.Item
                        name="email_on_success"
                        valuePropName="checked"
                        style={{ marginBottom: 8 }}
                      >
                        <Switch checkedChildren="On Success" unCheckedChildren="Off" />
                        <span style={{ marginLeft: 8 }}>Send email when integration succeeds</span>
                      </Form.Item>
                      <Form.Item
                        name="email_on_failure"
                        valuePropName="checked"
                        style={{ marginBottom: 8 }}
                      >
                        <Switch checkedChildren="On Failure" unCheckedChildren="Off" />
                        <span style={{ marginLeft: 8 }}>Send email when integration fails</span>
                      </Form.Item>
                      <Form.Item
                        name="email_on_partial"
                        valuePropName="checked"
                        style={{ marginBottom: 8 }}
                      >
                        <Switch checkedChildren="On Partial" unCheckedChildren="Off" />
                        <span style={{ marginLeft: 8 }}>Send email when integration partially succeeds (has errors but some records processed)</span>
                      </Form.Item>
                    </Space>
                  </Form.Item>
                </>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SchedulerConfig;

