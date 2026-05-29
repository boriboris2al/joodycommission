// commission.js
let currentFilter = '전체';
let currentActiveTags = []; 
let currentSearch = '';

function openRegisterModal() {
    if (!window.currentUserRole) {
        alert("로그인이 필요한 서비스입니다. 로그인 또는 회원가입을 먼저 해주세요!");
        openModal('authModal');
        return;
    }
    if (window.currentUserRole === 'applicant') {
        alert("신청자 전용 계정은 커미션을 등록할 수 없습니다. 글을 쓰려면 '커미션주' 계정으로 가입해 주세요.");
        return;
    }
    openModal('regModal');
}

// 1. 메인 화면에 커미션 목록 띄우기 (🌟 작가 닉네임 검색 연동 고도화 버전)
async function fetchCommissions() {
    const listContainer = document.getElementById('commissionList');
    if (!listContainer) return;
        
    try {
        let query = window.supabaseClient
            .from('commissions')
            .select(`id, title, price, slot_type, max_slots, current_slots, tags, image_url, is_closed, is_private, user_id, profiles!inner ( username )`);

        // 🌟 요구사항 3: 글 제목은 물론, 작가 이름(username) 검색어까지 통합 감지 스캔 구현
        if (currentSearch && currentSearch.trim() !== '') {
            const cleanSearch = currentSearch.trim();
            query = query.or(`title.ilike.%${cleanSearch}%, profiles.username.ilike.%${cleanSearch}%`);
        }

        if (currentFilter !== '전체') {
            query = query.contains('tags', [currentFilter]);
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;

        let visibleData = data.filter(item => {
            if (item.is_private === true) {
                return window.currentUserId && window.currentUserId === item.user_id;
            }
            return true;
        });

        if (currentActiveTags.length > 0) {
            visibleData = visibleData.filter(item =>
                currentActiveTags.every(tag => item.tags && item.tags.includes(tag))
            );
        }

        if (!visibleData || visibleData.length === 0) {
            listContainer.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm">조건에 맞는 커미션이 없습니다. ㅠㅠ</div>`;
            return;
        }

        listContainer.innerHTML = visibleData.map(item => {
            const slotText = item.is_closed ? '마감' : (item.slot_type === 'always' ? '상시' : `슬롯 ${item.current_slots || 0}/${item.max_slots || 5}`);
            const slotColor = item.is_closed ? 'bg-gray-200 text-gray-600' : 'bg-pink-50 text-pink-500';
            const tagsHTML = item.tags ? item.tags.map(tag => `<span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-medium">#${tag}</span>`).join(' ') : '';
                        
            let firstImg = 'https://via.placeholder.com/350x200?text=No+Image';
            if (item.image_url) {
                firstImg = item.image_url.includes(',') ? item.image_url.split(',')[0] : item.image_url;
            }
                        
            const privateBadge = item.is_private ? `<span class="text-[10px] bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-bold">비공개</span>` : '';
            const closedOverlay = item.is_closed ? `
                <div class="absolute inset-0 bg-black/50 z-10 pointer-events-none flex flex-col items-center justify-center gap-1">
                    <span style="font-size:2rem;">🔒</span>
                    <span class="text-white font-bold text-sm tracking-wide" style="text-shadow:0 1px 4px rgba(0,0,0,0.7);">슬롯 마감</span>
                </div>` : '';

            return `
                <div class="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition cursor-pointer relative" onclick="openDetail(${item.id})">
                    <div class="h-44 bg-gray-100 relative">
                        <img src="${firstImg}" alt="${item.title}" class="w-full h-full object-cover${item.is_closed ? ' opacity-60' : ''}">
                        ${closedOverlay}
                        <span class="absolute top-3 right-3 bg-black/60 text-white text-[11px] font-bold px-2.5 py-1 rounded-full backdrop-blur-xs z-20">
                            ${item.price} 가치
                        </span>
                    </div>
                    <div class="p-3.5 space-y-1.5">
                        <div class="flex justify-between items-center">
                            <div class="flex items-center gap-1" onclick="event.stopPropagation(); openArtistProfile('${item.user_id}')">
                                <span class="text-xs text-pink-600 font-bold hover:underline">✨ ${item.profiles?.username || '알 수 없음'}</span>
                                ${privateBadge}
                            </div>
                            <span class="text-[11px] font-semibold ${slotColor} px-2 py-0.5 rounded-full">${slotText}</span>
                        </div>
                        <h3 class="font-bold text-gray-900 text-sm line-clamp-1">${item.title}</h3>
                        <div class="flex flex-wrap gap-1 pt-1">${tagsHTML}</div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error(error);
        listContainer.innerHTML = `<div class="text-center py-10 text-red-400 text-sm">데이터 로드 실패 ㅠㅠ</div>`;
    }
}

function changeFilter(target, filterName) {
    currentActiveTags = [];
    renderTagDropdowns();
    const buttons = target.parentElement.querySelectorAll('button');
    buttons.forEach(btn => {
        btn.className = "bg-white text-gray-600 border border-gray-200 px-3 py-1.5 rounded-full whitespace-nowrap hover:border-pink-300 transition text-xs";
    });
    target.className = "bg-pink-500 text-white px-3 py-1.5 rounded-full whitespace-nowrap font-medium shadow-sm transition text-xs";
    currentFilter = filterName;
    fetchCommissions();
}

function toggleTagFilter(tag) {
    if (currentActiveTags.includes(tag)) {
        currentActiveTags = currentActiveTags.filter(t => t !== tag);
    } else {
        currentActiveTags.push(tag);
    }
    currentFilter = '전체';
    renderTagDropdowns();
    fetchCommissions();
}

function renderTagDropdowns() {
    const categories = [
        { label: '화풍', tags: ['SD', 'LD'] },
        { label: '틀 종류', tags: ['고정틀', '반고정틀', '자유'] },
        { label: '채색', tags: ['낙서', '선화', '단색', '풀채색'] },
        { label: '구도', tags: ['두상', '흉상', '반신', '전신'] },
        { label: '기타', tags: ['캐디', '기타'] },
    ];

    categories.forEach(cat => {
        const wrapper = document.getElementById(`dropdown-${cat.label}`);
        if (!wrapper) return;
        const panel = wrapper.querySelector('.dropdown-panel');
        if (!panel) return;

        panel.innerHTML = cat.tags.map(tag => {
            const active = currentActiveTags.includes(tag);
            return `<button onclick="toggleTagFilter('${tag}')" class="${active
                ? 'bg-pink-500 text-white border-pink-500 font-bold'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-pink-300'
            } border text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap transition font-medium">#${tag}</button>`;
        }).join('');
    });
}

function toggleDropdown(label) {
    const categories = ['화풍', '틀 종류', '채색', '구도', '기타'];
    categories.forEach(cat => {
        const wrapper = document.getElementById(`dropdown-${cat}`);
        if (!wrapper) return;
        const panel = wrapper.querySelector('.dropdown-panel');
        const arrow = wrapper.querySelector('.dropdown-arrow');
        if (cat === label) {
            const isOpen = panel.classList.contains('hidden');
            if (isOpen) {
                panel.classList.remove('hidden');
                if (arrow) arrow.style.transform = 'rotate(180deg)';
            } else {
                panel.classList.add('hidden');
                if (arrow) arrow.style.transform = 'rotate(0deg)';
            }
        } else {
            panel.classList.add('hidden');
            if (arrow) arrow.style.transform = 'rotate(0deg)';
        }
    });
}

// 2. 새 커미션 등록 및 수정하기 로직
async function handleCreateCommission(e) {
    e.preventDefault();
    
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (!user || window.currentUserRole === 'applicant') return alert("작성 권한이 없습니다.");

    const editId = document.getElementById('editCommissionId').value;
    const title = document.getElementById('commTitle').value;
    const price = parseFloat(document.getElementById('commPrice').value);
    
    const slot_type = document.getElementById('commSlotType').value;
    const max_slots = parseInt(document.getElementById('commMaxSlots').value) || 5;
    const current_slots = parseInt(document.getElementById('commCurrentSlots').value) || 0;

    const description = document.getElementById('commDesc').value;
    const item_wanted = document.getElementById('commItem').value;
    const credit_rule = document.getElementById('commCredit').value;
    const custom_contact = document.getElementById('commContact').value; 
    
    const imageInput = document.getElementById('commImage');
    const imageFiles = imageInput ? imageInput.files : [];
    
    if (!custom_contact || !custom_contact.trim()) return alert("신청 연락망을 입력해 주세요!");

    const tags = [];
    const tagIds = ['tagSD', 'tagLD', 'tagFix', 'tagSemi', 'tagFree', 'tagDoodle', 'tagLine', 'tagColor', 'tagFull', 'tagHead', 'tagBust', 'tagHalf', 'tagBody', 'tagCaddie', 'tagEtc'];
    tagIds.forEach(id => {
        const el = document.getElementById(id);
        if(el && el.checked) tags.push(el.dataset.name);
    });

    try {
        let final_image_str = "";

        if (imageFiles.length > 0) {
            const urlArray = [];
            for (let i = 0; i < Math.min(imageFiles.length, 6); i++) {
                const file = imageFiles[i];
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${i}.${fileExt}`;
                
                const { error: upErr } = await window.supabaseClient.storage.from('commission-samples').upload(fileName, file);
                if (upErr) throw upErr;

                const { data } = window.supabaseClient.storage.from('commission-samples').getPublicUrl(fileName);
                if (data) urlArray.push(data.publicUrl);
            }
            final_image_str = urlArray.join(',');
        }

        const dataPayload = {
            user_id: user.id, title, price, slot_type, max_slots, current_slots, tags, description, item_wanted, credit_rule, contact_info: custom_contact
        };

        if (final_image_str !== "") {
            dataPayload.image_url = final_image_str;
        }

        if (editId) {
            const { error } = await window.supabaseClient
                .from('commissions')
                .update(dataPayload)
                .eq('id', editId)
                .eq('user_id', window.currentUserId);
            if (error) throw error;
            alert("커미션 타입 수정이 완료되었습니다! ✨");
        } else {
            if (final_image_str === "") return alert("샘플 이미지를 최소 1장 이상 등록해주세요!");
            const { error } = await window.supabaseClient.from('commissions').insert([dataPayload]);
            if (error) throw error;
            alert("커미션이 성공적으로 등록되었습니다! 🎉");
        }

        closeModal('regModal');
        document.getElementById('regForm').reset();
        fetchCommissions();
    } catch (error) {
        alert("등록/수정 실패 사유: " + error.message);
    }
}

// 3. 상세 팝업창 열기
async function openDetail(id) {
    try {
        const { data: item, error } = await window.supabaseClient.from('commissions').select(`*, profiles ( username )`).eq('id', id).single();
        if (error) throw error;

        const sliderContainer = document.getElementById('detailSliderContainer');
        const imgCounter = document.getElementById('detailImgCounter');
        
        let images = [];
        if (item.image_url) {
            images = item.image_url.includes(',') ? item.image_url.split(',') : [item.image_url];
        } else {
            images = ['https://via.placeholder.com/350x200?text=No+Image'];
        }

        sliderContainer.innerHTML = images.map((url, idx) => `
            <div class="w-full h-full flex-shrink-0 snap-center cursor-zoom-in" onclick="openImageViewer(${JSON.stringify(images).replace(/"/g, '&quot;')}, ${idx})">
                <img src="${url.trim()}" class="w-full h-full object-cover">
            </div>
        `).join('');

        if (images.length > 1) {
            imgCounter.classList.remove('hidden');
            imgCounter.innerText = `👈 가로 슬라이드 넘겨보기 (1/${images.length})`;
            sliderContainer.onscroll = () => {
                const page = Math.round(sliderContainer.scrollLeft / sliderContainer.clientWidth) + 1;
                imgCounter.innerText = `👈 가로 슬라이드 넘겨보기 (${page}/${images.length})`;
            };
        } else {
            imgCounter.classList.add('hidden');
            sliderContainer.onscroll = null;
        }

        document.getElementById('detailPrice').innerText = `${item.price} 가치`;
        document.getElementById('detailTitle').innerText = item.title;
        
        // 🌟 요구사항 2: 상세보기 내 작가명 마킹 및 이벤트 이식
        const artistEl = document.getElementById('detailArtist');
        artistEl.innerText = `✨ 작가: ${item.profiles?.username || '알 수 없음'}`;
        artistEl.onclick = () => { closeModal('detailModal'); openArtistProfile(item.user_id); };

        document.getElementById('detailSlot').innerText = item.is_closed ? '슬롯 마감됨' : (item.slot_type === 'always' ? '상시 운영' : `남은 슬롯: ${item.current_slots || 0}/${item.max_slots || 5}개`);
        document.getElementById('detailItem').innerText = item.item_wanted || '없음';
        document.getElementById('detailCredit').innerText = item.credit_rule || '자유롭게 표기 가능';
        document.getElementById('detailDesc').innerText = item.description || '상세 설명이 없습니다.';
        
        const deleteBtn = document.getElementById('detailDeleteBtn');
        const editBtn = document.getElementById('detailEditBtn');
        
        if (window.currentUserId && window.currentUserId === item.user_id) {
            if (deleteBtn) {
                deleteBtn.classList.remove('hidden');
                deleteBtn.onclick = () => handleDeleteCommission(item.id, item.title);
            }
            if (editBtn) {
                editBtn.classList.remove('hidden');
                editBtn.onclick = () => {
                    closeModal('detailModal');
                    setupEditMode(item);
                };
            }
        } else { 
            if (deleteBtn) deleteBtn.classList.add('hidden'); 
            if (editBtn) editBtn.classList.add('hidden'); 
        }

        const bookmarkBtn = document.getElementById('detailBookmarkBtn');
        if (bookmarkBtn) {
            if (window.currentUserId) {
                const { data: isBookmarked } = await window.supabaseClient.from('bookmarks').select('id').eq('user_id', window.currentUserId).eq('commission_id', id).maybeSingle();
                if (isBookmarked) {
                    bookmarkBtn.className = "bg-amber-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-xs border border-amber-500";
                    bookmarkBtn.innerText = "💛 북마크 취소";
                    bookmarkBtn.onclick = () => toggleBookmark(id, true);
                } else {
                    bookmarkBtn.className = "bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-xs font-bold shadow-xs border border-amber-200 hover:bg-amber-100";
                    bookmarkBtn.innerText = "🤍 북마크";
                    bookmarkBtn.onclick = () => toggleBookmark(id, false);
                }
            } else {
                bookmarkBtn.onclick = () => { alert('로그인 후 북마크 등록이 가능합니다!'); openModal('authModal'); };
            }
        }

        const contactBtn = document.getElementById('detailContactBtn');
        if (contactBtn) {
            const contactInfo = item.contact_info || ''; 
            if (contactInfo.startsWith('http')) {
                contactBtn.innerText = "💬 오픈채팅으로 신청하기";
                contactBtn.onclick = () => window.open(contactInfo, '_blank');
            } else {
                contactBtn.innerText = `🎮 연락처: ${contactInfo} (복사하기)`;
                contactBtn.onclick = () => { navigator.clipboard.writeText(contactInfo); alert('연락처가 복사되었습니다!'); };
            }
        }

        document.getElementById('targetCommissionId').value = id;
        fetchReviews(id);
        openModal('detailModal');
    } catch (error) { alert('상세 정보를 불러오지 못했습니다: ' + error.message); }
}

// 🌟 요구사항 2: 작가 고유 프로필 뷰어 윈도우 개설 연산
async function openArtistProfile(userId) {
    try {
        const { data: profile, error: pErr } = await window.supabaseClient.from('profiles').select('*').eq('id', userId).single();
        if (pErr) throw pErr;

        document.getElementById('artistNameTitle').innerText = `🎨 ${profile.username} 님의 프로필`;
        
        let roleText = "신청자 전용 계정";
        if(profile.role === 'commissioner') roleText = "커미션 작가";
        else if(profile.role === 'both') roleText = "멀티 크리에이터";
        document.getElementById('artistRoleBadge').innerText = roleText;

        // 연락망 및 응답 가능 시간 마킹
        document.getElementById('artistContactInfo').innerText = profile.contact || '등록된 대화 채널이 없습니다.';
        document.getElementById('artistResponseTime').innerText = profile.response_time || '지정되지 않음 (언제든 문의해 보세요!)';

        // 해당 작가의 타입 모아보기 정렬 바인딩
        const { data: list, error: lErr } = await window.supabaseClient.from('commissions').select('*').eq('user_id', userId).eq('is_private', false).order('created_at', { ascending: false });
        if (lErr) throw lErr;

        const listContainer = document.getElementById('artistCommissionsList');
        if (list.length === 0) {
            listContainer.innerHTML = `<p class="text-gray-400 text-center py-4 text-[11px]">현재 모집 중인 대중 공개 타입이 없습니다.</p>`;
        } else {
            listContainer.innerHTML = list.map(item => {
                let img = 'https://via.placeholder.com/350x200?text=No+Image';
                if (item.image_url) img = item.image_url.includes(',') ? item.image_url.split(',')[0] : item.image_url;
                return `
                    <div class="bg-gray-50 border border-gray-100 rounded-xl overflow-hidden flex gap-2.5 p-2 cursor-pointer" onclick="closeModal('artistProfileModal'); openDetail(${item.id})">
                        <img src="${img}" class="w-16 h-16 object-cover rounded-lg flex-shrink-0">
                        <div class="flex-1 min-w-0 flex flex-col justify-center">
                            <p class="text-xs font-bold text-gray-800 line-clamp-1">${item.title}</p>
                            <p class="text-[11px] text-pink-500 font-semibold mt-0.5">${item.price} 가치</p>
                        </div>
                    </div>
                `;
            }).join('');
        }
        openModal('artistProfileModal');
    } catch(e) { alert("프로필 로드 실패: " + e.message); }
}

// 이미지 풀스크린 뷰어 팝업
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
            style="position:absolute; top:16px; right:16px; color:white; font-size:26px;
                   background:rgba(255,255,255,0.2); border:none; cursor:pointer;
                   z-index:52000; width:40px; height:40px; border-radius:50%;
                   display:flex; align-items:center; justify-content:center; line-height:1; backdrop-filter:blur(4px);">✕</button>
        
        <div id="viewerSliderContainer" 
             style="display:flex; width:100%; height:82vh; overflow-x:auto; scroll-snap-type:x mandatory; scroll-behavior:smooth; -webkit-overflow-scrolling:touch;" 
             class="scrollbar-none">
            ${images.map(url => `
                <div style="width:100%; height:100%; flex-shrink:0; scroll-snap-align:center; display:flex; align-items:center; justify-content:center; padding:0 8px;">
                    <img src="${url.trim()}" style="max-width:100%; max-height:100%; object-fit:contain; border-radius:8px; pointer-events:none;">
                </div>
            `).join('')}
        </div>
        
        ${images.length > 1 ? `<p id="viewerIndicator" style="color:rgba(255,255,255,0.6); font-size:13px; font-weight:bold; margin-top:12px; font-family:sans-serif; letter-spacing:1px; z-index:52000;">${startIdx + 1} / ${images.length}</p>` : ''}
    `;

    document.body.appendChild(overlay);

    const slider = overlay.querySelector('#viewerSliderContainer');
    const indicator = overlay.querySelector('#viewerIndicator');

    if (slider) {
        setTimeout(() => {
            slider.scrollLeft = slider.clientWidth * startIdx;
        }, 10);

        slider.onscroll = () => {
            if (indicator) {
                const page = Math.round(slider.scrollLeft / slider.clientWidth) + 1;
                indicator.innerText = `${page} / ${images.length}`;
            }
        };
    }

    const closeBtn = overlay.querySelector('#viewerCloseBtn');
    if (closeBtn) closeBtn.onclick = () => overlay.remove();

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    const escHandler = (e) => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);
}

// 수정 폼 세팅
function setupEditMode(item) {
    document.getElementById('editCommissionId').value = item.id;
    document.getElementById('commTitle').value = item.title;
    document.getElementById('commPrice').value = item.price;
    
    const typeSelect = document.getElementById('commSlotType');
    typeSelect.value = item.slot_type || "always";
    
    if (item.slot_type === 'limited') {
        document.getElementById('customSlotInputGroup').classList.remove('hidden');
        document.getElementById('commMaxSlots').value = item.max_slots || 5;
        document.getElementById('commCurrentSlots').value = item.current_slots || 0;
    } else {
        document.getElementById('customSlotInputGroup').classList.add('hidden');
    }

    document.getElementById('commItem').value = item.item_wanted || '';
    document.getElementById('commCredit').value = item.credit_rule || '';
    document.getElementById('commContact').value = item.contact_info || '';
    document.getElementById('commDesc').value = item.description || '';

    const tagIds = ['tagSD', 'tagLD', 'tagFix', 'tagSemi', 'tagFree', 'tagDoodle', 'tagLine', 'tagColor', 'tagFull', 'tagHead', 'tagBust', 'tagHalf', 'tagBody', 'tagCaddie', 'tagEtc'];
    tagIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = item.tags && item.tags.includes(el.dataset.name);
    });

    document.getElementById('regModalTitle').innerText = "내 커미션 정보 수정";
    document.getElementById('regSubmitBtn').innerText = "수정 완료하기";
    document.getElementById('editImgNotice').classList.remove('hidden');

    openModal('regModal');
}

// 4. 북마크 추가/삭제 토글
async function toggleBookmark(commissionId, isDeleteAction) {
    if (!window.currentUserId) return alert("로그인이 필요한 기능입니다.");
    try {
        if (isDeleteAction) {
            await window.supabaseClient.from('bookmarks').delete().eq('user_id', window.currentUserId).eq('commission_id', commissionId);
        } else {
            await window.supabaseClient.from('bookmarks').insert([{ user_id: window.currentUserId, commission_id: commissionId }]);
        }
        openDetail(commissionId);
    } catch (e) { alert("북마크 연산 실패: " + e.message); }
}

// 5. 북마크 탭 조회
async function fetchBookmarks() {
    const listContainer = document.getElementById('bookmarkList');
    if (!listContainer) return;
    if (!window.currentUserId) {
        listContainer.innerHTML = `<div class="text-center py-14 text-gray-400 text-sm">로그인 후 북마크를 확인하실 수 있습니다. ㅠㅠ</div>`;
        return;
    }
    try {
        const { data, error } = await window.supabaseClient
            .from('bookmarks')
            .select(`commission_id, commissions ( id, title, price, slot_type, max_slots, current_slots, tags, image_url, is_closed, profiles ( username ) )`)
            .eq('user_id', window.currentUserId);
            
        if (error) throw error;
        if (!data || data.length === 0) {
            listContainer.innerHTML = `<div class="text-center py-14 text-gray-400 text-sm">아직 북마크(찜)한 타입이 없습니다. 🤍</div>`;
            return;
        }

        listContainer.innerHTML = data.map(bookmark => {
            const item = bookmark.commissions;
            if (!item) return ''; 
            const slotText = item.is_closed ? '마감' : (item.slot_type === 'always' ? '상시' : `슬롯 ${item.current_slots || 0}/${item.max_slots || 5}`);
            const slotColor = item.is_closed ? 'bg-gray-200 text-gray-600' : 'bg-pink-50 text-pink-500';
            const tagsHTML = item.tags ? item.tags.map(tag => `<span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-medium">#${tag}</span>`).join(' ') : '';
            
            let firstImg = 'https://via.placeholder.com/350x200?text=No+Image';
            if (item.image_url) {
                firstImg = item.image_url.includes(',') ? item.image_url.split(',')[0] : item.image_url;
            }

            const closedOverlay = item.is_closed ? `
                <div class="absolute inset-0 bg-black/50 z-10 pointer-events-none flex flex-col items-center justify-center gap-1">
                    <span style="font-size:2rem;">🔒</span>
                    <span class="text-white font-bold text-sm tracking-wide" style="text-shadow:0 1px 4px rgba(0,0,0,0.7);">슬롯 마감</span>
                </div>` : '';

            return `
                <div class="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition cursor-pointer relative" onclick="openDetail(${item.id})">
                    <div class="h-44 bg-gray-100 relative">
                        <img src="${firstImg}" class="w-full h-full object-cover${item.is_closed ? ' opacity-60' : ''}">
                        ${closedOverlay}
                        <span class="absolute top-3 right-3 bg-black/60 text-white text-[11px] font-bold px-2.5 py-1 rounded-full z-20">${item.price} 가치</span>
                    </div>
                    <div class="p-3.5 space-y-1.5">
                        <div class="flex justify-between items-center">
                            <span class="text-xs text-gray-400 font-medium">✨ ${item.profiles?.username || '알 수 없음'}</span>
                            <span class="text-[11px] font-semibold ${slotColor} px-2 py-0.5 rounded-full">${slotText}</span>
                        </div>
                        <h3 class="font-bold text-gray-900 text-sm line-clamp-1">${item.title}</h3>
                        <div class="flex flex-wrap gap-1 pt-1">${tagsHTML}</div>
                    </div>
                </div>`;
        }).join('');
    } catch (e) { listContainer.innerHTML = `<div class="text-center py-10 text-red-400 text-sm">북마크 로드 실패 ㅠㅠ</div>`; }
}

// 6. 커미션 글 삭제 (🌟 무자비한 후기 삭제 경고 알림 트랩 장착 버전)
async function handleDeleteCommission(id, title) {
    if (!confirm(`🚨 경고: 정말 [ ${title} ] 타입을 삭제하시겠습니까?\n지금 삭제하시면 그동안 작성된 소중한 '후기'도 전부 함께 지워집니다. 정말 삭제하시겠습니까?`)) return;
    try {
        const { error } = await window.supabaseClient.from('commissions').delete().eq('id', id).eq('user_id', window.currentUserId);
        if (error) throw error;
        alert("커미션 타입과 연동 후기가 깔끔하게 파기되었습니다!");
        closeModal('myTypesModal');
        closeModal('detailModal');
        fetchCommissions();
    } catch (e) { alert("삭제 실패: " + e.message); }
}

// 7. 후기 목록 조회
async function fetchReviews(commissionId) {
    const reviewListContainer = document.getElementById('reviewList');
    if (!reviewListContainer) return;
    reviewListContainer.innerHTML = "<p class='text-xs text-gray-400'>후기 로딩 중...</p>";
    try {
        const { data: reviews, error } = await window.supabaseClient.from('reviews').select(`content, rating, profiles ( username )`).eq('commission_id', commissionId).order('created_at', { ascending: false });
        if (error) throw error;
        if (reviews.length === 0) {
            reviewListContainer.innerHTML = "<p class='text-xs text-gray-400 py-2'>아직 작성된 후기가 없습니다.</p>";
            return;
        }
        reviewListContainer.innerHTML = reviews.map(rev => `
            <div class="bg-gray-50 p-2.5 rounded-xl text-xs space-y-1">
                <div class="flex justify-between items-center">
                    <span class="font-semibold text-gray-700">👤 ${rev.profiles?.username || '신청자'}</span>
                    <span class="text-amber-400 font-bold">${'⭐'.repeat(rev.rating)}</span>
                </div>
                <p class="text-gray-600">${rev.content}</p>
            </div>`).join('');
    } catch (error) { reviewListContainer.innerHTML = "<p class='text-xs text-red-400'>후기 로드 실패</p>"; }
}

// 8. 한줄 후기 등록
async function handleCreateReview(e) {
    e.preventDefault();
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (!user) return alert("로그인 후 이용 가능합니다.");
    const commissionId = document.getElementById('targetCommissionId').value;
    const rating = parseInt(document.getElementById('reviewRating').value);
    const content = document.getElementById('reviewContent').value;
    try {
        const { error } = await window.supabaseClient.from('reviews').insert([{ commission_id: commissionId, writer_id: user.id, rating: rating, content: content }]);
        if (error) throw error;
        alert('후기가 등록되었습니다! 🎉');
        document.getElementById('reviewContent').value = '';
        fetchReviews(commissionId);
    } catch (error) { alert('후기 등록 실패: ' + error.message); }
}

// 9. 내 타입 목록 관리 열기 (🌟 관리창 내 수정 및 경고 삭제 액션 컴포넌트 실장)
async function openMyTypes() {
    closeModal('profileMenuModal');
    const container = document.getElementById('myTypesList');
    if (!container) return;
        
    container.innerHTML = "<p class='text-xs text-gray-400 text-center py-4'>불러오는 중...</p>";
    openModal('myTypesModal');
    try {
        const { data, error } = await window.supabaseClient
            .from('commissions')
            .select('id, title, price, slot_type, max_slots, current_slots, is_closed, is_private')
            .eq('user_id', window.currentUserId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        if (data.length === 0) {
            container.innerHTML = "<p class='text-xs text-gray-400 py-6 text-center'>등록한 커미션 타입이 없습니다.</p>";
            return;
        }
        container.innerHTML = data.map(item => {
            const slotText = item.slot_type === 'always' ? '상시' : `슬롯 ${item.current_slots || 0}/${item.max_slots || 5}개`;
            const closedBadge = item.is_closed
                ? `<span class="text-[10px] bg-gray-300 text-gray-600 px-2 py-0.5 rounded-full font-bold">마감</span>`
                : `<span class="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-bold">모집중</span>`;
            const privateBadge = item.is_private
                ? `<span class="text-[10px] bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-bold">비공개</span>`
                : `<span class="text-[10px] bg-blue-50 text-blue-400 px-2 py-0.5 rounded-full font-bold">공개중</span>`;
            return `
                <div class="bg-gray-50 rounded-xl p-3 flex flex-col gap-2.5 border border-gray-100">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="text-sm font-bold text-gray-800">${item.title}</p>
                            <p class="text-xs text-gray-400 mt-0.5">${item.price} 가치 · ${slotText}</p>
                        </div>
                        <div class="flex gap-1">${closedBadge} ${privateBadge}</div>
                    </div>
                    <!-- 🌟 내 타입 관리 대시보드 내 다이렉트 편집 액션 버튼 라인 신설 -->
                    <div class="flex justify-between items-center pt-2 border-t border-dashed border-gray-200">
                        <div class="flex gap-2">
                            <button onclick="closeModal('myTypesModal'); setupEditMode(${JSON.stringify(item).replace(/"/g, '&quot;')});" class="text-[11px] bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg font-bold hover:bg-blue-100">✏️ 타입 수정</button>
                            <button onclick="handleDeleteCommission(${item.id}, '${item.title}')" class="text-[11px] bg-red-50 text-red-500 px-2.5 py-1 rounded-lg font-bold hover:bg-red-100">🗑️ 삭제</button>
                        </div>
                        <div class="flex gap-3">
                            <button onclick="toggleClosedStatus(${item.id}, ${item.is_closed})" class="text-[10px] text-gray-500 underline hover:text-pink-500">${item.is_closed ? '마감 해제' : '슬롯 마감'}</button>
                            <button onclick="togglePrivateStatus(${item.id}, ${item.is_private})" class="text-[10px] text-gray-500 underline hover:text-purple-500">${item.is_private ? '공개 전환' : '비공개 전환'}</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        container.innerHTML = "<p class='text-xs text-red-400 text-center py-4'>목록 로드 실패</p>";
    }
}

// 슬롯 마감/해제 토글
async function toggleClosedStatus(id, currentStatus) {
    try {
        const { error } = await window.supabaseClient.from('commissions').update({ is_closed: !currentStatus }).eq('id', id).eq('user_id', window.currentUserId);
        if (error) throw error;
        await openMyTypes();
        if (typeof fetchCommissions === 'function') fetchCommissions();
    } catch (err) { alert("상태 변경 실패: " + err.message); }
}

// 비공개/공개 토글
async function togglePrivateStatus(id, currentStatus) {
    try {
        const { error } = await window.supabaseClient.from('commissions').update({ is_private: !currentStatus }).eq('id', id).eq('user_id', window.currentUserId);
        if (error) throw error;
        await openMyTypes();
        if (typeof fetchCommissions === 'function') fetchCommissions();
    } catch (err) { alert("비공개 상태 변경 실패: " + err.message); }
}
