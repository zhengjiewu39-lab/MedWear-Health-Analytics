import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import Layout from './Layout';

function ProtectedRoute() {
  if (!localStorage.getItem('token')) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

export default ProtectedRoute;
