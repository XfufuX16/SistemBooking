import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axiosClient from '../api/axiosClient';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import useAuthStore from '../store/authStore';
import { Card, CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { ArrowLeft, MapPin, Users, Info, CalendarDays } from 'lucide-react';

export default function FacilityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  const { data: facility, isLoading } = useQuery({
    queryKey: ['facility', id],
    queryFn: async () => {
      const { data } = await axiosClient.get(`/facilities/${id}`);
      return data;
    }
  });

  const handleSelect = (selectInfo) => {
    setSelectedSlot({
      startObj: selectInfo.start,
      endObj: selectInfo.end
    });
  };

  const handleSelectAllow = (selectInfo) => {
    // Prevent selecting dates/times in the past
    return selectInfo.start >= new Date();
  };

  const handleBooking = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!selectedSlot) return;

    setBookingLoading(true);
    try {
      const diffMs = selectedSlot.endObj.getTime() - selectedSlot.startObj.getTime();
      const hours = diffMs / (1000 * 60 * 60);
      const total_price = hours * facility.price_per_hour;

      const formatTime = (dateObj) => dateObj.toTimeString().substring(0, 5);
      const formatDate = (dateObj) => {
        const d = new Date(dateObj);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().split('T')[0];
      };

      const payload = {
        facility_id: facility.id,
        booking_date: formatDate(selectedSlot.startObj),
        start_time: formatTime(selectedSlot.startObj),
        end_time: formatTime(selectedSlot.endObj),
        total_price
      };

      await axiosClient.post('/bookings', payload);
      alert('Booking berhasil dibuat! Silakan bayar melalui menu Booking Saya.');
      navigate('/my-bookings');
    } catch (e) {
      let errorMessage = 'Terjadi kesalahan saat booking.';
      if (e.response?.data?.errors?.booking_date) {
        errorMessage = 'Tanggal pemesanan harus hari ini atau di masa depan.';
      } else if (e.response?.data?.message) {
        errorMessage = e.response.data.message;
      }
      alert(errorMessage);
    } finally {
      setBookingLoading(false);
    }
  };

  if (isLoading) return (
    <div className="container flex justify-center items-center" style={{ minHeight: '60vh' }}>
      <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }}>Memuat detail fasilitas...</p>
    </div>
  );
  
  if (!facility) return (
    <div className="container flex justify-center items-center" style={{ minHeight: '60vh' }}>
      <p>Fasilitas tidak ditemukan.</p>
    </div>
  );

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
      <button onClick={() => navigate(-1)} style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '2rem' }}>
        <ArrowLeft size={20} style={{ marginRight: '0.5rem' }} /> Kembali
      </button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6" style={{ gridTemplateColumns: '1fr 380px' }}>
        
        {/* Left Col - Calendar */}
        <div>
          <Card>
            <CardBody style={{ padding: '2rem' }}>
              <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>Pilih Jadwal</h2>
              
              <div style={{ padding: '1rem', background: 'var(--info)', color: 'white', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <Info size={24} style={{ flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'rgba(255,255,255,0.9)' }}>
                  Silakan <strong>klik dan seret (drag)</strong> pada jam yang kosong di kalender untuk memilih waktu pemesanan.
                </p>
              </div>

              <div>
                <style>{`
                  .fc-theme-standard .fc-scrollgrid { border-color: var(--border); }
                  .fc-theme-standard th { background: var(--surface-hover); padding: 0.5rem 0; font-weight: 600; color: var(--text-secondary); }
                  .fc-timegrid-slot { height: 3rem; }
                  .fc-highlight { background: rgba(99, 102, 241, 0.3) !important; }
                  .fc-button-primary { background-color: var(--surface) !important; border-color: var(--border) !important; color: var(--text-primary) !important; text-transform: capitalize; font-weight: 500; }
                  .fc-button-active { background-color: var(--primary) !important; color: white !important; border-color: var(--primary) !important; }
                `}</style>
                <FullCalendar
                  plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
                  initialView="timeGridWeek"
                  selectable={true}
                  selectMirror={true}
                  allDaySlot={false}
                  slotMinTime="06:00:00"
                  slotMaxTime="23:00:00"
                  select={handleSelect}
                  selectAllow={handleSelectAllow}
                  height="700px"
                  headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: 'timeGridWeek,timeGridDay'
                  }}
                />
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right Col - Info & Booking Form */}
        <div>
          <Card style={{ position: 'sticky', top: '100px' }}>
            <CardBody style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.75rem', lineHeight: 1.2 }}>{facility.name}</h3>
                <span className={`badge ${facility.type === 'lapangan' ? 'badge-success' : 'badge-info'}`}>
                  {facility.type === 'lapangan' ? 'Lapangan' : 'Meeting Room'}
                </span>
              </div>
              
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                {facility.description}
              </p>
              
              <div className="flex flex-col gap-3" style={{ padding: '1.5rem 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                <div className="flex justify-between items-center">
                  <span style={{ color: 'var(--text-secondary)' }}>Harga per Jam</span>
                  <span style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--primary)' }}>
                    Rp {facility.price_per_hour.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MapPin size={18} /> Lokasi
                  </span>
                  <span style={{ fontWeight: 500, textAlign: 'right' }}>{facility.location || '-'}</span>
                </div>
                {facility.capacity && (
                  <div className="flex justify-between items-center">
                    <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Users size={18} /> Kapasitas
                    </span>
                    <span style={{ fontWeight: 500 }}>{facility.capacity} orang</span>
                  </div>
                )}
              </div>

              <div className="mt-6" style={{ background: 'var(--surface-hover)', padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
                <h4 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Detail Pemesanan</h4>
                
                {selectedSlot ? (
                  <div>
                    <div style={{ background: 'white', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Tanggal</span>
                        <strong style={{ fontSize: '0.875rem' }}>
                          {selectedSlot.startObj.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Waktu</span>
                        <strong style={{ fontSize: '0.875rem' }}>
                          {selectedSlot.startObj.toTimeString().substring(0, 5)} - {selectedSlot.endObj.toTimeString().substring(0, 5)}
                        </strong>
                      </div>
                    </div>

                    <Button className="w-full btn-lg" onClick={handleBooking} isLoading={bookingLoading}>
                      Lanjutkan Booking
                    </Button>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                    <div style={{ width: '48px', height: '48px', background: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: 'var(--shadow-card)' }}>
                      <CalendarDays size={24} color="var(--text-muted)" />
                    </div>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      Pilih jam pada kalender di sebelah kiri untuk melihat detail pemesanan.
                    </p>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
