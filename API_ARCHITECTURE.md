# Architecture API

## Vue d'ensemble

L'application est maintenant structurée en 2 couches :

1. **API Layer** : Edge Functions Supabase qui interrogent la base de données
2. **Frontend Layer** : Application React qui communique avec l'API

```
┌─────────────────────────────────────────────┐
│           Application Web (React)           │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │   API Services (src/services/api/)   │  │
│  │   - candidatApiService.ts            │  │
│  │   - clientApiService.ts              │  │
│  │   - missionApiService.ts             │  │
│  │   ...                                │  │
│  └──────────────┬───────────────────────┘  │
└─────────────────┼───────────────────────────┘
                  │ HTTP/REST
                  ↓
┌─────────────────────────────────────────────┐
│         Edge Functions (API Layer)          │
│                                             │
│  /api-candidats   - CRUD candidats          │
│  /api-clients     - CRUD clients            │
│  /api-missions    - CRUD missions           │
│  /api-factures    - CRUD factures           │
│  /api-contrats    - CRUD contrats           │
│  ...                                        │
└─────────────────┼───────────────────────────┘
                  │ Supabase SDK
                  ↓
┌─────────────────────────────────────────────┐
│         Base de données Supabase            │
└─────────────────────────────────────────────┘
```

## Avantages de cette architecture

### 1. **Séparation des préoccupations**
- Le frontend ne connaît pas la structure de la base de données
- L'API peut évoluer indépendamment du frontend
- Logique métier centralisée côté serveur

### 2. **Sécurité renforcée**
- Les règles RLS sont appliquées côté serveur
- Authentification JWT vérifiée à chaque requête
- Pas d'exposition directe de la base de données

### 3. **Extensibilité**
- Facile d'ajouter d'autres clients (mobile, intégrations tierces)
- Possibilité d'enrichir l'API avec de la logique métier
- Support de webhooks et d'événements

### 4. **Performance**
- Possibilité de cache côté API
- Requêtes optimisées côté serveur
- Réduction de la charge client

## Structure des fichiers

### Edge Functions (API)
```
supabase/functions/
  ├── api-candidats/
  │   └── index.ts       # CRUD candidats
  ├── api-clients/
  │   └── index.ts       # CRUD clients
  ├── api-missions/
  │   └── index.ts       # CRUD missions
  └── ...
```

### Services API Frontend
```
src/services/api/
  ├── apiClient.ts              # Client HTTP générique
  ├── candidatApiService.ts     # Service candidats
  ├── clientApiService.ts       # Service clients
  ├── missionApiService.ts      # Service missions
  └── ...
```

## Format des réponses API

Toutes les réponses API suivent le format :

```typescript
// Succès
{
  "success": true,
  "data": { ... }
}

// Erreur
{
  "success": false,
  "error": "Message d'erreur"
}
```

## Authentification

Toutes les requêtes nécessitent un token JWT :

```typescript
Authorization: Bearer <jwt_token>
```

Le token est automatiquement géré par `apiClient.ts`.

## Endpoints disponibles

### Candidats (`/api-candidats`)

- `GET /` - Liste tous les candidats
- `GET /:id` - Récupère un candidat par ID
- `POST /` - Crée un nouveau candidat
- `PUT /:id` - Met à jour un candidat
- `DELETE /:id` - Supprime un candidat
- `GET /count` - Compte le nombre de candidats

## Migration progressive

### Étape 1 : API Candidats (✓ Implémenté)
- Edge Function `api-candidats`
- Service `candidatApiService`

### Étape 2 : Autres entités
Pour migrer une autre entité (ex: clients) :

1. **Créer l'Edge Function** :
   ```bash
   supabase/functions/api-clients/index.ts
   ```

2. **Créer le service API** :
   ```bash
   src/services/api/clientApiService.ts
   ```

3. **Mettre à jour les composants** :
   ```typescript
   // Avant
   import { clientService } from '@/services';
   
   // Après
   import { clientApiService } from '@/services/api/clientApiService';
   ```

## Cas d'usage avancés

### Enrichissement de l'API

L'API peut être enrichie avec :

1. **Validation métier** : Vérifier les données avant insertion
2. **Calculs complexes** : Agréger des données
3. **Notifications** : Envoyer des emails/SMS
4. **Webhooks** : Notifier des systèmes externes
5. **Analytics** : Tracker les événements

### Exemple d'enrichissement

```typescript
// Dans api-candidats/index.ts
if (method === 'POST' && path === '/') {
  const body: CandidatCreate = await req.json();
  
  // Validation métier
  if (!body.email || !body.email.includes('@')) {
    throw new Error('Email invalide');
  }
  
  // Insertion
  const { data, error } = await supabase
    .from('candidats')
    .insert(body)
    .select()
    .single();
  
  // Notification
  await supabase.functions.invoke('send-candidat-invitation', {
    body: { candidatId: data.id }
  });
  
  return new Response(
    JSON.stringify({ success: true, data }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

## Intégrations tierces

L'API peut être utilisée par :

1. **Applications mobiles** (iOS, Android)
2. **Intégrations webhook** (Zapier, Make.com)
3. **Scripts externes** (Python, Node.js)
4. **Autres applications web**

### Exemple d'utilisation externe

```bash
# Récupérer un token JWT
curl -X POST https://cpwjmfxyjtrdsnkcwruq.supabase.co/auth/v1/token \
  -H "apikey: YOUR_ANON_KEY" \
  -d '{"email":"user@example.com","password":"password"}'

# Utiliser l'API
curl -X GET https://cpwjmfxyjtrdsnkcwruq.supabase.co/functions/v1/api-candidats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Monitoring et logs

Les Edge Functions incluent des logs détaillés :

```typescript
console.log(`API Request: ${method} ${path}`);
console.error('API Error:', error);
```

Accessibles via le dashboard Lovable Cloud.

## Prochaines étapes

1. Migrer les autres services vers l'API
2. Ajouter des endpoints spécifiques (recherche, filtres)
3. Implémenter le versioning de l'API (v1, v2)
4. Ajouter une documentation OpenAPI/Swagger
5. Mettre en place des limites de taux (rate limiting)
