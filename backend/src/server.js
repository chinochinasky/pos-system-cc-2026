const cluster = require('cluster');
const os = require('os');
const app = require('./app');
const winston = require('winston');

// Configuración del Logger para mantener consistencia con el resto del sistema
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()]
});

const PORT = process.env.PORT || 3001;

// 🚀 ARQUITECTURA EN CLUSTER (MULTIHILO) ───────────────────────────────────────
if (cluster.isMaster) {
  // Detecta cuántos núcleos de CPU tiene tu VM en Azure
  const numCPUs = os.cpus().length;
  logger.info(`PROCESO MAESTRO INICIADO. Detectados ${numCPUs} núcleos. Configurando workers...`);

  // Crea un proceso trabajador (worker) por cada núcleo disponible
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Si un worker muere, lo reiniciamos al instante para mantener la disponibilidad
  cluster.on('exit', (worker, code, signal) => {
    logger.warn(`Worker (PID ${worker.process.pid}) murió. Reiniciando...`);
    cluster.fork();
  });

} else {
  // LOS WORKERS ESCUCHAN EN EL MISMO PUERTO
  app.listen(PORT, () => {
    logger.info(`Proceso Trabajador (Worker) con PID ${process.pid} listo en puerto ${PORT}`);
  });
}
