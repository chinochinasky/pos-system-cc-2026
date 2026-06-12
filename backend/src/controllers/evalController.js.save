const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const pool  = require('../config/database');

// ─── helpers ────────────────────────────────────────────────────────────────

/** Realiza una petición HTTP interna al propio servidor y devuelve el status code. */
function selfRequest(urlPath, headers = {}) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port:     Number(process.env.PORT) || 3001,
        path:     urlPath,
        method:   'GET',
        timeout:  3000,
        headers,
      },
      (res) => { resolve(res.statusCode); }
    );
    req.on('error',   () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

/** Cuenta archivos en el directorio de uploads local (excluye .gitkeep). */
function countLocalUploads() {
  const dir = path.join(__dirname, '..', '..', 'uploads');
  try {
    return fs.readdirSync(dir).filter((f) => !f.startsWith('.')).length;
  } catch {
    return 0;
  }
}

/** Detecta si la aplicación corre dentro de un contenedor. */
function isInsideContainer() {
  if (fs.existsSync('/.dockerenv')) return true;
  try {
    return fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker');
  } catch {
    return false;
  }
}

// ─── evaluación principal ────────────────────────────────────────────────────

const evalReport = async (req, res) => {
  const criteria = [];

  const add = (category, name, pass, pts, detail) =>
    criteria.push({ category, name, pass, pts: pass ? pts : 0, maxPts: pts, detail });

  // ══════════════════════════════════════════════════════════════
  // 1. BASE DE DATOS
  // ══════════════════════════════════════════════════════════════

  // 1.1 Host de BD externo (no es localhost / 127.0.0.1 / nombre de servicio local)
  const dbHost = process.env.DB_HOST || 'localhost';
  const LOCAL_HOSTS = ['localhost', '127.0.0.1', 'postgres', 'db', 'database'];
  const externalDB = !LOCAL_HOSTS.includes(dbHost.toLowerCase());
  add('Base de Datos', 'Host de BD es externo / cloud (RDS, Cloud SQL, etc.)',
    externalDB, 10, `DB_HOST = "${dbHost}"`);

  // 1.2 SSL habilitado en la conexión a BD
  const dbSSL = process.env.DB_SSL === 'true';
  add('Base de Datos', 'SSL habilitado en la conexión a BD',
    dbSSL, 10, `DB_SSL = "${process.env.DB_SSL || 'no definida'}" (requiere "true")`);

  // 1.3 Password de BD no usa el valor por defecto inseguro
  const dbPassSecure = !!process.env.DB_PASSWORD && process.env.DB_PASSWORD !== 'postgres';
  add('Base de Datos', 'DB_PASSWORD no usa el valor por defecto ("postgres")',
    dbPassSecure, 5,
    process.env.DB_PASSWORD
      ? (dbPassSecure ? 'Contraseña personalizada configurada ✓' : 'Usa el valor por defecto "postgres" ✗')
      : 'DB_PASSWORD no definida');

  // 1.4 BD responde correctamente (conexión real)
  let dbAlive = false;
  try { await pool.query('SELECT 1'); dbAlive = true; } catch { /* intencional */ }
  add('Base de Datos', 'Conexión a la BD activa y funcional',
    dbAlive, 5, dbAlive ? 'SELECT 1 → OK' : 'No se pudo conectar a la BD');

  // ══════════════════════════════════════════════════════════════
  // 2. ALTA DISPONIBILIDAD
  // ══════════════════════════════════════════════════════════════

  // 2.1 Endpoint /health implementado y funciona
  const healthStatus = await selfRequest('/health');
  const healthOk = healthStatus === 200;
  add('Alta Disponibilidad', 'Endpoint GET /health implementado y responde 200',
    healthOk, 12,
    healthStatus ? `GET /health → HTTP ${healthStatus}` : 'GET /health → sin respuesta (no implementado)');

  // 2.2 Detrás de un load balancer / reverse proxy
  const lbHeaders = ['x-forwarded-for', 'x-forwarded-proto', 'x-amzn-trace-id',
                     'x-cloud-trace-context', 'x-real-ip', 'forwarded'];
  const detectedLB = lbHeaders.filter((h) => !!req.headers[h]);
  const behindLB = detectedLB.length > 0;
  add('Alta Disponibilidad', 'Tráfico pasa por load balancer / reverse proxy',
    behindLB, 8,
    behindLB
      ? `Headers detectados: ${detectedLB.join(', ')}`
      : `Ningún header de proxy detectado (${lbHeaders.join(', ')})`);

  // 2.3 Conexión al cliente es HTTPS
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  const isHTTPS = proto === 'https';
  add('Alta Disponibilidad', 'Tráfico externo usa HTTPS',
    isHTTPS, 8,
    `Protocolo detectado: "${proto}" (header x-forwarded-proto o req.secure)`);

  // 2.4 Corriendo en contenedor (Docker / ECS / Kubernetes)
  const inContainer = isInsideContainer();
  add('Alta Disponibilidad', 'Aplicación corre dentro de un contenedor',
    inContainer, 7,
    inContainer ? '/.dockerenv encontrado o cgroup contiene "docker"' : 'No se detectó entorno de contenedor');

  // 2.5 Hostname indica múltiples instancias (nombre de container/pod ≠ nombre de máquina genérico)
  const hostname = os.hostname();
  const looksLikeOrchestrated = /^[0-9a-f]{12}$/.test(hostname) || // Docker short ID
    /^[a-z0-9-]+-[a-z0-9]{5,10}$/.test(hostname) ||               // ECS / K8s pod
    hostname.startsWith('ip-');                                     // EC2
  add('Alta Disponibilidad', 'Hostname sugiere despliegue orquestado (ECS, Kubernetes, etc.)',
    looksLikeOrchestrated, 5, `Hostname actual: "${hostname}"`);

  // ══════════════════════════════════════════════════════════════
  // 3. ALMACENAMIENTO EN LA NUBE
  // ══════════════════════════════════════════════════════════════

  // 3.1 Variable de bucket configurada
  const bucketVar =
    process.env.AWS_BUCKET_NAME     ||
    process.env.S3_BUCKET           ||
    process.env.GCS_BUCKET_NAME     ||
    process.env.AZURE_CONTAINER_NAME;
  add('Almacenamiento', 'Variable de bucket cloud configurada (S3 / GCS / Azure Blob)',
    !!bucketVar, 12,
    bucketVar
      ? `Bucket: "${bucketVar}"`
      : 'AWS_BUCKET_NAME / GCS_BUCKET_NAME / AZURE_CONTAINER_NAME — ninguna definida');

  // 3.2 Sin archivos almacenados localmente (uploads/ vacío)
  const localFiles = countLocalUploads();
  add('Almacenamiento', 'Directorio uploads/ vacío (imágenes migradas a cloud)',
    localFiles === 0, 8, `Archivos en backend/uploads/: ${localFiles}`);

  // 3.3 Credenciales cloud de almacenamiento presentes
  const hasStorageCreds =
    !!(process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ROLE_ARN ||
       process.env.GOOGLE_APPLICATION_CREDENTIALS ||
       process.env.AZURE_STORAGE_CONNECTION_STRING);
  add('Almacenamiento', 'Credenciales de acceso al bucket configuradas',
    hasStorageCreds, 5,
    `AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? 'sí' : 'no'} | ` +
    `GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'sí' : 'no'} | ` +
    `AZURE_STORAGE_CONNECTION_STRING: ${process.env.AZURE_STORAGE_CONNECTION_STRING ? 'sí' : 'no'}`);

  // ══════════════════════════════════════════════════════════════
  // 4. SEGURIDAD
  // ══════════════════════════════════════════════════════════════

  // 4.1 Autenticación JWT activa (ruta protegida devuelve 401 sin token)
  const statusNoToken = await selfRequest('/api/products');
  const authImplemented = statusNoToken === 401 || statusNoToken === 403;
  add('Seguridad', 'Auth JWT implementada (GET /api/products → 401 sin token)',
    authImplemented, 15,
    statusNoToken
      ? `GET /api/products sin token → HTTP ${statusNoToken} ${authImplemented ? '✓' : '✗ (debería ser 401)'}`
      : 'Sin respuesta del servidor');

  // 4.2 CORS restringido a dominio específico
  const frontendURL = process.env.FRONTEND_URL;
  add('Seguridad', 'CORS restringido a dominio específico (FRONTEND_URL configurada)',
    !!frontendURL, 5,
    frontendURL
      ? `FRONTEND_URL = "${frontendURL}"`
      : 'FRONTEND_URL no definida → CORS permite todos los orígenes (*)');

  // 4.3 JWT_SECRET no es el valor por defecto del proyecto
  const jwtOk =
    !!process.env.JWT_SECRET &&
    process.env.JWT_SECRET !== 'cambiar_este_secreto_en_produccion' &&
    process.env.JWT_SECRET.length >= 32;
  add('Seguridad', 'JWT_SECRET configurado, personalizado y con longitud ≥ 32 chars',
    jwtOk, 5,
    process.env.JWT_SECRET
      ? (jwtOk ? `Longitud: ${process.env.JWT_SECRET.length} chars ✓` : 'Usa el valor por defecto o es demasiado corto ✗')
      : 'JWT_SECRET no definida');

  // 4.4 NODE_ENV = production
  const isProd = process.env.NODE_ENV === 'production';
  add('Seguridad', 'NODE_ENV configurado como "production"',
    isProd, 5, `NODE_ENV = "${process.env.NODE_ENV || 'no definido'}"`);

  // ══════════════════════════════════════════════════════════════
  // 5. OBSERVABILIDAD Y GESTIÓN DE CONFIGURACIÓN
  // ══════════════════════════════════════════════════════════════

  // 5.1 Logging externo configurado
  const loggingVars = ['LOG_LEVEL', 'CLOUDWATCH_GROUP', 'DATADOG_API_KEY',
                        'SENTRY_DSN', 'LOG_DRIVER', 'LOKI_URL'].filter((v) => !!process.env[v]);
  add('Observabilidad', 'Sistema de logging externo configurado (CloudWatch, Datadog, Sentry, etc.)',
    loggingVars.length > 0, 5,
    loggingVars.length > 0
      ? `Variables activas: ${loggingVars.join(', ')}`
      : 'Ninguna variable de logging detectada (solo console.log)');

  // 5.2 Secrets management
  const secretsMgmt = ['AWS_SECRET_ARN', 'AZURE_KEY_VAULT_URL', 'GCP_SECRET_PROJECT',
                        'SECRETS_MANAGER', 'VAULT_ADDR'].filter((v) => !!process.env[v]);
  add('Observabilidad', 'Gestión de secretos en la nube configurada (Secrets Manager, Key Vault, etc.)',
    secretsMgmt.length > 0, 5,
    secretsMgmt.length > 0
      ? `Variables activas: ${secretsMgmt.join(', ')}`
      : 'Ninguna variable de secrets management detectada');

  // ══════════════════════════════════════════════════════════════
  // RESUMEN
  // ══════════════════════════════════════════════════════════════

  const totalPts = criteria.reduce((s, c) => s + c.pts, 0);
  const maxPts   = criteria.reduce((s, c) => s + c.maxPts, 0);
  const pct      = Math.round((totalPts / maxPts) * 100);

  const byCategory = criteria.reduce((acc, c) => {
    if (!acc[c.category]) acc[c.category] = { pts: 0, maxPts: 0, items: [] };
    acc[c.category].pts    += c.pts;
    acc[c.category].maxPts += c.maxPts;
    acc[c.category].items.push(c);
    return acc;
  }, {});

  res.json({
    meta: {
      timestamp:   new Date().toISOString(),
      hostname:    hostname,
      nodeVersion: process.version,
      nodeEnv:     process.env.NODE_ENV || 'no definido',
      uptime:      `${Math.floor(process.uptime() / 60)} min ${Math.floor(process.uptime() % 60)} seg`,
      port:        process.env.PORT || 3001,
    },
    score: { total: totalPts, max: maxPts, pct },
    byCategory,
    criteria,
  });
};

module.exports = { evalReport };
