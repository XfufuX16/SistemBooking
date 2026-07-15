import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../api/axiosClient';
import { Check, X } from 'lucide-react';

export default function AdminBookings() {
  const queryClient = useQueryClient();

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['admin-bookings'],
    queryFn: async () => {
      const { data } = await axiosClient.get('/admin/bookings');
      return data;
    }
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => axiosClient.put(`/admin/bookings/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-bookings']);
      alert('Status booking berhasil diubah!');
    },
    onError: (err) => {
      alert(err.response?.data?.message || 'Gagal mengubah status');
    }
  });

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Kelola Booking</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>Daftar semua pemesanan fasilitas oleh pengguna.</p>
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--text-muted)' }}>Memuat data booking...</p>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>User</th>
                <th>Fasilitas</th>
                <th>Tanggal</th>
                <th>Waktu</th>
                <th>Harga</th>
                <th>Status Pembayaran</th>
                <th>Status Booking</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {bookings?.map((b) => (
                <tr key={b.id}>
                  <td>{b.id}</td>
                  <td>{b.user?.name}</td>
                  <td style={{ fontWeight: 500 }}>{b.facility?.name}</td>
                  <td>{b.booking_date}</td>
                  <td>{b.start_time} - {b.end_time}</td>
                  <td>Rp {b.total_price.toLocaleString('id-ID')}</td>
                  <td>
                    <span className={`badge ${b.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                      {b.payment_status}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${
                      b.status === 'confirmed' ? 'badge-success' : 
                      b.status === 'pending' ? 'badge-warning' : 'badge-danger'
                    }`}>
                      {b.status}
                    </span>
                  </td>
                  <td>
                    {b.status === 'pending' && b.payment_status === 'paid' && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => statusMutation.mutate({ id: b.id, status: 'confirmed' })} 
                          style={{ color: 'var(--secondary)', background: 'rgba(16, 185, 129, 0.1)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}
                          title="Konfirmasi"
                        >
                          <Check size={16} />
                        </button>
                        <button 
                          onClick={() => statusMutation.mutate({ id: b.id, status: 'cancelled' })} 
                          style={{ color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}
                          title="Tolak"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {(!bookings || bookings.length === 0) && (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Belum ada data booking</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
