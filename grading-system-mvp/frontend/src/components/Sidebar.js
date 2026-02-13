import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  HiAcademicCap, HiHome, HiPlus, HiChevronLeft, HiMenuAlt2,
  HiUpload
} from 'react-icons/hi';
import './Sidebar.css';

const Sidebar = ({ onCollapseChange }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (onCollapseChange) onCollapseChange(collapsed);
  }, [collapsed, onCollapseChange]);

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { path: '/', icon: HiHome, label: 'Classes', shortcut: '1' },
    { path: '/create-test', icon: HiPlus, label: 'Create Test', shortcut: '2' },
    { path: '/upload-answers', icon: HiUpload, label: 'Upload Answers', shortcut: '3' },
  ];

  return (
    <aside className={`sb ${collapsed ? 'sb-collapsed' : ''}`}>
      {/* Brand */}
      <div className="sb-brand">
        <div className="sb-logo">
          <HiAcademicCap />
        </div>
        {!collapsed && (
          <div className="sb-brand-text">
            <span className="sb-brand-name">GradeShield</span>
            <span className="sb-brand-sub">Unbiased Grading</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="sb-nav">
        {!collapsed && <span className="sb-section-label">Navigation</span>}
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              className={`sb-nav-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => {
                if (item.path === '/' && location.pathname === '/') {
                  // Already on home — force classes view reset
                  navigate('/', { state: { resetToClasses: true }, replace: true });
                } else {
                  navigate(item.path);
                }
              }}
              title={item.label}
            >
              <Icon className="sb-nav-icon" />
              {!collapsed && (
                <>
                  <span className="sb-nav-label">{item.label}</span>
                  <span className="sb-nav-badge">{item.shortcut}</span>
                </>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="sb-footer">
        {!collapsed && (
          <div className="sb-footer-links">
            <span>Orchids</span>
            <span>International</span>
            <span>School</span>
          </div>
        )}
        <button
          className="sb-toggle"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <HiMenuAlt2 /> : <HiChevronLeft />}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
