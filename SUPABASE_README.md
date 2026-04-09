# Chatbot Admin - Supabase Vorbereitung

## Überblick
Das Projekt ist jetzt vorbereitet, auf Supabase zu speichern und später auf Vercel zu deployen.

## Dateien die neu erstellt/geändert wurden

### Neue Dateien:
- **`supabase.js`** - Supabase-Anbindung mit Funktionen für Laden/Speichern
- **`.env.example`** - Vorlage für Umgebungsvariablen
- **`.gitignore`** - Verhindert dass `.env` ins Repo kommt
- **`SUPABASE_SETUP.sql`** - SQL um die Tabelle in Supabase anzulegen

### Geänderte Dateien:
- **`script.js`** - loadClients() und updateClient() nutzen jetzt Supabase mit Fallback
- **`index.html`** - supabase.js wird vor script.js geladen, Statusanzeigen hinzugefügt
- **`style.css`** - `.status-pills` Container für mehrere Status-Pills

## Setup-Schritte

### 1. Supabase Projekt erstellen
1. Gehe zu https://supabase.com
2. Erstelle einen neuen kostenlosen Projekt
3. Kopiere: **Project URL** und **Anon Key** (in Settings → API)

### 2. Environmental Variablen
1. Kopiere `.env.example` zu `.env`
2. Füge deine Werte ein:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Supabase Tabelle erstellen
1. Gehe in Supabase Dashboard → SQL Editor
2. Öffne eine neue Query
3. Kopiere den kompletten Inhalt aus `SUPABASE_SETUP.sql`
4. Einfügen und Run drücken

Das erstellt:
- Tabelle `clients` mit allen Feldern
- Automatische `updated_at` aktualisierung
- Row Level Security Policies
- Beispiel-Daten zum Testen

### 4. Frontend konfigurieren (Vercel später)
```javascript
// Vercel kann Environment Variablen als globale Variablen setzen:
window.__SUPABASE_URL__ = process.env.REACT_APP_SUPABASE_URL;
window.__SUPABASE_ANON_KEY__ = process.env.REACT_APP_SUPABASE_ANON_KEY;
```

## Aktuelle Funktionalität

### Laden (Priority):
1. **Supabase** ✓ (wenn konfiguriert)
2. **Express API** ✓ (Fallback)
3. **Lokale clients.json** ✓ (Fallback)
4. **Demo-Daten** ✓ (Fallback)

### Speichern (Priority):
1. **Supabase** ✓ (wenn konfiguriert)
2. **Express API** ✓ (Fallback)

## Status-Anzeige
- `✓ Online verbunden` (grün) - Supabase ist verbunden
- `⊗ Offline (Demo-Modus)` (orange) - Supabase nicht verbunden, auf Demo-Daten

## Deployment auf Vercel

Später kannst du das Projekt so auf Vercel deployen:

```bash
# Repo nach GitHub pushen
git add .
git commit -m "Supabase integration"
git push origin main

# In Vercel Dashboard:
# 1. "Add New..." → "Project"
# 2. GitHub repo verbinden
# 3. Environment Variablen setzen:
#    SUPABASE_URL=...
#    SUPABASE_ANON_KEY=...
# 4. Deploy
```

## Lokale Express-API weiterhin aktiv
Die lokale Express-API auf Port 3000 läuft weiterhin:
- Bei offline/Demo-Modus wird sie als Fallback genutzt
- Später kannst du sie entfernen

## Nächste Schritte
1. Supabase Projekt erstellen
2. `.env` ausfüllen
3. SQL-Migration durchführen
4. Frontend testen: http://localhost:3000
5. Status sollte "✓ Online verbunden" zeigen
