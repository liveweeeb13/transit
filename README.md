# Transit

Dépôt officiel : [github.com/liveweeeb13/transit](https://github.com/liveweeeb13/transit)

---

## Fonctionnalités

- Interface responsive,  aux ordinateurs, tablettes et smartphones.
- Serveur Node.js - Express
- Calcul avec les heures reels en direct
- Deux types de parcours gérés :
  - **Parcours 1 (Aller / Retour)**
  - **Parcours 2 (Boucle)**
- Sauvegarde automatique dans le navigateur des réglages
- Icônes d'images personnalisées depuis `assets/img/` et couleurs de ligne

---


## Instructions

1. ```bash
   git clone https://github.com/liveweeeb13/transit.git
   cd transit
   ```

2. ```bash
   npm install
   ```

3. ```bash
   npm start
   ```

4. Ouvrir http://localhost:3000


---

## Structure du projet

```text
transit/
├── server.js     
├── package.json  
├── index.html    
├── style.css     
├── script.js     
├── lines.json        # Configuration des lignes
├── README.md    
└── assets/
    └── img/          # Images
```

---

## Configuration des lignes

Le fichier `lines.json` définit l'ensemble des lignes disponibles. Chaque ligne accepte les propriétés suivantes :

| Clé | Type | Description |
| :--- | :--- | :--- |
| `type` | String | `"tram"` ou `"bus"`
| `parcours` | Number | `1` pour aller-retour, `2` pour boucle. |
| `Direction-1` | String | Premier terminus / terminus principal de la boucle. |
| `Direction-2` | String | Second terminus / point de passage intermédiaire (optionnel pour boucle). |
| `temps` | Number | Durée du trajet en minutes. |
| `tempsPause` | Number | Durée de la pause en minutes. |
| `color` | String | Code couleur de la ligne. |
| `icon` | String | Chemin vers l'image dans `assets/img/`. |

### Exemple de configuration

```json
{
  "T1": {
    "type": "tram",
    "parcours": 1,
    "Direction-1": "Gare Centrale",
    "Direction-2": "Aéroport",
    "temps": 22,
    "tempsPause": 6,
    "color": "#007acc",
    "icon": "assets/img/T1.png"
  },
  "15": {
    "type": "bus",
    "parcours": 2,
    "Direction-1": "Centre Commercial",
    "Direction-2": "Quartier Ouest",
    "temps": 15,
    "tempsPause": 4,
    "color": "#e67e22",
    "icon": "assets/img/bus15.png"
  }
}
```

---

## Crédits

Développé par [liveweeeb](https://github.com/liveweeeb13).
