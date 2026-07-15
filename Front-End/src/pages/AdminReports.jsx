import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axiosClient from '../api/axiosClient';
import Button from '../components/ui/Button';
import { Download, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];

export default function AdminReports() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['admin-reports-summary'],
    queryFn: async () => {
      const { data } = await axiosClient.get('/admin/reports/summary');
      return data;
    }
  });

  const handleExportPDF = async () => {
    try {
      const response = await axiosClient.get('/admin/reports/export', {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Laporan_Booking.pdf');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert('Gagal mengekspor PDF');
    }
  };

  if (isLoading) return <p style={{ color: 'var(--text-muted)' }}>Memuat laporan...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Laporan Keuangan & Booking</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>Ringkasan pendapatan dari booking yang telah dibayar (Lunas).</p>
        </div>
        <Button onClick={handleExportPDF} className="flex items-center gap-2">
          <Download size={18} /> Ekspor PDF
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div style={{ background: 'white', padding: '2rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ background: 'var(--primary-light)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
            <FileText size={32} color="var(--primary)" />
          </div>
          <div>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontWeight: 600 }}>Total Booking Dibayar</p>
            <h3 style={{ margin: 0, fontSize: '2.5rem' }}>{summary?.total_bookings || 0}</h3>
          </div>
        </div>
        
        <div style={{ background: 'white', padding: '2rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--secondary)' }}>Rp</span>
          </div>
          <div>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontWeight: 600 }}>Total Pendapatan</p>
            <h3 style={{ margin: 0, fontSize: '2.5rem' }}>{summary?.total_revenue?.toLocaleString('id-ID') || 0}</h3>
          </div>
        </div>
      </div>
      
      <div style={{ background: 'white', padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
         <h3 style={{ marginBottom: '1.5rem' }}>Grafik Pendapatan Bulanan (Tahun Ini)</h3>
         <div style={{ height: '350px', width: '100%' }}>
            {summary?.revenue_per_month && summary.revenue_per_month.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={summary.revenue_per_month.map(item => ({
                    name: monthNames[item.month - 1],
                    Pendapatan: parseInt(item.revenue, 10)
                  }))}
                  margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis 
                    tickFormatter={(value) => `Rp ${value.toLocaleString('id-ID')}`} 
                    axisLine={false} 
                    tickLine={false}
                    width={100}
                  />
                  <Tooltip 
                    formatter={(value) => [`Rp ${value.toLocaleString('id-ID')}`, 'Pendapatan']}
                    contentStyle={{ borderRadius: 'var(--radius-md)', border: 'none', boxShadow: 'var(--shadow-card)' }}
                  />
                  <Bar dataKey="Pendapatan" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                Belum ada data pendapatan untuk bulan ini.
              </div>
            )}
         </div>
      </div>
    </div>
  );
}
