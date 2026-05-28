// commission.js
const supabase = window.supabaseClient;

let currentFilter = '전체';
let currentSearch = '';

// [필독] 이번 에러의 핵심 범인! 하단 탭의 ➕ 버튼을 누르면 작동하는 함수입니다.
function openRegisterModal() {
    // 1. 로그인 여부 체크
    if (!window.currentUserRole) {
        alert("로그인이 필요한 서비스입니다. 로그인 또는 회원가입을 먼저 해주세요!");
        openModal('authModal');
        return;
    }
    
    // 2. 권한 체크 (신청자 계정은 글쓰기 차단)
    if (window.currentUserRole === 'applicant') {
        alert("신청자 전용 계정은 커미션을 등록할 수 없습니다. 글을 쓰려면 '커미션주' 계정으로 가입해 주세요.");
        return;
    }
    
    // 3. 통과 시 등록 모달 오픈
    openModal('regModal');
}

// 1. 메인 화면에 커미션 목록 띄우기 (실시간 필터 및 검색 반영)
async function fetchCommissions() {
    const listContainer = document.getElementById('commissionList');
    if (!listContainer) return;
    
    try {
        let query = supabase
            .from('commissions')
            .select(`id, title, price, slot_type, tags, image_url, profiles ( username )`);

        if (currentSearch.trim() !== '') {
            query = query.ilike('title', `%${currentSearch}%`);
        }

        if (currentFilter !== '전체') {
            query = query.contains('tags', [currentFilter]);
        }

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

// 필터 버튼 클릭 시 작동
function changeFilter(target, filterName) {
    const buttons = target.parentElement.querySelectorAll('button');
    buttons.forEach(btn => {
        btn.className = "bg-white text-gray-600 border border-gray-200 px-3 py-1.5 rounded-full whitespace-nowrap hover:border-pink-300 transition";
    });
    target.className = "bg-pink-500 text-white px-3 py-1.5 rounded-full whitespace-nowrap font-medium shadow-sm transition";
    currentFilter = filterName;
    fetchCommissions();
}

// 2. 새 커미션 등록 처리 (이미지 업로드 + 개별 연락망 반영)
async function handleCreateCommission(e) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || window.currentUserRole === 'applicant') return alert("작성 권한이 없습니다.");

    const title = document.getElementById('commTitle').value;
    const price = parseFloat(document.getElementById('commPrice').value);
    const slot_type = document.getElementById('commSlot').value;
    const description = document.getElementById('commDesc').value;
    const item_wanted = document.getElementById('commItem').value;
    const credit_rule = document.getElementById('commCredit').value;
    const custom_contact = document.getElementById('commContact').value; 
    const imageFile = document.getElementById('commImage').files[0];
    
    if (!custom_contact.trim()) return alert("신청 연락망을 입력해 주세요!");

    // 선택된 모든 체크박스 태그 수집
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

        // DB 등록
        const { error } = await supabase.from('commissions').insert([{
            user_id: user.id, title, price, slot_type, tags, description, item_wanted, credit_rule, image_url
        }]);

        // 글 작성 시 입력한 개별 연락망을 프로필에도 실시간 동기화
        await supabase.from('profiles').update({ contact_info: custom_contact }).eq('id', user.id);

        if (error) throw error;

        alert("커미션이 성공적으로 등록되었습니다!");
        closeModal('regModal');
        document.getElementById('regForm').reset();
        fetchCommissions();
    } catch (error) {
        alert("등록 실패: " + error.message);
    }
}

// 3. 상세 팝업창 열기 및 데이터 매핑
async function openDetail(id) {
    try {
        const { data: item, error } = await supabase
            .from('commissions')
            .select(`*, profiles ( username, contact_info )`)
            .eq('id', id)
            .single();

        if (error) throw error;

        document.getElementById('detailImg').src = item.image_url || 'https://via.placeholder.com/350x200?text=No+Image';
        document.getElementById('detailPrice').innerText = `${item.price} 가치`;
        document.getElementById('detailTitle').innerText = item.title;
        document.getElementById('detailArtist').innerText = `✨ 작가: ${item.profiles?.username || '알 수 없음'}`;
        document.getElementById('detailSlot').innerText = item.slot_type === 'always' ? '상시 운영' : `남은 슬롯: ${item.slot_type}/5개`;
        document.getElementById('detailItem').innerText = item.item_wanted || '없음 (아무거나 가능)';
        document.getElementById('detailCredit').innerText = item.credit_rule || '자유롭게 표기 가능';
        document.getElementById('detailDesc').innerText = item.description || '상세 설명이 없습니다.';
        
        const contactBtn = document.getElementById('detailContactBtn');
        const contactInfo = item.profiles?.contact_info || ''; 
        
        if (contactInfo.startsWith('http')) {
            contactBtn.innerText = "💬 오픈채팅으로 신청하기";
            contactBtn.onclick = () => window.open(contactInfo, '_blank');
        } else {
            contactBtn.innerText = `🎮 연락처: ${contactInfo} (복사하기)`;
            contactBtn.onclick = () => {
                navigator.clipboard.writeText(contactInfo);
                alert('연락처가 클립보드에 복사되었습니다!');
            };
        }

        document.getElementById('targetCommissionId').value = id;
        fetchReviews(id);
        openModal('detailModal');
    } catch (error) {
        alert('상세 정보를 불러오지 못했습니다: ' + error.message);
    }
}

// 4. 후기 목록 조회
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

// 5. 한줄 후기 등록
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
        fetchReviews(commissionId);
    } catch (error) {
        alert('후기 등록 실패: ' + error.message);
    }
}
