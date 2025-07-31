require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const productosRoutes = require('./routes/productos');
const marcasRoutes = require('./routes/marcas');
const categoriasRoutes = require('./routes/categorias');
const authRoutes = require('./routes/auth');
const checkoutRoutes = require('./routes/checkout');

const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// Rutas
app.use('/api/productos', productosRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/marcas', marcasRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/checkout', checkoutRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

