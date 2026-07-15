import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import useAuthStore from '../store/authStore';
import { Card, CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const { data } = await axiosClient.post('/login', { email, password });
      setAuth(data.user, data.access_token);
      if (data.user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err) {
      const message = err.response?.data?.errors?.email?.[0] || err.response?.data?.message || 'Login gagal. Periksa kembali email dan password Anda.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center" style={{ minHeight: '80vh', padding: '2rem' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div className="text-center mb-8">
          <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Selamat Datang</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Silakan masuk ke akun Anda</p>
        </div>
        
        <Card>
          <CardBody style={{ padding: '2.5rem' }}>
            {error && (
              <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: 500 }}>
                {error}
              </div>
            )}
            
            <form onSubmit={handleLogin}>
              <div className="input-wrapper">
                <label className="input-label">Email Address</label>
                <input 
                  type="email"
                  className="input-field"
                  placeholder="name@example.com"
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                />
              </div>
              <div className="input-wrapper">
                <label className="input-label">Password</label>
                <input 
                  type="password"
                  className="input-field"
                  placeholder="••••••••"
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                />
              </div>
              <Button type="submit" className="w-full btn-lg mt-4" isLoading={loading}>
                Masuk
              </Button>
            </form>
            
            <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Belum punya akun? <Link to="/register" style={{ fontWeight: 600 }}>Daftar di sini</Link>
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
