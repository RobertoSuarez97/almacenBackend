const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// Obtener todas las categorías
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM categorias');
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener las categorías:', error);
    res.status(500).json({ message: 'Error interno del servidor al obtener las categorías.' });
  }
});

// Ruta para agregar categorías relacionadas a un producto
router.post('/addDetalleCategoria/:id', async (req, res) => {
  try {
    const productId = req.params.id; // ID del producto
    const categories = req.body; // Array de IDs de categorías

    if (!productId || !Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ message: 'El ID del producto y la lista de categorías son obligatorios.' });
    }

    const values = categories.map((categoryId) => [productId, categoryId]);
    const sql = 'INSERT INTO productos_categorias (producto_id, categoria_id) VALUES ?';

    await db.query(sql, [values]);

    res.status(201).json({
      message: 'Categorías asociadas al producto correctamente.',
    });
  } catch (error) {
    console.error('Error al asociar categorías al producto:', error);
    res.status(500).json({ message: 'Error interno del servidor al asociar las categorías.' });
  }
});

// Ruta para buscar categorías relacionadas a un producto
router.get('/getDetalleCategoria/:id', async (req, res) => {
  try {
    const { id: productId } = req.params; // ID del producto

    if (!productId) {
      return res.status(400).json({ message: 'El ID del producto es obligatorio.' });
    }

    const sql = 'SELECT categoria_id FROM productos_categorias WHERE producto_id = ?';
    const [rows] = await db.query(sql, [productId]);

    res.json(rows);
  } catch (error) {
    console.error('Error al obtener las categorías del producto:', error);
    res.status(500).json({ message: 'Error interno del servidor al obtener las categorías del producto.' });
  }
});

// Ruta para eliminar categorías relacionadas a un producto
router.delete('/deleteDetalleCategoria/:id', async (req, res) => {
  try {
    const { id: productId } = req.params; // ID del producto

    if (!productId) {
      return res.status(400).json({ message: 'El ID del producto es obligatorio.' });
    }

    const sql = 'DELETE FROM productos_categorias WHERE producto_id = ?';
    const [result] = await db.query(sql, [productId]);

    if (result.affectedRows > 0) {
      res.status(200).json({ message: 'Categorías del producto eliminadas correctamente.' });
    } else {
      res.status(404).json({ message: 'No se encontraron categorías para el producto especificado o ya fueron eliminadas.' });
    }
  } catch (error) {
    console.error('Error al eliminar las categorías del producto:', error);
    res.status(500).json({ message: 'Error interno del servidor al eliminar las categorías.' });
  }
});

module.exports = router;
