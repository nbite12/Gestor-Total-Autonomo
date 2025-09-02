const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
// Asegúrate de que la variable FRONTEND_URL esté configurada en Vercel
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

// --- Rutas de la API ---
// Aquí es donde añadirás tus rutas para autenticación, datos, etc.
// Ejemplo:
// const authRoutes = require('./routes/auth');
// app.use('/api/auth', authRoutes);

// Una ruta de prueba para verificar que el backend funciona
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'El backend está funcionando correctamente' });
});

// Un gestor para las rutas de API no encontradas
app.use('/api/*', (req, res) => {
    res.status(404).json({ message: 'Ruta de API no encontrada' });
});

const PORT = process.env.PORT || 3001;

// Inicia el servidor solo si no está en un entorno serverless como Vercel
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Servidor corriendo en el puerto ${PORT}`);
    });
}

// Exporta la app para que Vercel pueda usarla como una Serverless Function
module.exports = app;
