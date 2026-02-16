import React, { useEffect, useState } from 'react';
import {
  Table,
  Card,
  Button,
  Space,
  Tag,
  Typography,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Popconfirm,
  message
} from 'antd';
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import apiClient from '../config/api';
import { useAuth } from '../context/AuthContext';

const { Title } = Typography;
const notificationTypes = ['CRITICAL', 'CRITICAL_PARTIAL', 'ALL'];

const EmailConfig = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [loading, setLoading] = useState(false);
  const [recipients, setRecipients] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchRecipients();
  }, []);

  const fetchRecipients = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/email-config/recipients');
      setRecipients(response.data.data || []);
    } catch (error) {
      console.error('Error fetching recipients:', error);
      message.error('Failed to load email recipients');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (record = null) => {
    setEditing(record);
    form.setFieldsValue({
      email: record?.email,
      group_name: record?.group_name,
      notification_type: record?.notification_type || 'CRITICAL',
      is_active: record?.is_active ?? true,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await apiClient.put(`/email-config/recipients/${editing.id}`, values);
        message.success('Recipient updated');
      } else {
        await apiClient.post('/email-config/recipients', values);
        message.success('Recipient created');
      }
      setModalVisible(false);
      setEditing(null);
      fetchRecipients();
    } catch (error) {
      if (error?.errorFields) return;
      console.error('Error saving recipient:', error);
      message.error(error.response?.data?.error || 'Failed to save recipient');
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiClient.delete(`/email-config/recipients/${id}`);
      message.success('Recipient deleted');
      fetchRecipients();
    } catch (error) {
      console.error('Error deleting recipient:', error);
      message.error(error.response?.data?.error || 'Failed to delete recipient');
    }
  };

  const columns = [
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Group',
      dataIndex: 'group_name',
      key: 'group_name',
      render: (text) => <Tag>{text}</Tag>
    },
    {
      title: 'Type',
      dataIndex: 'notification_type',
      key: 'notification_type',
      render: (text) => <Tag color="blue">{text}</Tag>
    },
    {
      title: 'Active',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active) => <Tag color={active ? 'green' : 'red'}>{active ? 'Active' : 'Inactive'}</Tag>
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <Space>
          {isAdmin && (
            <Button type="link" icon={<EditOutlined />} onClick={() => openModal(record)}>
              Edit
            </Button>
          )}
          {isAdmin && (
            <Popconfirm
              title="Delete this recipient?"
              onConfirm={() => handleDelete(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Button type="link" danger icon={<DeleteOutlined />}>
                Delete
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <Title level={2}>Email Configuration</Title>
      <Card
        title="Notification Recipients"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchRecipients}>
              Refresh
            </Button>
            {isAdmin && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
                Add Recipient
              </Button>
            )}
          </Space>
        }
      >
        <Table
          dataSource={recipients}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      <Modal
        title={editing ? 'Edit Recipient' : 'Add Recipient'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSave}
        okText="Save"
        destroyOnClose
      >
        <Form layout="vertical" form={form}>
          <Form.Item
            label="Email"
            name="email"
            rules={[{ required: true, message: 'Email is required' }, { type: 'email', message: 'Enter a valid email' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Group"
            name="group_name"
            rules={[{ required: true, message: 'Group is required' }]}
          >
            <Input placeholder="e.g. CriticalAlerts" />
          </Form.Item>
          <Form.Item
            label="Notification Type"
            name="notification_type"
            rules={[{ required: true, message: 'Notification type is required' }]}
          >
            <Select>
              {notificationTypes.map((t) => (
                <Select.Option key={t} value={t}>
                  {t}
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
        </Form>
      </Modal>
    </div>
  );
};

export default EmailConfig;

