const jwt = require('jsonwebtoken');
const winston = require('winston'); // 🪵 Importamos Winston para logging estructurado

// Configuración del logger alineada con app.js y database.js
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

/**
 * Middleware de autenticación JWT.
 * ✅ SOLUCIONADO: Ahora extrae el token primero desde las Cookies HttpOnly para máxima seguridad XSS.
 * Obliga al uso estricto del secreto de producción de las variables de entorno.
 */
const authMiddleware = (req, res, next) => {
  try {
    // 🍪 Buscamos el token primero en las cookies inyectadas automáticamente por el navegador
    let token = req.cookies?.token;

    // Plan B: Si no viene en la cookie, lo extraemos del header tradicional por compatibilidad externa
    if (!token) {
      const authHeader = req.headers['authorization'];
      token = authHeader && authHeader.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ error: 'Acceso denegado. Token no suministrado o sesión expirada.' });
    }

    // ✅ SOLUCIONADO: Uso estricto de process.env.JWT_SECRET sin fallbacks expuestos
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Agregamos el usuario decodificado a req.user para que esté disponible en los controladores
    req.user = decoded;
    
    next();
  } catch (err) {
    logger.error('Fallo en la verificación del token de seguridad', { 
      message: err.message,
      service: 'auth-middleware' 
    });
    // Retornamos 403 si el token es inválido o expiró
    return res.status(403).json({ error: 'Token inválido o expirado. Inicie sesión nuevamente.' });
  }
};

/**
 * Middleware de autorización por rol.
 * ✅ SOLUCIONADO: Verifica dinámicamente que el usuario autenticado tenga los permisos requeridos en la nube.
 *
 * @param {string[]} roles - Roles permitidos (ej: ['admin', 'cajero'])
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado. Sesión requerida.' });
    }

    // Comprobamos si el rol guardado en el JWT coincide con los autorizados para la ruta
    if (!roles.includes(req.user.rol)) {
      logger.warn('Intento de acceso no autorizado denegado', {
        user: req.user.email,
        userRole: req.user.rol,
        requiredRoles: roles
      });
      return res.status(403).json({ error: 'No tienes permisos suficientes para realizar esta acción.' });
    }
    
    next();
  };
};

module.exports = { authMiddleware, requireRole };
