# Requirement traceability matrix

| Requirement | SourceRef | Interpretation | Expected implementation | Status |
|---|---|---|---|---|
| REQ-AUTH-001 | `orion:src_Fft9ZoQ4eY8b0Qzm0Zs81FMF` | Email magic-link login; 30-day session | Accessible login request UI and success/error states; real Auth.js needs missing secrets/provider | UI implemented; service unknown |
| REQ-WORK-001 | `orion:src_Fft9ZoQ4eY8b0Qzm0Zs81FMF` | Owner creates workspace and invites member | Workspace shell and member invitation affordance | UI planned |
| REQ-PROJECT-001 | `orion:src_Fft9ZoQ4eY8b0Qzm0Zs81FMF` | Researcher manages authorized projects | Filterable project list, create dialog, archived state | UI implemented |
| REQ-SESSION-001 | `orion:src_Fft9ZoQ4eY8b0Qzm0Zs81FMF` | Session has participant, date, method, status, guide | Project detail session list | UI implemented |
| REQ-EVID-001 | `orion:src_Fft9ZoQ4eY8b0Qzm0Zs81FMF` | Evidence text, kind, timestamp and tags is editable/removable | Evidence composer, typed evidence cards, tag display and retry feedback | UI implemented |
| REQ-THEME-001 | `orion:src_Fft9ZoQ4eY8b0Qzm0Zs81FMF` | Same-project evidence groups into theme with synthesis | Theme builder panel connected to selected evidence | UI implemented |
| REQ-DASH-001 | `orion:src_Fft9ZoQ4eY8b0Qzm0Zs81FMF` | Daily work dashboard | Metrics, upcoming sessions, synthesis tasks, recent projects | UI implemented |
| NFR-A11Y-001 | `orion:src_A0k2kAdQOuglZlP1SMnkn1mB` | WCAG 2.2 AA target | Semantic landmarks, skip link, labels, focus states, live feedback, responsive controls | Implemented; manual/axe validation pending |
| NFR-PERF-001 | `orion:src_frq0hVHECnkGt0Tu-3XdBxTZ` | Public/app performance targets | Server-rendered routes, no external image/icon dependencies in demo | Structural only; production measurement unknown |
| REQ-SEARCH-001 | `orion:src_Fft9ZoQ4eY8b0Qzm0Zs81FMF` | Search project, participant, evidence and tag | Project search input; complete global/API search requires backend | Partial UI |
| REQ-EXPORT-001 | `orion:src_Fft9ZoQ4eY8b0Qzm0Zs81FMF` | CSV export limited to Pro | Pricing plan describes CSV; export service excluded pending data layer | Documented, not implemented |
| SEO public routes | `orion:src_l8xzbV5tKoBvF0uvqUDBycMX` | Home/pricing indexable; login/app noindex | Route metadata for home/pricing/login | Implemented |
| Security/RBAC | `orion:src_-LnHXFwKkm4QY7DuNFPKO2Jj` | Server authorization, rate limits, headers, secret handling | No fake security claims; implementation deferred until real auth/data infrastructure exists | Unknown/blocker for service layer |
