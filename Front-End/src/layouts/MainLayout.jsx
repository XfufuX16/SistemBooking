import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { LogOut, User as UserIcon, CalendarDays } from 'lucide-react';
import axiosClient from '../api/axiosClient';

export default function MainLayout() {
  const { isAuthenticated, user, logout } = useAuthStore();
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

  const isHome = location.pathname === '/';

  return (
    <div className="page-wrapper">
      <header className="glass" style={{ position: 'sticky', top: 0, zIndex: 50, transition: 'all 0.3s' }}>
        <div className="container flex items-center justify-between" style={{ height: '80px' }}>
          <Link to="/" className="flex items-center gap-2" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            <div style={{ background: 'var(--primary)', padding: '0.5rem', borderRadius: 'var(--radius-md)' }}>
              <CalendarDays color="white" size={24} />
            </div>
            <span style={{ letterSpacing: '-0.02em' }}>
              Sistem<span style={{ color: 'var(--primary)' }}>Booking</span>
            </span>
          </Link>

          <nav className="flex items-center gap-6">
            <Link to="/" style={{ fontWeight: 600, color: isHome ? 'var(--primary)' : 'var(--text-secondary)' }}>Beranda</Link>
            {isAuthenticated ? (
              <>
                <Link to="/my-bookings" style={{ fontWeight: 600, color: location.pathname.includes('/my-bookings') ? 'var(--primary)' : 'var(--text-secondary)' }}>
                  Booking Saya
                </Link>
                {user?.role === 'admin' && (
                  <Link to="/admin" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Dashboard Admin
                  </Link>
                )}
                <div className="flex items-center gap-3" style={{ marginLeft: '1rem', paddingLeft: '1.5rem', borderLeft: '2px solid var(--border)' }}>
                  <div style={{ background: 'var(--surface-hover)', padding: '0.5rem', borderRadius: '50%' }}>
                    <UserIcon size={18} color="var(--primary)" />
                  </div>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user.name}</span>
                  <button onClick={handleLogout} className="flex items-center" style={{ marginLeft: '0.5rem', color: 'var(--text-muted)', transition: 'color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.color='var(--danger)'} onMouseOut={(e) => e.currentTarget.style.color='var(--text-muted)'} title="Logout">
                    <LogOut size={20} />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/login" className="btn btn-secondary btn-sm" style={{ border: 'none', background: 'transparent' }}>Masuk</Link>
                <Link to="/register" className="btn btn-primary btn-sm" style={{ borderRadius: 'var(--radius-xl)' }}>Daftar Sekarang</Link>
              </div>
            )}
          </nav>
        </div>
      </header>

      <main className="main-content" style={{ padding: '0' }}>
        <Outlet />
      </main>

      <footer style={{ background: 'var(--surface)', padding: '4rem 0 2rem', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
             <CalendarDays color="var(--text-muted)" size={24} />
             <span style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: '1.25rem' }}>SistemBooking</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            &copy; {new Date().getFullYear()} SistemBooking. All rights reserved.<br/>
            Membuat pemesanan lapangan dan ruang pertemuan menjadi lebih mudah dan cepat.
          </p>
        </div>
      </footer>
    </div>
  );
}
