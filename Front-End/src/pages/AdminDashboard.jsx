import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axiosClient from '../api/axiosClient';
import { Users, Database, Calendar, DollarSign, ArrowUpRight } from 'lucide-react';

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      // In a real app, you'd fetch /admin/stats
      // Since this endpoint might not exist, we fetch basic info to count
      const [facRes, bookRes] = await Promise.all([
        axiosClient.get('/facilities'),
        axiosClient.get('/admin/bookings')
      ]);
      
      const totalIncome = bookRes.data.reduce((acc, curr) => curr.payment_status === 'paid' ? acc + Number(curr.total_price) : acc, 0);
      const pendingBookings = bookRes.data.filter(b => b.payment_status === 'pending').length;

      return {
        totalFacilities: facRes.data.length,
        totalBookings: bookRes.data.length,
        totalIncome,
        pendingBookings
      };
    }
  });

  if (isLoading) return <p style={{ color: 'var(--text-muted)' }}>Memuat statistik...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Ringkasan Sistem</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>Pantau metrik dan kinerja platform hari ini.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Total Fasilitas</p>
              <h3 style={{ margin: '0.5rem 0 0', fontSize: '2rem', color: 'var(--text-primary)' }}>{stats?.totalFacilities || 0}</h3>
            </div>
            <div style={{ background: 'var(--primary-light)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
              <Database size={24} color="var(--primary)" />
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Total Booking</p>
              <h3 style={{ margin: '0.5rem 0 0', fontSize: '2rem', color: 'var(--text-primary)' }}>{stats?.totalBookings || 0}</h3>
            </div>
            <div style={{ background: 'var(--info)', padding: '0.75rem', borderRadius: 'var(--radius-md)', opacity: 0.2 }}></div>
            <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', color: 'var(--info)' }}>
              <Calendar size={24} />
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Pendapatan</p>
              <h3 style={{ margin: '0.5rem 0 0', fontSize: '1.75rem', color: 'var(--text-primary)' }}>Rp {stats?.totalIncome?.toLocaleString('id-ID') || 0}</h3>
            </div>
            <div style={{ background: 'var(--secondary)', padding: '0.75rem', borderRadius: 'var(--radius-md)', opacity: 0.2 }}></div>
            <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', color: 'var(--secondary)' }}>
              <DollarSign size={24} />
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Menunggu Bayar</p>
              <h3 style={{ margin: '0.5rem 0 0', fontSize: '2rem', color: 'var(--text-primary)' }}>{stats?.pendingBookings || 0}</h3>
            </div>
            <div style={{ background: 'var(--warning)', padding: '0.75rem', borderRadius: 'var(--radius-md)', opacity: 0.2 }}></div>
            <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', color: 'var(--warning)' }}>
              <Users size={24} />
            </div>
          </div>
        </div>
      </div>
      
      {/* Example Table structure placeholder for the dashboard */}
      <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '2rem', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
           <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Aktivitas Terbaru</h3>
        </div>
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Navigasi ke menu "Booking" untuk melihat data lengkap.
        </div>
      </div>
    </div>
  );
}
