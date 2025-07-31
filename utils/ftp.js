const ftp = require('basic-ftp');
const fs = require('fs');
require('dotenv').config();

// Configuración FTP
const ftpConfig = {
  host: process.env.FTP_HOST,
  user: process.env.FTP_USER,
  password: process.env.FTP_PASSWORD,
  secure: process.env.FTP_SECURE === 'true',
};

/**
 * Sube un archivo a un servidor FTP y luego elimina el archivo local.
 * @param {string} localPath - La ruta al archivo local que se va a subir.
 * @param {string} remoteFilename - El nombre del archivo en el servidor FTP.
 */
const uploadFileToFtp = async (localPath, remoteFilename) => {
  const client = new ftp.Client();
  try {
    await client.access(ftpConfig);
    await client.uploadFrom(localPath, `assets/productos/${remoteFilename}`);
    console.log(`Archivo ${remoteFilename} subido a FTP correctamente.`);
  } catch (err) {
    console.error(`Error al subir el archivo ${remoteFilename} por FTP:`, err);
    // Lanzar el error para que el manejador de la ruta principal pueda capturarlo y hacer rollback
    throw err;
  } finally {
    client.close();
    // Eliminar el archivo local después de subirlo o si falla
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
  }
};

module.exports = {
  uploadFileToFtp,
};
