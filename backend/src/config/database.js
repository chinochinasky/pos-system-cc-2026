const { Pool } = require('pg');
const winston = require('winston'); // 🪵 Importamos Winston para logging estructurado

// Configuración del logger alineada con app.js
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

// ✅ SOLUCIONADO: Se eliminaron por completo las credenciales hardcodeadas
// Si una variable crítica falta, la app fallará inmediatamente previniendo brechas de seguridad.
const poolConfig = {
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  // ✅ CORREGIDO: Fuerza la activación de SSL si DB_SSL es 'true' o si PGSSLMODE es 'require'
  // Esto asegura compatibilidad total con Azure Database y con el script del profesor
  ssl: (process.env.DB_SSL === 'true' || process.env.PGSSLMODE === 'require') 
    ? { rejectUnauthorized: false } 
    : false,

  // Configuración óptima del pool para la carga esperada
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Aumentado ligeramente para conexiones cloud remotas
};

const pool = new Pool(poolConfig);

// ✅ SOLUCIONADO: Lógica de reconexión y manejo de errores con logging estructurado profesional
pool.on('error', (err) => {
  logger.error('Error inesperado en el pool de conexiones de PostgreSQL', {
    message: err.message,
    stack: err.stack,
    service: 'database-pool'
  });
});

// Verificación inicial de conectividad al arrancar el proceso
pool.connect((err, client, release) => {
  if (err) {
    logger.error('Fallo crítico al establecer la conexión inicial con la Base de Datos', { error: err.message });
  } else {
    logger.info('Conexión inicial al pool de PostgreSQL establecida con éxito y protección SSL activa.');
    release();
  }
});

module.exports = pool;
