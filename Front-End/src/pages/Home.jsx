import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axiosClient from '../api/axiosClient';
import { Link } from 'react-router-dom';
import { Card, CardBody } from '../components/ui/Card';
import { ArrowRight, MapPin, Users, Loader2 } from 'lucide-react';

const fetchFacilities = async () => {
  const { data } = await axiosClient.get('/facilities');
  return data;
};

export default function Home() {
  const { data: facilities, isLoading, error } = useQuery({
    queryKey: ['facilities'],
    queryFn: fetchFacilities,
  });

  return (
    <div>
      {/* Hero Section */}
      <section style={{ 
        background: 'linear-gradient(135deg, var(--primary-light) 0%, var(--background) 100%)', 
        padding: '6rem 0',
        borderBottom: '1px solid var(--border)'
      }}>
        <div className="container text-center">
          <div style={{ display: 'inline-flex', alignItems: 'center', background: 'var(--surface)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-xl)', marginBottom: '2rem', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <span style={{ display: 'block', width: '8px', height: '8px', background: 'var(--secondary)', borderRadius: '50%', marginRight: '0.5rem' }}></span>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Sistem Booking Real-time Aktif</span>
          </div>
          
          <h1 style={{ fontSize: '3.5rem', maxWidth: '800px', margin: '0 auto 1.5rem', lineHeight: 1.1 }}>
            Booking Lapangan & Ruangan <span className="gradient-text">Semakin Mudah</span>
          </h1>
          
          <p style={{ fontSize: '1.25rem', maxWidth: '600px', margin: '0 auto 3rem', color: 'var(--text-secondary)' }}>
            Temukan fasilitas olahraga dan ruang pertemuan terbaik untuk kebutuhan Anda. Pesan sekarang, kelola dengan mudah.
          </p>
          
          <div className="flex justify-center gap-4">
            <button className="btn btn-primary btn-lg" style={{ borderRadius: 'var(--radius-xl)' }} onClick={() => document.getElementById('facilities-section').scrollIntoView({ behavior: 'smooth' })}>
              Lihat Fasilitas <ArrowRight size={20} style={{ marginLeft: '0.5rem' }} />
            </button>
          </div>
        </div>
      </section>

      {/* Facilities List Section */}
      <section id="facilities-section" className="container" style={{ padding: '5rem 2rem' }}>
        <div style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h2 style={{ fontSize: '2.5rem', margin: 0 }}>Fasilitas Tersedia</h2>
            <p style={{ margin: '0.5rem 0 0', fontSize: '1.125rem' }}>Pilih ruangan atau lapangan yang sesuai dengan kebutuhan Anda.</p>
          </div>
        </div>
        
        {isLoading && (
          <div className="flex justify-center items-center" style={{ padding: '4rem 0', color: 'var(--text-muted)' }}>
            <Loader2 className="loader" size={32} style={{ border: 'none', animation: 'spin 1s linear infinite' }} color="var(--primary)" />
            <span style={{ marginLeft: '1rem', fontSize: '1.25rem', fontWeight: 500 }}>Memuat fasilitas...</span>
          </div>
        )}
        
        {error && (
          <div style={{ padding: '2rem', background: 'var(--danger)', color: 'white', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            Gagal memuat fasilitas. Silakan coba beberapa saat lagi.
          </div>
        )}
        
        {facilities && (
          <div className="grid grid-cols-3 gap-6">
            {facilities.map((facility) => (
              <Link to={`/facilities/${facility.id}`} key={facility.id} style={{ color: 'inherit', display: 'block' }}>
                <Card style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ height: '220px', background: 'var(--surface-hover)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(45deg, var(--primary-light), var(--surface))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <span style={{ color: 'var(--primary)', fontWeight: 600, letterSpacing: '0.1em', opacity: 0.5, textTransform: 'uppercase' }}>
                         {facility.type === 'lapangan' ? 'SPORT FACILITY' : 'MEETING ROOM'}
                       </span>
                    </div>
                    <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
                      <span className={`badge ${facility.type === 'lapangan' ? 'badge-success' : 'badge-info'}`} style={{ boxShadow: 'var(--shadow-sm)' }}>
                        {facility.type === 'lapangan' ? 'Lapangan' : 'Meeting Room'}
                      </span>
                    </div>
                  </div>
                  <CardBody style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>{facility.name}</h3>
                    <p style={{ flex: 1, fontSize: '0.875rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {facility.description}
                    </p>
                    
                    <div className="flex flex-col gap-2 mt-4 pt-4" style={{ borderTop: '1px solid var(--border)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      <div className="flex items-center gap-2">
                         <MapPin size={16} /> <span>{facility.location || 'Lokasi belum ditentukan'}</span>
                      </div>
                      {facility.capacity && (
                        <div className="flex items-center gap-2">
                           <Users size={16} /> <span>Maks {facility.capacity} orang</span>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-end mt-6">
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Mulai dari</span>
                        <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.25rem' }}>
                          Rp {facility.price_per_hour.toLocaleString('id-ID')}
                        </span>
                      </div>
                      <span className="btn btn-primary btn-sm" style={{ padding: '0.5rem 1.25rem' }}>Booking</span>
                    </div>
                  </CardBody>
                </Card>
              </Link>
            ))}
            {facilities.length === 0 && (
              <div className="w-full text-center" style={{ gridColumn: '1 / -1', padding: '4rem', background: 'var(--surface)', borderRadius: 'var(--radius-lg)' }}>
                <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)', margin: 0 }}>Belum ada fasilitas yang tersedia.</p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
