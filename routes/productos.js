const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const db = require('../db/connection');

// Obtener todos los productos
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM productos');
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

// Obtener todos los productos
router.get('/novedades', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM productos order by fecha asc limit 14');
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

router.get('/getProductosPorCategorias', async (req, res) => {
  try {
    const sql = `
      SELECT 
        p.id AS producto_id, 
        p.nombre AS producto_nombre, 
        p.descripcion AS producto_descripcion, 
        p.caracteristicas, 
        p.precio, 
        p.stock, 
        p.marca_id, 
        p.descuento, 
        p.imagen_principal, 
        c.id AS categoria_id, 
        c.nombre AS categoria_nombre,
        m.nombre AS marca_nombre
      FROM productos p
      LEFT JOIN productos_categorias pc ON p.id = pc.producto_id
      LEFT JOIN marcas m ON p.marca_id  = m.id
      LEFT JOIN categorias c ON pc.categoria_id = c.id
      ORDER BY c.id, p.id
    `;

    const [rows] = await db.query(sql);
    console.log(rows)
    // Organizar productos por categoría
    

    res.status(200).json(rows);
  } catch (error) {
    console.error('Error al obtener productos con categorías:', error);
    res.status(500).json({ message: 'Error al obtener productos con categorías', error });
  }
});

// Obtener todos los productos
router.get('/ofertas', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM productos where descuento > 0');
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

// Obtener un producto por su ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params; // Extraer el ID de los parámetros de la URL

    // Consulta SQL para obtener el producto con el ID especificado
    const [rows] = await db.query('SELECT * FROM productos WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json(rows[0]); // Retornar el primer producto (debería ser único)
  } catch (error) {
    console.error('Error al obtener producto:', error);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
});

router.get('/gallery/:id', async (req, res) => {
  try {
    const { id } = req.params; // Extraer el ID de los parámetros de la URL

    // Consulta SQL para obtener el producto con el ID especificado
    const [rows] = await db.query('SELECT * FROM galeria_productos WHERE producto_id = ?', [id]);

    // if (rows.length === 0) {
    //   return res.status(404).json({ message: 'Producto no encontrado' });
    // }

    res.json(rows); // Retornar el primer producto (debería ser único)
  } catch (error) {
    console.error('Error al obtener producto:', error);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
});

// Configuración de almacenamiento para multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'C:/Users/rsv683/Desktop/Proyectos/Proyecto-almacen/almacenDeMochilas/src/assets/productos'); // Carpeta donde se guardarán las imágenes
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname)); // Nombre único para cada archivo
  },
});
const upload = multer({ storage });

/**
 * 📌 Ruta para agregar un producto con imagen principal y galería de imágenes
 */
router.post('/photoUpload', upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'gallery', maxCount: 10 }]), async (req, res) => {
  try {
    const { name, description, caracteristicas, price, quantity, brand, discount } = req.body;

    // Validar que los datos sean correctos
    if (!name || !description || !caracteristicas || !price || !quantity || !brand) {
      return res.status(400).json({ message: 'Todos los campos son obligatorios' });
    }

    // Obtener la imagen principal
    const photo = req.files['photo'] ? req.files['photo'][0].filename : null;

    if (!photo) {
      return res.status(400).json({ message: 'Debe subir una imagen principal' });
    }

    // Insertar el producto en la tabla "productos"
    const sqlProducto = `
      INSERT INTO productos (nombre, descripcion, caracteristicas, precio, stock, marca_id, descuento, imagen_principal, fecha)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    const [result] = await db.query(sqlProducto, [
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

    // Guardar imágenes en la galería si se subieron
    if (req.files['gallery']) {
      const galleryImages = req.files['gallery'].map(file => [productId, file.filename]);

      const sqlGaleria = `INSERT INTO galeria_productos (producto_id, imagen) VALUES ?`;
      await db.query(sqlGaleria, [galleryImages]);
    }

    res.status(201).json({
      message: 'Producto agregado correctamente',
      productId,
      photo,
      gallery: req.files['gallery'] ? req.files['gallery'].map(file => file.filename) : [],
    });
  } catch (error) {
    console.error('Error al agregar producto:', error);
    res.status(500).json({ message: 'Error al agregar producto', error });
  }
});

router.put('/:id', upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'gallery', maxCount: 10 }]), async (req, res) => {
  try {
    const { id } = req.params; // ID del producto a actualizar
    const { name, description, caracteristicas, price, quantity, brand, discount, deleteGallery } = req.body;

    // Validar que los datos sean correctos
    if (!name || !description || !caracteristicas || price == null || quantity == null || !brand || discount == null) {
      return res.status(400).json({ message: 'Por favor, completa todos los campos' });
    }

    // Verificar si se subió una nueva imagen principal
    let newPhoto = req.files['photo'] ? req.files['photo'][0].filename : req.body.photo;

    // Actualizar los datos en la tabla "productos"
    const sqlUpdateProduct = `
      UPDATE productos 
      SET nombre = ?, descripcion = ?, caracteristicas = ?, precio = ?, stock = ?, marca_id = ?, descuento = ?, imagen_principal = ?
      WHERE id = ?
    `;
    const [result] = await db.query(sqlUpdateProduct, [name, description, caracteristicas, price, quantity, brand, discount, newPhoto, id]);

    // Si no se encontró el producto
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    // Manejo de la galería de imágenes
    if (deleteGallery) {
      const deleteIds = JSON.parse(deleteGallery); // Convertir a array
      if (deleteIds.length > 0) {
        const sqlDeleteImages = `DELETE FROM galeria_productos WHERE id IN (?)`;
        await db.query(sqlDeleteImages, [deleteIds]);
      }
    }

    if (req.files['gallery']) {
      const newGalleryImages = req.files['gallery'].map(file => [id, file.filename]);
      const sqlInsertGallery = `INSERT INTO galeria_productos (producto_id, imagen) VALUES ?`;
      await db.query(sqlInsertGallery, [newGalleryImages]);
    }

    res.json({
      message: 'Producto actualizado correctamente',
      photo: newPhoto,
      gallery: req.files['gallery'] ? req.files['gallery'].map(file => file.filename) : [],
    });
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    res.status(500).json({ message: 'Error al actualizar producto', error });
  }
});




module.exports = router;
