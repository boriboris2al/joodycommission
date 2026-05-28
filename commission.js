// commission.js
let currentFilter = '전체';
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

// 1. 메인 화면에 커미션 목록 띄우기 (비공개 처리된 글은 노출 원천 차단!)
async function fetchCommissions() {
    const listContainer = document.getElementById('commissionList');
    if (!listContainer) return;
    
    try {
        // 비공개 기능 작동을 위해 'is_private' 필드도 select
        let query = window.supabaseClient
            .from('commissions')
            .select(`id, title, price, slot_type, tags, image_url, is_closed, is_private, user_id, profiles ( username )`);

        // 검색 처리
        if (currentSearch && currentSearch.trim() !== '') {
            query = query.ilike('title', `%${currentSearch}%`);
        }

        // 태그 필터 처리
        if (currentFilter !== '전체') {
            query = query.contains('tags', [currentFilter]);
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;

        // 🕵️ 요구사항 2: 비공개 글 필터링 가드
        // 단, 본인이 쓴 글이라면 비공개 상태여도 메인 피드에서 보여야 하므로 필터링 규칙 결합
        const visibleData = data.filter(item => {
            if (item.is_private === true) {
                return window.currentUserId && window.currentUserId === item.user_id;
            }
            return true;
        });

        if (!visibleData || visibleData.length === 0) {
            listContainer.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm">조건에 맞는 커미션이 없습니다. ㅠㅠ</div>`;
            return;
        }

        listContainer.innerHTML = visibleData.map(item => {
            const slotText = item.is_closed ? '마감' : (item.slot_type === 'always' ? '상시' : `슬롯 ${item.slot_type}/5`);
            const slotColor = item.is_closed ? 'bg-gray-200 text-gray-600' : 'bg-pink-50 text-pink-500';
            const tagsHTML = item.tags ? item.tags.map(tag => `<span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-medium">#${tag}</span>`).join(' ') : '';
            
            // 이미지 주소 뭉치 파싱해서 대표사진 1장 출력
            let firstImg = 'https://via.placeholder.com/350x200?text=No+Image';
            if (item.image_url) {
                firstImg = item.image_url.includes(',') ? item.image_url.split(',')[0] : item.image_url;
            }
            
            const privateBadge = item.is_private ? `<span class="text-[10px] bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-bold">비공개</span>` : '';

            return `
                <div class="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition cursor-pointer relative" onclick="openDetail(${item.id})">
                    ${item.is_closed ? '<div class="absolute inset-0 bg-black/5 z-10 pointer-events-none"></div>' : ''}
                    <div class="h-44 bg-gray-100 relative">
                        <img src="${firstImg}" alt="${item.title}" class="w-full h-full object-cover">
                        <span class="absolute top-3 right-3 bg-black/60 text-white text-[11px] font-bold px-2.5 py-1 rounded-full backdrop-blur-xs">
                            ${item.price} 가치
                        </span>
                    </div>
                    <div class="p-3.5 space-y-1.5">
                        <div class="flex justify-between items-center">
                            <div class="flex items-center gap-1">
                                <span class="text-xs text-gray-400 font-medium">✨ ${item.profiles?.username || '알 수 없음'}</span>
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
    const buttons = target.parentElement.querySelectorAll('button');
    buttons.forEach(btn => {
        btn.className = "bg-white text-gray-600 border border-gray-200 px-3 py-1.5 rounded-full whitespace-nowrap hover:border-pink-300 transition";
    });
    target.className = "bg-pink-500 text-white px-3 py-1.5 rounded-full whitespace-nowrap font-medium shadow-sm transition";
    currentFilter = filterName;
    fetchCommissions();
}

// 2. 새 커미션 등록 및 ✏️ 요구사항 1: 수정하기 로직 통합 제어 함수
async function handleCreateCommission(e) {
    e.preventDefault();
    
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (!user || window.currentUserRole === 'applicant') return alert("작성 권한이 없습니다.");

    // 수정 모드 ID 여부 체크
    const editId = document.getElementById('editCommissionId').value;

    const title = document.getElementById('commTitle').value;
    const price = parseFloat(document.getElementById('commPrice').value);
    const slot_type = document.getElementById('commSlot').value;
    const is_private = document.getElementById('commIsPrivate').checked; // 비공개 값 확보
    const description = document.getElementById('commDesc').value;
    const item_wanted = document.getElementById('commItem').value;
    const credit_rule = document.getElementById('commCredit').value;
    const custom_contact = document.getElementById('commContact').value; 
    
    const imageInput = document.getElementById('commImage');
    const imageFiles = imageInput ? imageInput.files : [];
    
    if (!custom_contact || !custom_contact.trim()) return alert("신청 연락망을 입력해 주세요!");

    const tags = [];
    const tagIds = ['tagSD', 'tagLD', 'tagFix', 'tagSemi', 'tagFree', 'tagDoodle', 'tagLine', 'tagColor', 'tagFull', 'tagHead', 'tagBust', 'tagHalf', 'tagBody'];
    tagIds.forEach(id => {
        const el = document.getElementById(id);
        if(el && el.checked) tags.push(el.dataset.name);
    });

    try {
        let final_image_str = "";

        // 📸 요구사항 3: 이미지 파일이 선택된 경우 멀티 업로드 루프 연산 실행 (최대 4장 이상)
        if (imageFiles.length > 0) {
            const urlArray = [];
            for (let i = 0; i < Math.min(imageFiles.length, 6); i++) { // 안전 한도 6장 제한
                const file = imageFiles[i];
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${i}.${fileExt}`;
                
                const { error: upErr } = await window.supabaseClient.storage.from('commission-samples').upload(fileName, file);
                if (upErr) throw upErr;

                const { data } = window.supabaseClient.storage.from('commission-samples').getPublicUrl(fileName);
                if (data) urlArray.push(data.publicUrl);
            }
            final_image_str = urlArray.join(','); // 여러 장의 주소를 콤마로 이어 붙여 스트링으로 직렬화
        }

        const dataPayload = {
            user_id: user.id, title, price, slot_type, tags, description, item_wanted, credit_rule, contact_info: custom_contact, is_private
        };

        // 이미지 주소가 빌드된 경우에만 페이로드에 포함 (수정 모드 시 사진을 안 바꿀 수 있으므로)
        if (final_image_str !== "") {
            dataPayload.image_url = final_image_str;
        }

        if (editId) {
            // ✏️ 수정 연산 실행
            const { error } = await window.supabaseClient
                .from('commissions')
                .update(dataPayload)
                .eq('id', editId)
                .eq('user_id', window.currentUserId);
            if (error) throw error;
            alert("커미션 타입 수정이 완료되었습니다! ✨");
        } else {
            // 새 글 등록 연산 실행
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

// 3. 상세 팝업창 열기 (📸 멀티 슬라이더 렌더링 주입)
async function openDetail(id) {
    try {
        const { data: item, error } = await window.supabaseClient.from('commissions').select(`*, profiles ( username )`).eq('id', id).single();
        if (error) throw error;

        // 📸 요구사항 3: 이미지 파싱 및 슬라이드 동적 UI 주입
        const sliderContainer = document.getElementById('detailSliderContainer');
        const imgCounter = document.getElementById('detailImgCounter');
        
        let images = [];
        if (item.image_url) {
            images = item.image_url.includes(',') ? item.image_url.split(',') : [item.image_url];
        } else {
            images = ['https://via.placeholder.com/350x200?text=No+Image'];
        }

        // 이미지 돔 트리 구성
        sliderContainer.innerHTML = images.map(url => `
            <div class="w-full h-full flex-shrink-0 snap-center">
                <img src="${url.trim()}" class="w-full h-full object-cover">
            </div>
        `).join('');

        // 2장 이상일 때 인디케이터 띄워주기
        if (images.length > 1) {
            imgCounter.classList.remove('hidden');
            imgCounter.innerText = `👈 가로 슬라이드 넘겨보기 (1/${images.length})`;
            
            // 사용자가 손가락으로 넘길 때 숫자 실시간 계산 인터랙션 추가
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
        document.getElementById('detailArtist').innerText = `✨ 작가: ${item.profiles?.username || '알 수 없음'}`;
        document.getElementById('detailSlot').innerText = item.is_closed ? '슬롯 마감됨' : (item.slot_type === 'always' ? '상시 운영' : `남은 슬롯: ${item.slot_type}/5개`);
        document.getElementById('detailItem').innerText = item.item_wanted || '없음';
        document.getElementById('detailCredit').innerText = item.credit_rule || '자유롭게 표기 가능';
        document.getElementById('detailDesc').innerText = item.description || '상세 설명이 없습니다.';
        
        // 🔒 삭제 및 수정 버튼 권한 동시대조 가드
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
                    setupEditMode(item); // 수정 폼 로드 실행 함수 호출
                };
            }
        } else { 
            if (deleteBtn) deleteBtn.classList.add('hidden'); 
            if (editBtn) editBtn.classList.add('hidden'); 
        }

        // 북마크 버튼 제어
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

// ✏️ 요구사항 1: 기존 데이터 불러와서 수정 전용 양식으로 변경해 주는 보조 함수
function setupEditMode(item) {
    document.getElementById('editCommissionId').value = item.id;
    document.getElementById('commTitle').value = item.title;
    document.getElementById('commPrice').value = item.price;
    document.getElementById('commSlot').value = item.slot_type;
    document.getElementById('commIsPrivate').checked = item.is_private || false; // 비공개 체크박스 동기화
    document.getElementById('commItem').value = item.item_wanted || '';
    document.getElementById('commCredit').value = item.credit_rule || '';
    document.getElementById('commContact').value = item.contact_info || '';
    document.getElementById('commDesc').value = item.description || '';

    // 태그 체크박스 역바인딩 복구
    const tagIds = ['tagSD', 'tagLD', 'tagFix', 'tagSemi', 'tagFree', 'tagDoodle', 'tagLine', 'tagColor', 'tagFull', 'tagHead', 'tagBust', 'tagHalf', 'tagBody'];
    tagIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = item.tags && item.tags.includes(el.dataset.name);
    });

    document.getElementById('regModalTitle').innerText = "내 커미션 정보 수정";
    document.getElementById('regSubmitBtn').innerText = "수정 완료하기";
    document.getElementById('editImgNotice').classList.remove('hidden');

    openModal('regModal');
}

// 4. 북마크 추가/삭제 토글 연산 함수
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

// 5. 하단 탭 [북마크] 전용 조회 함수
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
            .select(`commission_id, commissions ( id, title, price, slot_type, tags, image_url, is_closed, profiles ( username ) )`)
            .eq('user_id', window.currentUserId);
            
        if (error) throw error;
        if (!data || data.length === 0) {
            listContainer.innerHTML = `<div class="text-center py-14 text-gray-400 text-sm">아직 북마크(찜)한 타입이 없습니다. 🤍</div>`;
            return;
        }

        listContainer.innerHTML = data.map(bookmark => {
            const item = bookmark.commissions;
            if (!item) return ''; 
            const slotText = item.is_closed ? '마감' : (item.slot_type === 'always' ? '상시' : `슬롯 ${item.slot_type}/5`);
            const slotColor = item.is_closed ? 'bg-gray-200 text-gray-600' : 'bg-pink-50 text-pink-500';
            const tagsHTML = item.tags ? item.tags.map(tag => `<span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-medium">#${tag}</span>`).join(' ') : '';
            
            let firstImg = 'https://via.placeholder.com/350x200?text=No+Image';
            if (item.image_url) {
                firstImg = item.image_url.includes(',') ? item.image_url.split(',')[0] : item.image_url;
            }

            return `
                <div class="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition cursor-pointer relative" onclick="openDetail(${item.id})">
                    ${item.is_closed ? '<div class="absolute inset-0 bg-black/5 z-10 pointer-events-none"></div>' : ''}
                    <div class="h-44 bg-gray-100 relative">
                        <img src="${firstImg}" class="w-full h-full object-cover">
                        <span class="absolute top-3 right-3 bg-black/60 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">${item.price} 가치</span>
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

// 6. 커미션 글 삭제 처리
async function handleDeleteCommission(id, title) {
    if (!confirm(`🚨정말 [ ${title} ] 타입을 삭제하시겠습니까?\n삭제된 데이터와 후기는 복구할 수 없습니다.`)) return;
    try {
        const { error } = await window.supabaseClient.from('commissions').delete().eq('id', id).eq('user_id', window.currentUserId);
        if (error) throw error;
        alert("커미션 타입이 깔끔하게 삭제되었습니다!");
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
