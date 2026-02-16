import React, { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Select,
  DatePicker,
  Button,
  Space,
  Tag,
  Typography,
  Input,
  Row,
  Col,
  Modal,
  Descriptions,
  Alert,
  Empty,
  Spin,
  message
} from 'antd';
import {
  ReloadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import dayjs, { formatJakartaTime } from '../utils/dayjs';
import apiClient from '../config/api';
import LogDetailModal from '../components/logs/LogDetailModal';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const IntegrationLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  const [filters, setFilters] = useState({
    integration_name: undefined,
    status: undefined,
    dateRange: null
  });
  const [integrations, setIntegrations] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  useEffect(() => {
    fetchIntegrations();
    fetchLogs();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchIntegrations = async () => {
    try {
      const response = await apiClient.get('/logs/integrations/list');
      setIntegrations(response.data.integrations || []);
    } catch (error) {
      console.error('Error fetching integrations:', error);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize
      };

      if (filters.integration_name) {
        params.integration_name = filters.integration_name;
      }

      if (filters.status) {
        params.status = filters.status;
      }

      if (filters.dateRange && filters.dateRange.length === 2) {
        params.start_date = filters.dateRange[0].startOf('day').toISOString();
        params.end_date = filters.dateRange[1].endOf('day').toISOString();
      }

      const response = await apiClient.get('/logs', { params });
      setLogs(response.data.data || []);
      setPagination({
        ...pagination,
        total: response.data.pagination?.total || 0
      });
    } catch (error) {
      console.error('Error fetching logs:', error);
      message.error('Failed to fetch integration logs');
    } finally {
      setLoading(false);
    }
  };

  const handleTableChange = (newPagination) => {
    setPagination({
      ...pagination,
      current: newPagination.current,
      pageSize: newPagination.pageSize
    });
  };

  const handleFilterChange = (key, value) => {
    setFilters({
      ...filters,
      [key]: value
    });
    setPagination({
      ...pagination,
      current: 1 // Reset to first page when filter changes
    });
  };

  const handleResetFilters = () => {
    setFilters({
      integration_name: undefined,
      status: undefined,
      dateRange: null
    });
    setPagination({
      ...pagination,
      current: 1
    });
  };

  const handleViewDetails = async (log) => {
    try {
      const response = await apiClient.get(`/logs/${log.id}`);
      setSelectedLog(response.data);
      setDetailModalVisible(true);
    } catch (error) {
      console.error('Error fetching log details:', error);
      message.error('Failed to fetch log details');
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

  const formatDuration = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      sorter: (a, b) => a.id - b.id
    },
    {
      title: 'Integration',
      dataIndex: 'integration_name',
      key: 'integration_name',
      width: 180,
      render: (text) => <Tag>{text}</Tag>
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
      title: 'Duration',
      dataIndex: 'duration_ms',
      key: 'duration_ms',
      width: 100,
      render: (ms) => formatDuration(ms || 0)
    },
    {
      title: 'Started At',
      dataIndex: 'started_at',
      key: 'started_at',
      width: 180,
      render: (date) => formatJakartaTime(date)
    },
    {
      title: 'Completed At',
      dataIndex: 'completed_at',
      key: 'completed_at',
      width: 180,
      render: (date) => formatJakartaTime(date)
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetails(record)}
        >
          Details
        </Button>
      )
    }
  ];

  return (
    <div>
      <Title level={2}>Integration Logs</Title>
      
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Select
              placeholder="Filter by Integration"
              style={{ width: '100%' }}
              allowClear
              value={filters.integration_name}
              onChange={(value) => handleFilterChange('integration_name', value)}
            >
              {integrations.map((name) => (
                <Select.Option key={name} value={name}>
                  {name}
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Select
              placeholder="Filter by Status"
              style={{ width: '100%' }}
              allowClear
              value={filters.status}
              onChange={(value) => handleFilterChange('status', value)}
            >
              <Select.Option value="SUCCESS">Success</Select.Option>
              <Select.Option value="FAILED">Failed</Select.Option>
              <Select.Option value="PARTIAL">Partial</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8} lg={8}>
            <RangePicker
              style={{ width: '100%' }}
              value={filters.dateRange}
              onChange={(dates) => handleFilterChange('dateRange', dates)}
              showTime
              format="YYYY-MM-DD HH:mm:ss"
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Space>
              <Button onClick={fetchLogs} icon={<ReloadOutlined />}>
                Refresh
              </Button>
              <Button onClick={handleResetFilters}>Reset</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} logs`,
            pageSizeOptions: ['10', '20', '50', '100']
          }}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
          locale={{
            emptyText: <Empty description="No integration logs found" />
          }}
        />
      </Card>

      {selectedLog && (
        <LogDetailModal
          visible={detailModalVisible}
          logData={selectedLog}
          onClose={() => {
            setDetailModalVisible(false);
            setSelectedLog(null);
          }}
        />
      )}
    </div>
  );
};

export default IntegrationLogs;
