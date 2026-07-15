import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { LogOut, LayoutDashboard, Database, Calendar, FileText, Settings, Menu } from 'lucide-react';
import axiosClient from '../api/axiosClient';

export default function AdminLayout() {
  const { logout, user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await axiosClient.post('/logout');
    } catch (e) {
      console.error(e);
    }
    logout();
    navigate('/');
  };

  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: <LayoutDashboard size={20} /> },
    { name: 'Fasilitas', path: '/admin/facilities', icon: <Database size={20} /> },
    { name: 'Booking', path: '/admin/bookings', icon: <Calendar size={20} /> },
    { name: 'Laporan', path: '/admin/reports', icon: <FileText size={20} /> },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--surface-hover)' }}>
      {/* Sidebar */}
      <aside style={{ width: '260px', background: 'var(--admin-sidebar-bg)', color: 'var(--admin-sidebar-text)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
           <div style={{ background: 'var(--primary)', padding: '0.5rem', borderRadius: 'var(--radius-md)' }}>
              <Settings color="white" size={24} />
           </div>
           <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '1px' }}>ADMIN<span style={{ color: 'var(--primary)' }}>PANEL</span></span>
        </div>
        
        <nav style={{ flex: 1, padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: isActive ? 'var(--admin-sidebar-active)' : 'transparent',
                  color: isActive ? 'white' : 'var(--text-muted)',
                  fontWeight: isActive ? 600 : 500,
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--admin-sidebar-hover)'; e.currentTarget.style.color = 'white'; }}
                onMouseOut={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                {item.icon} {item.name}
              </Link>
            );
          })}
        </nav>
        
        <div style={{ padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Login sebagai: <br/><strong style={{ color: 'white' }}>{user?.name}</strong></div>
          <button 
            onClick={handleLogout} 
            className="w-full"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', fontWeight: 600, transition: 'all 0.2s' }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'var(--danger)'; e.currentTarget.style.color = 'white'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = 'var(--danger)'; }}
          >
            <LogOut size={20} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top Header */}
        <header style={{ background: 'white', height: '70px', display: 'flex', alignItems: 'center', padding: '0 2rem', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Menu size={24} color="var(--text-secondary)" style={{ cursor: 'pointer' }} />
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {navItems.find(item => location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path)))?.name || 'Dashboard'}
            </span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
             <Link to="/" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Kembali ke Web</Link>
          </div>
        </header>
        
        {/* Page Content */}
        <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
