// ── ÉTAT GLOBAL ──
const state = {
  modpack: { category: '', version: '', sort: 'relevance', players: '', difficulty: '', loader: '', modIn: '', offset: 0, query: '' },
  mod:     { category: '', version: '', sort: 'relevance', loader: '', offset: 0, query: '' }
};

let searchTimers = { modpack: null, mod: null };
let modInTimer   = null;

// ── ONGLETS ──
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b) => {
    b.classList.toggle('active', b.getAttribute('onclick') === `switchTab('${tab}')`);
  });
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  if (tab === 'modpacks') fetchResults('modpack');
  if (tab === 'mods')     fetchResults('mod');
  if (tab === 'top10')    loadTop10();
  if (tab === 'guides')   renderGuides();
}

// ── FILTRES ──
function toggleFilter(id) {
  const el = document.getElementById(id);
  el.classList.toggle('hidden');
  el.previousElementSibling.querySelector('.chevron').textContent =
    el.classList.contains('hidden') ? '▼' : '▲';
}

function setFilter(type, key, value, btn) {
  state[type][key] = value;
  state[type].offset = 0;
  if (btn) {
    btn.closest('.filter-options').querySelectorAll('.filter-chip')
      .forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  fetchResults(type);
}

// ── RECHERCHE ──
function debounceSearch(type) {
  clearTimeout(searchTimers[type]);
  searchTimers[type] = setTimeout(() => {
    state[type].query = document.getElementById('search-' + type).value;
    state[type].offset = 0;
    fetchResults(type);
  }, 400);
}

function debounceModInSearch() {
  clearTimeout(modInTimer);
  modInTimer = setTimeout(() => {
    state.modpack.modIn = document.getElementById('search-mod-in-modpack').value;
    state.modpack.offset = 0;
    fetchResults('modpack');
  }, 400);
}

// ── BUILD URL ──
function buildUrl(type, overrides = {}) {
  const s = { ...state[type], ...overrides };
  const projectType = type === 'modpack' ? 'modpack' : 'mod';
  const facets = [["project_type:" + projectType]];

  if (s.category)   facets.push(["categories:" + s.category]);
  if (s.version)    facets.push(["versions:"    + s.version]);
  if (s.loader)     facets.push(["categories:"  + s.loader]);
  if (s.difficulty) facets.push(["categories:"  + s.difficulty]);
  if (s.players)    facets.push(["categories:"  + s.players]);

  const query = s.modIn || s.query || '';

  const params = new URLSearchParams({
    query,
    facets: JSON.stringify(facets),
    index:  s.sort   || 'relevance',
    limit:  20,
    offset: s.offset || 0
  });

  return `https://api.modrinth.com/v2/search?${params}`;
}

// ── FETCH AVEC FALLBACK ──
const restrictivite = ['difficulty', 'players', 'loader', 'category', 'version'];

async function fetchResults(type, append = false) {
  const container = document.getElementById('results-' + type);
  if (!append) container.innerHTML = '<p class="loading">Consultation des archives...</p>';

  try {
    const res  = await fetch(buildUrl(type));
    const data = await res.json();

    if (data.hits && data.hits.length > 0) {
      renderCards(type, data.hits, append);
      return;
    }

    await fetchWithFallback(type, { ...state[type] }, restrictivite.slice(), container);
  } catch(e) {
    container.innerHTML = '<p class="loading">Erreur de connexion aux archives.</p>';
  }
}

async function fetchWithFallback(type, currentFilters, criteresRestants, container) {
  if (criteresRestants.length === 0) {
    container.innerHTML = '<p class="loading">Aucun résultat trouvé.</p>';
    return;
  }

  const critereRetire  = criteresRestants.shift();
  const nouveauxFiltres = { ...currentFilters, [critereRetire]: '' };

  try {
    const res  = await fetch(buildUrl(type, nouveauxFiltres));
    const data = await res.json();

    if (data.hits && data.hits.length > 0) {
      const labels = {
        difficulty: 'la difficulté',
        players:    'le mode de jeu',
        loader:     'le mod loader',
        category:   'la catégorie',
        version:    'la version'
      };

      container.innerHTML = `
        <div class="fallback-notice">
          Aucun résultat exact — voici des suggestions en ignorant <strong>${labels[critereRetire] || critereRetire}</strong>
        </div>
      `;
      renderCards(type, data.hits, true);
    } else {
      await fetchWithFallback(type, nouveauxFiltres, criteresRestants, container);
    }
  } catch(e) {
    container.innerHTML = '<p class="loading">Erreur de connexion aux archives.</p>';
  }
}

// ── TOP 10 ──
async function loadTop10() {
  const grid = document.getElementById('top10-grid');
  grid.innerHTML = '<p class="loading">Chargement du top 10...</p>';

  try {
    const params = new URLSearchParams({
      facets: JSON.stringify([["project_type:modpack"]]),
      index:  'downloads',
      limit:  10,
      offset: 0
    });
    const res  = await fetch(`https://api.modrinth.com/v2/search?${params}`);
    const data = await res.json();

    grid.innerHTML = '';
    data.hits.forEach((item, i) => {
      const card = document.createElement('div');
      card.className = 'top10-card';
      card.style.animationDelay = (i * 0.06) + 's';
      card.onclick = () => openDetail(item, 'modpack');
      card.innerHTML = `
        <div class="top10-rank">${i + 1}</div>
        <img src="${item.icon_url || 'https://via.placeholder.com/48?text=MC'}" alt="${item.title}">
        <div class="top10-info">
          <h3>${item.title}</h3>
          <p>${item.description}</p>
          <div class="mod-meta">
            <span>⬇ ${formatNumber(item.downloads)}</span>
            <span>♥ ${formatNumber(item.follows)}</span>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
  } catch(e) {
    grid.innerHTML = '<p class="loading">Erreur de chargement.</p>';
  }
}

// ── GUIDES ──
const guidesData = [
  {
    emoji: '🚀',
    titre: 'Par où commencer avec les modpacks ?',
    resume: 'Tu découvres les modpacks ? Voici les bases pour bien démarrer sans te perdre.',
    contenu: `
      <h3>Par où commencer avec les modpacks ?</h3>
      <p>Un modpack, c'est une collection de mods déjà configurés et compatibles entre eux. Au lieu d'installer 50 mods à la main, tu lances un seul pack et tout est prêt.</p>
      <h4>Les étapes pour démarrer :</h4>
      <p><strong>1. Installe un launcher</strong> — <a href="https://modrinth.com/app" target="_blank">Modrinth App</a> ou CurseForge sont les deux plus populaires. Ils gèrent tout automatiquement.</p>
      <p><strong>2. Choisis ton modpack</strong> — Utilise le quiz sur l'accueil pour trouver celui qui correspond à ton style de jeu.</p>
      <p><strong>3. Alloue assez de RAM</strong> — La plupart des modpacks ont besoin d'au moins 4 Go de RAM, certains jusqu'à 8 Go. Règle ça dans les paramètres de ton launcher.</p>
      <p><strong>4. Lance et attends</strong> — Le premier démarrage prend du temps, c'est normal. Les mods se chargent tous au lancement.</p>
      <p><strong>Conseil :</strong> commence par un modpack léger comme <em>Vault Hunters</em> ou <em>All the Mods</em> pour t'habituer avant de passer aux packs plus lourds.</p>
    `
  },
  {
    emoji: '💻',
    titre: 'Quel PC pour les modpacks ?',
    resume: 'Forge, Fabric, peu de RAM... on t\'explique ce dont tu as vraiment besoin.',
    contenu: `
      <h3>Quel PC pour les modpacks ?</h3>
      <p>Les modpacks sont beaucoup plus gourmands que le Minecraft vanilla. Voici ce qu'il te faut selon le type de pack :</p>
      <h4>Modpacks légers (Casual)</h4>
      <p>4 Go de RAM allouée, n'importe quel PC de moins de 10 ans. Exemples : <em>Better MC</em>, <em>Prominence</em>.</p>
      <h4>Modpacks moyens</h4>
      <p>6-8 Go de RAM allouée, un processeur correct (i5 ou Ryzen 5). Exemples : <em>All the Mods 9</em>, <em>Enigmatica 6</em>.</p>
      <h4>Modpacks lourds</h4>
      <p>8-12 Go de RAM allouée, bon CPU et GPU. Exemples : <em>SkyFactory 4</em>, <em>FTB Revelation</em>.</p>
      <h4>Astuces pour améliorer les performances :</h4>
      <p>Installe les mods <strong>Sodium</strong> (Fabric) ou <strong>OptiFine</strong> (Forge) si le pack le permet. Baisse la distance de rendu à 8-10 chunks. Active la génération de chunks en arrière-plan dans les paramètres.</p>
    `
  },
  {
    emoji: '⚔️',
    titre: 'Top 5 modpacks pour débuter en 2025',
    resume: 'Les meilleurs modpacks pour les nouveaux joueurs, testés et approuvés.',
    contenu: `
      <h3>Top 5 modpacks pour débuter en 2025</h3>
      <p>Tu ne sais pas quel modpack choisir ? Voici notre sélection pour les débutants :</p>
      <p><strong>1. Better MC</strong> — Ajoute plein de contenu sans changer le gameplay de base. Parfait pour une première expérience moddée.</p>
      <p><strong>2. Prominence II</strong> — Aventure et exploration, très accessible. Un des modpacks les mieux notés du moment.</p>
      <p><strong>3. All the Mods 9</strong> — La référence pour découvrir la technologie et la magie. Énorme mais bien guidé.</p>
      <p><strong>4. RLCraft</strong> — Si tu veux du challenge dès le départ. Survie hardcore, mais très populaire.</p>
      <p><strong>5. Vault Hunters</strong> — Un modpack de quêtes avec une progression claire. Idéal pour jouer en multi.</p>
      <p>Utilise notre <strong>quiz sur l'accueil</strong> pour obtenir une recommandation personnalisée selon tes préférences !</p>
    `
  },
  {
    emoji: '🔧',
    titre: 'Forge vs Fabric vs NeoForge : quelles différences ?',
    resume: 'Tu ne sais pas quel mod loader choisir ? On t\'explique tout en 2 minutes.',
    contenu: `
      <h3>Forge vs Fabric vs NeoForge</h3>
      <p>Le mod loader, c'est le moteur qui fait tourner les mods. Chaque modpack en utilise un spécifique, tu ne peux pas les mélanger.</p>
      <h4>Forge</h4>
      <p>Le plus ancien et le plus répandu. La majorité des gros modpacks (FTB, ATM, etc.) utilisent Forge. Très stable, énorme bibliothèque de mods. Inconvénient : plus lent au chargement.</p>
      <h4>Fabric</h4>
      <p>Plus léger et plus rapide que Forge. Populaire pour les mods de performance (Sodium, Lithium) et les modpacks axés survie. La bibliothèque de mods est plus petite mais grandit vite.</p>
      <h4>NeoForge</h4>
      <p>Un fork de Forge créé en 2023 par une partie de l'équipe d'origine. Compatible avec beaucoup de mods Forge, et plus actif dans le développement. C'est l'avenir pour les gros modpacks.</p>
      <h4>Quilt</h4>
      <p>Un fork de Fabric, encore en développement. Peu de modpacks l'utilisent pour l'instant.</p>
      <p><strong>Conseil :</strong> ne te prends pas la tête, le launcher installe automatiquement le bon mod loader pour chaque modpack.</p>
    `
  },
  {
    emoji: '🌍',
    titre: 'Jouer en multijoueur : guide complet',
    resume: 'Comment jouer avec des amis sur un modpack, gratuitement ou avec un serveur dédié.',
    contenu: `
      <h3>Jouer en multijoueur sur un modpack</h3>
      <p>Jouer à un modpack avec des amis, c'est souvent l'expérience la plus fun. Voici comment faire.</p>
      <h4>Option 1 : LAN (réseau local)</h4>
      <p>Si vous êtes sur le même réseau Wi-Fi, un joueur héberge la partie depuis le jeu ("Ouvrir sur le réseau local"). Gratuit, mais vous devez être au même endroit.</p>
      <h4>Option 2 : Aternos (gratuit)</h4>
      <p><a href="https://aternos.org" target="_blank">Aternos</a> propose des serveurs Minecraft gratuits. Tu peux y installer des modpacks. Inconvénient : le serveur se met en veille quand personne ne joue.</p>
      <h4>Option 3 : Serveur payant</h4>
      <p>Pour une expérience stable, un VPS ou un hébergeur comme Bisect Hosting ou PebbleHost à partir de 3-5€/mois. Idéal pour jouer à plusieurs de façon régulière.</p>
      <h4>Important :</h4>
      <p>Tous les joueurs doivent avoir exactement la même version du modpack installée. Utilisez le même launcher et le même modpack pour éviter les problèmes de compatibilité.</p>
    `
  },
  {
    emoji: '📦',
    titre: 'Comment installer un modpack étape par étape',
    resume: 'Guide pas à pas pour installer ton premier modpack avec Modrinth App.',
    contenu: `
      <h3>Installer un modpack étape par étape</h3>
      <p>Voici comment installer n'importe quel modpack avec <strong>Modrinth App</strong> (recommandé) :</p>
      <p><strong>Étape 1 :</strong> Télécharge <a href="https://modrinth.com/app" target="_blank">Modrinth App</a> sur le site officiel et installe-le.</p>
      <p><strong>Étape 2 :</strong> Connecte-toi avec ton compte Microsoft (celui que tu utilises pour Minecraft).</p>
      <p><strong>Étape 3 :</strong> Dans l'onglet "Browse", cherche le modpack qui t'intéresse ou utilise notre quiz pour trouver lequel te correspond.</p>
      <p><strong>Étape 4 :</strong> Clique sur "Install". Le launcher télécharge automatiquement tous les mods et configure Java.</p>
      <p><strong>Étape 5 :</strong> Avant de lancer, va dans les paramètres de l'instance et alloue au moins 4-6 Go de RAM selon le modpack.</p>
      <p><strong>Étape 6 :</strong> Lance le jeu et attends le premier chargement (ça peut prendre 2-5 minutes la première fois).</p>
      <p><strong>Astuce :</strong> Si le jeu crashe au démarrage, c'est souvent un problème de RAM. Essaie d'augmenter l'allocation.</p>
    `
  }
];

let guideRendered = false;

function renderGuides() {
  if (guideRendered) return;
  guideRendered = true;

  const grid = document.getElementById('guides-grid');
  grid.innerHTML = '';

  guidesData.forEach((guide, i) => {
    const card = document.createElement('div');
    card.className = 'guide-card';
    card.style.animationDelay = (i * 0.07) + 's';
    card.onclick = () => openGuide(i);
    card.innerHTML = `
      <div class="guide-emoji">${guide.emoji}</div>
      <h3>${guide.titre}</h3>
      <p>${guide.resume}</p>
      <span class="guide-lire">Lire →</span>
    `;
    grid.appendChild(card);
  });
}

function openGuide(index) {
  const guide = guidesData[index];
  document.getElementById('modal-content').innerHTML = guide.contenu;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

// ── MODALES FOOTER ──
function openAbout() {
  document.getElementById('modal-content').innerHTML = `
    <h3>À propos de Minecraft Finder</h3>
    <p>Minecraft Finder est un outil gratuit conçu pour aider les joueurs à trouver le modpack ou le mod Minecraft qui correspond à leurs envies.</p>
    <p>Face aux milliers de modpacks disponibles sur Modrinth, il peut être difficile de savoir par où commencer. Notre quiz personnalisé, nos filtres avancés et notre top 10 sont là pour simplifier ce choix.</p>
    <p>Les données affichées sur ce site proviennent de l'API publique de <a href="https://modrinth.com" target="_blank">Modrinth</a>, la plus grande plateforme open-source de mods Minecraft.</p>
    <p>Ce site a été créé par un passionné de Minecraft et de modpacks, pour la communauté.</p>
    <p><strong>Contact :</strong> une question ou une suggestion ? Retrouvez-nous sur les réseaux ou via le formulaire de contact.</p>
  `;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function openPrivacy() {
  document.getElementById('modal-content').innerHTML = `
    <h3>Politique de confidentialité</h3>
    <p><em>Dernière mise à jour : mars 2025</em></p>
    <p>Minecraft Finder respecte votre vie privée. Voici comment nous utilisons vos données.</p>
    <h4>Données collectées</h4>
    <p>Minecraft Finder ne collecte aucune donnée personnelle directement. Ce site est un outil statique qui interroge l'API publique de Modrinth pour afficher des résultats de recherche.</p>
    <h4>Cookies</h4>
    <p>Ce site peut utiliser des cookies techniques nécessaires au bon fonctionnement (préférences de navigation). Si des publicités sont affichées via Google AdSense, des cookies tiers peuvent être déposés par Google à des fins publicitaires. Vous pouvez gérer vos préférences de cookies via les paramètres de votre navigateur.</p>
    <h4>Google AdSense</h4>
    <p>Ce site peut afficher des publicités via Google AdSense. Google utilise des cookies pour personnaliser les publicités affichées. Pour en savoir plus sur la façon dont Google utilise vos données, consultez la <a href="https://policies.google.com/privacy" target="_blank">politique de confidentialité de Google</a>.</p>
    <h4>Données de l'API Modrinth</h4>
    <p>Les données affichées (modpacks, mods, descriptions) proviennent de l'API publique de Modrinth. Minecraft Finder n'est pas responsable du contenu publié par les créateurs de mods sur Modrinth.</p>
    <h4>Vos droits</h4>
    <p>Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de suppression de vos données. Pour exercer ces droits, contactez-nous.</p>
  `;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function openLegal() {
  document.getElementById('modal-content').innerHTML = `
    <h3>Mentions légales</h3>
    <p><em>Dernière mise à jour : mars 2025</em></p>
    <h4>Éditeur du site</h4>
    <p>Minecraft Finder est un site personnel édité à titre non commercial.</p>
    <h4>Hébergement</h4>
    <p>Ce site est hébergé par Vercel Inc., 340 Pine Street Suite 701, San Francisco, California 94104, USA.</p>
    <h4>Propriété intellectuelle</h4>
    <p>Le contenu de ce site (quiz, guides, textes) est la propriété de l'éditeur sauf mention contraire. Les données relatives aux modpacks et mods proviennent de l'API publique de Modrinth et appartiennent à leurs créateurs respectifs.</p>
    <h4>Non-affiliation</h4>
    <p>Minecraft Finder n'est pas affilié à Mojang Studios, Microsoft, Modrinth ou CurseForge. "Minecraft" est une marque déposée de Mojang Studios.</p>
    <h4>Limitation de responsabilité</h4>
    <p>L'éditeur ne peut être tenu responsable des contenus publiés par les créateurs de mods sur Modrinth, ni des dommages pouvant résulter de l'installation de mods ou modpacks tiers.</p>
  `;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

// ── RENDU CARTES ──
function renderCards(type, items, append) {
  const container = document.getElementById('results-' + type);
  if (!append) container.innerHTML = '';

  if (!items || items.length === 0) {
    container.innerHTML = '<p class="loading">Aucun résultat trouvé.</p>';
    return;
  }

  items.forEach((item, i) => {
    const card = document.createElement('div');
    card.className = 'mod-card';
    card.style.animationDelay = (i * 0.04) + 's';
    card.style.cursor = 'pointer';
    card.onclick = () => openDetail(item, type);
    card.innerHTML = `
      <img src="${item.icon_url || 'https://via.placeholder.com/56?text=MC'}" alt="${item.title}">
      <div class="mod-info">
        <h3>${item.title}</h3>
        <p>${item.description}</p>
        <div class="mod-meta">
          <span>⬇ ${formatNumber(item.downloads)}</span>
          <span>♥ ${formatNumber(item.follows)}</span>
          ${item.versions?.length ? `<span>${item.versions[item.versions.length - 1]}</span>` : ''}
        </div>
        <span class="mod-info-link">Voir le détail →</span>
      </div>
    `;
    container.appendChild(card);
  });
}

// ── FORMAT ──
function formatNumber(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000)    return (n / 1000).toFixed(1) + 'k';
  return n;
}

function formatDescription(text) {
  if (!text) return 'Aucune description disponible.';

  const suspicious = [
    'adfoc.us', 'adfly', 'bit.ly', 'tinyurl', 'paypal', 'patreon',
    'ko-fi', 'buymeacoffee', 'img.shields.io', 'badge', 'sponsor', 'donate',
    'apexhost', 'apexminecraft', 'apex.gg',
    'nitrado', 'nitrado.net',
    'bisecthosting', 'bisecthost',
    'shockbyte', 'shockbyte.com',
    'mcprohosting', 'mcprohosting.com',
    'serverminer', 'serverminer.com',
    'nodecraft', 'nodecraft.com',
    'pebblehost', 'pebblehost.com',
    'melonhosting', 'aternos',
    'falixnodes', 'exaroton', 'exaroton.com',
    'crafted.host', 'sparked.host',
    'bloom.host',
    'curseforge.com',
    'twitter.com', 'x.com', 'youtube.com', 'twitch.tv',
    'discord.gg', 'discord.com/invite'
  ];

  text = text.replace(/!\[.*?\]\(.*?\)/g, '');
  text = text.split('\n').filter(line => {
    const lower = line.toLowerCase();
    return !suspicious.some(d => lower.includes(d));
  }).join('\n');

  text = text.replace(/\[(.+?)\]\((.*?)\)/g, (match, linkText, url) => {
    const isSuspicious = suspicious.some(d => url.toLowerCase().includes(d));
    if (isSuspicious) return '';
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
  });

  text = text
    .replace(/<script.*?>.*?<\/script>/gi, '')
    .replace(/<iframe.*?>.*?<\/iframe>/gi, '');

  text = text
    .replace(/#{1,6}\s(.+)/g, '<strong>$1</strong><br>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');

  text = text.replace(/(<br>){3,}/g, '<br><br>');

  return text;
}

// ── JOUABILITÉ ESTIMÉE ──
function estimerJouabilite(categories, downloads, follows) {
  const isMulti = categories.includes('multiplayer');
  const isSolo  = categories.includes('singleplayer');
  const ratio   = follows > 0 ? downloads / follows : 0;

  if (isMulti && isSolo) return { label: 'Solo & Multi',          confirmed: true  };
  if (isMulti)           return { label: 'Multijoueur',           confirmed: true  };
  if (isSolo)            return { label: 'Solo',                  confirmed: true  };
  if (ratio > 5000)      return { label: 'Probablement Multi',    confirmed: false };
  if (ratio > 2000)      return { label: 'Solo & Multi estimé',   confirmed: false };
  return                        { label: 'Solo estimé',           confirmed: false };
}

// ── TRADUCTION ──
async function traduireTexte(text) {
  if (!text || text.length < 10) return text;
  const motsFr = ['le','la','les','de','du','des','un','une','et','est','avec','pour','sur','dans'];
  const mots   = text.toLowerCase().split(/\s+/).slice(0, 30);
  const isFr   = mots.filter(m => motsFr.includes(m)).length >= 3;
  if (isFr) return text;

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=en|fr`;
    const res  = await fetch(url);
    const data = await res.json();
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      return data.responseData.translatedText;
    }
  } catch(e) {}
  return text;
}

// ── PARTAGE ──
function partagerModpack(slug, title) {
  const url = `${window.location.origin}${window.location.pathname}?modpack=${slug}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      showToast(`Lien copié pour "${title}"`);
    });
  } else {
    prompt('Copie ce lien :', url);
  }
}

function showToast(message) {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('toast-visible'), 10);
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── LOAD MORE ──
function loadMore(type) {
  state[type].offset += 20;
  fetchResults(type, true);
}

// ── PAGE DÉTAIL ──
async function openDetail(item, type) {
  const page    = document.getElementById('detail-page');
  const content = document.getElementById('detail-content');

  page.classList.remove('detail-hidden');
  page.scrollTo(0, 0);

  content.innerHTML = `
    <div class="detail-inner">
      <button class="detail-back" onclick="closeDetail()">← Retour</button>
      <p class="loading">Chargement des archives...</p>
    </div>
  `;

  let fullDescription = item.description;
  try {
    const res  = await fetch(`https://api.modrinth.com/v2/project/${item.slug}`);
    const data = await res.json();
    fullDescription = data.body || item.description;
  } catch(e) {}

  const descCourteTradte = await traduireTexte(item.description);

  const projectType = type === 'modpack' ? 'modpack' : 'mod';
  const modrinthUrl = `https://modrinth.com/${projectType}/${item.slug}`;
  const categories  = item.categories || [];
  const jouabilite  = estimerJouabilite(categories, item.downloads, item.follows);
  const confiance   = jouabilite.confirmed ? '✓ Confirmé' : '~ Estimé';

  const difficulte =
    categories.includes('hardcore')    ? 'Hardcore'  :
    categories.includes('challenging') ? 'Difficile' :
    categories.includes('lightweight') ? 'Casual'    : 'Modérée';

  const loader   = ['forge','fabric','quilt','neoforge'].find(l => categories.includes(l));
  const versions = item.versions ? item.versions.slice(-3).reverse().join(', ') : 'N/A';

  history.pushState({}, '', `?modpack=${item.slug}`);

  content.innerHTML = `
    <div class="detail-inner">

      <button class="detail-back" onclick="closeDetail()">← Retour</button>

      <div class="detail-hero">
        <img src="${item.icon_url || 'https://via.placeholder.com/96?text=MC'}" alt="${item.title}">
        <div class="detail-hero-info">
          <h2>${item.title}</h2>
          <p>${descCourteTradte}</p>
        </div>
      </div>

      <div class="detail-divider"></div>

      <div class="detail-grid">
        <div class="detail-stat">
          <div class="detail-stat-label">Téléchargements</div>
          <div class="detail-stat-value">${formatNumber(item.downloads)}</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-label">Favoris</div>
          <div class="detail-stat-value">${formatNumber(item.follows)}</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-label">Jouabilité <span class="stat-badge">${confiance}</span></div>
          <div class="detail-stat-value">${jouabilite.label}</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-label">Difficulté</div>
          <div class="detail-stat-value">${difficulte}</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-label">Mod loader</div>
          <div class="detail-stat-value">${loader ? loader.charAt(0).toUpperCase() + loader.slice(1) : 'Universel'}</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-label">Versions MC</div>
          <div class="detail-stat-value">${versions}</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-label">Type</div>
          <div class="detail-stat-value">${projectType === 'modpack' ? 'Modpack' : 'Mod'}</div>
        </div>
      </div>

      ${categories.length > 0 ? `
        <div class="detail-section-title">Catégories</div>
        <div class="detail-tags">
          ${categories.map(c => `<span class="detail-tag">${c}</span>`).join('')}
        </div>
      ` : ''}

      <div class="detail-divider"></div>

      <div class="detail-section-title">Description complète</div>
      <div class="detail-description" id="detail-desc-text">${formatDescription(fullDescription)}</div>

      <div class="detail-actions">
        <a href="${modrinthUrl}" target="_blank" class="detail-cta">Voir sur Modrinth →</a>
        <button class="detail-share" onclick="partagerModpack('${item.slug}', '${item.title.replace(/'/g, "\\'")}')">
          Partager ce modpack
        </button>
      </div>

    </div>
  `;
}

function closeDetail() {
  document.getElementById('detail-page').classList.add('detail-hidden');
  history.pushState({}, '', window.location.pathname);
}

// ── GESTION URL PARTAGE ──
async function checkUrlPartage() {
  const params = new URLSearchParams(window.location.search);
  const slug   = params.get('modpack');
  if (!slug) return;

  try {
    const res  = await fetch(`https://api.modrinth.com/v2/project/${slug}`);
    const data = await res.json();
    if (data && data.slug) {
      const item = {
        slug:        data.slug,
        title:       data.title,
        description: data.description,
        icon_url:    data.icon_url,
        downloads:   data.downloads,
        follows:     data.followers,
        categories:  data.categories,
        versions:    data.game_versions
      };
      openDetail(item, data.project_type || 'modpack');
    }
  } catch(e) {}
}

// ── QUIZ ──
const questions = [
  {
    id: "players",
    question: "Tu joues comment ?",
    options: [
      { label: "Solo",        value: ""            },
      { label: "Multijoueur", value: "multiplayer" }
    ]
  },
  {
    id: "type",
    question: "Quel type de jeu ?",
    options: [
      { label: "Aventure",    value: "adventure"   },
      { label: "Combat",      value: "combat"      },
      { label: "Magie",       value: "magic"       },
      { label: "Technologie", value: "technology"  },
      { label: "Quêtes",      value: "quests"      },
      { label: "Peu importe", value: ""            }
    ]
  },
  {
    id: "difficulty",
    question: "Niveau de challenge ?",
    options: [
      { label: "Chill / Casual", value: "lightweight" },
      { label: "Normal",         value: ""             },
      { label: "Difficile",      value: "challenging"  },
      { label: "Hardcore",       value: "hardcore"     }
    ]
  },
  {
    id: "perf",
    question: "Ton PC il tient la route ?",
    options: [
      { label: "PC gamer", value: "high"   },
      { label: "PC moyen", value: "medium" },
      { label: "Vieux PC", value: "low"    }
    ]
  }
];

let answers         = {};
let currentQuestion = 0;

function renderQuestion() {
  const quiz = document.getElementById("quiz");
  const q    = questions[currentQuestion];
  quiz.innerHTML = `
    <div class="question">
      <p class="question-text">${q.question}</p>
      <div class="options">
        ${q.options.map(opt => `
          <button class="option-btn" onclick="selectAnswer('${q.id}', '${opt.value}')">${opt.label}</button>
        `).join("")}
      </div>
      <p class="progress">${currentQuestion + 1} / ${questions.length}</p>
    </div>
  `;
}

function selectAnswer(id, value) {
  answers[id] = value;
  currentQuestion++;
  if (currentQuestion < questions.length) {
    renderQuestion();
  } else {
    searchModpacks();
  }
}

async function searchModpacks() {
  document.getElementById("quiz").innerHTML    = "";
  document.getElementById("results").innerHTML = '<p class="loading">Consultation des archives...</p>';

  const facets = [["project_type:modpack"]];
  if (answers.players)                    facets.push(["categories:" + answers.players]);
  if (answers.type)                       facets.push(["categories:" + answers.type]);
  if (answers.difficulty)                 facets.push(["categories:" + answers.difficulty]);
  if (answers.perf === 'low')             facets.push(["categories:lightweight"]);

  const params = new URLSearchParams({
    facets: JSON.stringify(facets),
    index:  'downloads',
    limit:  10
  });

  try {
    const res  = await fetch(`https://api.modrinth.com/v2/search?${params}`);
    const data = await res.json();

    if (data.hits && data.hits.length > 0) {
      renderQuizResults(data.hits);
    } else {
      const facetsFallback = [["project_type:modpack"]];
      if (answers.players) facetsFallback.push(["categories:" + answers.players]);
      if (answers.type)    facetsFallback.push(["categories:" + answers.type]);

      const paramsFallback = new URLSearchParams({
        facets: JSON.stringify(facetsFallback),
        index:  'downloads',
        limit:  10
      });
      const res2  = await fetch(`https://api.modrinth.com/v2/search?${paramsFallback}`);
      const data2 = await res2.json();
      renderQuizResults(data2.hits);
    }
  } catch(e) {
    document.getElementById("results").innerHTML = '<p class="loading">Erreur lors de la recherche.</p>';
  }
}

function renderQuizResults(mods) {
  const results = document.getElementById("results");

  if (!mods || mods.length === 0) {
    results.innerHTML = '<p class="loading">Aucun modpack trouvé. Réessaie.</p>';
    return;
  }

  results.innerHTML = `
    <h2 class="section-title" style="margin-top:40px">Modpacks recommandés pour toi</h2>
    <div class="mods-grid"></div>
    <button class="restart-btn" onclick="restart()">Recommencer le quiz</button>
  `;

  const grid = results.querySelector('.mods-grid');
  mods.forEach((mod, i) => {
    const card = document.createElement('div');
    card.className = 'mod-card';
    card.style.animationDelay = (i * 0.05) + 's';
    card.style.cursor = 'pointer';
    card.onclick = () => openDetail(mod, 'modpack');
    card.innerHTML = `
      <img src="${mod.icon_url || 'https://via.placeholder.com/56?text=MC'}" alt="${mod.title}">
      <div class="mod-info">
        <h3>${mod.title}</h3>
        <p>${mod.description}</p>
        <div class="mod-meta">
          <span>⬇ ${formatNumber(mod.downloads)}</span>
          <span>♥ ${formatNumber(mod.follows)}</span>
        </div>
        <span class="mod-info-link">Voir le détail →</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

function restart() {
  answers = {};
  currentQuestion = 0;
  document.getElementById("results").innerHTML = "";
  renderQuestion();
}

// ── INIT ──
renderQuestion();
checkUrlPartage();