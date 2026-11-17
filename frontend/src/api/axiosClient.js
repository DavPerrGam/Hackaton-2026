import axios from 'axios';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
});

axiosClient.interceptors.request.use((config) => {
  const esAgente = config.url?.startsWith('/agente');
  const token = esAgente
    ? localStorage.getItem('ideapro_public_token')
    : localStorage.getItem('ideapro_admin_token') || localStorage.getItem('ideapro_public_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

axiosClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const desdeApi = err.response?.data?.error;
    const detalleApi = err.response?.data?.details;
    let mensaje = desdeApi || 'Ocurrió un error inesperado. Intenta de nuevo.';
    if (detalleApi && typeof detalleApi === 'string') mensaje = `${mensaje}: ${detalleApi}`;
    if (!err.response) {
      mensaje =
        'No se pudo conectar con el servidor. Abre el backend en http://localhost:3001 (npm run dev en la carpeta backend) y recarga.';
    }
    const error = new Error(mensaje);
    error.status = err.response?.status;
    return Promise.reject(error);
  }
);

export default axiosClient;
