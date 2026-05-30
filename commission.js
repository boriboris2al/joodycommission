const getSupabaseClient = () => window.supabaseClient;

window.currentActiveTags = [];
window.currentSearch = "";
window.currentSortMode = "random";

function renderContactInfo(contactText) {
    if (!contactText) return `<span class="text-gray-400">등록된 연락망이 없습니다.</span>`;
    const trimmed = contactText.trim();
    const isUrl = /^(http|https):\/\/[^\s]+/.test(trimmed);
    if (isUrl) {
        return `<a href="${trimmed}" target="_blank" class="text-blue-500 font-bold underline hover:text-blue-600 break-all">${trimmed} 🔗</a>`;
    } else {
        return `<span class="text-gray-700 font-medium break-all select-all">${contactText}</span>`;
    }
}

function renderTagDropdowns() {
    const categories = {
        '화풍': ['SD', 'LD'],
        '틀 종류': ['고정틀', '반고정틀', '자유'],
        '채색': ['낙서', '선화', '단색', '풀채색'],
        '구도': ['두상', '흉상', '반신', '전신'],
        '기타': ['캐디', '기타']
    };
    for (const [catName, tags] of Object.entries(categories)) {
        const wrapper = document.getElementById(`dropdown-${catName}`);
        if (!wrapper) continue;
        const panel = wrapper.querySelector('.dropdown-panel');
        if (!panel) continue;
        panel.innerHTML = tags.map(tag =>
            `<button onclick="toggleTagFilter('${tag}')" id="tagBtn-${tag}" class="bg-gray-50 text-gray-700 hover:bg-pink-50 hover:text-pink-600 rounded-lg text-center font-medium transition py-1 px-2.5 text-xs block w-full">#${tag}</button>`
        ).join('');
    }
}

function toggleDropdown(catName) {
    const wrapper = document.getElementById(`dropdown-${catName}`);
    if (!wrapper) return;
    const panel = wrapper.querySelector('.dropdown-panel');
    const arrow = wrapper.querySelector('.dropdown-arrow');
    const isHidden = panel.classList.contains('hidden');

    ['화풍', '틀 종류', '채색', '구도', '기타'].forEach(c => {
        const w = document.getElementById(`dropdown-${c}`);
        if (w) {
            w.querySelector('.dropdown-panel').classList.add('hidden');
            w.querySelector('.dropdown-arrow').style.transform = 'rotate(0deg)';
        }
    });
    if (isHidden) {
        panel.classList.remove('hidden');
        if (arrow) arrow.style.transform = 'rotate(180deg)';
    }
}

function toggleTagFilter(tag) {
    const idx = window.currentActiveTags.indexOf(tag);
    const btn = document.getElementById(`tagBtn-${tag}`);
    if (idx > -1) {
        window.currentActiveTags.splice(idx, 1);
        if (btn) btn.className = "bg-gray-50 text-gray-700 hover:bg-pink-50 hover:text-pink-600 rounded-lg text-center font-medium transition py-1 px-2.5 text-xs block w-full";
    } else {
        window.currentActiveTags.push(tag);
        if (btn) btn.className = "bg-pink-500 text-white font-bold rounded-lg text-center transition py-1 px-2.5 text-xs block w-full shadow-2xs";
    }
    fetchCommissions();
}

function changeFilter(btn, mode) {
    if (mode === '전체') {
        window.currentActiveTags = [];
        document.querySelectorAll('.dropdown-panel button').forEach(b => {
            b.className = "bg-gray-50 text-gray-700 hover:bg-pink-50 hover:text-pink-600 rounded-lg text-center font-medium transition py-1 px-2.5 text-xs block w-full";
        });
        fetchCommissions();
    }
}

function changeSortMode(mode) {
    window.currentSortMode = mode;
    document.querySelectorAll('.sort-btn').forEach(b => {
        b.classList.remove('bg-pink-500', 'text-white', 'shadow-sm');
        b.classList.add('bg-white', 'text-gray-600', 'border', 'border-gray-200');
    });
    const activeBtn = document.getElementById(`sort-${mode}`);
    if (activeBtn) {
        activeBtn.classList.remove('bg-white', 'text-gray-600', 'border', 'border-gray-200');
        activeBtn.classList.add('bg-pink-500', 'text-white', 'shadow-sm');
    }
    fetchCommissions();
}

function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

async function fetchCommissions() {
    const listEl = document.getElementById('commissionList');
    if (!listEl) return;
    listEl.innerHTML = "<p class='text-xs text-gray-400 text-center py-10'>커미션 피드를 불러오는 중... 🎀</p>";

    try {
        const { data, error } = await getSupabaseClient()
            .from('commissions')
            .select(`*, profiles!inner ( username, role, contact_info, response_time )`)
            .eq('is_private', false)
            .order('bumped_at', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false });

        if (error) throw error;

        let filteredData = data || [];

        const searchKeyword = (window.currentSearch || "").trim().toLowerCase();
        if (searchKeyword !== "") {
            filteredData = filteredData.filter(item => {
                const titleMatch = item.title && item.title.toLowerCase().includes(searchKeyword);
                const artistName = item.profiles ? item.profiles.username : '';
                const artistMatch = artistName && artistName.toLowerCase().includes(searchKeyword);
                return titleMatch || artistMatch;
            });
        }

        if (window.currentActiveTags.length > 0) {
            filteredData = filteredData.filter(item => {
                if (!item.tags || !Array.isArray(item.tags)) return false;
                return window.currentActiveTags.every(t => item.tags.includes(t));
            });
        }

        const sortMode = window.currentSortMode || 'random';

        const ids = filteredData.map(i => i.id);
        if (ids.length > 0) {
            const { data: bData } = await getSupabaseClient()
                .from('bookmarks')
                .select('commission_id')
                .in('commission_id', ids);

            const { data: rData } = await getSupabaseClient()
                .from('reviews')
                .select('commission_id')
                .in('commission_id', ids);

            const bookmarkMap = {};
            const reviewMap = {};
            (bData || []).forEach(b => { bookmarkMap[b.commission_id] = (bookmarkMap[b.commission_id] || 0) + 1; });
            (rData || []).forEach(r => { reviewMap[r.commission_id] = (reviewMap[r.commission_id] || 0) + 1; });

            filteredData = filteredData.map(item => ({
                ...item,
                bookmark_count: bookmarkMap[item.id] || 0,
                review_count: reviewMap[item.id] || 0,
            }));
        }

        if (sortMode === 'random') {
            filteredData = shuffleArray(filteredData);
        } else if (sortMode === 'reviews') {
            filteredData.sort((a, b) => (b.review_count || 0) - (a.review_count || 0));
        } else if (sortMode === 'bookmarks') {
            filteredData.sort((a, b) => (b.bookmark_count || 0) - (a.bookmark_count || 0));
        } else if (sortMode === 'popular') {
            filteredData.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
        } else if (sortMode === 'latest') {
            filteredData.sort((a, b) => {
                const dateA = new Date(a.bumped_at || a.created_at);
                const dateB = new Date(b.bumped_at || b.created_at);
                return dateB - dateA;
            });
        }

        if (filteredData.length === 0) {
            listEl.innerHTML = "<p class='text-xs text-gray-400 text-center py-14'>조건에 맞는 커미션 타입이 없습니다. 🥲</p>";
            return;
        }

        listEl.innerHTML = filteredData.map(item => {
            const artistName = item.profiles ? item.profiles.username : '알 수 없음';
            let firstImg = 'https://placehold.co/400x300/fbcfe8/fff?text=No+Image';
            if (item.image_url) {
                firstImg = item.image_url.includes(',') ? item.image_url.split(',')[0] : item.image_url;
            }
            const slotText = item.slot_type === 'always' ? '상시 모집' : `슬롯 ${item.current_slots || 0}/${item.max_slots || 5}`;
            const statusBadge = item.is_closed
                ? `<span class="bg-gray-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">마감</span>`
                : `<span class="bg-pink-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">모집중</span>`;
            const tagsHtml = (item.tags && item.tags.length > 0)
                ? item.tags.map(t => `<span class="bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded-md">#${t}</span>`).join(' ')
                : '';
            const bumpedBadge = item.bumped_at
                ? `<span class="bg-amber-100 text-amber-600 text-[9px] font-bold px-1.5 py-0.5 rounded-full"> bump </span>`
                : '';

            return `
                <div class="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col" onclick="openDetailModal(${item.id})">
                    <div class="relative w-full h-48 bg-gray-50 overflow-hidden">
                        <img src="${firstImg}" alt="${item.title}" class="w-full h-full object-cover">
                        <span class="absolute bottom-3 right-3 bg-black/60 text-white text-[11px] font-bold px-2.5 py-1 rounded-full backdrop-blur-xs">💎 ${item.price} 가치</span>
                    </div>
                    <div class="p-3.5 flex flex-col gap-1.5">
                        <div class="flex justify-between items-center text-[11px]">
                            <span class="text-pink-600 font-bold hover:underline" onclick="event.stopPropagation(); openArtistProfile('${item.user_id}');">🎨 ${artistName}</span>
                            <div class="flex items-center gap-1">${bumpedBadge} ${statusBadge} <span class="text-gray-400 font-medium">${slotText}</span></div>
                        </div>
                        <h3 class="text-sm font-bold text-gray-900 line-clamp-1">${item.title}</h3>
                        <div class="flex flex-wrap gap-1 mt-0.5">${tagsHtml}</div>
                    </div>
                </div>`;
        }).join('');
    } catch (err) {
        console.error("fetchCommissions 오류:", err);
        listEl.innerHTML = "<p class='text-xs text-red-400 text-center py-10'>데이터 요청 중 에러 발생</p>";
    }
}

async function openArtistProfile(userId) {
    if (!userId) return alert("유효하지 않은 작가 회원 정보입니다.");
    try {
        const { data: prof, error: pErr } = await getSupabaseClient().from('profiles').select('username, role, contact_info, response_time').eq('id', userId).maybeSingle();
        if (pErr || !prof) throw new Error("profiles 데이터를 조회할 수 없습니다.");

        document.getElementById('artistNameTitle').innerText = `🎨 ${prof.username} 님의 프로필`;
        let roleStr = "커미션주";
        if (prof.role === 'applicant') roleStr = "일반 신청자";
        if (prof.role === 'both') roleStr = "반장/신청자 공용";
        document.getElementById('artistRoleBadge').innerText = roleStr;
        document.getElementById('artistContactInfo').innerHTML = renderContactInfo(prof.contact_info);
        document.getElementById('artistResponseTime').innerText = prof.response_time || "지정된 응답 가능 시간이 없습니다.";

        const shareBtn = document.getElementById('artistShareBtn');
        if (shareBtn) shareBtn.onclick = () => { if (typeof shareProfileLink === 'function') shareProfileLink(userId, prof.username); };

        const listContainer = document.getElementById('artistCommissionsList');
        listContainer.innerHTML = "<p class='text-[11px] text-gray-400 py-2'>등록된 타입을 조회 중입니다...</p>";
        openModal('artistProfileModal');

        const { data: comms } = await getSupabaseClient()
            .from('commissions')
            .select('id, title, price, image_url, slot_type, is_closed')
            .eq('user_id', userId)
            .eq('is_private', false)
            .order('bumped_at', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false });

        if (!comms || comms.length === 0) {
            listContainer.innerHTML = "<p class='text-[11px] text-gray-400 py-2 text-center'>현재 전시 중인 공개 타입이 없습니다.</p>";
        } else {
            listContainer.innerHTML = comms.map(c => {
                let img = 'https://placehold.co/100x100/fbcfe8/fff?text=No+Img';
                if (c.image_url) img = c.image_url.includes(',') ? c.image_url.split(',')[0] : c.image_url;
                const sBadge = c.is_closed
                    ? `<span class="bg-gray-300 text-gray-600 px-1.5 py-0.5 rounded text-[9px] font-bold">마감</span>`
                    : `<span class="bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded text-[9px] font-bold">모집</span>`;
                return `
                    <div class="flex items-center gap-3 bg-gray-50/70 p-2 rounded-xl border border-gray-100 cursor-pointer hover:bg-pink-50/20" onclick="closeModal('artistProfileModal'); openDetailModal(${c.id});">
                        <img src="${img}" class="w-11 h-11 object-cover rounded-lg border border-gray-200">
                        <div class="flex-1 min-w-0">
                            <p class="text-xs font-bold text-gray-800 truncate">${c.title}</p>
                            <p class="text-[10px] text-gray-400 mt-0.5">${c.price} 가치</p>
                        </div>
                        <div class="flex flex-col items-end gap-1">
                            ${sBadge}
                            <button onclick="event.stopPropagation(); shareCommissionLink(${c.id}, '${c.title.replace(/'/g, "\\'")}')" class="text-[9px] text-purple-500 hover:underline">🔗 공유</button>
                        </div>
                    </div>`;
            }).join('');
        }
    } catch (e) { alert("작가 프로필 로드 실패: " + e.message); }
}

async function openDetailModal(id) {
    try {
        const { data: item, error } = await getSupabaseClient()
            .from('commissions')
            .select(`*, profiles ( username, contact_info )`)
            .eq('id', id)
            .maybeSingle();
        if (error || !item) return alert("해당 커미션 글이 존재하지 않거나 삭제되었습니다.");

        getSupabaseClient()
            .from('commissions')
            .update({ view_count: (item.view_count || 0) + 1 })
            .eq('id', id)
            .then(() => {})
            .catch(() => {});

        const isMine = window.currentUserId === item.user_id;
        document.getElementById('detailDeleteBtn').style.display = isMine ? 'block' : 'none';
        document.getElementById('detailEditBtn').style.display = isMine ? 'block' : 'none';
        
        // 끌어올리기 버튼 제어 및 클릭 이벤트 매핑
        const bumpBtn = document.getElementById('detailBumpBtn');
        if (bumpBtn) {
            bumpBtn.style.display = isMine ? 'block' : 'none';
            bumpBtn.onclick = () => { handleBumpCommission(item.id, item.bumped_at); };
        }

        document.getElementById('detailDeleteBtn').onclick = () => { closeModal('detailModal'); handleDeleteCommission(item.id, item.title); };
        document.getElementById('detailEditBtn').onclick = () => { closeModal('detailModal'); setupEditMode(item); };

        const detailShareBtn = document.getElementById('detailShareBtn');
        if (detailShareBtn) detailShareBtn.onclick = () => { if (typeof shareCommissionLink === 'function') shareCommissionLink(item.id, item.title); };

        const slider = document.getElementById('detailSliderContainer');
        const counter = document.getElementById('detailImgCounter');
        slider.innerHTML = "";
        let imgs = item.image_url
            ? (item.image_url.includes(',') ? item.image_url.split(',') : [item.image_url])
            : ['https://placehold.co/400x300/fbcfe8/fff?text=No+Image'];

        imgs.forEach((url, idx) => { 
            slider.innerHTML += `<img src="${url.trim()}" class="w-full h-full object-cover flex-shrink-0 snap-center cursor-zoom-in" onclick="openImageViewer(${JSON.stringify(imgs).replace(/"/g, '&quot;')}, ${idx})">`; 
        });

        if (imgs.length > 1) {
            counter.innerText = `1 / ${imgs.length}`;
            counter.classList.remove('hidden');
            slider.onscroll = () => { const idx = Math.round(slider.scrollLeft / slider.clientWidth) + 1; counter.innerText = `${idx} / ${imgs.length}`; };
        } else { counter.classList.add('hidden'); slider.onscroll = null; }

        document.getElementById('detailPrice').innerText = `💎 ${item.price} 가치`;
        const artistName = item.profiles ? item.profiles.username : '알 수 없음';
        const artistSpan = document.getElementById('detailArtist');
        artistSpan.innerText = `🎨 작가: ${artistName}`;
        artistSpan.onclick = () => { closeModal('detailModal'); openArtistProfile(item.user_id); };

        const slotText = item.slot_type === 'always' ? '상시 모집' : `슬롯 마감현황 (${item.current_slots || 0}/${item.max_slots || 5})`;
        document.getElementById('detailSlot').innerText = item.is_closed ? '🔒 슬롯 마감' : `🔓 ${slotText}`;
        document.getElementById('detailTitle').innerText = item.title;
        document.getElementById('detailItem').innerText = item.item_wanted || '상세내용 없음';
        document.getElementById('detailDeadline').innerText = item.deadline || '상세 협의 후 결정';
        document.getElementById('detailCredit').innerText = item.credit_rule || '출처 표기 불필요';
        document.getElementById('detailDesc').innerText = item.description || '';

        const okEl = document.getElementById('detailOk');
        const ngEl = document.getElementById('detailNg');
        if (okEl) okEl.innerText = item.ok_list || '특별한 제한 없음';
        if (ngEl) ngEl.innerText = item.ng_list || '특별한 제한 없음';

        const contactBtn = document.getElementById('detailContactBtn');
        const contactTarget = item.contact_info || (item.profiles ? item.profiles.contact_info : '');
        if (contactTarget) {
            contactBtn.innerText = "💬 작가님에게 커미션 신청하기";
            contactBtn.onclick = () => {
                const cleanLink = contactTarget.trim();
                if (/^(http|https):\/\/[^\s]+/.test(cleanLink)) { window.open(cleanLink, '_blank'); }
                else { alert(`작가님 연락망 정보입니다.\n\n📋 연락처: ${cleanLink}`); }
            };
        } else { contactBtn.innerText = "등록된 연락 경로가 없습니다."; contactBtn.onclick = null; }

        await BookmarkBtn(item.id);
        document.getElementById('targetCommissionId').value = item.id;

        window.editingReviewId = null;
        const reviewContent = document.getElementById('reviewContent');
        const reviewSubmitBtn = document.getElementById('reviewSubmitBtn');
        const reviewCancelBtn = document.getElementById('reviewCancelEditBtn');
        if (reviewContent) reviewContent.value = '';
        if (reviewSubmitBtn) { reviewSubmitBtn.innerText = '등록'; reviewSubmitBtn.className = 'bg-gray-800 text-white px-4 rounded-xl text-xs font-bold whitespace-nowrap shadow-sm'; }
        if (reviewCancelBtn) reviewCancelBtn.classList.add('hidden');

        fetchReviews(item.id);
        openModal('detailModal');
    } catch (e) { alert("상세화면을 열지 못했습니다: " + e.message); }
}

// ⬆️ 커미션 최신글로 끌어올리기 기능 구현 (이틀/48시간 제한 시간 계산 포함)
async function handleBumpCommission(id, lastBumpedAt) {
    if (lastBumpedAt) {
        const lastDate = new Date(lastBumpedAt);
        const now = new Date();
        const diffMs = now - lastDate;
        const hoursLeft = 48 - (diffMs / (1000 * 60 * 60));
        
        if (hoursLeft > 0) {
            const minutesLeft = Math.ceil((hoursLeft % 1) * 60);
            return alert(`⚠️ 커미션 끌어올리기는 이틀에 한 번만 가능합니다.\n\n재사용 가능까지 남은 시간: ${Math.floor(hoursLeft)}시간 ${minutesLeft}분`);
        }
    }

    if (!confirm("이 커미션 타입을 목록 최상단으로 끌어올리시겠습니까?")) return;

    try {
        const isoNow = new Date().toISOString();
        const { error } = await getSupabaseClient()
            .from('commissions')
            .update({ bumped_at: isoNow })
            .eq('id', id)
            .eq('user_id', window.currentUserId);

        if (error) throw error;
        alert("성공적으로 최신 피드로 끌어올렸습니다! ✨");
        closeModal('detailModal');
        fetchCommissions();
    } catch (err) {
        alert("끌어올리기 처리 실패: " + err.message);
    }
}

function openImageViewer(images, startIdx) {
    const existing = document.getElementById('imageViewerOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'imageViewerOverlay';
    overlay.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.96);
        z-index: 50000 !important; display: flex; flex-direction: column;
        justify-content: center; align-items: center; overflow: hidden;
    `;

    overlay.innerHTML = `
        <button id="viewerCloseBtn"
            style="position:absolute; top:16px; right:16px; color:white; font-size:24px;
                   background:rgba(255,255,255,0.2); border:none; cursor:pointer;
                   z-index:52000; width:40px; height:40px; border-radius:50%;
                   display:flex; align-items:center; justify-content:center; line-height:1; backdrop-filter:blur(4px);">✕</button>
        
        <div style="position:relative; width:100%; display:flex; align-items:center; justify-content:center; max-width:420px;">
            ${images.length > 1 ? `<button id="viewerPrevBtn" style="position:absolute; left:12px; z-index:52000; color:white; font-size:24px; background:rgba(0,0,0,0.4); border:none; cursor:pointer; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; padding-bottom:3px; font-weight:bold; box-shadow:0 2px 8px rgba(0,0,0,0.2);">‹</button>` : ''}
            <div id="viewerSliderContainer" 
                 style="display:flex; width:100%; height:75vh; overflow-x:auto; scroll-snap-type:x mandatory; scroll-behavior:smooth; -webkit-overflow-scrolling:touch;" 
                 class="scrollbar-none">
                ${images.map(url => `
                    <div style="width:100%; height:100%; flex-shrink:0; scroll-snap-align:center; display:flex; align-items:center; justify-content:center; padding:0 12px;">
                        <img src="${url.trim()}" style="max-width:100%; max-height:100%; object-fit:contain; border-radius:8px; pointer-events:none;">
                    </div>
                `).join('')}
            </div>
            ${images.length > 1 ? `<button id="viewerNextBtn" style="position:absolute; right:12px; z-index:52000; color:white; font-size:24px; background:rgba(0,0,0,0.4); border:none; cursor:pointer; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; padding-bottom:3px; font-weight:bold; box-shadow:0 2px 8px rgba(0,0,0,0.2);">›</button>` : ''}
        </div>
        ${images.length > 1 ? `<p id="viewerIndicator" style="color:rgba(255,255,255,0.6); font-size:13px; font-weight:bold; margin-top:16px; font-family:sans-serif; letter-spacing:1px; z-index:52000;">${startIdx + 1} / ${images.length}</p>` : ''}
    `;

    document.body.appendChild(overlay);

    const slider = overlay.querySelector('#viewerSliderContainer');
    const indicator = overlay.querySelector('#viewerIndicator');

    if (slider) {
        setTimeout(() => { slider.scrollLeft = slider.clientWidth * startIdx; }, 20);
        slider.onscroll = () => {
            if (indicator) {
                const page = Math.round(slider.scrollLeft / slider.clientWidth) + 1;
                indicator.innerText = `${page} / ${images.length}`;
            }
        };
    }

    const prevBtn = overlay.querySelector('#viewerPrevBtn');
    const nextBtn = overlay.querySelector('#viewerNextBtn');

    if (prevBtn) {
        prevBtn.onclick = (e) => {
            e.stopPropagation();
            const currentPage = Math.round(slider.scrollLeft / slider.clientWidth);
            if (currentPage > 0) { slider.scrollLeft = slider.clientWidth * (currentPage - 1); }
            else { slider.scrollLeft = slider.clientWidth * (images.length - 1); }
        };
    }

    if (nextBtn) {
        nextBtn.onclick = (e) => {
            e.stopPropagation();
            const currentPage = Math.round(slider.scrollLeft / slider.clientWidth);
            if (currentPage < images.length - 1) { slider.scrollLeft = slider.clientWidth * (currentPage + 1); }
            else { slider.scrollLeft = 0; }
        };
    }

    const closeBtn = overlay.querySelector('#viewerCloseBtn');
    if (closeBtn) closeBtn.onclick = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    const escHandler = (e) => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);
}

async function BookmarkBtn(commissionId) {
    const btn = document.getElementById('detailBookmarkBtn');
    if (!window.currentUserId) { btn.innerText = "★ 북마크"; btn.onclick = () => alert("로그인 후 이용 가능합니다!"); return; }
    try {
        const { data } = await getSupabaseClient().from('bookmarks').select('id').eq('user_id', window.currentUserId).eq('commission_id', commissionId).maybeSingle();
        if (data) {
            // 북마크 되어있을 때: 핑크색 테마(y2k-nametag) + 북마크 해제 문구
            btn.innerText = "★ 북마크 해제";
            btn.className = "px-2.5 py-1 rounded-full text-[10px] font-bold transition-all y2k-nametag";
            btn.onclick = () => removeBookmark(data.id, commissionId);
        } else {
            // 북마크 안 되어있을 때: 밝은 노란색 테마(btn-y2k-yellow) + 북마크 문구
            btn.innerText = "★ 북마크";
            btn.className = "px-2.5 py-1 rounded-full text-[10px] font-bold transition-all btn-y2k-yellow";
            btn.onclick = () => addBookmark(commissionId);
        }
    } catch (e) {}
}
async function addBookmark(commissionId) { await getSupabaseClient().from('bookmarks').insert([{ user_id: window.currentUserId, commission_id: commissionId }]); await BookmarkBtn(commissionId); }
async function removeBookmark(bookmarkId, commissionId) { await getSupabaseClient().from('bookmarks').delete().eq('id', bookmarkId); await BookmarkBtn(commissionId); }

async function fetchBookmarks() {
    const bList = document.getElementById('bookmarkList');
    if (!bList) return;
    if (!window.currentUserId) { bList.innerHTML = "<p class='text-xs text-gray-400 text-center py-10'>로그인 후 보관함을 이용해주세요! 🔒</p>"; return; }
    try {
        const { data, error } = await getSupabaseClient().from('bookmarks').select(`id, commissions ( id, title, price, image_url, slot_type, is_closed, user_id, profiles ( username ) )`).eq('user_id', window.currentUserId);
        if (error) throw error;
        if (!data || data.length === 0) { bList.innerHTML = "<p class='text-xs text-gray-400 text-center py-14'>아직 하트를 누른 커미션 타입이 없습니다. 🤍</p>"; return; }
        bList.innerHTML = data.map(b => {
            const c = b.commissions; if (!c) return '';
            const artist = c.profiles ? c.profiles.username : '알 수 없음';
            let img = 'https://placehold.co/100x100/fbcfe8/fff?text=No+Img';
            if (c.image_url) img = c.image_url.includes(',') ? c.image_url.split(',')[0] : c.image_url;
            const badge = c.is_closed
                ? `<span class="bg-gray-300 text-gray-600 text-[10px] px-1.5 py-0.5 rounded font-bold">마감</span>`
                : `<span class="bg-green-100 text-green-600 text-[10px] px-1.5 py-0.5 rounded font-bold">모집중</span>`;
            return `
                <div class="bg-white rounded-2xl p-3 flex gap-3 border border-gray-100 shadow-2xs cursor-pointer hover:border-pink-200" onclick="openDetailModal(${c.id})">
                    <img src="${img}" class="w-16 h-16 object-cover rounded-xl border border-gray-100 flex-shrink-0">
                    <div class="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                        <div>
                            <div class="flex justify-between items-center text-[10px] text-gray-400"><span>🎨 ${artist}</span>${badge}</div>
                            <h4 class="text-xs font-bold text-gray-800 truncate mt-0.5">${c.title}</h4>
                        </div>
                        <p class="text-xs font-bold text-pink-500">💎 ${c.price} 가치</p>
                    </div>
                </div>`;
        }).join('');
    } catch (e) { bList.innerHTML = "<p class='text-xs text-red-400 text-center py-10'>북마크 로드 에러</p>"; }
}

window.editingReviewId = null;

async function fetchReviews(commissionId) {
    const container = document.getElementById('reviewList');
    if (!container) return;
    container.innerHTML = "<p class='text-[10px] text-gray-400 text-center py-2'>후기를 불러오는 중...</p>";

    try {
        const { data: reviews, error } = await getSupabaseClient()
            .from('reviews')
            .select('id, content, rating, created_at, writer_id, is_anonymous, image_url')
            .eq('commission_id', commissionId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("후기 조회 오류:", error);
            container.innerHTML = `<p class='text-[10px] text-red-400 text-center py-2'>후기 불러오기 실패 (${error.message})</p>`;
            return;
        }

        if (!reviews || reviews.length === 0) {
            container.innerHTML = "<p class='text-[10px] text-gray-400 py-4 text-center'>첫 후기의 주인공이 되어보세요! ✨</p>";
            return;
        }

        const writerIds = [...new Set(reviews.filter(r => !r.is_anonymous && r.writer_id).map(r => r.writer_id))];
        let usernameMap = {};
        if (writerIds.length > 0) {
            const { data: profiles } = await getSupabaseClient()
                .from('profiles')
                .select('id, username')
                .in('id', writerIds);
            if (profiles) profiles.forEach(p => { usernameMap[p.id] = p.username; });
        }

        container.innerHTML = reviews.map(r => {
            const author = r.is_anonymous ? '익명' : (usernameMap[r.writer_id] || '알 수 없음');
            const stars = "⭐".repeat(Math.min(r.rating || 5, 5));
            const isReviewMine = window.currentUserId === r.writer_id;

            // object-contain 부여 및 클릭 차단(pointer-events-none) 처리 적용 완료
            const reviewImg = r.image_url
                ? `<img src="${r.image_url}" class="mt-1.5 w-full max-h-48 object-contain rounded-lg border border-gray-100 pointer-events-none select-none" style="cursor: default;">`
                : '';

            const actionBtns = isReviewMine
                ? `<div class="flex gap-1.5 items-center">
                    <button onclick="event.stopPropagation(); startEditReview(${r.id}, \`${r.content.replace(/`/g, '\\`').replace(/"/g, '&quot;')}\`, ${r.rating}, ${commissionId})" class="text-[9px] text-blue-400 hover:underline">수정</button>
                    <button onclick="event.stopPropagation(); handleDeleteReview(${r.id}, ${commissionId})" class="text-[9px] text-red-400 hover:underline">삭제</button>
                   </div>`
                : '';

            return `
                <div class="bg-gray-50/60 p-2.5 rounded-xl border border-gray-100/70 text-[11px] space-y-0.5">
                    <div class="flex justify-between items-center text-gray-400 text-[10px]">
                        <span class="font-bold text-gray-600">👤 ${author}</span>
                        <div class="flex gap-1.5 items-center"><span>${stars}</span>${actionBtns}</div>
                    </div>
                    <p class="text-gray-700 leading-normal font-medium">${r.content}</p>
                    ${reviewImg}
                </div>`;
        }).join('');
    } catch (e) {
        console.error("후기 예외:", e);
        container.innerHTML = "<p class='text-[10px] text-red-400 text-center py-2'>후기 조회 중 오류가 발생했습니다.</p>";
    }
}

function startEditReview(reviewId, content, rating, commissionId) {
    window.editingReviewId = reviewId;
    const contentInput = document.getElementById('reviewContent');
    const ratingInput = document.getElementById('reviewRating');
    const submitBtn = document.getElementById('reviewSubmitBtn');
    const cancelBtn = document.getElementById('reviewCancelEditBtn');

    if (contentInput) contentInput.value = content;
    if (ratingInput) ratingInput.value = rating;
    if (submitBtn) {
        submitBtn.innerText = "수정 완료";
        submitBtn.className = 'bg-blue-500 text-white px-4 rounded-xl text-xs font-bold whitespace-nowrap shadow-sm';
    }
    if (cancelBtn) {
        cancelBtn.classList.remove('hidden');
        cancelBtn.onclick = () => cancelEditReview(commissionId);
    }
    document.getElementById('targetCommissionId').value = commissionId;
    if (contentInput) contentInput.focus();
}

function cancelEditReview(commissionId) {
    window.editingReviewId = null;
    const contentInput = document.getElementById('reviewContent');
    const submitBtn = document.getElementById('reviewSubmitBtn');
    const cancelBtn = document.getElementById('reviewCancelEditBtn');
    if (contentInput) contentInput.value = '';
    if (submitBtn) {
        submitBtn.innerText = '등록';
        submitBtn.className = 'bg-gray-800 text-white px-4 rounded-xl text-xs font-bold whitespace-nowrap shadow-sm';
    }
    if (cancelBtn) cancelBtn.classList.add('hidden');
}

async function handleCreateReview(e) {
    e.preventDefault();
    if (!window.currentUserId) return alert("로그인 세션이 필요합니다!");

    const commId = document.getElementById('targetCommissionId').value;
    const content = document.getElementById('reviewContent').value.trim();
    const rating = parseInt(document.getElementById('reviewRating').value) || 5;
    const isAnonymous = document.getElementById('reviewAnonymous')?.checked || false;
    const imageFile = document.getElementById('reviewImage')?.files?.[0] || null;

    if (!content) return alert("후기 내용을 입력해주세요!");
    if (!commId) return alert("커미션 ID가 없습니다. 상세창을 다시 열어주세요.");

    const submitBtn = document.getElementById('reviewSubmitBtn');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = "처리 중..."; }

    try {
        let imageUrl = null;
        if (imageFile) {
            const ext = imageFile.name.split('.').pop();
            const path = `reviews/${window.currentUserId}/${Date.now()}.${ext}`;
            const { error: upErr } = await getSupabaseClient().storage.from('commission-samples').upload(path, imageFile);
            if (upErr) throw new Error("이미지 업로드 실패: " + upErr.message);
            const { data: { publicUrl } } = getSupabaseClient().storage.from('commission-samples').getPublicUrl(path);
            imageUrl = publicUrl;
        }

        if (window.editingReviewId) {
            const updateData = { content, rating };
            if (imageUrl) updateData.image_url = imageUrl;
            const { error } = await getSupabaseClient()
                .from('reviews')
                .update(updateData)
                .eq('id', window.editingReviewId)
                .eq('writer_id', window.currentUserId);
            if (error) throw error;
            cancelEditReview(commId);
            alert("후기가 수정되었습니다! ✨");
        } else {
            const payload = {
                commission_id: parseInt(commId),
                writer_id: window.currentUserId,
                content,
                rating,
                is_anonymous: isAnonymous
            };
            if (imageUrl) payload.image_url = imageUrl;

            const { error } = await getSupabaseClient().from('reviews').insert([payload]);
            if (error) throw error;

            if (document.getElementById('reviewContent')) document.getElementById('reviewContent').value = '';
            if (document.getElementById('reviewImage')) document.getElementById('reviewImage').value = '';
            if (document.getElementById('reviewAnonymous')) document.getElementById('reviewAnonymous').checked = false;
            const nameEl = document.getElementById('reviewImageName');
            if (nameEl) nameEl.innerText = '';
        }

        fetchReviews(commId);
    } catch (err) {
        console.error("후기 처리 오류:", err);
        alert("후기 처리 실패: " + err.message);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = window.editingReviewId ? "수정 완료" : "등록";
        }
    }
}

async function handleDeleteReview(reviewId, commissionId) {
    if (!confirm("작성하신 후기를 정말 삭제하시겠습니까?")) return;
    try {
        const { error } = await getSupabaseClient()
            .from('reviews')
            .delete()
            .eq('id', reviewId)
            .eq('writer_id', window.currentUserId);
        if (error) throw error;
        fetchReviews(commissionId);
    } catch (e) { alert("후기 삭제 실패: " + e.message); }
}

function openRegisterModal() {
    if (!window.currentUserId) return alert("로그인 후 커미션 등록이 가능합니다!");
    if (window.currentUserRole === 'applicant') return alert("⚠️ 신청자 전용 계정은 커미션 글을 등록할 수 없습니다.");
    openModal('regModal');
}

async function handleCreateCommission(e) {
    e.preventDefault();
    const commId = document.getElementById('editCommissionId').value;
    const title = document.getElementById('commTitle').value.trim();
    const price = parseFloat(document.getElementById('commPrice').value) || 0;
    const slot_type = document.getElementById('commSlotType').value;
    const current_slots = parseInt(document.getElementById('commCurrentSlots').value) || 0;
    const max_slots = parseInt(document.getElementById('commMaxSlots').value) || 5;
    const item_wanted = document.getElementById('commItem').value.trim();
    const credit_rule = document.getElementById('commCredit').value.trim();
    const deadline = document.getElementById('commDeadline').value.trim();
    const contact_info = document.getElementById('commContact').value.trim();
    const description = document.getElementById('commDesc').value.trim();
    const ok_list = document.getElementById('commOkList')?.value.trim() || '';
    const ng_list = document.getElementById('commNgList')?.value.trim() || '';
    const fileInput = document.getElementById('commImage');

    const checkedTags = [];
    document.querySelectorAll('#regForm input[type="checkbox"]:checked').forEach(cb => { checkedTags.push(cb.getAttribute('data-name')); });
    if (!title || price <= 0 || !contact_info) return alert("필수 정보를 채워주세요!");

    const submitBtn = document.getElementById('regSubmitBtn');
    submitBtn.innerText = "서버로 전송 중..."; submitBtn.disabled = true;

    try {
        let finalImages = [];
        if (fileInput.files && fileInput.files.length > 0) {
            for (let i = 0; i < fileInput.files.length; i++) {
                const file = fileInput.files[i];
                const ext = file.name.split('.').pop();
                const path = `${window.currentUserId}/${Date.now()}_${i}.${ext}`;
                const { error: upErr } = await getSupabaseClient().storage.from('commission-samples').upload(path, file);
                if (upErr) throw upErr;
                const { data: { publicUrl } } = getSupabaseClient().storage.from('commission-samples').getPublicUrl(path);
                finalImages.push(publicUrl);
            }
        }

        const payload = { title, price, slot_type, current_slots, max_slots, item_wanted, credit_rule, deadline, contact_info, description, tags: checkedTags, ok_list, ng_list };

        if (commId) {
            if (finalImages.length > 0) payload.image_url = finalImages.join(',');
            const { error } = await getSupabaseClient().from('commissions').update(payload).eq('id', commId).eq('user_id', window.currentUserId);
            if (error) throw error;
            alert("커미션 타입이 수정되었습니다! ✨");
        } else {
            payload.user_id = window.currentUserId;
            payload.image_url = finalImages.length > 0 ? finalImages.join(',') : 'https://placehold.co/400x300/fbcfe8/fff?text=No+Image';
            const { error } = await getSupabaseClient().from('commissions').insert([payload]);
            if (error) throw error;
            alert("새로운 커미션 타입이 등록되었습니다! 🎀");
        }
        closeModal('regModal');
        document.getElementById('regForm').reset();
        fetchCommissions();
    } catch (err) { alert("등록/수정 오류: " + err.message); }
    finally { submitBtn.innerText = commId ? "수정 완료" : "등록 완료"; submitBtn.disabled = false; }
}

function setupEditMode(item) {
    document.getElementById('editCommissionId').value = item.id;
    document.getElementById('commTitle').value = item.title || '';
    document.getElementById('commPrice').value = item.price || 0;
    document.getElementById('commSlotType').value = item.slot_type || 'always';
    toggleSlotInputDisplay(item.slot_type || 'always');
    document.getElementById('commCurrentSlots').value = item.current_slots || 0;
    document.getElementById('commMaxSlots').value = item.max_slots || 5;
    document.getElementById('commItem').value = item.item_wanted || '';
    document.getElementById('commCredit').value = item.credit_rule || '';
    document.getElementById('commDeadline').value = item.deadline || '';
    document.getElementById('commContact').value = item.contact_info || '';
    document.getElementById('commDesc').value = item.description || '';
    if (document.getElementById('commOkList')) document.getElementById('commOkList').value = item.ok_list || '';
    if (document.getElementById('commNgList')) document.getElementById('commNgList').value = item.ng_list || '';

    document.querySelectorAll('#regForm input[type="checkbox"]').forEach(cb => {
        cb.checked = (item.tags && item.tags.includes(cb.getAttribute('data-name')));
    });

    document.getElementById('regModalTitle').innerText = "내 커미션 타입 수정";
    document.getElementById('regSubmitBtn').innerText = "수정 완료";
    document.getElementById('editImgNotice').classList.remove('hidden');
    openModal('regModal');
}

async function handleDeleteCommission(id, title) {
    if (!confirm(`[ ${title} ] 타입을 정말 삭제하시겠습니까?`)) return;
    try {
        const { error } = await getSupabaseClient().from('commissions').delete().eq('id', id).eq('user_id', window.currentUserId);
        if (error) throw error;
        alert("삭제 처리가 안전하게 끝났습니다.");
        fetchCommissions();
        const myTypesModal = document.getElementById('myTypesModal');
        if (myTypesModal && myTypesModal.classList.contains('active')) { if (typeof openMyTypes === 'function') openMyTypes(); }
    } catch (err) { alert("삭제 실패: " + err.message); }
}
