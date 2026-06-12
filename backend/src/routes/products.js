const router = require('express').Router();
const ctrl = require('../controllers/productController');
const { authMiddleware, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { body, validationResult } = require('express-validator'); // 🛡️ Importamos el validador

// ─── MIDDLEWARE DE CONTROL DE ERRORES DE VALIDACIÓN ─────────────────────────
const validateInputs = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Si hay errores en los datos recibidos, respondemos de inmediato con un 400 (Bad Request)
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// ─── REGLAS DE VALIDACIÓN PARA PRODUCTOS ─────────────────────────────────────
const productValidationRules = [
  body('nombre')
    .trim()
    .notEmpty().withMessage('El nombre del producto es obligatorio.')
    .isLength({ min: 3 }).withMessage('El nombre debe tener al menos 3 caracteres.'),
  
  body('precio')
    .notEmpty().withMessage('El precio es obligatorio.')
    .isFloat({ min: 0 }).withMessage('El precio debe ser un número positivo.'),
  
  body('stock')
    .notEmpty().withMessage('El stock es obligatorio.')
    .isInt({ min: 0 }).withMessage('El stock debe ser un número entero mayor o igual a cero.'),
  
  body('categoria_id')
    .notEmpty().withMessage('La categoría es obligatoria.')
    .isInt().withMessage('ID de categoría inválido.')
];

// ─── RUTAS PROTEGIDAS Y VALIDADAS ────────────────────────────────────────────
router.get('/',    authMiddleware, ctrl.getAll);
router.get('/:id', authMiddleware, ctrl.getById);

// POST: Primero procesa la imagen (upload), luego valida los campos de texto, y finalmente crea
router.post('/',   
  authMiddleware, 
  requireRole(['admin']), 
  upload.single('image'), 
  productValidationRules, 
  validateInputs, 
  ctrl.create
);

// PUT: Lo mismo para la edición del producto
router.put('/:id', 
  authMiddleware, 
  requireRole(['admin']), 
  upload.single('image'), 
  productValidationRules, 
  validateInputs, 
  ctrl.update
);

router.delete('/:id', authMiddleware, requireRole(['admin']), ctrl.remove);

module.exports = router;
