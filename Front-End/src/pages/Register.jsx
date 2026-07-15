import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { Card, CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function Register() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    password_confirmation: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (form.password !== form.password_confirmation) {
      setError('Konfirmasi password tidak cocok.');
      setLoading(false);
      return;
    }

    try {
      await axiosClient.post('/register', form);
      alert('Registrasi berhasil, silakan login');
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Registrasi gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center" style={{ minHeight: '80vh', padding: '2rem' }}>
      <div style={{ width: '100%', maxWidth: '480px' }}>
        <div className="text-center mb-8">
          <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Daftar Akun Baru</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Bergabung dan mulai kemudahan booking fasilitas</p>
        </div>
        
        <Card>
          <CardBody style={{ padding: '2.5rem' }}>
            {error && (
              <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: 500 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleRegister}>
              <div className="input-wrapper">
                <label className="input-label">Nama Lengkap</label>
                <input 
                  type="text" name="name" className="input-field" 
                  value={form.name} onChange={handleChange} required 
                  placeholder="John Doe"
                />
              </div>
              <div className="input-wrapper">
                <label className="input-label">Email Address</label>
                <input 
                  type="email" name="email" className="input-field" 
                  value={form.email} onChange={handleChange} required 
                  placeholder="name@example.com"
                />
              </div>
              <div className="input-wrapper">
                <label className="input-label">Nomor Telepon</label>
                <input 
                  type="text" name="phone" className="input-field" 
                  value={form.phone} onChange={handleChange} required 
                  placeholder="081234567890"
                />
              </div>
              <div className="input-wrapper">
                <label className="input-label">Password</label>
                <input 
                  type="password" name="password" className="input-field" 
                  value={form.password} onChange={handleChange} required 
                  placeholder="••••••••"
                />
              </div>
              <div className="input-wrapper">
                <label className="input-label">Konfirmasi Password</label>
                <input 
                  type="password" name="password_confirmation" className="input-field" 
                  value={form.password_confirmation} onChange={handleChange} required 
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" className="w-full btn-lg mt-4" isLoading={loading}>
                Daftar
              </Button>
            </form>
            
            <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Sudah punya akun? <Link to="/login" style={{ fontWeight: 600 }}>Masuk di sini</Link>
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
