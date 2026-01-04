# 📘 n8n-as-code : The Bible (Version 3.0)

**Statut :** Source Unique de Vérité (Architecture & Roadmap)
**Contexte :** Migration Monorepo & AI-First Strategy

Ce document consolide toutes les spécifications techniques, fonctionnelles et la roadmap de développement pour l'écosystème `n8n-as-code`.

---

# PARTIE 1 : ARCHITECTURE & VISION

## 1. Philosophie
**"Code First, Visual Feedback"**
Déporter la logique n8n (visuelle) vers des fichiers textes versionnables, manipulables par des humains ou des Agents IA, avec synchronisation bidirectionnelle.

## 2. Structure Monorepo (NPM Workspaces)
Le projet est divisé en trois paquets distincts.

```text
/ (Racine du Repo)
├── package.json           # Workspaces: ["packages/*"]
├── AGENTS.md              # Fichier maître de contexte IA (Généré)
├── .gitignore
└── packages/
    ├── core/              # [LIBRARY] Le Cerveau (Logique pure, sans UI)
    ├── cli/               # [CLIENT] Interface Terminal (Mode Headless)
    └── vscode-extension/  # [CLIENT] Interface VS Code (Mode Riche)
```

## 3. Le Cœur du Système : `packages/core`
Librairie TypeScript pure (Aucune dépendance `vscode`).

### A. Services Clés
1.  **`N8nApiClient`** : Wrapper Axios. Endpoints: `/workflows`, `/node-types`, `/activate`.
2.  **`WorkflowSanitizer`** : Nettoyage JSON avant sauvegarde.
    * Supprime `executionUrl`.
    * Normalise l'ordre des clés (Git friendly).
3.  **`SyncManager`** : Algorithme de détection d'état (Hash MD5).
    * États : `SYNCED`, `LOCAL_MODIFIED`, `REMOTE_MODIFIED`, `CONFLICT`.

### B. IA & Expérience Développeur
Ces générateurs sont exécutés au démarrage (`init-ai`) :
1.  **`SchemaGenerator`** : Interroge `/node-types` -> Génère `n8n-schema.json`.
2.  **`SnippetGenerator`** : Interroge `/node-types` -> Génère `.vscode/n8n.code-snippets`.
3.  **`AiContextGenerator`** : Génère `AGENTS.md` et `.cursorrules`.

---

# PARTIE 2 : STRATÉGIE IA & SNIPPETS

## 1. Injection de Contexte (No-MCP)
Nous n'utilisons pas de serveur MCP. Nous injectons des fichiers statiques.

### A. Le Fichier Maître : `AGENTS.md`
Généré à la racine. Contient :
* Rôle : "Expert n8n Automation Engineer".
* Liste des nœuds installés sur l'instance (Version exacte + Community Nodes).
* Règles de syntaxe (Expressions `{{ $json... }}`).

### B. Les Adaptateurs
* **Cursor** : `.cursorrules` -> "READ AGENTS.md BEFORE CODING."
* **Cline/Roo** : `.clinerules` -> "READ AGENTS.md."

## 2. Snippets Dynamiques
Le Core génère un fichier `.vscode/n8n.code-snippets` pour accélérer l'écriture.

**Exemple de format généré :**
```json
"n8n-slack": {
    "prefix": "n8n-slack",
    "body": [
        "{",
        "  \"parameters\": { \"channel\": \"$1\" },",
        "  \"name\": \"Slack\",",
        "  \"type\": \"n8n-nodes-base.slack\",",
        "  \"typeVersion\": 1, ...",
        "}"
    ],
    "description": "Insert a Slack node (Context-Aware)"
}
```

---

# PARTIE 3 : EXPÉRIENCE UTILISATEUR (UX)

## 1. Interface VS Code (`packages/vscode-extension`)
Couche UI fine par-dessus le Core.

* **Push on Save :** Écoute `onDidSaveTextDocument`. Valide le JSON -> Push API n8n -> Notif Toast.
* **Sidebar (TreeDataProvider) :** Affiche l'état de synchro (Icônes 🟢/🔵/🟠/🔴).
* **WebView (Visual Bridge) :** Iframe pointant vers le workflow distant. Se recharge après un Push.

## 2. Interface CLI (`packages/cli`)
Pour CI/CD et utilisateurs Vim.

* **`n8n sync watch`** : Processus persistant (Chokidar + Polling).
* **Feedback Visuel :** Spinners (Ora) et Couleurs (Chalk).

---

# PARTIE 4 : PLAN DE MIGRATION (ROADMAP AGENT)

**Instructions pour l'Agent IA :** Exécute ces phases dans l'ordre strict.

### Phase 1 : Initialisation Monorepo
- [ ] Créer dossiers : `packages/core`, `packages/cli`, `packages/vscode-extension`.
- [ ] `package.json` racine avec `"workspaces": ["packages/*"]`.
- [ ] `tsconfig.base.json` pour compilation partagée.

### Phase 2 : Migration du "Core"
- [ ] Initialiser `packages/core`.
- [ ] Migrer `N8nApiClient` et `WorkflowSanitizer`.
- [ ] Implémenter `SyncManager` (MD5 Logic).
- [ ] **Implémenter `SnippetGenerator` & `SchemaGenerator`.**

### Phase 3 : Création du CLI
- [ ] Initialiser `packages/cli`.
- [ ] Créer commande test `n8n sync status`.

### Phase 4 : Connexion Extension
- [ ] Déplacer code extension existant vers `packages/vscode-extension`.
- [ ] Remplacer logique interne par imports `@n8n-as-code/core`.