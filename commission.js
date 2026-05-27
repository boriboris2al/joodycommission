// commission.js
const supabase = window.supabaseClient;

// 메인 화면에 커미션 목록 띄우기
async function fetchCommissions() {
    const listContainer = document.getElementById('commissionList');
    if (!listContainer) return;
    
    try {
        const { data, error } = await supabase
            .from('commissions')
            .select(`id, title, price, slot_type, tags, image_url, profiles ( username )`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (data.length === 0) {
            listContainer.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm">등록된 커미션이 없습니다.</div>`;
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

// 새 커미션 등록 로직 (이미지 업로드 포함)
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
    
    // 선택된 태그 수집
    const tags = [];
    if(document.getElementById('tagSD').checked) tags.push('SD');
    if(document.getElementById('tagLD').checked) tags.push('LD');
    if(document.getElementById('tagFix').checked) tags.push('고정틀');
    if(document.getElementById('tagFree').checked) tags.push('자유');

    try {
        let image_url = "";

        // 이미지가 있으면 Supabase 스토리지에 먼저 업로드
        if (imageFile) {
            const fileExt = imageFile.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('commission-samples')
                .upload(fileName, imageFile);

            if (uploadError) throw uploadError;

            // 공개 URL 주소 따오기
            const { data } = supabase.storage.from('commission-samples').getPublicUrl(fileName);
            image_url = data.publicUrl;
        }

        // DB에 최종 저장
        const { error } = await supabase.from('commissions').insert([{
            user_id: user.id, title, price, slot_type, tags, description, item_wanted, credit_rule, image_url
        }]);

        if (error) throw error;

        alert("커미션이 등록되었습니다!");
        closeModal('regModal');
        fetchCommissions();
    } catch (error) {
        alert(error.message);
    }
}
