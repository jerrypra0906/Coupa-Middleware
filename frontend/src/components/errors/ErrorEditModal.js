import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, message } from 'antd';
import apiClient from '../../config/api';

const { TextArea } = Input;

const ErrorEditModal = ({ visible, error, onSuccess, onCancel }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible && error) {
      form.setFieldsValue({
        error_message: error.error_message,
        retry_status: error.retry_status,
        raw_payload: error.raw_payload ? JSON.stringify(error.raw_payload, null, 2) : ''
      });
    }
  }, [visible, error, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      const payload = {
        error_message: values.error_message,
        retry_status: values.retry_status
      };

      // Try to parse raw_payload if provided
      if (values.raw_payload) {
        try {
          payload.raw_payload = JSON.parse(values.raw_payload);
        } catch (e) {
          message.error('Invalid JSON in raw payload');
          return;
        }
      }

      await apiClient.put(`/errors/${error.id}`, payload);
      message.success('Error updated successfully');
      onSuccess();
    } catch (error) {
      console.error('Error updating error:', error);
      message.error(error.response?.data?.error || 'Failed to update error');
    }
  };

  return (
    <Modal
      title="Edit Error Detail"
      open={visible}
      onOk={handleSubmit}
      onCancel={onCancel}
      width={700}
      okText="Save"
      cancelText="Cancel"
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          error_message: error?.error_message,
          retry_status: error?.retry_status,
          raw_payload: error?.raw_payload ? JSON.stringify(error.raw_payload, null, 2) : ''
        }}
      >
        <Form.Item
          label="Error Message"
          name="error_message"
          rules={[{ required: true, message: 'Please enter error message' }]}
        >
          <TextArea rows={3} />
        </Form.Item>

        <Form.Item
          label="Retry Status"
          name="retry_status"
          rules={[{ required: true, message: 'Please select retry status' }]}
        >
          <Select>
            <Select.Option value="PENDING">Pending</Select.Option>
            <Select.Option value="RETRYING">Retrying</Select.Option>
            <Select.Option value="RETRIED">Retried</Select.Option>
            <Select.Option value="IGNORED">Ignored</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Raw Payload (JSON)"
          name="raw_payload"
          tooltip="Edit the raw payload as JSON. Must be valid JSON format."
        >
          <TextArea rows={8} placeholder='{"key": "value"}' />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ErrorEditModal;

