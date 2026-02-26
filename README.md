# ⛵ Segellogbuch – PWA Deployment Guide

## Was ist das?
Diese App ist eine **Progressive Web App (PWA)**. Das bedeutet:
- Läuft im Browser auf iOS & Android
- Kann auf dem Homescreen installiert werden (sieht aus wie eine native App)
- Funktioniert **offline** (Daten werden lokal gespeichert)
- Kein App Store nötig

---

## 🚀 Schritt-für-Schritt: Deployment auf Vercel (kostenlos)

### Voraussetzungen
- Kostenloser Account auf [vercel.com](https://vercel.com)
- Kostenloser Account auf [github.com](https://github.com)
- [Node.js](https://nodejs.org) installiert (LTS Version)

---

### Schritt 1 – Projekt lokal vorbereiten

Öffne ein Terminal und führe folgende Befehle aus:

```bash
# In den Projektordner wechseln
cd segellogbuch

# Abhängigkeiten installieren
npm install

# Lokaler Test (optional)
npm run dev
# → öffnet http://localhost:5173
```

---

### Schritt 2 – GitHub Repository erstellen

1. Gehe zu [github.com/new](https://github.com/new)
2. Repository Name: `segellogbuch`
3. Auf **"Create repository"** klicken

Dann im Terminal:
```bash
git init
git add .
git commit -m "Segellogbuch PWA"
git branch -M main
git remote add origin https://github.com/DEIN-USERNAME/segellogbuch.git
git push -u origin main
```

---

### Schritt 3 – Vercel Deployment

**Option A: Per Klick (empfohlen)**
1. Gehe zu [vercel.com/new](https://vercel.com/new)
2. Klicke auf **"Import Git Repository"**
3. Wähle dein `segellogbuch` Repository
4. Einstellungen bleiben Standard (Vercel erkennt Vite automatisch)
5. Klicke **"Deploy"**
6. Nach ~1 Minute ist die App live unter `https://segellogbuch.vercel.app`

**Option B: Per CLI**
```bash
npm install -g vercel
vercel login
vercel --prod
```

---

### Schritt 4 – App auf dem Handy installieren

**iPhone (iOS Safari):**
1. Öffne die Vercel-URL in **Safari**
2. Tippe auf das **Teilen-Symbol** (Kasten mit Pfeil nach oben)
3. Scrolle nach unten → **"Zum Home-Bildschirm"**
4. **"Hinzufügen"** tippen
5. ⛵ Das Segellogbuch-Icon erscheint auf dem Homescreen

**Android (Chrome):**
1. Öffne die Vercel-URL in **Chrome**
2. Tippe auf die **drei Punkte** (Menü oben rechts)
3. **"App installieren"** oder **"Zum Startbildschirm hinzufügen"**
4. **"Installieren"** tippen

---

## 🔄 Updates deployen

Wenn du Änderungen am Code gemacht hast:
```bash
git add .
git commit -m "Update"
git push
```
Vercel deployed automatisch — nach ~30 Sekunden ist das Update live.
Auf dem Handy aktualisiert sich die PWA automatisch beim nächsten Öffnen.

---

## 💾 Datenspeicherung
Alle Daten werden im **LocalStorage** des Browsers gespeichert.
- Daten bleiben beim App-Update erhalten
- Beim Browser-Cache leeren oder Deinstallation gehen Daten verloren
- **Empfehlung:** Regelmäßig CSV-Export machen als Backup!

---

## 🌐 Eigene Domain (optional)
In Vercel unter Settings → Domains kannst du eine eigene Domain wie
`segellogbuch.mein-verein.de` einrichten (kostenlos mit eigenem Domain-Anbieter).

---

## ❓ Probleme?
- **"npm not found"** → Node.js von [nodejs.org](https://nodejs.org) installieren
- **Build-Fehler** → `npm install` erneut ausführen
- **iOS installieren grau** → Nur in Safari möglich, nicht Chrome/Firefox
