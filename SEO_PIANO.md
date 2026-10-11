# SEO_PIANO.md — semplicom.com
> Analisi GSC: 2026-07-09 → 2026-10-08 (3 mesi, ricerca Web)

---

## 1. OVERVIEW NUMERI

| Periodo | Clic | Impressioni | CTR medio | Posizione media |
|---|---|---|---|---|
| 09–31 lug 2026 | 180 | 7.577 | 2.4% | 10.2 |
| Ago 2026 | 217 | 11.203 | 1.9% | 11.1 |
| Set 2026 | 398 | 16.021 | 2.5% | 8.1 |
| 01–08 ott 2026 | 102 | 4.296 | 2.4% | 9.3 |
| **TOTALE** | **897** | **39.097** | **~2.3%** | **~9.3** |

**Trend positivo**: impressioni +111% da lug a set, clic +121%. Il sito sta crescendo velocemente ma il CTR medio (2.3%) è basso → enorme margine di recupero clic senza nuovi contenuti.

**Dispositivi**:
- Mobile: 495 clic (55%), 18.611 imp, CTR 2.7%, pos 7.2
- Desktop: 380 clic (42%), 20.098 imp, CTR 1.9%, pos 11.5
- Mobile domina i clic ma desktop ha più impressioni → ottimizzare title/meta per entrambi

---

## 2. TOP PAGINE PER CLIC

| # | Pagina | Clic | Imp | CTR | Pos | Priorità |
|---|---|---|---|---|---|---|
| 1 | `/` (home) | 297 | 1.332 | 22.3% | 4.0 | brand |
| 2 | `/blog/quanto-guadagna-agente-energia/` | 175 | 4.652 | 3.8% | 3.8 | ALTO |
| 3 | `/blog/provvigioni-luce-gas-quanto-si-guadagna/` | 78 | 1.971 | 4.0% | 4.1 | MEDIO |
| 4 | `/blog/ccv-corrispettivo-commercializzazione/` | 56 | **9.684** | **0.6%** | 6.7 | **CRITICO** |
| 5 | `/diventa-partner/` | 47 | 828 | 5.7% | 5.8 | BASSO |
| 6 | `/come-si-calcola-il-pun-in-bolletta/` | 44 | 2.682 | 1.6% | 4.8 | MEDIO |
| 7 | `/crm-agenzie-energia/` | 42 | 2.790 | 1.5% | 17.9 | **ALTO** |
| 8 | `/prezzi` | 31 | 995 | 3.1% | 8.7 | BASSO |
| 9 | `/energia-gas/` | 28 | 1.017 | 2.8% | 10.0 | MEDIO |
| 10 | `/spread-energia/` | 27 | 3.986 | 0.7% | 5.4 | **ALTO** |

---

## 3. OPPORTUNITÀ PRIORITIZZATE

### PRIORITA' 1 — CTR CRISIS (alta impressioni, basso CTR)

#### A. Pagina CCV `/blog/ccv-corrispettivo-commercializzazione/`
- **9.684 impressioni, solo 56 clic, CTR 0.6%** — la pagina più visitata dopo la home in termini di visibilità
- Query principali che portano impressioni:

| Query | Imp | Clic | Pos |
|---|---|---|---|
| ccv significato | 550 | 0 | 7.4 |
| ccv | 197 | 0 | 5.7 |
| ccv luce | 184 | 0 | 12.2 |
| prezzo ccv luce cos'è | 147 | 0 | 12.5 |
| ccv luce significato | 138 | 0 | 10.5 |
| ccv luce cosa è | 123 | 0 | 10.9 |
| gestione pratiche energia | 111 | 0 | 5.7 |
| ccv cosa è | 100 | 0 | 7.9 |
| corrispettivo di commercializzazione | 335 | 4 | 3.8 |

**Azione**: ottimizzare `<title>` e `<meta description>` per includere varianti ("ccv significato", "ccv luce cosa è"), aggiungere FAQ structured data, migliorare H1/intro per rispondere direttamente alla query.

**Potenziale**: portare CTR da 0.6% → 3% = +230 clic/mese aggiuntivi senza muovere un'altra pagina.

---

#### B. Pagina Spread `/spread-energia/` + `/blog/spread-energia-come-funziona/`
- Due pagine concorrenti sullo stesso topic: spread energia
- `/spread-energia/`: 3.986 imp, 27 clic, CTR 0.7%, pos 5.4
- `/blog/spread-energia-come-funziona/`: 4.062 imp, 26 clic, CTR 0.6%, pos 6.3
- **Cannibalizzazione**: Google mostra entrambe → si dividono le impressioni
- Query "spread energia elettrica": 196 imp, 3 clic, pos 8.2

**Azione**: scegliere una pagina canonica principale (consiglio: `/spread-energia/`), aggiungere canonical `rel="canonical"` sulla pagina blog che punta alla principale, oppure integrare il blog post in `/spread-energia/` e fare redirect 301.

---

#### C. Pagina PUN `/pun-oggi/`
- 2.547 impressioni, solo 3 clic, CTR **0.1%**, pos 10.7
- Query "psv oggi": 202 imp, 1 clic, pos 25.3 (pagina sbagliata che appare)
- `/prezzo-unico-nazionale/`: 1.537 imp, 4 clic, CTR 0.3%, pos 28.2

**Azione**: migliorare title tag per includere "PUN oggi [mese corrente]", aggiungere schema `Dataset` o `FAQPage`, migliorare contenuto con valore del giorno prominente (above the fold).

---

#### D. Pagina PSV `/psv-oggi/`
- 2.750 impressioni, 6 clic, CTR 0.2%, pos **24.7** (pagina 2-3)
- Query "psv gas oggi": 152 imp, 1 clic, pos 43.9 (pagina 4!)

**Azione**: rafforzare il contenuto con dati storici, schema FAQPage, internal linking da pagine correlate (energia-gas, blog). Obiettivo: entrare in top 10.

---

#### E. Pagina CRM `/crm-agenzie-energia/`
- 2.790 imp, 42 clic, CTR 1.5%, pos **17.9** (fine pagina 2)
- Molti anchor URL indicizzati: `#perche` (140 imp), `#definizione` (131 imp), `#checklist` (75 imp) — Google la vede come pagina autorevole ma la posizione è bassa
- Query "crm vendita luce e gas italia": 111 imp, 1 clic, pos 1.1 (ottimo! ma solo 1 clic)

**Azione**: ottimizzare H1 e title per keyword principale "crm agenzie energia", aggiungere BreadcrumbList e FAQPage schema, internal link da pagine blog correlate.

---

### PRIORITA' 2 — POSIZIONAMENTO (pos 4–10, margine di miglioramento)

| Pagina | Imp | Clic | Pos | Azione |
|---|---|---|---|---|
| `/blog/quanto-guadagna-agente-energia/` | 4.652 | 175 | 3.8 | Ottimizzare per snippet featured (risposta diretta) |
| `/come-si-calcola-il-pun-in-bolletta/` | 2.682 | 44 | 4.8 | Aggiornare title con anno, aggiungere FAQ schema |
| `/noleggio/` | 142 | 0 | 7.4 | CTR 0%: title e meta completamente da rifare |
| `/blog/gestione-pratiche-energia-digitale/` | 162 | 0 | 11.0 | CTR 0%: ottimizzare title/meta |

---

### PRIORITA' 3 — PROBLEMI TECNICI

#### URL maiuscolo indicizzato
- GSC mostra `/blog/come-TROVARE-clienti-ENERGIA-2026/` (uppercase) con 1 impressione
- **Azione**: verificare redirect 301 da URL maiuscolo → minuscolo

#### Pagine senza traffico organico da analizzare
- `/assicurazioni/`: 2 clic, 186 imp — potenziale non sfruttato
- `/master-consulente/`: 1 clic, 133 imp, pos 7.6 — buona posizione, 0 clic → title da rifare

---

## 4. PIANO INTERVENTI ORDINATO

| Priorità | Tipo | Pagina | Intervento | Impatto stimato |
|---|---|---|---|---|
| 1 | CTR | `/blog/ccv-corrispettivo-commercializzazione/` | Nuovo title + meta + FAQ schema | +200 clic/mese |
| 2 | Canonical | `/blog/spread-energia-come-funziona/` | Aggiungere canonical → `/spread-energia/` | Consolidamento autorità |
| 3 | CTR | `/pun-oggi/` | Nuovo title dinamico + schema | +30-50 clic/mese |
| 4 | Posizione | `/crm-agenzie-energia/` | H1 + title + schema BreadcrumbList | +20-40 clic/mese |
| 5 | CTR | `/psv-oggi/` | Contenuto + schema + internal link | +15-30 clic/mese |
| 6 | CTR | `/noleggio/` | Title + meta da zero | +5-10 clic/mese |
| 7 | CTR | `/master-consulente/` | Title + meta | +5-10 clic/mese |
| 8 | Tech | `/blog/come-TROVARE-clienti-ENERGIA-2026/` | Redirect 301 (server config) | Dedup indexing |
| 9 | CTR | `/blog/gestione-pratiche-energia-digitale/` | Title + meta | +5-10 clic/mese |
| 10 | Snippet | `/blog/quanto-guadagna-agente-energia/` | Featured snippet optimization | +30-50 clic/mese |

---

## 5. QUICK WINS (implementabili subito in HTML)

1. **CCV page title**: da generico → `Corrispettivo di Commercializzazione (CCV): cos'è e come funziona | SempliCom`
2. **CCV meta**: includere "ccv significato", "ccv luce", risposta diretta in <160 caratteri
3. **CCV FAQ schema**: almeno 4 domande (cos'è CCV, come si calcola, CCV luce vs gas, chi lo paga)
4. **PUN oggi title**: `PUN Oggi — Prezzo Unico Nazionale in tempo reale | SempliCom`
5. **Noleggio title**: chiarire subito di cosa si tratta (noleggio operativo? attrezzature?)
6. **Master consulente title**: specificare target e benefit
7. **Spread canonical**: una riga di codice nel `<head>` della pagina blog

---

*Generato: 2026-10-11 | Fonte: GSC Performance semplicom.com-Performance-on-Search-2026-10-11.xlsx*
