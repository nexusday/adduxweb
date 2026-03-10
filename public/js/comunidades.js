import { database, ref, onValue } from './base.js';

const typeMeta = {
    whatsapp: { label: 'WhatsApp', icon: 'fab fa-whatsapp', className: 'whatsapp' },
    discord: { label: 'Discord', icon: 'fab fa-discord', className: 'discord' },
    telegram: { label: 'Telegram', icon: 'fab fa-telegram-plane', className: 'telegram' }
};

function renderCommunities(items) {
    const grid = document.getElementById('communitiesGrid');
    const counter = document.getElementById('communitiesCount');
    if (!grid) return;

    if (!items || items.length === 0) {
        grid.innerHTML = '<div class="empty-state">Aún no hay comunidades publicadas.</div>';
        if (counter) counter.textContent = '0 comunidades';
        return;
    }

    if (counter) counter.textContent = `${items.length} comunidad${items.length === 1 ? '' : 'es'}`;

    grid.innerHTML = items.map(comm => {
        const type = typeMeta[(comm.type || '').toLowerCase()] || typeMeta.whatsapp;
        const name = escapeHtml(comm.name || 'Comunidad');
        const link = escapeHtml(comm.link || '#');
        return `
            <div class="community-card">
                <div class="community-top">
                    <span class="community-icon ${type.className}"><i class="${type.icon}"></i></span>
                    <div>
                        <div class="community-name">${name}</div>
                        <span class="community-type ${type.className}">${type.label}</span>
                    </div>
                </div>
                <div class="community-actions">
                    <div class="community-link">
                        <a class="btn btn-primary" href="${link}" target="_blank" rel="noopener">Entrar</a>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function loadCommunitiesPublic() {
    const refCommunities = ref(database, 'communities');
    onValue(refCommunities, (snapshot) => {
        const data = snapshot.val() || {};
        const list = Object.entries(data)
            .map(([id, value]) => ({ id, ...(value || {}) }))
            .filter(item => Object.keys(item).length > 1);

        list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        renderCommunities(list);
    });
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}

document.addEventListener('DOMContentLoaded', () => {
    loadCommunitiesPublic();
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
});




