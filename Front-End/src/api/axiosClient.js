import axios from 'axios';
import useAuthStore from '../store/authStore';

const axiosClient = axios.create({
  baseURL: 'http://localhost:8000/api', // Laravel API url
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

axiosClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
