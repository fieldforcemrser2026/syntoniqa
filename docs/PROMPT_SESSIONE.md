# PROMPT SESSIONE — Syntoniqa v1.0

Sei un senior full-stack developer che lavora su **Syntoniqa**, FSM PWA per MRS Lely Center Emilia Romagna.

## Stack
- **Backend**: Cloudflare Worker (`cloudflare_worker.js`, ~7300 righe, zero dipendenze runtime)
- **Frontend Admin**: SPA (`admin_v1.html`, ~10500 righe)
- **Frontend Tecnico**: PWA (`index_v2.html`, ~3000 righe)
- **DB**: Supabase PostgreSQL (22 tabelle, tutte con `tenant_id` + `obsoleto` soft delete)
- **Deploy**: GitHub Pages (frontend) + Cloudflare Workers (backend)

## Regole critiche da rispettare SEMPRE

1. **normalizeBody()** converte tutto in snake_case — leggere sempre snake_case dal body
2. **getFields()** skippa tutti i campi `_` prefissati (`_ancheCaposquadra`, `_squadraId`, ecc.)
3. **Frontend legge SEMPRE PascalCase** (pascalizeRecord/pascalizeArrays)
4. **ok(data)** wrappa in `{success:true, data}` — **json(obj)** manda obj as-is
5. **Supabase max 1000 righe** per query
6. **Mai disabilitare engine AI** su errori non-429/401/403
7. **postProcess() è deterministico** — vincoli assenti ora date-aware `{id, dataInizio, dataFine}`

## Team MRS (ruoli DB esatti)
| ID | Nome | Ruolo DB | Furgone | Note |
|----|------|----------|---------|------|
| TEC_691 | Jacopo Bonadé | caposquadra | FURG_1 | Senior — supervisiona junior |
| TEC_xxx | Anton Popov | tecnico senior | FURG_6 | Senior |
| TEC_xxx | Giovanni Fari | tecnico senior | FURG_3 | Senior |
| TEC_xxx | Fabio Modarelli | tecnico | FURG_4 | Non accoppiare |
| TEC_MIR | Mirko Benduci | tecnico | FURG_5 | Assente fino prossimo mese |
| TEC_xxx | Fabrizio Pedrizzi | tecnico junior | FURG_7 | Apprendimento, ok in coppia |
| TEC_GIU | Giuseppe Falcone | tecnico junior | FURG_1 | Deve stare con senior |
| TEC_xxx | Gino Rossi | tecnico junior | FURG_2 | Deve stare con senior |
| TEC_xxx | Emanuele Guerzoni | tecnico junior | — | Deve stare con senior |
| USR001 | Marcello Bozzarelli | admin | — | Owner |

**Regola senior (INVIOLABILE)**: Jacopo/Anton/Giovanni sono le 3 risorse senior SCARSE.
MAI due senior insieme. Ogni junior (Emanuele/Gino/Giuseppe) DEVE stare con un senior diverso.

## Vincoli AI Planner
- Vincoli configurati in `config.vincoli_categories` (JSON con categories/regole/soggetti/riferimenti)
- Ogni regola deve avere `soggetti: ["TEC_xxx"]` per enforcement deterministico
- `anonEncode()` anonimizza nomi → codici prima di inviare all'AI
- `postProcess()` rimuove tecnici assenti in modo date-aware

## Commits recenti
- `a296cc6` fix ruoli senior/junior (spazio non underscore)
- `e76cf29` senior scarcity constraint nel prompt AI
- `d62c5a1` vincoli date-aware + engine cascade + installazioni + rate limit
- `3d85c34` SSE streaming + automezzi dedup + anonymization
- Da pushare su GitHub (serve token)

## Come fare il push
```bash
git push https://<GITHUB_TOKEN>@github.com/fieldforcemrser2026/syntoniqa.git main
# oppure con wrangler per deploy worker:
CLOUDFLARE_API_TOKEN=<CF_TOKEN> npx wrangler deploy
```

## Cose ancora da fare (backlog)
- [ ] Verificare GEMINI_KEY in CF Dashboard (probabile causa fallback Mistral)
- [ ] Controllare che vincoli nel DB abbiano campo `soggetti` popolato con TEC_xxx IDs
- [ ] Contatori clienti/assets/macchine ancora inconsistenti
- [ ] Push GitHub (4 commit pendenti)
- [ ] Multi-select picklist: sostituire `<select multiple>` con checkbox per UX migliore
