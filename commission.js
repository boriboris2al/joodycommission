// commission.js
const supabase = window.supabaseClient;

// 전역 상태 변수 (현재 필터 및 검색어 상태 기억)
let currentFilter = '전체';
let currentSearch = '';

// 1. 메인 화면에 커미션 목록 띄우기 (필터 및 검색 적용)
async function fetchCommissions() {
    const listContainer = document.getElementById('commissionList');
    if (!listContainer) return;
    
    try {
        // 기본 쿼리 생성 (profiles 정보 포함)
        let query = supabase
            .from('commissions')
            .select(`id, title, price, slot_type, tags, image_url, profiles ( username )`);

        // [검색 조건] 제목 또는 닉네임 검색
        if (currentSearch.trim() !== '') {
            // 주디 닉네임 또는 제목에 검색어가 포함된 경우 (ilike는 대소문자 구분 없는 포함 검색)
            // 주의: supabase에서 관계 테이블(profiles) 필터링은 편의상 클라이언트 단 처리 혹은 rpc를 쓰지만, 여기서는 간단히 제목 기반 검색으로 우선 처리 후 고도화합니다.
            query = query.ilike('title', `%${currentSearch}%`);
        }

        // [필터 조건] '전체'가 아니면 해당 태그를 포함하고 있는지 검사
        if (currentFilter !== '전체') {
            query = query.contains('tags', [currentFilter]);
        }

        // 최신순 정렬
        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        if (data.length === 0) {
            listContainer.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm">조건에 맞는 커미션이 없습니다. ㅠㅠ</div>`;
            return;
        }

        listContainer.innerHTML = data.map(item => {
            const slotText = item.slot_type === 'always' ? '상시' : `슬롯 ${item.slot_type}/5`;
            const tagsHTML = item.tags.map(tag => `<span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-medium">#${tag}</span>`).join(' ');
            const sampleImg = item.image_url || 'https://via.placeholder.com/350x200?text=No+Image';

            return `
                <div class="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition cursor-pointer" onclick="openDetail(${item.id})">
                    <div class="h-44 bg-gray-100 relative">
                        <img src="${sampleImg}" alt="${item.title}" class="w-full h-full object-cover">
                        <span class="absolute top-3 right-3 bg-black/60 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">${item.price} 가치</span>
                    </div>
                    <div class="p-3.5 space-y-1.5">
                        <div class="flex justify-between items-center">
                            <span class="text-xs text-gray-400 font-medium">✨ ${item.profiles?.username || '알 수 없음'}</span>
                            <span class="text-[11px] font-semibold text-pink-500 bg-pink-50 px-2 py-0.5 rounded-full">${slotText}</span>
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

// 필터 변경 함수
function changeFilter(target, filterName) {
    // 이전 활성화된 버튼 스타일 리셋
    const buttons = target.parentElement.querySelectorAll('button');
    buttons.forEach(btn => {
        btn.className = "bg-white text-gray-600 border border-gray-200 px-3 py-1.5 rounded-full whitespace-nowrap hover:border-pink-300 transition";
    });
    // 선택된 버튼만 하이라이트
    target.className = "bg-pink-500 text-white px-3 py-1.5 rounded-full whitespace-nowrap font-medium shadow-sm transition";
    
    currentFilter = filterName;
    fetchCommissions();
}

// 2. 새 커미션 등록 로직
async function handleCreateCommission(e) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("로그인이 필요한 기능입니다.");

    const title = document.getElementById('commTitle').value;
    const price = parseFloat(document.getElementById('commPrice').value);
    const slot_type = document.getElementById('commSlot').value;
    const description = document.getElementById('commDesc').value;
    const item_wanted = document.getElementById('commItem').value;
    const credit_rule = document.getElementById('commCredit').value;
    const imageFile = document.getElementById('commImage').files[0];
    
    // 선택 가능한 모든 카테고리 체크박스 수집
    const tags = [];
    ['tagSD', 'tagLD', 'tagFix', 'tagSemi', 'tagFree', 'tagDoodle', 'tagLine', 'tagColor', 'tagFull', 'tagHead', 'tagBust', 'tagHalf', 'tagBody'].forEach(id => {
        const el = document.getElementById(id);
        if(el && el.checked) tags.push(el.dataset.name);
    });

    try {
        let image_url = "";
        if (imageFile) {
            const fileExt = imageFile.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('commission-samples')
                .upload(fileName, imageFile);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('commission-samples').getPublicUrl(fileName);
            image_url = data.publicUrl;
        }

        const { error } = await supabase.from('commissions').insert([{
            user_id: user.id, title, price, slot_type, tags, description, item_wanted, credit_rule, image_url
        }]);

        if (error) throw error;

        alert("커미션이 등록되었습니다!");
        closeModal('regModal');
        document.getElementById('regForm').reset();
        fetchCommissions();
    } catch (error) {
        alert(error.message);
    }
}

// 3. 상세 페이지 팝업 열기
async function openDetail(id) {
    try {
        // 커미션 상세 정보 가져오기
        const { data: item, error } = await supabase
            .from('commissions')
            .select(`*, profiles ( username, contact_info )`)
            .eq('id', id)
            .single();

        if (error) throw error;

        // 상세 모달창에 데이터 꽂아넣기
        document.getElementById('detailImg').src = item.image_url || 'https://via.placeholder.com/350x200?text=No+Image';
        document.getElementById('detailPrice').innerText = `${item.price} 가치`;
        document.getElementById('detailTitle').innerText = item.title;
        document.getElementById('detailArtist').innerText = `✨ 작가: ${item.profiles?.username || '알 수 없음'}`;
        document.getElementById('detailSlot').innerText = item.slot_type === 'always' ? '상시 운영' : `남은 슬롯: ${item.slot_type}/5개`;
        document.getElementById('detailItem').innerText = item.item_wanted || '없음 (아무거나 가능)';
        document.getElementById('detailCredit').innerText = item.credit_rule || '자유롭게 표기 가능';
        document.getElementById('detailDesc').innerText = item.description || '상세 설명이 없습니다.';
        
        // 연락처 연결 버튼 설정
        const contactBtn = document.getElementById('detailContactBtn');
        const contactInfo = item.profiles?.contact_info || '';
        
        if (contactInfo.startsWith('http')) {
            contactBtn.innerText = "💬 오픈채팅으로 신청하기";
            contactBtn.onclick = () => window.open(contactInfo, '_blank');
        } else {
            contactBtn.innerText = `🎮 인게임 ID: ${contactInfo || item.profiles?.username} (복사하기)`;
            contactBtn.onclick = () => {
                navigator.clipboard.writeText(contactInfo || item.profiles?.username);
                alert('인게임 닉네임이 복사되었습니다! 인게임에서 연락해보세요.');
            };
        }

        // 후기 작성을 위해 현재 커미션 ID 숨겨두기
        document.getElementById('targetCommissionId').value = id;

        // 후기 목록 가져오기
        fetchReviews(id);

        openModal('detailModal');
    } catch (error) {
        alert('상세 정보를 불러오지 못했습니다: ' + error.message);
    }
}

// 4. 특정 커미션의 후기 목록 불러오기
async function fetchReviews(commissionId) {
    const reviewListContainer = document.getElementById('reviewList');
    reviewListContainer.innerHTML = "<p class='text-xs text-gray-400'>후기 로딩 중...</p>";

    try {
        const { data: reviews, error } = await supabase
            .from('reviews')
            .select(`content, rating, profiles ( username )`)
            .eq('commission_id', commissionId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (reviews.length === 0) {
            reviewListContainer.innerHTML = "<p class='text-xs text-gray-400 py-2'>아직 작성된 후기가 없습니다. 첫 후기를 남겨보세요!</p>";
            return;
        }

        reviewListContainer.innerHTML = reviews.map(rev => `
            <div class="bg-gray-50 p-2.5 rounded-xl text-xs space-y-1">
                <div class="flex justify-between items-center">
                    <span class="font-semibold text-gray-700">👤 ${rev.profiles?.username || '신청자'}</span>
                    <span class="text-amber-400 font-bold">${'⭐'.repeat(rev.rating)}</span>
                </div>
                <p class="text-gray-600">${rev.content}</p>
            </div>
        `).join('');
    } catch (error) {
        reviewListContainer.innerHTML = "<p class='text-xs text-red-400'>후기를 불러오지 못했습니다.</p>";
    }
}

// 5. 후기 등록하기
async function handleCreateReview(e) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("로그인 후 이용 가능합니다.");

    const commissionId = document.getElementById('targetCommissionId').value;
    const rating = parseInt(document.getElementById('reviewRating').value);
    const content = document.getElementById('reviewContent').value;

    try {
        const { error } = await supabase.from('reviews').insert([{
            commission_id: commissionId,
            writer_id: user.id,
            rating: rating,
            content: content
        }]);

        if (error) throw error;

        alert('후기가 등록되었습니다!');
        document.getElementById('reviewContent').value = '';
        fetchReviews(commissionId); // 후기 리스트 갱신
    } catch (error) {
        alert('후기 등록 실패: ' + error.message);
    }
}
