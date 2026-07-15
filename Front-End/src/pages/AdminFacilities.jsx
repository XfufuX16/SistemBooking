import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../api/axiosClient';
import Button from '../components/ui/Button';
import { Plus, Edit, Trash2 } from 'lucide-react';

export default function AdminFacilities() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: '', type: 'lapangan', price_per_hour: '', location: '', capacity: '', description: ''
  });

  const { data: facilities, isLoading } = useQuery({
    queryKey: ['admin-facilities'],
    queryFn: async () => {
      const { data } = await axiosClient.get('/facilities');
      return data;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingId) {
        return axiosClient.put(`/admin/facilities/${editingId}`, payload);
      }
      return axiosClient.post('/admin/facilities', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-facilities']);
      closeModal();
      alert('Data fasilitas berhasil disimpan!');
    },
    onError: (err) => {
      alert(err.response?.data?.message || 'Gagal menyimpan fasilitas');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => axiosClient.delete(`/admin/facilities/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-facilities']);
      alert('Fasilitas berhasil dihapus');
    }
  });

  const openModal = (facility = null) => {
    if (facility) {
      setEditingId(facility.id);
      setForm({ ...facility });
    } else {
      setEditingId(null);
      setForm({ name: '', type: 'lapangan', price_per_hour: '', location: '', capacity: '', description: '' });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  const handleDelete = (id) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus fasilitas ini?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Kelola Fasilitas</h2>
        <Button onClick={() => openModal()} className="flex items-center gap-2">
          <Plus size={18} /> Tambah Fasilitas
        </Button>
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--text-muted)' }}>Memuat data fasilitas...</p>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nama Fasilitas</th>
                <th>Tipe</th>
                <th>Harga/Jam</th>
                <th>Lokasi</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {facilities?.map((f) => (
                <tr key={f.id}>
                  <td>{f.id}</td>
                  <td style={{ fontWeight: 500 }}>{f.name}</td>
                  <td>
                    <span className={`badge ${f.type === 'lapangan' ? 'badge-success' : 'badge-info'}`}>
                      {f.type}
                    </span>
                  </td>
                  <td>Rp {f.price_per_hour.toLocaleString('id-ID')}</td>
                  <td>{f.location || '-'}</td>
                  <td>
                    <div className="flex gap-2">
                      <button onClick={() => openModal(f)} style={{ color: 'var(--info)', background: 'rgba(59, 130, 246, 0.1)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleDelete(f.id)} style={{ color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!facilities || facilities.length === 0) && (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Belum ada data fasilitas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '500px', borderRadius: 'var(--radius-lg)', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>{editingId ? 'Edit Fasilitas' : 'Tambah Fasilitas'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="input-wrapper">
                <label className="input-label">Nama Fasilitas</label>
                <input type="text" className="input-field" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="input-wrapper">
                  <label className="input-label">Tipe</label>
                  <select className="input-field" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                    <option value="lapangan">Lapangan</option>
                    <option value="ruang pertemuan">Ruang Pertemuan</option>
                  </select>
                </div>
                <div className="input-wrapper">
                  <label className="input-label">Harga/Jam</label>
                  <input type="number" className="input-field" value={form.price_per_hour} onChange={e => setForm({...form, price_per_hour: e.target.value})} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="input-wrapper">
                  <label className="input-label">Lokasi</label>
                  <input type="text" className="input-field" value={form.location || ''} onChange={e => setForm({...form, location: e.target.value})} />
                </div>
                <div className="input-wrapper">
                  <label className="input-label">Kapasitas</label>
                  <input type="number" className="input-field" value={form.capacity || ''} onChange={e => setForm({...form, capacity: e.target.value})} />
                </div>
              </div>
              <div className="input-wrapper">
                <label className="input-label">Deskripsi</label>
                <textarea className="input-field" value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} rows="3" required></textarea>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button type="button" variant="secondary" onClick={closeModal}>Batal</Button>
                <Button type="submit" isLoading={saveMutation.isLoading}>Simpan</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
