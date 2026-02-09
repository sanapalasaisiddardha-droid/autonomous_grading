import React, { useState, useCallback } from 'react';
import Sidebar from './Sidebar';

const Layout = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleCollapseChange = useCallback((collapsed) => {
    setSidebarCollapsed(collapsed);
  }, []);

  return (
    <div className="layout-wrapper">
      <Sidebar onCollapseChange={handleCollapseChange} />
      <div className={`layout-main ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
        {children}
      </div>
    </div>
  );
};

export default Layout;
