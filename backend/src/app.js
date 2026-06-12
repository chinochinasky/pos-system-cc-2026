require('dotenv').config();
const statusMonitor = require('express-status-monitor');
const cookieParser = require('cookie-parser');
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit'); // 🛡️ Importado para Rate Limiting
const winston = require('winston');              // 🪵 Importado para Logging estructurado
const pool = require('./config/database');       // 🔌 Importamos el pool para el Health Check de la BD

const authRoutes     = require('./routes/auth');
const productRoutes  = require('./routes/products');
const categoryRoutes = require('./routes/categories');
const clientRoutes   = require('./routes/clients');
const saleRoutes     = require('./routes/sales');
const reportRoutes   = require('./routes/reports');
const userRoutes     = require('./routes/users');
const evalRoutes     = require('./routes/eval');

const app = express();

// 📊 MONITOREO DE MÉTRICAS EN TIEMPO REAL ─────────────────────────────────────
// ✅ SOLUCIONADO: Expone un panel visual e interactivo en http://tu-ip:3001/status
app.use(statusMonitor({
  title: 'Panel de Métricas del Sistema POS',
  path: '/status',
  spans: [{
    interval: 1,     // Registra datos cada 1 segundo
    retention: 60    // Mantiene el historial de los últimos 60 segundos
  }, {
    interval: 5,
    retention: 60
  }]
}));

// 🪵 CONFIGURACIÓN DE LOGGING ESTRUCTURADO (WINSTON) ──────────────────────────
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json() // Formato JSON estructurado para CloudWatch / Azure Monitor
  ),
  transports: [
    new winston.transports.Console() // Muestra los logs en la consola del contenedor
  ]
});

// ─── CORS RESTRINGIDO ────────────────────────────────────────────────────────
// ✅ SOLUCIONADO: Ahora solo acepta peticiones desde tu frontend oficial en Azure
app.use(cors({
  origin: 'http://57.156.66.244:3000',
  credentials: true
}));

// 🛡️ RATE LIMITING ────────────────────────────────────────────────────────────
// ✅ SOLUCIONADO: Máximo 100 peticiones cada 15 minutos por dirección IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Demasiadas peticiones desde esta IP, intente más tarde.' }
});
app.use('/api/', limiter);

// ─── PARSERS ─────────────────────────────────────────────────────────────────
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── ARCHIVOS ESTÁTICOS (imágenes) ───────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ─── HEALTH CHECK CON VALIDACIÓN DE BD ───────────────────────────────────────
// ✅ SOLUCIONADO: Endpoint listo para Load Balancers y orquestadores en la nube
app.get('/health', async (req, res) => {
  try {
    // Intenta hacer una consulta rápida a Postgres en Azure
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'ok', timestamp: new Date() });
  } catch (error) {
    logger.error('Health Check falló en la base de datos', { error: error.message });
    res.status(503).json({ status: 'error', db: 'unreachable' });
  }
});

// ─── RUTAS ───────────────────────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/products',   productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/clients',    clientRoutes);
app.use('/api/sales',      saleRoutes);
app.use('/api/reports',    reportRoutes);
app.use('/api/users',      userRoutes);
app.use('/api/eval',       evalRoutes);

// ─── MANEJO DE ERRORES GLOBAL CON LOGGING PROFESIONAL ───────────────────────
// ✅ SOLUCIONADO: Reemplazado console.error por logging estructurado JSON
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  logger.error('Error interno capturado', {
    message: err.message,
    stack: err.stack,
    status: err.status || 500
  });
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
});

module.exports = app;
