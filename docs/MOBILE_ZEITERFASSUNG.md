# Mobile-Optimierung: Zeiterfassung

## Übersicht

Die Zeiterfassung wurde für mobile Geräte optimiert, um eine bessere Benutzererfahrung auf kleinen Bildschirmen zu bieten.

## Implementierte Features

### Desktop-Ansicht (≥ 768px Breite)
- **Verhalten:** Wie bisher
- **Kalender-Kacheln:** Zeigen immer alle Details (Projektname, Stunden, Badges)
- **Expansion:** Kachel vergrößert sich relativ an ursprünglicher Position
- **Badges:** Rechteckige Badges mit Anzahl (blau für Zeiteinträge, lila für Reisekosten)

### Mobile-Ansicht (< 768px Breite)

#### Normalzustand (nicht angeklickt):
- **Kompakte Kacheln** (min-height: 80px statt 120px)
- **Nur Datum sichtbar** (z.B. "9")
- **Farbige Kreis-Icons** mit Anzahl-Badge:
  - 🔵 **Blauer Kreis** mit weißer Zahl = Zeiteinträge (z.B. "3")
  - 🟣 **Lila Kreis** mit weißer Zahl = Reisekosten (z.B. "1")
- **Plus-Button** rechts oben für neue Einträge
- **Keine Projekt-Details** sichtbar (Platzersparnis)

#### Angeklickter Zustand (expanded):
- **Full-Screen Overlay** (fixed positioning)
- **Position:** `left: 1rem, right: 1rem, top: 5rem` (zentriert mit Abstand)
- **Maximale Höhe:** 320px mit Scroll
- **Volle Details sichtbar:**
  - Projektname (mit automatischer Bindestrich-Trennung)
  - Stunden-Anzeige
  - Farbige Badges für Entry-Type (onsite, remote, etc.)
  - Kategorie-Badges für Reisekosten
- **X-Button** zum Schließen oben rechts
- **Scroll-Funktion** bei mehr als 3-4 Einträgen
- **Schatten-Effekt** (shadow-2xl) für Tiefenwirkung

## Technische Details

### Responsive Breakpoint
```css
@media (min-width: 768px) {
  /* Desktop-Ansicht */
}

@media (max-width: 767px) {
  /* Mobile-Ansicht */
}
```

### State Management
```typescript
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  const checkMobile = () => {
    setIsMobile(window.innerWidth < 768);
  };
  checkMobile();
  window.addEventListener('resize', checkMobile);
  return () => window.removeEventListener('resize', checkMobile);
}, []);
```

### Conditional Rendering
```typescript
{/* Desktop: Badges, Mobile: nur wenn expanded */}
{(isExpanded || !isMobile) && entries.length > 0 && (
  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">
    {entries.length}
  </span>
)}

{/* Mobile: Farbige Kreis-Icons nur wenn nicht expanded */}
{!isExpanded && isMobile && (
  <div className="flex items-center gap-1">
    {entries.length > 0 && (
      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white text-[9px] font-bold">
        {entries.length}
      </div>
    )}
  </div>
)}
```

## Vorteile

✅ **Übersichtlicher Kalender** auf kleinen Screens  
✅ **Schnelle Erfassung** durch Icon-Badges (auf einen Blick sichtbar)  
✅ **Lesbare Details** beim Anklicken (Full-Screen Overlay)  
✅ **Konsistent** mit Desktop-Verhalten (gleiche Funktionalität)  
✅ **Touch-optimiert** (größere Touch-Targets, kein Hover erforderlich)  
✅ **Performant** (keine zusätzlichen API-Calls, nur CSS/JS)

## Browser-Kompatibilität

- ✅ Chrome/Edge (Chromium-basiert)
- ✅ Safari (iOS & macOS)
- ✅ Firefox
- ✅ Mobile Browser (iOS Safari, Chrome Mobile, Samsung Internet)

## Testing

Um die Mobile-Ansicht zu testen:
1. Öffnen Sie die Zeiterfassung in einem Browser
2. Öffnen Sie die Developer Tools (F12)
3. Aktivieren Sie den Device-Modus (Strg+Shift+M)
4. Wählen Sie ein Mobile-Gerät (z.B. iPhone 12, Galaxy S20)
5. Testen Sie das Anklicken von Kacheln mit Einträgen

## Bekannte Einschränkungen

- **Keine Hover-Effekte** auf Touch-Geräten (by design)
- **Copy-Button** bei Zeiteinträgen erscheint nur auf Desktop (Hover-basiert)
- **Expansion** funktioniert nur bei Kacheln mit Einträgen (leere Kacheln nicht anklickbar)

## Zukünftige Verbesserungen

- [ ] Swipe-Gesten für Monatswechsel
- [ ] Drag & Drop für Zeiteinträge (Mobile-optimiert)
- [ ] Haptic Feedback bei Interaktionen (iOS/Android)
- [ ] Offline-Modus mit Service Worker
