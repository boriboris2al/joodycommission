// commission.js
// 🚨 중복 선언 에러(Identifier already been declared) 방지를 위해 const를 빼고 글로벌 변수 설정
if (window.supabaseClient) {
    supabase = window.supabaseClient;
}

let currentFilter = '전체';
let currentSearch = '';

// 하단 탭의 ➕ 버튼 클릭 시 작동 (권한 가드)
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

// 1. 메인 화면에 커미션 목록 띄우기
async function fetchCommissions() {
    const listContainer = document.getElementById('commissionList');
    if (!listContainer) return;
    
    try {
        let query = supabase
            .from('commissions')
            .select(`id, title, price, slot_type, tags, image_url, is_closed, profiles ( username )`);

        if (currentSearch && currentSearch.trim() !== '') {
            query = query.ilike('title', `%${currentSearch}%`);
        }

        if (currentFilter !== '전체') {
            query = query.contains('tags', [currentFilter]);
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;

        if (!data || data.length === 0) {
            listContainer.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm">조건에 맞는 커미션이 없습니다. ㅠㅠ</div>`;
            return;
        }

        listContainer.innerHTML = data.map(item => {
            const slotText = item.is_closed ? '마감' : (item.slot_type === 'always' ? '상시' : `슬롯 ${item.slot_type}/5`);
            const slotColor = item.is_closed ? 'bg-gray-200 text-gray-600' : 'bg-pink-50 text-pink-500';
            const tagsHTML = item.tags ? item.tags.map(tag => `<span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-medium">#${tag}</span>`).join(' ') : '';
            const sampleImg = item.image_url || 'https://via.placeholder.com/350x200?text=No+Image';

            return `
                <div class="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition cursor-pointer relative" onclick="openDetail(${item.id})">
                    ${item.is_closed ? '<div class="absolute inset-0 bg-black/5 z-10 pointer-events-none"></div>' : ''}
                    <div class="h-44 bg-gray-100 relative">
                        <img src="${sampleImg}" alt="${item.title}" class="w-full h-full object-cover">
                        <span class="absolute top-3 right-3 bg-black/60 text-white text-[11px] font-bold px-2.5 py-1 rounded-full backdrop-blur-xs">
                            ${item.price} 가치
                        </span>
                    </div>
                    <div class="p-3.5 space-y-1.5">
                        <div class="flex justify-between items-center">
                            <span class="text-xs text-gray-400 font-medium">✨ ${item.profiles?.username || '알 수 없음'}</span>
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

// 2. ★버튼 먹통 현상 완벽 해결한 새 커미션 등록 처리
async function handleCreateCommission(e) {
    e.preventDefault();
    
    // 유저 세션 다시 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || window.currentUserRole === 'applicant') {
        return alert("커미션을 등록할 권한이 없습니다.");
    }

    // 데이터 가져오기
    const title = document.getElementById('commTitle').value;
    const price = parseFloat(document.getElementById('commPrice').value);
    const slot_type = document.getElementById('commSlot').value;
    const description = document.getElementById('commDesc').value;
    const item_wanted = document.getElementById('commItem').value;
    const credit_rule = document.getElementById('commCredit').value;
    const custom_contact = document.getElementById('commContact').value; 
    const imageInput = document.getElementById('commImage');
    const imageFile = imageInput ? imageInput.files[0] : null;
    
    if (!custom_contact || !custom_contact.trim()) return alert("신청 연락망을 입력해 주세요!");

    // 체크박스 태그 빌드
    const tags = [];
    const tagIds = ['tagSD', 'tagLD', 'tagFix', 'tagSemi', 'tagFree', 'tagDoodle', 'tagLine', 'tagColor', 'tagFull', 'tagHead', 'tagBust', 'tagHalf', 'tagBody'];
    tagIds.forEach(id => {
        const el = document.getElementById(id);
        if(el && el.checked) tags.push(el.dataset.name);
    });

    try {
        let image_url = "";
        
        // 이미지가 있으면 업로드 프로세스 태우기
        if (imageFile) {
            const fileExt = imageFile.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            
            // Storage 업로드
            const { error: uploadError } = await supabase.storage
                .from('commission-samples')
                .upload(fileName, imageFile);

            if (uploadError) {
                // 만약 버킷이 없어서 에러 나면 사용자용 기본 이미지 처리 우회 경로 확보
                console.error("Storage 업로드 에러:", uploadError);
                throw new Error("이미지 서버 업로드 실패! (Storage 버킷 설정을 확인하거나 파일 형식을 확인해주세요)");
            }

            // 퍼블릭 URL 추출
            const { data } = supabase.storage.from('commission-samples').getPublicUrl(fileName);
            if (data) image_url = data.publicUrl;
        }

        // DB 최종 인서트 연산 (★ 컬럼 매핑 완벽 검증 버전)
        const { error } = await supabase.from('commissions').insert([{
            user_id: user.id,
            title: title,
            price: price,
            slot_type: slot_type,
            tags: tags,
            description: description,
            item_wanted: item_wanted,
            credit_rule: credit_rule,
            contact_info: custom_contact,
            image_url: image_url
        }]);

        if (error) throw error;

        alert("커미션이 성공적으로 등록되었습니다! 🎉");
        closeModal('regModal');
        document.getElementById('regForm').reset();
        fetchCommissions(); // 목록 갱신
    } catch (error) {
        alert("등록 실패 사유: " + error.message);
    }
}

// 3. 상세 팝업창 열기 (북마크 유무 실시간 파악)
async function openDetail(id) {
    try {
        const { data: item, error } = await supabase
            .from('commissions')
            .select(`*, profiles ( username )`)
            .eq('id', id)
            .single();

        if (error) throw error;

        document.getElementById('detailImg').src = item.image_url || 'https://via.placeholder.com/350x200?text=No+Image';
        document.getElementById('detailPrice').innerText = `${item.price} 가치`;
        document.getElementById('detailTitle').innerText = item.title;
        document.getElementById('detailArtist').innerText = `✨ 작가: ${item.profiles?.username || '알 수 없음'}`;
        document.getElementById('detailSlot').innerText = item.is_closed ? '슬롯 마감됨' : (item.slot_type === 'always' ? '상시 운영' : `남은 슬롯: ${item.slot_type}/5개`);
        document.getElementById('detailItem').innerText = item.item_wanted || '없음';
        document.getElementById('detailCredit').innerText = item.credit_rule || '자유롭게 표기 가능';
        document.getElementById('detailDesc').innerText = item.description || '상세 설명이 없습니다.';
        
        // 🔒 삭제 버튼 제어
        const deleteBtn = document.getElementById('detailDeleteBtn');
        if (window.currentUserId && window.currentUserId === item.user_id) {
            if (deleteBtn) {
                deleteBtn.classList.remove('hidden');
                deleteBtn.onclick = () => handleDeleteCommission(item.id, item.title);
            }
        } else { 
            if (deleteBtn) deleteBtn.classList.add('hidden'); 
        }

        // 🔖 북마크 버튼 제어
        const bookmarkBtn = document.getElementById('detailBookmarkBtn');
        if (bookmarkBtn) {
            if (window.currentUserId) {
                const { data: isBookmarked } = await supabase
                    .from('bookmarks')
                    .select('id')
                    .eq('user_id', window.currentUserId)
                    .eq('commission_id', id)
                    .maybeSingle();

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
                bookmarkBtn.onclick = () => { 
                    alert('로그인 후 북마크 등록이 가능합니다!'); 
                    openModal('authModal'); 
                };
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
                contactBtn.onclick = () => { 
                    navigator.clipboard.writeText(contactInfo); 
                    alert('연락처가 복사되었습니다!'); 
                };
            }
        }

        document.getElementById('targetCommissionId').value = id;
        fetchReviews(id);
        openModal('detailModal');
    } catch (error) { 
        alert('상세 정보를 불러오지 못했습니다: ' + error.message); 
    }
}

// 4. 북마크 추가/삭제 토글 연산 함수
async function toggleBookmark(commissionId, isDeleteAction) {
    if (!window.currentUserId) return alert("로그인이 필요한 기능입니다.");
    try {
        if (isDeleteAction) {
            const { error } = await supabase
                .from('bookmarks')
                .delete()
                .eq('user_id', window.currentUserId)
                .eq('commission_id', commissionId);
            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('bookmarks')
                .insert([{ user_id: window.currentUserId, commission_id: commissionId }]);
            if (error) throw error;
        }
        openDetail(commissionId); // 변경상태 반영해 상세창 갱신
    } catch (e) { 
        alert("북마크 연산 실패: " + e.message); 
    }
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
        const { data, error } = await supabase
            .from('bookmarks')
            .select(`commission_id, commissions ( id, title, price, slot_type, tags, image_url, is_closed, profiles ( username ) )`)
            .eq('user_id', window.currentUserId);
            
        if (error) throw error;
        if (!data || data.length === 0) {
            listContainer.innerHTML = `<div class="text-
