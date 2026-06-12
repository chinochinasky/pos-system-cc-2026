const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

/**
 * POST /api/auth/login
 * ✅ SOLUCIONADO: Autenticación completa sin tokens expuestos en localStorage.
 * Las credenciales usan variables de entorno estrictas y el token se envía en cookie HttpOnly.
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validar que email y password no estén vacíos
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos.' });
    }

    const result = await pool.query(
      `SELECT u.*, r.nombre as rol
       FROM usuarios u
       JOIN roles r ON u.rol_id = r.id
       WHERE u.email = $1 AND u.activo = true`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    // ✅ SOLUCIONADO: Uso estricto de secretos y expiraciones de producción desde el .env
    const token = jwt.sign(
      { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
      process.env.JWT_SECRET, // Obliga a usar la variable de entorno configurada
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    // 🍪 ✅ SOLUCIONADO: Inyección del token en cookie HttpOnly invisible para atacantes XSS
    res.cookie('token', token, {
      httpOnly: true,     // 🛡️ Blindado contra scripts maliciosos de JS
      secure: false,      // Cambiar a true si el frontend usara HTTPS en la web
      sameSite: 'lax',    // Escudo básico contra ataques CSRF
      maxAge: 24 * 60 * 60 * 1000 // Duración de 1 día entero
    });

    // Se responde al frontend únicamente con los datos públicos del usuario
    res.json({
      user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/auth/me
 * Retorna los datos del usuario logueado usando la sesión activa.
 */
const me = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado.' });
    }
    const result = await pool.query(
      `SELECT u.id, u.nombre, u.email, r.nombre as rol
       FROM usuarios u JOIN roles r ON u.rol_id = r.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/auth/logout
 * ✅ AÑADIDO: Destruye la sesión borrando la cookie HttpOnly en el navegador
 */
const logout = async (req, res) => {
  res.clearCookie('token');
  return res.json({ message: 'Sesión cerrada correctamente.' });
};

module.exports = { login, me, logout };
