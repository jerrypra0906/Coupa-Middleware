import React, { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Select,
  Button,
  Space,
  Tag,
  Typography,
  Row,
  Col,
  Modal,
  Form,
  Input,
  message,
  Popconfirm,
  Empty,
  Spin,
  Checkbox,
  Tooltip
} from 'antd';
import {
  ReloadOutlined,
  RetweetOutlined,
  EditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined
} from '@ant-design/icons';
import dayjs, { formatJakartaTime } from '../utils/dayjs';
import apiClient from '../config/api';
import { useAuth } from '../context/AuthContext';
import ErrorEditModal from '../components/errors/ErrorEditModal';

const { Title } = Typography;
const { TextArea } = Input;

const ErrorDetails = () => {
  const { user } = useAuth();
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  const [filters, setFilters] = useState({
    integration_name: undefined,
    retry_status: undefined,
    log_id: undefined
  });
  const [integrations, setIntegrations] = useState([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedError, setSelectedError] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  const isAdmin = user?.role === 'ADMIN';
  const canRetry = isAdmin || user?.role === 'INTEGRATION_OPERATOR';

  useEffect(() => {
    fetchIntegrations();
    fetchErrors();
  }, []);

  useEffect(() => {
    fetchErrors();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchIntegrations = async () => {
    try {
      const response = await apiClient.get('/logs/integrations/list');
      setIntegrations(response.data.integrations || []);
    } catch (error) {
      console.error('Error fetching integrations:', error);
    }
  };

  const fetchErrors = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize
      };

      if (filters.integration_name) {
        params.integration_name = filters.integration_name;
      }

      if (filters.retry_status) {
        params.retry_status = filters.retry_status;
      }

      if (filters.log_id) {
        params.log_id = filters.log_id;
      }

      const response = await apiClient.get('/errors', { params });
      setErrors(response.data.data || []);
      setPagination({
        ...pagination,
        total: response.data.pagination?.total || 0
      });
    } catch (error) {
      console.error('Error fetching errors:', error);
      message.error('Failed to fetch error details');
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
      current: 1
    });
  };

  const handleResetFilters = () => {
    setFilters({
      integration_name: undefined,
      retry_status: undefined,
      log_id: undefined
    });
    setPagination({
      ...pagination,
      current: 1
    });
  };

  const handleRetry = async (errorId) => {
    try {
      await apiClient.post(`/errors/${errorId}/retry`);
      message.success('Error marked for retry');
      fetchErrors();
    } catch (error) {
      console.error('Error retrying:', error);
      message.error(error.response?.data?.error || 'Failed to retry error');
    }
  };

  const handleBulkRetry = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select errors to retry');
      return;
    }

    try {
      await apiClient.post('/errors/bulk-retry', {
        error_ids: selectedRowKeys
      });
      message.success(`Marked ${selectedRowKeys.length} errors for retry`);
      setSelectedRowKeys([]);
      fetchErrors();
    } catch (error) {
      console.error('Error bulk retrying:', error);
      message.error(error.response?.data?.error || 'Failed to retry errors');
    }
  };

  const handleEdit = (error) => {
    setSelectedError(error);
    setEditModalVisible(true);
  };

  const handleEditSuccess = () => {
    setEditModalVisible(false);
    setSelectedError(null);
    fetchErrors();
  };

  const handleViewDetails = async (error) => {
    try {
      const response = await apiClient.get(`/errors/${error.id}`);
      setSelectedError(response.data.error);
      setDetailModalVisible(true);
    } catch (error) {
      console.error('Error fetching error details:', error);
      message.error('Failed to fetch error details');
    }
  };

  const getRetryStatusTag = (status) => {
    const statusConfig = {
      PENDING: { color: 'default', text: 'Pending' },
      RETRYING: { color: 'processing', text: 'Retrying' },
      RETRIED: { color: 'success', text: 'Retried' },
      IGNORED: { color: 'warning', text: 'Ignored' }
    };

    const config = statusConfig[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const rowSelection = canRetry ? {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
    getCheckboxProps: (record) => ({
      disabled: record.retry_status === 'RETRYING' || record.retry_status === 'RETRIED'
    })
  } : null;

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
      width: 150,
      render: (text) => text ? <Tag>{text}</Tag> : '-'
    },
    {
      title: 'Log ID',
      dataIndex: 'integration_log_id',
      key: 'integration_log_id',
      width: 100
    },
    {
      title: 'Line #',
      dataIndex: 'line_number',
      key: 'line_number',
      width: 80
    },
    {
      title: 'Field',
      dataIndex: 'field_name',
      key: 'field_name',
      width: 120
    },
    {
      title: 'Error Message',
      dataIndex: 'error_message',
      key: 'error_message',
      ellipsis: {
        showTitle: false
      },
      render: (text) => (
        <Tooltip placement="topLeft" title={text}>
          {text}
        </Tooltip>
      )
    },
    {
      title: 'Retry Status',
      dataIndex: 'retry_status',
      key: 'retry_status',
      width: 120,
      render: (status) => getRetryStatusTag(status)
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date) => formatJakartaTime(date)
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetails(record)}
            size="small"
          >
            View
          </Button>
          {canRetry && record.retry_status !== 'RETRYING' && record.retry_status !== 'RETRIED' && (
            <Popconfirm
              title="Retry this error?"
              onConfirm={() => handleRetry(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Button
                type="link"
                icon={<RetweetOutlined />}
                size="small"
              >
                Retry
              </Button>
            </Popconfirm>
          )}
          {isAdmin && (
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              size="small"
            >
              Edit
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <Title level={2}>Error Details</Title>
      
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
              placeholder="Filter by Retry Status"
              style={{ width: '100%' }}
              allowClear
              value={filters.retry_status}
              onChange={(value) => handleFilterChange('retry_status', value)}
            >
              <Select.Option value="PENDING">Pending</Select.Option>
              <Select.Option value="RETRYING">Retrying</Select.Option>
              <Select.Option value="RETRIED">Retried</Select.Option>
              <Select.Option value="IGNORED">Ignored</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Input
              placeholder="Filter by Log ID"
              type="number"
              value={filters.log_id}
              onChange={(e) => handleFilterChange('log_id', e.target.value ? parseInt(e.target.value) : undefined)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Space>
              <Button onClick={fetchErrors} icon={<ReloadOutlined />}>
                Refresh
              </Button>
              {canRetry && selectedRowKeys.length > 0 && (
                <Popconfirm
                  title={`Retry ${selectedRowKeys.length} selected errors?`}
                  onConfirm={handleBulkRetry}
                  okText="Yes"
                  cancelText="No"
                >
                  <Button type="primary" icon={<RetweetOutlined />}>
                    Bulk Retry ({selectedRowKeys.length})
                  </Button>
                </Popconfirm>
              )}
              <Button onClick={handleResetFilters}>Reset</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={errors}
          rowKey="id"
          loading={loading}
          rowSelection={rowSelection}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} errors`,
            pageSizeOptions: ['10', '20', '50', '100']
          }}
          onChange={handleTableChange}
          scroll={{ x: 1400 }}
          locale={{
            emptyText: <Empty description="No errors found" />
          }}
        />
      </Card>

      {selectedError && (
        <>
          <ErrorEditModal
            visible={editModalVisible}
            error={selectedError}
            onSuccess={handleEditSuccess}
            onCancel={() => {
              setEditModalVisible(false);
              setSelectedError(null);
            }}
          />
          <Modal
            title="Error Detail"
            open={detailModalVisible}
            onCancel={() => {
              setDetailModalVisible(false);
              setSelectedError(null);
            }}
            footer={null}
            width={800}
          >
            {selectedError && (
              <div>
                <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 4, maxHeight: 400, overflow: 'auto' }}>
                  {JSON.stringify(selectedError, null, 2)}
                </pre>
              </div>
            )}
          </Modal>
        </>
      )}
    </div>
  );
};

export default ErrorDetails;
