# SEO_MODIFICHE.md — semplicom.com
> Riepilogo modifiche applicate | 2026-10-11

---

## Modifiche applicate (in questo commit)

### 1. `/blog/ccv-corrispettivo-commercializzazione/`
**Problema**: 9.684 impressioni, CTR solo 0.6% (56 clic). Pagina più visibile del sito ma quasi invisibile nei click.

**Cambiamenti**:
- `<title>` → da `CCV: Cos'è il Corrispettivo di Commercializzazione e Come Si Calcola | SempliCom Blog`
  a `CCV Significato: Cos'è il Corrispettivo di Commercializzazione Luce e Gas — Come Si Calcola`
- `<meta description>` → include ora "CCV significato" e "bolletta luce e gas" (termini esatti delle query top)
- OG title allineato al nuovo title
- Schema FAQPage → aggiunte 2 nuove domande: "Cosa significa CCV in bolletta?" e "Cos'è il CCV nella bolletta luce?" che rispondono direttamente alle query a 550+ impressioni con 0 clic

**Impatto atteso**: +150-250 clic/mese portando CTR da 0.6% a 2-3%

---

### 2. `/pun-oggi/`
**Problema**: Title con "Aprile 2026" hardcoded (siamo a ottobre). dateModified obsoleto.

**Cambiamenti**:
- `<title>` → `PUN Oggi Ottobre 2026: Prezzo Unico Nazionale Aggiornato | SempliCom`
- `<meta description>` → "ottobre 2026" + aggiunto "GME" per credibilità
- OG title aggiornato
- Schema WebPage: `dateModified` → `2026-10-11`, `name` aggiornato a ottobre

**Impatto atteso**: miglior ranking per query "pun oggi" (attualmente pos 10.7 con 0.1% CTR)

---

### 3. `/psv-oggi/`
**Problema**: Title con "Aprile 2026" hardcoded. PSV ha 2.750 imp e solo 6 clic (CTR 0.2%).

**Cambiamenti**:
- `<title>` → `PSV Oggi Ottobre 2026: Prezzo Gas Naturale Aggiornato | SempliCom`
- `<meta description>` → "ottobre 2026" + "GME"
- OG title aggiornato

---

### 4. `/blog/spread-energia-come-funziona/`
**Problema**: Due pagine concorrenti sullo stesso topic (spread energia). Cannibalizzazione.
- `/spread-energia/`: 3.986 imp, pos 5.4
- `/blog/spread-energia-come-funziona/`: 4.062 imp, pos 6.3
- Google mostra entrambe → si dividono l'autorità

**Cambiamento**:
- `<link rel="canonical">` → modificato da self-canonical a `https://semplicom.com/spread-energia/`
- Google consoliderà tutta l'autorità sulla pagina principale `/spread-energia/`

**Impatto atteso**: miglioramento posizione di `/spread-energia/` + eliminazione cannibalizzazione

---

### 5. `/crm-agenzie-energia/`
**Problema**: Pagina a pos 17.9 (fine pag. 2) con 2.790 imp. Title non ottimizzato per ricerca.

**Cambiamenti**:
- `<title>` → da `CRM per Agenzie Energia e Gas | SempliCom — Suite Operativa Italiana`
  a `CRM Agenzie Energia e Gas: Gestione Clienti, Pratiche e Provvigioni | SempliCom`
- `<meta description>` → riformulata con keywords "gestisci clienti", "pratiche", "contratti", "provvigioni", "gratis"

**Impatto atteso**: miglioramento posizione + CTR da 1.5% verso 3%

---

### 6. `/blog/gestione-pratiche-energia-digitale/`
**Problema**: 162 imp, 0 clic, pos 11.0. Query "gestione pratiche energia" ha 111 imp a pos 5.7 ma non porta click a questa pagina.

**Cambiamenti**:
- `<title>` → include esattamente "Gestione Pratiche Energia" come keyword principale
- `<meta description>` → riformulata con benefit concreti e target chiaro (agenti)

---

## Modifiche manuali necessarie (non applicabili via HTML)

### A. Redirect 301 — URL maiuscolo
GSC mostra `/blog/come-TROVARE-clienti-ENERGIA-2026/` indicizzato (URL con lettere maiuscole).
Da aggiungere nella configurazione server (nginx/Apache/.htaccess) o nel deploy:
```
/blog/come-TROVARE-clienti-ENERGIA-2026/ → 301 → /blog/come-trovare-clienti-energia-2026/
```

### B. Aggiornamento mensile PUN/PSV
Le pagine `/pun-oggi/` e `/psv-oggi/` hanno il mese nel title e nel contenuto H1.
**Azione ricorrente**: aggiornare ogni primo del mese:
- `<title>` e `<meta description>`: mese corrente
- `dateModified` nello schema: data di aggiornamento
- Valore PUN/PSV nel body: dato aggiornato

### C. Contenuto /noleggio/ e /master-consulente/
Entrambe le pagine hanno 0 clic nonostante buone posizioni (7.4 e 7.6).
Verificare che l'H1 e il primo paragrafo rispondano immediatamente alla query di atterraggio.
Se la pagina sembra autorevole ma non converte: aggiungere una CTA above the fold più chiara.

---

## File NON inclusi in questo commit (in attesa di approvazione)
- `/massima-tranquillita/` — intera cartella
- Modifiche nav (Massima Tranquillità nel menu) su tutti i file HTML → da rivedere post-approvazione
- Sezione partnership homepage → da rivedere post-approvazione

---

*Generato: 2026-10-11 | Fonte GSC: semplicom.com-Performance-on-Search-2026-10-11.xlsx*
