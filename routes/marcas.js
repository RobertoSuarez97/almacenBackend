const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// Obtener todas las marcas
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM marcas');
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener las marcas:', error);
    res.status(500).json({ message: 'Error interno del servidor al obtener las marcas.' });
  }
});

// Obtener una marca por su ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query('SELECT * FROM marcas WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Marca no encontrada.' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener la marca:', error);
    res.status(500).json({ message: 'Error interno del servidor al obtener la marca.' });
  }
});

// Ruta para agregar una nueva marca
router.post('/addMarca', async (req, res) => {
  try {
    const { nombre } = req.body;

    if (!nombre) {
      return res.status(400).json({ message: 'El campo nombre es obligatorio.' });
    }

    const sql = 'INSERT INTO marcas (nombre) VALUES (?)';
    const [result] = await db.query(sql, [nombre]);

    res.status(201).json({
      message: 'Marca agregada correctamente.',
      marcaId: result.insertId,
    });
  } catch (error) {
    console.error('Error al agregar la marca:', error);
    // Manejo de errores específicos de la base de datos (ej. duplicados)
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ya existe una marca con ese nombre.' });
    }
    res.status(500).json({ message: 'Error interno del servidor al agregar la marca.' });
  }
});

// Ruta para actualizar una marca
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;

    if (!nombre) {
      return res.status(400).json({ message: 'El campo nombre es obligatorio.' });
    }

    const sql = 'UPDATE marcas SET nombre = ? WHERE id = ?';
    const [result] = await db.query(sql, [nombre, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Marca no encontrada para actualizar.' });
    }

    res.json({ message: 'Marca actualizada correctamente.' });
  } catch (error) {
    console.error('Error al actualizar la marca:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ya existe una marca con ese nombre.' });
    }
    res.status(500).json({ message: 'Error interno del servidor al actualizar la marca.' });
  }
});

module.exports = router;
