import axios from 'axios';

// URL del backend configurada desde las variables de entorno de Next.js
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  // 🍪 ✅ SOLUCIONADO: Permite el envío y recepción automática de Cookies HttpOnly entre dominios
  withCredentials: true, 
});

// 🛡️ INTERCEPTOR DE PETICIONES
api.interceptors.request.use((config) => {
  // ✅ SOLUCIONADO: Ya no se lee el token desde localStorage por seguridad XSS.
  // El navegador inyectará la cookie automáticamente gracias a 'withCredentials'.
  return config;
});

// 🛡️ INTERCEPTOR DE RESPUESTAS (Manejo global de errores de autenticación)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Si el backend responde 401 (No autorizado), significa que la cookie expiró o es inválida
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Limpiamos los datos públicos del usuario de la sesión web y redirigimos al login
      localStorage.removeItem('user'); 
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
