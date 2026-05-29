// commission.js
const getSupabaseClient = () => window.supabaseClient;

// 🌟 [초핵심] index.html의 입력값과 100% 동기화되도록 전역 검색 변수 바인딩 확실하게 선언!
window.currentActiveTags = [];
window.currentSearch = ""; 

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
        panel.innerHTML = tags.map(tag => {
            return `<button onclick="toggleTagFilter('${tag}')" id="tagBtn-${tag}" class="bg-gray-50 text-gray-700 hover:bg-pink-50 hover:text-pink-600 rounded-lg text-center font-medium transition py-1 px-2.5 text-xs block w-full">#${tag}</button>`;
        }).join('');
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
        if(w) {
            w.querySelector('.dropdown-panel').classList.add('hidden');
            w.querySelector('.dropdown-arrow').style.transform = 'rotate(0deg)';
        }
    });
    if (isHidden) {
        panel.classList.remove('hidden');
        if(arrow) arrow.style.transform = 'rotate(180deg)';
    }
}

function toggleTagFilter(tag) {
    const idx = window.currentActiveTags.indexOf(tag);
    const btn = document.getElementById(`tagBtn-${tag}`);
    if (idx > -1) {
        window.currentActiveTags.splice(idx, 1);
        if(btn) btn.className = "bg-gray-50 text-gray-700 hover:bg-pink-50 hover:text-pink-600 rounded-lg text-center font-medium transition py-1 px-2.5 text-xs block w-full";
    } else {
        window.currentActiveTags.push(tag);
        if(btn) btn.className = "bg-pink-500 text-white font-bold rounded-lg text-center transition py-1 px-2.5 text-xs block w-full shadow-2xs";
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

// 1. 피드 조회 (🌟 검색 변수 완전 동기화 연동 완료)
async function fetchCommissions() {
    const listEl = document.getElementById('commissionList');
    if (!listEl) return;
    listEl.innerHTML = "<p class='text-xs text-gray-400 text-center py-10'>커미션 피드를 불러오는 중... 🎀</p>";

    try {
        let query = getSupabaseClient()
            .from('commissions')
            .select(`*, profiles!inner ( username, role, contact_info, response_time )`)
            .eq('is_private', false)
            .order('created_at', { ascending: false });

        // 🌟 [수정 핵심부]: index.html에서 꽂아준 변수(window.currentSearch 또는 전역 currentSearch)를 확실하게 검사하고 필터 쿼리 주입
        const searchKeyword = (window.currentSearch || currentSearch || "").trim();
        if (searchKeyword !== "") {
            query = query.or(`title.ilike.%${searchKeyword}%, profiles.username.ilike.%${searchKeyword}%`);
        }

        const { data, error } = await query;
        if (error) throw error;

        let filteredData = data || [];
        if (window.currentActiveTags.length > 0) {
            filteredData = filteredData.filter(item => {
                if (!item.tags || !Array.isArray(item.tags)) return false;
                return window.currentActiveTags.every(t => item.tags.includes(t));
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
                ? `<span class="bg-gray-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-2xs">마감</span>`
                : `<span class="bg-pink-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-2xs">모집중</span>`;
            const tagsHtml = (item.tags && item.tags.length > 0) ? item.tags.map(t => `<span class="bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded-md">#${t}</span>`).join(' ') : '';

            return `
                <div class="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col" onclick="openDetailModal(${item.id})">
                    <div class="relative w-full h-48 bg-gray-50 overflow-hidden">
                        <img src="${firstImg}" alt="${item.title}" class="w-full h-full object-cover">
                        <span class="absolute bottom-3 right-3 bg-black/60 text-white text-[11px] font-bold px-2.5 py-1 rounded-full backdrop-blur-xs">💎 ${item.price} 가치</span>
                    </div>
                    <div class="p-3.5 flex flex-col gap-1.5">
                        <div class="flex justify-between items-center text-[11px]">
                            <span class="text-pink-600 font-bold hover:underline" onclick="event.stopPropagation(); openArtistProfile('${item.user_id}');">🎨 ${artistName}</span>
                            <div class="flex items-center gap-1">${statusBadge} <span class="text-gray-400 font-medium">${slotText}</span></div>
                        </div>
                        <h3 class="text-sm font-bold text-gray-900 line-clamp-1">${item.title}</h3>
                        <div class="flex flex-wrap gap-1 mt-0.5">${tagsHtml}</div>
                    </div>
                </div>`;
        }).join('');
    } catch (err) { listEl.innerHTML = "<p class='text-xs text-red-400 text-center py-10'>데이터 요청 중 에러 발생</p>"; }
}

// 2. 작가 프로필 상세 보기
async function openArtistProfile(userId) {
    if (!userId) return alert("유효하지 않은 작가 회원 정보입니다.");
    try {
        const { data: prof, error: pErr } = await getSupabaseClient().from('profiles').select('username, role, contact_info, response_time').eq('id', userId).maybeSingle();
        if (pErr || !prof) throw new Error("프로필 정보를 찾을 수 없습니다.");

        document.getElementById('artistNameTitle').innerText = `🎨 ${prof.username} 님의 프로필`;
        let roleStr = "커미션주";
        if(prof.role === 'applicant') roleStr = "일반 신청자";
        if(prof.role === 'both') roleStr = "반장/신청자 공용";
        document.getElementById('artistRoleBadge').innerText = roleStr;
        document.getElementById('artistContactInfo').innerHTML = renderContactInfo(prof.contact_info);
        document.getElementById('artistResponseTime').innerText = prof.response_time || "지정된 응답 가능 시간이 없습니다.";

        const listContainer = document.getElementById('artistCommissionsList');
        listContainer.innerHTML = "<p class='text-[11px] text-gray-400 py-2'>등록된 타입을 조회 중입니다...</p>";
        openModal('artistProfileModal');

        const { data: comms } = await getSupabaseClient().from('commissions').select('id, title, price, image_url, slot_type, is_closed').eq('user_id', userId).eq('is_private', false).order('created_at', { ascending: false });
        if (!comms || comms.length === 0) {
            listContainer.innerHTML = "<p class='text-[11px] text-gray-400 py-2 text-center'>현재 전시 중인 공개 타입이 없습니다.</p>";
        } else {
            listContainer.innerHTML = comms.map(c => {
                let img = 'https://placehold.co/100x100/fbcfe8/fff?text=No+Img';
                if (c.image_url) img = c.image_url.includes(',') ? c.image_url.split(',')[0] : c.image_url;
                const sBadge = c.is_closed ? `<span class="bg-gray-300 text-gray-600 px-1.5 py-0.5 rounded text-[9px] font-bold">마감</span>` : `<span class="bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded text-[9px] font-bold">모집</span>`;
                return `
                    <div class="flex items-center gap-3 bg-gray-50/70 p-2 rounded-xl border border-gray-100 cursor-pointer hover:bg-pink-50/20" onclick="closeModal('artistProfileModal'); openDetailModal(${c.id});">
                        <img src="${img}" class="w-11 h-11 object-cover rounded-lg border border-gray-200">
                        <div class="flex-1 min-w-0">
                            <p class="text-xs font-bold text-gray-800 truncate">${c.title}</p>
                            <p class="text-[10px] text-gray-400 mt-0.5">${c.price} 가치</p>
                        </div>
                        <div>${sBadge}</div>
                    </div>`;
            }).join('');
        }
    } catch (e) { alert("작가 프로필 로드 실패: " + e.message); }
}

// 3. 커미션 상세보기
async function openDetailModal(id) {
    try {
        const { data: item, error } = await getSupabaseClient().from('commissions').select(`*, profiles ( username, contact_info )`).eq('id', id).maybeSingle();
        if (error || !item) return alert("해당 커미션 글이 존재하지 않거나 삭제되었습니다.");

        const isMine = window.currentUserId === item.user_id;
        document.getElementById('detailDeleteBtn').style.display = isMine ? 'block' : 'none';
        document.getElementById('detailEditBtn').style.display = isMine ? 'block' : 'none';

        document.getElementById('detailDeleteBtn').onclick = () => { closeModal('detailModal'); handleDeleteCommission(item.id, item.title); };
        document.getElementById('detailEditBtn').onclick = () => { closeModal('detailModal'); setupEditMode(item); };

        const slider = document.getElementById('detailSliderContainer');
        const counter = document.getElementById('detailImgCounter');
        slider.innerHTML = "";
        
        let imgs = [];
        if (item.image_url) {
            imgs = item.image_url.includes(',') ? item.image_url.split(',') : [item.image_url];
        } else {
            imgs = ['https://placehold.co/400x300/fbcfe8/fff?text=No+Image'];
        }
        
        imgs.forEach(url => { slider.innerHTML += `<img src="${url.trim()}" class="w-full h-full object-cover flex-shrink-0 snap-center">`; });

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

        const slotText = item.slot_type === 'always' ? '상시 커미션' : `슬롯 마감현황 (${item.current_slots || 0}/${item.max_slots || 5})`;
        document.getElementById('detailSlot').innerText = item.is_closed ? '🔒 슬롯 마감' : `🔓 ${slotText}`;

        document.getElementById('detailTitle').innerText = item.title;
        document.getElementById('detailItem').innerText = item.item_wanted || '상세내용 없음';
        document.getElementById('detailDeadline').innerText = item.deadline || '상세 협의 후 결정';
        document.getElementById('detailCredit').innerText = item.credit_rule || '출처 표기 불필요';
        document.getElementById('detailDesc').innerText = item.description || '';

        const contactBtn = document.getElementById('detailContactBtn');
        const contactTarget = item.contact_info || (item.profiles ? item.profiles.contact_info : '');
        if (contactTarget) {
            contactBtn.innerText = "💬 작가님에게 커미션 신청하기";
            contactBtn.onclick = () => {
                const cleanLink = contactTarget.trim();
                if (/^(http|https):\/\/[^\s]+/.test(cleanLink)) { window.open(cleanLink, '_blank'); } 
                else { alert(`작가님 연락망 정보입니다. 복사해서 사용해주세요!\n\n📋 연락처: ${cleanLink}`); }
            };
        } else { contactBtn.innerText = "등록된 연락 경로가 없습니다."; contactBtn.onclick = null; }

        await updateBookmarkButtonUI(item.id);
        document.getElementById('targetCommissionId').value = item.id;
        fetchReviews(item.id);
        openModal('detailModal');
    } catch (e) { alert("상세화면을 열지 못했습니다."); }
}

async function updateBookmarkButtonUI(commissionId) {
    const btn = document.getElementById('detailBookmarkBtn');
    if (!window.currentUserId) { btn.innerText = "🤍 북마크"; btn.onclick = () => alert("로그인 후 이용 가능합니다!"); return; }
    try {
        const { data } = await getSupabaseClient().from('bookmarks').select('id').eq('user_id', window.currentUserId).eq('commission_id', commissionId).maybeSingle();
        if (data) {
            btn.innerText = "❤️ 찜 해제";
            btn.className = "bg-red-50 text-red-600 px-2.5 py-1 rounded-full text-[11px] font-bold border border-red-200 hover:bg-red-100";
            btn.onclick = () => removeBookmark(data.id, commissionId);
        } else {
            btn.innerText = "🤍 북마크 찜";
            btn.className = "bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full text-[11px] font-bold border border-amber-200 hover:bg-amber-100";
            btn.onclick = () => addBookmark(commissionId);
        }
    } catch(e){}
}
async function addBookmark(commissionId) { await getSupabaseClient().from('bookmarks').insert([{ user_id: window.currentUserId, commission_id: commissionId }]); await updateBookmarkButtonUI(commissionId); }
async function removeBookmark(bookmarkId, commissionId) { await getSupabaseClient().from('bookmarks').delete().eq('id', bookmarkId); await updateBookmarkButtonUI(commissionId); }

async function fetchBookmarks() {
    const bList = document.getElementById('bookmarkList');
    if (!bList) return;
    if (!window.currentUserId) { bList.innerHTML = "<p class='text-xs text-gray-400 text-center py-10'>로그인 후 보관함을 이용해주세요! 🔒</p>"; return; }
    try {
        const { data, error } = await getSupabaseClient().from('bookmarks').select(`id, commissions ( id, title, price, image_url, slot_type, is_closed, user_id, profiles ( username ) )`).eq('user_id', window.currentUserId);
        if (error) throw error;
        if (!data || data.length === 0) { bList.innerHTML = "<p class='text-xs text-gray-400 text-center py-14'>아직 하트를 누른 커미션 타입이 없습니다. 🤍</p>"; return; }
        bList.innerHTML = data.map(b => {
            const c = b.commissions; if(!c) return '';
            const artist = c.profiles ? c.profiles.username : '알 수 없음';
            let img = 'https://placehold.co/100x100/fbcfe8/fff?text=No+Img';
            if (c.image_url) img = c.image_url.includes(',') ? c.image_url.split(',')[0] : c.image_url;
            const badge = c.is_closed ? `<span class="bg-gray-300 text-gray-600 text-[10px] px-1.5 py-0.5 rounded font-bold">마감</span>` : `<span class="bg-green-100 text-green-600 text-[10px] px-1.5 py-0.5 rounded font-bold">모집중</span>`;
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
    } catch(e) { bList.innerHTML = "<p class='text-xs text-red-400 text-center py-10'>북마크 로드 에러</p>"; }
}

async function fetchReviews(commissionId) {
    const container = document.getElementById('reviewList'); if(!container) return; container.innerHTML = "";
    try {
        const { data, error } = await getSupabaseClient().from('reviews').select(`id, content, rating, created_at, user_id, profiles ( username )`).eq('commission_id', commissionId)
        .order('created_at', { ascending: false });
        if (error) throw error;
        if (!data || data.length === 0) { container.innerHTML = "<p class='text-[10px] text-gray-400 py-4 text-center'>첫 후기의 주인공이 되어보세요! ✨</p>"; return; }
        container.innerHTML = data.map(r => {
            const author = r.profiles ? r.profiles.username : '익명'; const stars = "⭐".repeat(r.rating || 5); const isReviewMine = window.currentUserId === r.user_id;
            const delBtn = isReviewMine ? `<button onclick="event.stopPropagation(); handleDeleteReview(${r.id}, ${commissionId})" class="text-[9px] text-red-400 hover:underline">삭제</button>` : '';
            return `
                <div class="bg-gray-50/60 p-2.5 rounded-xl border border-gray-100/70 text-[11px] space-y-0.5">
                    <div class="flex justify-between items-center text-gray-400 text-[10px]">
                        <span class="font-bold text-gray-600">👤 ${author}</span>
                        <div class="flex gap-1.5 items-center"><span>${stars}</span>${delBtn}</div>
                    </div>
                    <p class="text-700 leading-normal font-medium">${r.content}</p>
                </div>`;
        }).join('');
    } catch(e){}
}

async function handleCreateReview(e) {
    e.preventDefault(); if (!window.currentUserId) return alert("로그인 세션이 필요합니다!");
    const commId = document.getElementById('targetCommissionId').value; const content = document.getElementById('reviewContent').value.trim(); const rating = parseInt(document.getElementById('reviewRating').value) || 5;
    if(!content) return;
    try {
        const { error } = await getSupabaseClient().from('reviews').insert([{ commission_id: commId, user_id: window.currentUserId, content, rating }]);
        if (error) throw error; document.getElementById('reviewContent').value = ""; fetchReviews(commId);
    } catch(err) { alert("후기 등록 실패: " + err.message); }
}
async function handleDeleteReview(reviewId, commissionId) { if (!confirm("작성하신 후기를 정말 삭제하시겠습니까?")) return; try { await getSupabaseClient().from('reviews').delete().eq('id', reviewId).eq('user_id', window.currentUserId); fetchReviews(commissionId); } catch(e){ alert("후기 삭제 실패"); } }

function openRegisterModal() {
    if (!window.currentUserId) return alert("로그인 후 커미션 등록이 가능합니다!");
    if (window.currentUserRole === 'applicant') { return alert("⚠️ 신청자 전용 계정은 커미션 글을 등록할 수 없습니다.\n글을 쓰시려면 정보 수정에서 권한(타입)을 변경해주세요."); }
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
    const fileInput = document.getElementById('commImage');

    const checkedTags = [];
    document.querySelectorAll('#regForm input[type="checkbox"]:checked').forEach(cb => { checkedTags.push(cb.getAttribute('data-name')); });
    if(!title || price <= 0 || !contact_info) return alert("필수 정보를 채워주세요!");

    const submitBtn = document.getElementById('regSubmitBtn');
    submitBtn.innerText = "서버로 전송 중..."; submitBtn.disabled = true;

    try {
        let finalImages = [];
        if (fileInput.files && fileInput.files.length > 0) {
            for (let i = 0; i < fileInput.files.length; i++) {
                const file = fileInput.files[i]; const ext = file.name.split('.').pop(); const path = `${window.currentUserId}/${Date.now()}_${i}.${ext}`;
                const { error: upErr } = await getSupabaseClient().storage.from('commission-samples').upload(path, file); if (upErr) throw upErr;
                const { data: { publicUrl } } = getSupabaseClient().storage.from('commission-samples').getPublicUrl(path);
                finalImages.push(publicUrl);
            }
        }

        const payload = {
            title, price, slot_type, current_slots, max_slots,
            item_wanted, credit_rule, deadline, contact_info, description,
            tags: checkedTags
        };

        if (commId) {
            if (finalImages.length > 0) payload.image_url = finalImages.join(',');
            const { error } = await getSupabaseClient().from('commissions').update(payload).eq('id', commId).eq('user_id', window.currentUserId);
            if (error) throw error; alert("커미션 타입이 수정되었습니다! ✨");
        } else {
            payload.user_id = window.currentUserId;
            payload.image_url = finalImages.length > 0 ? finalImages.join(',') : 'https://placehold.co/400x300/fbcfe8/fff?text=No+Image';
            const { error } = await getSupabaseClient().from('commissions').insert([payload]); if (error) throw error;
            alert("새로운 커미션 타입이 등록되었습니다! 🎀");
        }
        closeModal('regModal'); document.getElementById('regForm').reset(); fetchCommissions();
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

    document.querySelectorAll('#regForm input[type="checkbox"]').forEach(cb => {
        const tName = cb.getAttribute('data-name'); cb.checked = (item.tags && item.tags.includes(tName));
    });

    document.getElementById('regModalTitle').innerText = "내 커미션 타입 수정";
    document.getElementById('regSubmitBtn').innerText = "수정 완료";
    document.getElementById('editImgNotice').classList.remove('hidden');
    openModal('regModal');
}

async function handleDeleteCommission(id, title) {
    if (!confirm(`[ ${title} ] 타입을 정말 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    try {
        const { error } = await getSupabaseClient().from('commissions').delete().eq('id', id).eq('user_id', window.currentUserId);
        if (error) throw error; alert("삭제 처리가 안전하게 끝났습니다."); fetchCommissions();
        if (document.getElementById('myTypesModal').classList.contains('active')) { if (typeof openMyTypes === 'function') openMyTypes(); }
    } catch(err) { alert("삭제 실패: " + err.message); }
}
