const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// Obtener todos los marcas
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM categorias');
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener marcas:', error);
    res.status(500).json({ error: 'Error al obtener marcas' });
  }
});

// Ruta para agregar categorías relacionadas a un producto
router.post('/addDetalleCategoria/:id', async (req, res) => {
  try {
    const productId = req.params.id; // ID del producto
    const categories = req.body; // Array de IDs de categorías

    // Validar que los datos sean correctos
    if (!productId || !Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ message: 'Producto y categorías son obligatorios' });
    }

    // Construir los valores para la consulta SQL
    const values = categories.map((categoryId) => [productId, categoryId]);

    const sql = `
      INSERT INTO productos_categorias (producto_id, categoria_id)
      VALUES ?
    `;

    // Ejecutar la consulta con un batch insert
    await db.query(sql, [values]);

    res.status(201).json({
      message: 'Categorías asociadas al producto correctamente',
    });
  } catch (error) {
    console.error('Error al asociar categorías al producto:', error);
    res.status(500).json({ message: 'Error al asociar categorías', error });
  }
});

// Ruta para buscar categorías relacionadas a un producto
router.get('/getDetalleCategoria/:id', async (req, res) => {
  try {
    const productId = req.params.id; // ID del producto

    // Validar que los datos sean correctos
    if (!productId ) {
      return res.status(400).json({ message: 'Producto es obligatorio' });
    }

    const sql = `
      SELECT categoria_id FROM productos_categorias WHERE producto_id = ?
    `;

    // Ejecutar la consulta con un batch insert
    const [rows] = await db.query(sql, productId);

    res.json(rows);
  } catch (error) {
    console.error('Error al asociar categorías al producto:', error);
    res.status(500).json({ message: 'Error al asociar categorías', error });
  }
});

// Ruta para eliminar categorías relacionadas a un producto
router.delete('/deleteDetalleCategoria/:id', async (req, res) => {
  try {
    const productId = req.params.id; // ID del producto

    // Validar que se haya enviado el ID
    if (!productId) {
      return res.status(400).json({ message: 'Producto es obligatorio' });
    }

    // Consulta SQL para eliminar registros relacionados
    const sql = `
      DELETE FROM productos_categorias WHERE producto_id = ?
    `;

    // Ejecutar la consulta
    const [result] = await db.query(sql, [productId]);

    // Verificar si se eliminaron registros
    if (result.affectedRows > 0) {
      res.status(200).json({ message: 'Categorías eliminadas correctamente', affectedRows: result.affectedRows });
    } else {
      res.status(200).json({ message: 'No se encontraron categorías para el producto especificado' });
    }
  } catch (error) {
    console.error('Error al eliminar categorías del producto:', error);
    res.status(500).json({ message: 'Error al eliminar categorías', error });
  }
});

module.exports = router;
