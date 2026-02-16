import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Typography, Space, Divider, Tag, message } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  DatabaseOutlined
} from '@ant-design/icons';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Tooltip
} from 'recharts';
import apiClient from '../config/api';

const { Title, Text } = Typography;
const COLORS = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#fa8c16'];

const Dashboard = () => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    runs: {
      totalRuns: 0,
      successRuns: 0,
      failedRuns: 0,
      partialRuns: 0,
      totalSuccessRecords: 0,
      totalErrorRecords: 0,
    },
    perIntegration: [],
    errors: {
      totalErrors: 0,
      byCategory: {},
      topErrors: {},
    },
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/dashboard/stats');
      setStats(response.data.stats || {});
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      message.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const runs = stats.runs || {};
  const perIntegration = stats.perIntegration || [];
  const errorCategories = Object.entries(stats.errors?.byCategory || {}).map(([name, value]) => ({
    name,
    value,
  }));

  const topErrors = Object.values(stats.errors?.topErrors || {}).map((item) => ({
    message: item.message,
    count: item.count,
  }));

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={2} style={{ marginBottom: 0 }}>Dashboard</Title>
        <Text type="secondary">Last 7 days</Text>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card loading={loading}>
            <Statistic
              title="Total Runs"
              value={runs.totalRuns || 0}
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={loading}>
            <Statistic
              title="Success Runs"
              value={runs.successRuns || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={loading}>
            <Statistic
              title="Failed Runs"
              value={runs.failedRuns || 0}
              valueStyle={{ color: '#f5222d' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={loading}>
            <Statistic
              title="Partial Runs"
              value={runs.partialRuns || 0}
              valueStyle={{ color: '#faad14' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={12}>
          <Card title="Runs by Integration (last 7 days)" loading={loading}>
            {perIntegration.length === 0 ? (
              <Text type="secondary">No data</Text>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={perIntegration} margin={{ top: 16, right: 16, left: 0, bottom: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="integration_name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total_runs" name="Runs" fill="#1890ff" />
                  <Bar dataKey="success_count" name="Success" fill="#52c41a" />
                  <Bar dataKey="failed_count" name="Failed" fill="#f5222d" />
                  <Bar dataKey="partial_count" name="Partial" fill="#faad14" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="Error Categories (last 7 days)" loading={loading}>
            {errorCategories.length === 0 ? (
              <Text type="secondary">No errors</Text>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={errorCategories}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {errorCategories.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ReTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={12}>
          <Card title="Top Errors (last 7 days)" loading={loading}>
            {topErrors.length === 0 ? (
              <Text type="secondary">No errors</Text>
            ) : (
              <Space direction="vertical" style={{ width: '100%' }}>
                {topErrors.slice(0, 5).map((err, idx) => (
                  <Card key={idx} size="small">
                    <Space direction="vertical">
                      <Text strong>{err.message}</Text>
                      <Tag color="magenta">Count: {err.count}</Tag>
                    </Space>
                  </Card>
                ))}
              </Space>
            )}
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="Record Totals (last 7 days)" loading={loading}>
            <Space split={<Divider type="vertical" />} wrap>
              <Statistic
                title="Total Success Records"
                value={runs.totalSuccessRecords || 0}
                valueStyle={{ color: '#52c41a' }}
              />
              <Statistic
                title="Total Error Records"
                value={runs.totalErrorRecords || 0}
                valueStyle={{ color: '#f5222d' }}
              />
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;

