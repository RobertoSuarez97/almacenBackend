const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../db/connection');

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña son obligatorios' });
  }

  try {
    // Prevenir inyección SQL usando consultas parametrizadas
    const [users] = await db.query('SELECT * FROM administrador WHERE usuario = ?', [username]);

    if (users.length === 0) {
      // Por seguridad, no especificar si el usuario no existe o la contraseña es incorrecta
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const user = users[0];

    // Comparar la contraseña hasheada
    // const isMatch = await bcrypt.compare(password, user.contrasena);
    // if (!isMatch) {
    //   return res.status(401).json({ message: 'Credenciales inválidas' });
    // }

    const userPassword = users.find((p) => p.contrasena === password);
    if (!userPassword) {
        return res.status(200).json({ message: 'Password incorrecto' });
    }

    // Generar el token JWT
    const token = jwt.sign({ id: user.id, username: user.usuario }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.status(200).json({ token });

  } catch (err) {
    console.error('Error en el proceso de login:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

module.exports = router;
