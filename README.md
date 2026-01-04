# 🚀 n8n-as-code

**n8n-as-code** est un écosystème conçu pour gérer vos workflows n8n comme du code. Il transforme vos automations en fichiers JSON locaux synchronisés, permettant le versioning (Git), l'édition assistée par IA et une intégration fluide dans VS Code.

---

## 🏗 Architecture (Monorepo)

Le projet est maintenant structuré en monorepo pour une meilleure modularité :

-   **`packages/core`** : La bibliothèque de base contenant la logique de synchronisation, les clients API et le nettoyage des JSON.
-   **`packages/cli`** : L'interface en ligne de commande (`n8n-sync`).
-   **`packages/vscode-extension`** : L'extension VS Code pour éditer vos workflows avec retour visuel immédiat.

---

## 🛠 Installation

1.  **Cloner le dépôt**
2.  **Installer les dépendances** :
    ```bash
    npm install
    ```
3.  **Compiler le projet** :
    ```bash
    npm run build
    ```
4.  **Configuration** : Créez un fichier `.env` à la racine :
    ```env
    N8N_HOST=https://votre-instance.n8n.cloud
    N8N_API_KEY=votre_cle_api
    ```

---

## � Usage : CLI (`@n8n-as-code/cli`)

Le CLI vous permet de synchroniser vos workflows depuis n'importe quel terminal.

### Commandes disponibles :

-   **`node packages/cli/dist/index.js pull`** : Télécharge tous vos workflows actifs vers le dossier local `workflows/`.
-   **`node packages/cli/dist/index.js watch`** : Lance la synchronisation bidirectionnelle en temps réel. Toute modification locale est poussée, et toute modification distante est récupérée via polling.
-   **`node packages/cli/dist/index.js push`** : Détecte les nouveaux fichiers locaux et les crée sur votre instance n8n.

---

## 🔌 VS Code Extension

L'extension apporte la puissance de `n8n-as-code` directement dans votre éditeur.

### Fonctionnalités :
-   **Push on Save** : Sauvegardez un fichier `.json` dans votre dossier de workflows, et il est instantanément mis à jour sur n8n.
-   **Status Bar** : Gardez un œil sur l'état de la synchronisation (Spinning, Error, Success).
-   **Commandes** : `F1` -> `n8n: Pull Workflows` pour tout rafraîchir.

### Développement :
Pour tester l'extension, ouvrez le dossier `packages/vscode-extension` et appuyez sur `F5`.

---

## 🤖 AI Context (AGENTS.md)

Le projet supporte l'injection de contexte pour les agents IA (comme Cursor, Windsurf ou GitHub Copilot). 

### 🚀 Initialisation Rapide

Deux méthodes pour générer le contexte IA :

1.  **Via VS Code (Recommandé)** :
    -   Ouvrez la Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
    -   Exécutez `n8n: Initialize AI Context`.
    -   *(Note)* : L'extension vous proposera aussi de le faire automatiquement si `AGENTS.md` est manquant.

2.  **Via Terminal** :
    ```bash
    n8n init-ai
    ```

### Ce qui est généré :
-   📄 **`AGENTS.md`** : Instructions système pour l'IA (rôle, version n8n, bonnes pratiques).
-   🛡️ **`n8n-schema.json`** : Schéma de validation strict pour les workflows.
-   🧩 **`.vscode/n8n.code-snippets`** : Bibliothèque de snippets enrichie (Webhook, Code, HTTP...) adaptée à votre version.
-   ⚙️ **`.cursorrules` / `.clinerules`** : Règles spécifiques pour les IDEs IA.

---

## 📁 Gestion du dossier `workflows/`

Le dossier `workflows/` est exclu du dépôt principal via `.gitignore`. Cela vous permet de gérer vos workflows indépendamment (versioning par client, par projet, etc.). Le dépôt est automatiquement initialisé lorsque vous lancez `npm install` grâce au script `postinstall`.

### Optionnel : Connecter à un dépôt distant

Si vous souhaitez sauvegarder vos workflows sur un dépôt distant :

1. Entrez dans le dossier `workflows/` :
   ```bash
   cd workflows
   ```

2. Connectez votre dépôt distant :
   ```bash
   git remote add origin <votre-repo-url>
   git push -u origin main
   ```

---

## 📄 Licence
MIT