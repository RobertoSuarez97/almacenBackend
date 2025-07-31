const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const db = require('../db/connection');
const fs = require('fs');
const { uploadFileToFtp } = require('../utils/ftp');
require('dotenv').config();

// Configuración de almacenamiento para multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Carpeta temporal local
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Crear carpeta uploads si no existe
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Obtener todos los productos
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM productos');
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener los productos:', error);
    res.status(500).json({ message: 'Error interno del servidor al obtener los productos.' });
  }
});

// Productos con límite de novedades
router.get('/novedades', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM productos ORDER BY fecha DESC LIMIT 14');
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener las novedades:', error);
    res.status(500).json({ message: 'Error interno del servidor al obtener las novedades.' });
  }
});

// Productos organizados por categorías
router.get('/getProductosPorCategorias', async (req, res) => {
  try {
    const sql = `
      SELECT 
        p.id AS producto_id, p.nombre AS producto_nombre, p.descripcion AS producto_descripcion,
        p.caracteristicas, p.precio, p.stock, p.marca_id, p.descuento, p.imagen_principal,
        c.id AS categoria_id, c.nombre AS categoria_nombre, m.nombre AS marca_nombre
      FROM productos p
      LEFT JOIN productos_categorias pc ON p.id = pc.producto_id
      LEFT JOIN marcas m ON p.marca_id = m.id
      LEFT JOIN categorias c ON pc.categoria_id = c.id
      ORDER BY c.id, p.id
    `;
    const [rows] = await db.query(sql);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error al obtener productos por categorías:', error);
    res.status(500).json({ message: 'Error interno del servidor al procesar la solicitud.' });
  }
});

// Productos en oferta
router.get('/ofertas', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM productos WHERE descuento > 0');
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener las ofertas:', error);
    res.status(500).json({ message: 'Error interno del servidor al obtener las ofertas.' });
  }
});

// Obtener producto por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query('SELECT * FROM productos WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Producto no encontrado.' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener el producto:', error);
    res.status(500).json({ message: 'Error interno del servidor al obtener el producto.' });
  }
});

// Obtener galería por producto
router.get('/gallery/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query('SELECT * FROM galeria_productos WHERE producto_id = ?', [id]);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener la galería del producto:', error);
    res.status(500).json({ message: 'Error interno del servidor al obtener la galería.' });
  }
});

// Agregar producto con imagen y galería
router.post(
  '/photoUpload',
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'gallery', maxCount: 10 },
  ]),
  async (req, res) => {
    const connection = await db.getConnection(); // Obtener una conexión del pool
    try {
      const { name, description, caracteristicas, price, quantity, brand, discount } = req.body;

      if (!name || !description || !caracteristicas || !price || !quantity || !brand) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios' });
      }

      const photoFile = req.files['photo'] ? req.files['photo'][0] : null;
      if (!photoFile) {
        return res.status(400).json({ message: 'Debe subir una imagen principal' });
      }

      await connection.beginTransaction(); // Iniciar transacción

      // 1. Subir imagen principal a FTP
      const photo = photoFile.filename;
      await uploadFileToFtp(photoFile.path, photo);

      // 2. Insertar el producto en la base de datos
      const sqlProducto = `
        INSERT INTO productos (nombre, descripcion, caracteristicas, precio, stock, marca_id, descuento, imagen_principal, fecha)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `;
      const [result] = await connection.query(sqlProducto, [
        name,
        description,
        caracteristicas,
        price,
        quantity,
        brand,
        discount || 0,
        photo,
      ]);
      const productId = result.insertId;

      // 3. Manejar la galería de imágenes
      if (req.files['gallery'] && req.files['gallery'].length > 0) {
        const galleryFiles = req.files['gallery'];
        const galleryImages = galleryFiles.map((file) => [productId, file.filename]);

        // Subir cada imagen de la galería a FTP
        for (const file of galleryFiles) {
          await uploadFileToFtp(file.path, file.filename);
        }

        // Insertar las imágenes de la galería en la base de datos
        const sqlGaleria = `INSERT INTO galeria_productos (producto_id, imagen) VALUES ?`;
        await connection.query(sqlGaleria, [galleryImages]);
      }

      await connection.commit(); // Confirmar la transacción

      res.status(201).json({
        message: 'Producto agregado correctamente',
        productId,
        photo,
        gallery: req.files['gallery'] ? req.files['gallery'].map((file) => file.filename) : [],
      });
    } catch (error) {
      await connection.rollback(); // Revertir la transacción en caso de error
      console.error('Error al agregar producto:', error);
      // Aquí se podría agregar lógica para eliminar archivos subidos a FTP si la transacción falla
      res.status(500).json({ message: 'Error al agregar el producto. La operación fue revertida.' });
    } finally {
      connection.release(); // Liberar la conexión
    }
  }
);

// Actualizar producto y galería
router.put(
  '/:id',
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'gallery', maxCount: 10 },
  ]),
  async (req, res) => {
    const connection = await db.getConnection();
    try {
      const { id } = req.params;
      const { name, description, caracteristicas, price, quantity, brand, discount, deleteGallery } = req.body;

      if (!name || !description || !caracteristicas || price == null || quantity == null || !brand || discount == null) {
        return res.status(400).json({ message: 'Por favor, completa todos los campos' });
      }

      await connection.beginTransaction();

      let newPhoto = req.body.photo;

      // 1. Actualizar imagen principal si se proporciona una nueva
      if (req.files['photo']) {
        const photoFile = req.files['photo'][0];
        newPhoto = photoFile.filename;
        await uploadFileToFtp(photoFile.path, photoFile.filename);
      }

      // 2. Actualizar la información del producto
      const sqlUpdateProduct = `
        UPDATE productos
        SET nombre = ?, descripcion = ?, caracteristicas = ?, precio = ?, stock = ?, marca_id = ?, descuento = ?, imagen_principal = ?
        WHERE id = ?
      `;
      const [result] = await connection.query(sqlUpdateProduct, [
        name,
        description,
        caracteristicas,
        price,
        quantity,
        brand,
        discount,
        newPhoto,
        id,
      ]);

      if (result.affectedRows === 0) {
        throw new Error('Producto no encontrado'); // Lanza un error para activar el rollback
      }

      // 3. Eliminar imágenes de la galería si se solicita
      if (deleteGallery) {
        const deleteIds = JSON.parse(deleteGallery);
        if (Array.isArray(deleteIds) && deleteIds.length > 0) {
          // Aquí se podría agregar lógica para eliminar los archivos del FTP antes de borrar el registro
          const sqlDeleteImages = `DELETE FROM galeria_productos WHERE id IN (?)`;
          await connection.query(sqlDeleteImages, [deleteIds]);
        }
      }

      // 4. Agregar nuevas imágenes a la galería
      if (req.files['gallery'] && req.files['gallery'].length > 0) {
        const newGalleryFiles = req.files['gallery'];
        const newGalleryImages = newGalleryFiles.map((file) => [id, file.filename]);

        for (const file of newGalleryFiles) {
          await uploadFileToFtp(file.path, file.filename);
        }

        const sqlInsertGallery = `INSERT INTO galeria_productos (producto_id, imagen) VALUES ?`;
        await connection.query(sqlInsertGallery, [newGalleryImages]);
      }

      await connection.commit();

      res.json({
        message: 'Producto actualizado correctamente',
        photo: newPhoto,
        gallery: req.files['gallery'] ? req.files['gallery'].map((file) => file.filename) : [],
      });
    } catch (error) {
      await connection.rollback();
      console.error('Error al actualizar producto:', error);

      // Si el producto no se encontró, enviar un 404
      if (error.message === 'Producto no encontrado') {
        return res.status(404).json({ message: 'Producto no encontrado' });
      }

      res.status(500).json({ message: 'Error al actualizar el producto. La operación fue revertida.' });
    } finally {
      connection.release();
    }
  }
);

module.exports = router;
