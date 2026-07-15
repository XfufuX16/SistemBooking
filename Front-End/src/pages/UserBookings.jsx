import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../api/axiosClient';
import { Card, CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Calendar, MapPin, Clock } from 'lucide-react';

export default function UserBookings() {
  const queryClient = useQueryClient();

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: async () => {
      const { data } = await axiosClient.get('/bookings');
      return data;
    }
  });

  const payMutation = useMutation({
    mutationFn: (id) => axiosClient.post(`/bookings/${id}/pay`),
    onSuccess: () => {
      alert('Pembayaran berhasil!');
      queryClient.invalidateQueries(['my-bookings']);
    },
    onError: (err) => {
      alert(err.response?.data?.message || 'Gagal melakukan pembayaran');
    }
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => axiosClient.put(`/bookings/${id}/cancel`),
    onSuccess: () => {
      alert('Booking dibatalkan');
      queryClient.invalidateQueries(['my-bookings']);
    }
  });

  if (isLoading) return (
    <div className="container flex justify-center items-center" style={{ minHeight: '60vh' }}>
      <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }}>Memuat data booking...</p>
    </div>
  );

  return (
    <div className="container" style={{ padding: '3rem 2rem' }}>
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '2rem', margin: 0 }}>Booking Saya</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Daftar riwayat pemesanan fasilitas Anda.</p>
      </div>
      
      {bookings && bookings.length > 0 ? (
        <div className="grid grid-cols-1 gap-6">
          {bookings.map((booking) => (
            <Card key={booking.id} style={{ borderLeft: `4px solid ${booking.status === 'confirmed' ? 'var(--secondary)' : booking.status === 'pending' ? 'var(--warning)' : 'var(--danger)'}` }}>
              <CardBody className="flex justify-between items-center" style={{ padding: '1.5rem 2rem' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>{booking.facility.name}</h3>
                  <div className="flex gap-4" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                     <span className="flex items-center gap-1"><Calendar size={16} /> {booking.booking_date}</span>
                     <span className="flex items-center gap-1"><Clock size={16} /> {booking.start_time} - {booking.end_time}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className={`badge ${
                      booking.status === 'confirmed' ? 'badge-success' : 
                      booking.status === 'pending' ? 'badge-warning' : 'badge-danger'
                    }`}>
                      {booking.status === 'confirmed' ? 'Dikonfirmasi' : booking.status === 'pending' ? 'Menunggu' : 'Dibatalkan'}
                    </span>
                    <span className={`badge ${booking.payment_status === 'paid' ? 'badge-info' : 'badge-neutral'}`}>
                      {booking.payment_status === 'paid' ? 'Lunas' : 'Belum Dibayar'}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                    Rp {booking.total_price.toLocaleString('id-ID')}
                  </div>
                  {booking.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button variant="danger" size="sm" onClick={() => cancelMutation.mutate(booking.id)} isLoading={cancelMutation.isLoading}>
                        Batal
                      </Button>
                      <Button variant="primary" size="sm" onClick={() => payMutation.mutate(booking.id)} isLoading={payMutation.isLoading}>
                        Bayar Sekarang
                      </Button>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardBody className="text-center" style={{ padding: '3rem' }}>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>Belum ada histori booking.</p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
