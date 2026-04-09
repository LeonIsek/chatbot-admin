const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const CLIENTS_FILE = path.join(__dirname, 'clients.json');

console.log(`[INIT] CLIENTS_FILE Pfad: ${CLIENTS_FILE}`);
console.log(`[INIT] __dirname: ${__dirname}`);

app.use(express.json());
app.use(express.static(__dirname));

// GET /api/clients
app.get('/api/clients', (req, res) => {
  try {
    console.log('\n[GET /api/clients] ========================================');
    console.log('[GET] Leseanfrage von Frontend');
    console.log(`[GET] Lese Datei: ${CLIENTS_FILE}`);
    
    // Prüfe ob Datei existiert
    if (!fs.existsSync(CLIENTS_FILE)) {
      console.error(`[GET] FEHLER: Datei existiert nicht: ${CLIENTS_FILE}`);
      return res.status(404).json({ error: 'clients.json not found' });
    }
    
    const data = fs.readFileSync(CLIENTS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    
    console.log('[GET] ✓ Erfolgreich gelesen');
    console.log('[GET] Struktur:', Array.isArray(parsed) ? `Array mit ${parsed.length} Kunden` : `Objekt mit clients Array`);
    console.log('[GET] Erste Kunde:', parsed[0]?.id || parsed.clients?.[0]?.id);
    
    res.json(parsed);
  } catch (error) {
    console.error('[GET] ✗ FEHLER beim Lesen:', error.message);
    console.error('[GET] Stack:', error.stack);
    res.status(500).json({ error: 'Failed to read clients', details: error.message });
  }
});

// POST /api/clients
app.post('/api/clients', (req, res) => {
  try {
    console.log('\n[POST /api/clients] ========================================');
    console.log('[POST] Speicheranfrage von Frontend erhalten');
    console.log(`[POST] Ziel-Datei: ${CLIENTS_FILE}`);
    
    // Check what we received
    const isArray = Array.isArray(req.body);
    const isObject = req.body && typeof req.body === 'object' && !isArray;
    
    console.log('[POST] req.body Typ:', isArray ? 'Array' : isObject ? 'Object' : typeof req.body);
    
    if (isArray) {
      console.log(`[POST] ✓ Array erkannt mit ${req.body.length} Kunden`);
      if (req.body[0]) {
        console.log('[POST] Erste Kunde:', {
          id: req.body[0].id,
          status: req.body[0].status,
          paymentStatus: req.body[0].paymentStatus
        });
      }
    } else if (isObject && req.body.clients) {
      console.log(`[POST] ✓ Envelope erkannt mit ${req.body.clients.length} Kunden`);
    } else {
      console.error('[POST] ✗ Ungültige Struktur!', req.body);
      return res.status(400).json({ error: 'Invalid data structure' });
    }
    
    // Schreibe in Datei
    const jsonString = JSON.stringify(req.body, null, 2);
    fs.writeFileSync(CLIENTS_FILE, jsonString);
    
    console.log('[POST] ✓ In Datei geschrieben');
    console.log(`[POST] Dateigröße: ${jsonString.length} bytes`);
    
    // Verifiziere das Schreiben
    const verify = fs.readFileSync(CLIENTS_FILE, 'utf-8');
    const verifyParsed = JSON.parse(verify);
    const verifyArray = Array.isArray(verifyParsed) ? verifyParsed : verifyParsed.clients;
    console.log(`[POST] ✓ Verifikation: ${verifyArray.length} Kunden in Datei`);
    
    res.json({ 
      success: true, 
      message: 'Clients saved successfully',
      saved: verifyArray.length
    });
  } catch (error) {
    console.error('[POST] ✗ FEHLER beim Speichern:', error.message);
    console.error('[POST] Stack:', error.stack);
    res.status(500).json({ error: 'Failed to save clients', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n[✓] Server läuft auf http://localhost:${PORT}`);
  console.log('[✓] Projektordner:', __dirname);
  console.log('[✓] clients.json Pfad:', CLIENTS_FILE);
  console.log('[✓] GET  /api/clients - Kunden laden');
  console.log('[✓] POST /api/clients - Kunden speichern\n');
});
