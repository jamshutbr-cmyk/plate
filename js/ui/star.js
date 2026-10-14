// Звезда Telegram Stars как SVG: на разных телефонах эмодзи ⭐ выглядит по-разному, а так цвет и размер наши (css/donate.css, .dn-st)
export const STAR='<svg class="dn-st" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.4l2.95 6.02 6.65.93-4.82 4.64 1.16 6.6L12 17.5l-5.94 3.09 1.16-6.6L2.4 9.35l6.65-.93z"/></svg>';
export const price=n=>`<span class="dn-p">${STAR}${String(n).replace(/\B(?=(\d{3})+(?!\d))/g,'\u00a0')}</span>`;
