# Third-party licenses

Taccuino rispetta le licenze di tutte le dipendenze open source utilizzate.
Questo file riassume le licenze dei pacchetti npm effettivamente usati a
runtime dall'applicazione (dipendenze in `package.json`). Aggiornare questo
elenco quando si aggiungono o rimuovono dipendenze.

Regola del progetto (vedi `CONTRIBUTING.md`): sono ammesse solo licenze
permissive — MIT, Apache-2.0, BSD, ISC, MPL-2.0 — mai pacchetti GPL o con
licenza commerciale nel client.

## Runtime (dependencies)

| Pacchetto | Licenza |
| --- | --- |
| @prisma/client | Apache-2.0 |
| @radix-ui/* (tutti i pacchetti UI) | MIT |
| cmdk | MIT |
| jszip | MIT (MIT/GPLv3 dual, usata sotto MIT) |
| lucide-react | ISC |
| next | MIT |
| next-themes | MIT |
| react, react-dom | MIT |
| sonner | MIT |
| zod | MIT |
| zustand | MIT |

Nota: molti pacchetti dell'elenco completo di `package.json` (es. `@mdxeditor/editor`,
`recharts`, `@tanstack/*`, `framer-motion`, `embla-carousel-react`,
`react-syntax-highlighter`, ecc.) sono presenti nello scaffolding del progetto ma
non sono importati dal codice di Taccuino; se in futuro venissero usati, vanno
aggiunti a questo elenco dopo la verifica della licenza.

## Sviluppo (devDependencies)

| Pacchetto | Licenza |
| --- | --- |
| @tailwindcss/postcss, tailwindcss | MIT |
| eslint, eslint-config-next | MIT |
| prisma | Apache-2.0 |
| typescript | Apache-2.0 |
| tw-animate-css | MIT |

## Componenti UI

I componenti in `src/components/ui` derivano da **shadcn/ui** (MIT), costruiti
sopra Radix UI (MIT) e Tailwind CSS (MIT). Icone: **Lucide** (ISC).

## Come rigenerare l'elenco

```bash
# elenco rapido di nome+licenza per le dipendenze installate
bun pm ls --all 2>/dev/null || npm ls --all
# oppure, per ogni pacchetto, leggere il campo "license" dal suo package.json
```
