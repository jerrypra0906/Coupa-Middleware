import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import IntegrationLogs from './pages/IntegrationLogs';
import SchedulerConfig from './pages/SchedulerConfig';
import ErrorDetails from './pages/ErrorDetails';
import EmailConfig from './pages/EmailConfig';
import Contracts from './pages/Contracts';
import Layout from './components/common/Layout';
import './App.css';

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1890ff',
        },
      }}
    >
      <AntApp>
        <AuthProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Navigate to="/dashboard" replace />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Dashboard />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/logs"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <IntegrationLogs />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/scheduler"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <Layout>
                      <SchedulerConfig />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/errors"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ErrorDetails />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/email-config"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <Layout>
                      <EmailConfig />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/contracts"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Contracts />
                    </Layout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Router>
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  );
}

export default App;

