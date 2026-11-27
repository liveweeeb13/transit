const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.get('/map-admin.html', (req, res) => res.status(404).send('Not found'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.get('/api/map', (req, res) => {
  const filePath = path.join(__dirname, 'data', 'map-data.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return res.json({ stops: [], shapes: [] });
    try {
      res.json(JSON.parse(data));
    } catch {
      res.json({ stops: [], shapes: [] });
    }
  });
});

app.post('/api/map', (req, res) => {
  const filePath = path.join(__dirname, 'data', 'map-data.json');
  fs.writeFile(filePath, JSON.stringify(req.body, null, 2), 'utf8', (err) => {
    if (err) return res.status(500).json({ error: 'Impossible de sauvegarder' });
    res.json({ ok: true });
  });
});

app.get('/api/lines', (req, res) => {
  const filePath = path.join(__dirname, 'data', 'lines.json');
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
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/map', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'map.html'));
});

app.get('/map/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'map-admin.html'));
});

app.listen(PORT, () => {
  console.log(`Serveur Express en écoute sur http://localhost:${PORT}`);
});
