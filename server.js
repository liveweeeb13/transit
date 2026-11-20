const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname))); // Fichiers statiques (CSS, JS, images)

app.get('/api/lines', (req, res) => {
  const filePath = path.join(__dirname, 'lines.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Impossible de lire lines.json' });
    }
    try {
      const json = JSON.parse(data);
      res.json(json);
    } catch (parseErr) {
      res.status(500).json({ error: 'Format JSON invalide' });
    }
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Serveur Express en écoute sur http://localhost:${PORT}`);
});
