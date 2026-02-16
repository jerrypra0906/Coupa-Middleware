import React, { useEffect, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Statistic,
  Alert,
  Descriptions,
  message,
  Tabs
} from 'antd';
import {
  PlayCircleOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import apiClient from '../config/api';
import { formatJakartaTime } from '../utils/dayjs';

const { Title, Text } = Typography;

const Contracts = () => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    supplierItems: {
      ready: 0,
      processed: 0,
      failed: 0
    },
    contractHeaders: {
      ready: 0,
      processed: 0,
      failed: 0
    },
    recentLogs: []
  });
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetchStats();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Fetch contract-specific stats
      const [logsResponse, configResponse] = await Promise.all([
        apiClient.get('/logs', {
          params: {
            integration_name: 'contracts-header-to-coupa',
            limit: 10,
            page: 1
          }
        }),
        apiClient.get('/schedulers')
      ]);

      const contractsHeaderConfig = configResponse.data.data?.find(c => c.module_name === 'contracts-header-to-coupa');
      const supplierItemConfig = configResponse.data.data?.find(c => c.module_name === 'supplieritem-to-coupa');
      const tokenConfig = configResponse.data.data?.find(c => c.module_name === 'token-to-coupa');
      const recentLogs = logsResponse.data.data?.logs || [];

      // Calculate stats from recent logs
      const supplierItemLogs = recentLogs.filter(log => 
        log.integration_name === 'supplieritem-to-coupa' && 
        log.errors?.some(err => err.field_name === 'COUPA_SUPPLIER_ITEM')
      );
      const contractHeaderLogs = recentLogs.filter(log =>
        log.integration_name === 'contracts-header-to-coupa' &&
        log.errors?.some(err => err.field_name === 'COUPA_CONTRACT_HEADER')
      );

      setStats({
        supplierItems: {
          ready: 0, // Would need backend endpoint to get this
          processed: supplierItemLogs.reduce((sum, log) => sum + (log.success_count || 0), 0),
          failed: supplierItemLogs.reduce((sum, log) => sum + (log.error_count || 0), 0)
        },
        contractHeaders: {
          ready: 0, // Would need backend endpoint to get this
          processed: contractHeaderLogs.reduce((sum, log) => sum + (log.success_count || 0), 0),
          failed: contractHeaderLogs.reduce((sum, log) => sum + (log.error_count || 0), 0)
        },
        recentLogs: recentLogs.slice(0, 5),
        contractsHeaderConfig: contractsHeaderConfig,
        supplierItemConfig: supplierItemConfig,
        tokenConfig: tokenConfig
      });
    } catch (error) {
      console.error('Error fetching contract stats:', error);
      message.error('Failed to load contract statistics');
    } finally {
      setLoading(false);
    }
  };

  const triggerIntegration = async (moduleName) => {
    setRunning(true);
    try {
      const response = await apiClient.post(`/schedulers/${moduleName}/trigger`);
      message.success(`${moduleName} integration triggered successfully`);
      setTimeout(() => {
        fetchStats();
      }, 2000);
    } catch (error) {
      console.error('Error triggering integration:', error);
      message.error(error.response?.data?.message || 'Failed to trigger integration');
    } finally {
      setRunning(false);
    }
  };

  const getStatusTag = (status) => {
    const statusConfig = {
      SUCCESS: { color: 'success', icon: <CheckCircleOutlined /> },
      FAILED: { color: 'error', icon: <CloseCircleOutlined /> },
      PARTIAL: { color: 'warning', icon: <ExclamationCircleOutlined /> }
    };
    const config = statusConfig[status] || { color: 'default', icon: null };
    return (
      <Tag color={config.color} icon={config.icon}>
        {status}
      </Tag>
    );
  };

  const logColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => getStatusTag(status)
    },
    {
      title: 'Records',
      key: 'records',
      width: 150,
      render: (_, record) => (
        <span>
          <Tag color="success">{record.success_count || 0}</Tag> /{' '}
          <Tag color="error">{record.error_count || 0}</Tag> /{' '}
          <strong>{record.total_records || 0}</strong>
        </span>
      )
    },
    {
      title: 'Started At',
      dataIndex: 'started_at',
      key: 'started_at',
      width: 180,
      render: (date) => formatJakartaTime(date)
    }
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={2} style={{ marginBottom: 0 }}>Contracts Integration</Title>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchStats}
            loading={loading}
          >
            Refresh
          </Button>
          <Space>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={() => triggerIntegration('contracts-header-to-coupa')}
              loading={running}
              disabled={!stats.contractsHeaderConfig?.is_active}
            >
              Run Contract Header
            </Button>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={() => triggerIntegration('supplieritem-to-coupa')}
              loading={running}
              disabled={!stats.supplierItemConfig?.is_active}
            >
              Run Supplier Item
            </Button>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={() => triggerIntegration('token-to-coupa')}
              loading={running}
              disabled={!stats.tokenConfig?.is_active}
            >
              Run Token
            </Button>
          </Space>
        </Space>
      </Row>

      {(!stats.contractsHeaderConfig?.is_active && 
        !stats.supplierItemConfig?.is_active && 
        !stats.tokenConfig?.is_active) && (
        <Alert
          message="Contracts Integrations are Disabled"
          description="All contract integration schedulers are currently disabled. Enable them in Scheduler Configuration to run automatically."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="Supplier Items Ready"
              value={stats.supplierItems.ready}
              prefix={<InfoCircleOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Items with finished_update_sap_oa = TRUE and finished_update_coupa_oa = FALSE
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="Supplier Items Processed"
              value={stats.supplierItems.processed}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Successfully updated in Coupa (last 10 runs)
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="Supplier Items Failed"
              value={stats.supplierItems.failed}
              valueStyle={{ color: '#f5222d' }}
              prefix={<CloseCircleOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Failed to update in Coupa (last 10 runs)
            </Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="Contract Headers Ready"
              value={stats.contractHeaders.ready}
              prefix={<InfoCircleOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Headers with contract_id, sap_oa_number, and finished_update_coupa_oa = FALSE
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="Contract Headers Processed"
              value={stats.contractHeaders.processed}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Successfully updated in Coupa (last 10 runs)
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="Contract Headers Failed"
              value={stats.contractHeaders.failed}
              valueStyle={{ color: '#f5222d' }}
              prefix={<CloseCircleOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Failed to update in Coupa (last 10 runs)
            </Text>
          </Card>
        </Col>
      </Row>

      <Card title="Integration Details" style={{ marginTop: 16 }}>
        <Tabs
          defaultActiveKey="overview"
          items={[
            {
              key: 'overview',
              label: 'Overview',
              children: (
                <>
                  <Descriptions bordered column={2}>
              <Descriptions.Item label="Contract Header Module">
                <Tag color={stats.contractsHeaderConfig?.is_active ? 'success' : 'default'}>
                  {stats.contractsHeaderConfig?.is_active ? 'Active' : 'Inactive'}
                </Tag> - {stats.contractsHeaderConfig?.execution_interval || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Supplier Item Module">
                <Tag color={stats.supplierItemConfig?.is_active ? 'success' : 'default'}>
                  {stats.supplierItemConfig?.is_active ? 'Active' : 'Inactive'}
                </Tag> - {stats.supplierItemConfig?.execution_interval || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Token Module">
                <Tag color={stats.tokenConfig?.is_active ? 'success' : 'default'}>
                  {stats.tokenConfig?.is_active ? 'Active' : 'Inactive'}
                </Tag> - {stats.tokenConfig?.execution_interval || 'N/A'}
              </Descriptions.Item>
                  </Descriptions>

                  <Alert
                    message="Integration Flow"
                    description={
                      <div>
                        <p><strong>1. Supplier Items:</strong> PUT API to update supplier items with sap-oa-line</p>
                        <p><strong>2. Contract Headers:</strong> PUT API to update contract headers with sap-oa and publish status</p>
                        <p><strong>3. Status Updates:</strong> Automatically marks finished_update_coupa_oa = TRUE on success</p>
                      </div>
                    }
                    type="info"
                    showIcon
                    style={{ marginTop: 16 }}
                  />
                </>
              )
            },
            {
              key: 'logs',
              label: 'Recent Logs',
              children: (
                <>
                  <Table
                    columns={logColumns}
                    dataSource={stats.recentLogs}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    locale={{
                      emptyText: 'No recent logs'
                    }}
                  />
                  <Button
                    type="link"
                    onClick={() => window.location.href = '/logs?integration_name=contracts-header-to-coupa'}
                    style={{ marginTop: 8 }}
                  >
                    View All Logs →
                  </Button>
                </>
              )
            }
          ]}
        />
      </Card>
    </div>
  );
};

export default Contracts;

