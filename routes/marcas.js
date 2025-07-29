const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// Obtener todos los marcas
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM marcas');
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener marcas:', error);
    res.status(500).json({ error: 'Error al obtener marcas' });
  }
});


// Obtener un Marca por su ID
router.get('/:id', async (req, res) => {
    try {
      const { id } = req.params; // Extraer el ID de los parámetros de la URL
  
      // Consulta SQL para obtener el Marca con el ID especificado
      const [rows] = await db.query('SELECT * FROM marcas WHERE id = ?', [id]);
  
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Marca no encontrada' });
      }
  
      res.json(rows[0]); // Retornar el primer Marca (debería ser único)
    } catch (error) {
      console.error('Error al obtener Marca:', error);
      res.status(500).json({ error: 'Error al obtener Marca' });
    }
  });
  
  
  // Ruta para subir un producto con archivo
  router.post('/addMarca', async (req, res) => {
    try {
      // Recuperar datos del cuerpo de la solicitud
      const { nombre } = req.body;
  
  
      if (!nombre ) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios' });
      }
  
      const sql = `
        INSERT INTO marcas 
        (nombre)
        VALUES (?)
      `;
  
      // Ejecutar la consulta SQL
      const [result] = await db.query(sql, [
        nombre
      ]);
  
      // Enviar la respuesta de éxito
      res.status(201).json({
        message: 'Marca agregada correctamente',
        productId: result.insertId, // ID del Marca recién agregado
      });
    } catch (error) {
      console.error('Error al procesar el Marca:', error);
      res.status(500).json({ message: 'Error al agregar Marca', error });
    }
  });
  
  // Ruta para actualizar un Marca con foto
  router.put('/:id', async (req, res) => {
    try {
      const { id } = req.params; // Extraer el ID del Marca
      const { nombre } = req.body; // Extraer datos del cuerpo de la solicitud
      console.log(req.body)
      if (!nombre) {
        return res.status(400).json({ message: 'Por favor, completa todos los campos' });
      }
  
      // Consulta SQL para actualizar el Marca
      const query = `
        UPDATE marcas 
        SET nombre = ?
        WHERE id = ?
      `;
      const [result] = await db.query(query, [nombre, id]);
  
      // Verificar si el Marca fue encontrado y actualizado
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Marca no encontrado' });
      }
  
      res.json({ message: 'Marca actualizado correctamente', nombre });
    } catch (error) {
      console.error('Error al actualizar Marca:', error);
      res.status(500).json({ message: 'Error al actualizar Marca', error });
    }
  });

module.exports = router;
