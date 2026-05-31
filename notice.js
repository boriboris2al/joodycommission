/* ========================================
   notice.js — 공지 · 문의 · 관리자 기능
   ======================================== */

// ──────────────────────────────────────────
// 1. 공지 메뉴 팝업 (📢 버튼 클릭)
// ──────────────────────────────────────────
function openNoticeMenu() {
    const existing = document.getElementById('noticeMenuPopup');
    if (existing) {
        existing.classList.toggle('hidden');
        return;
    }

    // 팝업 동적 생성
    const popup = document.createElement('div');
    popup.id = 'noticeMenuPopup';
    popup.className = 'notice-menu-popup';
    popup.innerHTML = `
        <button class="notice-menu-btn" onclick="closeNoticeMenu(); openNoticeModal();">
            📖 이용안내
        </button>
        <button class="notice-menu-btn" onclick="closeNoticeMenu(); openInquiry();">
            💬 문의하기
        </button>
    `;

    // 관리자면 관리자 패널 버튼 추가
    if (window.currentUserIsAdmin) {
        const adminBtn = document.createElement('button');
        adminBtn.className = 'notice-menu-btn';
        adminBtn.style.cssText = 'color:#9333ea; background:#f3e8ff; border-color:#e9d5ff;';
        adminBtn.innerHTML = '⚙️ 관리자 설정';
        adminBtn.onclick = () => { closeNoticeMenu(); openAdminModal(); };
        popup.appendChild(adminBtn);
    }

    // 📢 버튼 기준으로 위치
    const noticeBtn = document.querySelector('.notice-icon-btn');
    const wrapper = noticeBtn.closest('.notice-btn-wrapper') || noticeBtn.parentElement;
    wrapper.style.position = 'relative';
    wrapper.appendChild(popup);

    // 바깥 클릭 시 닫기
    setTimeout(() => {
        document.addEventListener('click', _noticeOutsideHandler);
    }, 0);
}

function _noticeOutsideHandler(e) {
    const popup = document.getElementById('noticeMenuPopup');
    const btn = document.querySelector('.notice-icon-btn');
    if (!popup) return;
    if (!popup.contains(e.target) && e.target !== btn) {
        closeNoticeMenu();
    }
}

function closeNoticeMenu() {
    const popup = document.getElementById('noticeMenuPopup');
    if (popup) popup.remove();
    document.removeEventListener('click', _noticeOutsideHandler);
}

// ──────────────────────────────────────────
// 2. 이용안내 모달
// ──────────────────────────────────────────
function openNoticeModal() {
    const modal = document.getElementById('noticeModal');
    if (!modal) return;
    modal.classList.add('active');
    loadNotice();
}

function closeNoticeModal() {
    const modal = document.getElementById('noticeModal');
    if (modal) modal.classList.remove('active');
}

// ──────────────────────────────────────────
// 3. Supabase에서 이용안내 불러오기
// ──────────────────────────────────────────
async function loadNotice() {
    const contentEl = document.getElementById('noticeContentText');
    if (!contentEl) return;

    contentEl.textContent = '불러오는 중...';

    try {
        const { data, error } = await supabase
            .from('site_settings')
            .select('setting_value')
            .eq('setting_key', 'notice_content')
            .single();

        if (error) throw error;

        contentEl.textContent = data?.setting_value || '이용안내가 아직 등록되지 않았습니다.';
    } catch (err) {
        console.error('이용안내 로드 실패:', err);
        contentEl.textContent = '이용안내를 불러올 수 없습니다.';
    }
}

// ──────────────────────────────────────────
// 4. 문의하기 (카카오 오픈채팅)
// ──────────────────────────────────────────
async function openInquiry() {
    try {
        const { data, error } = await supabase
            .from('site_settings')
            .select('setting_value')
            .eq('setting_key', 'kakao_link')
            .single();

        if (error) throw error;

        const link = data?.setting_value;
        if (link) {
            window.open(link, '_blank');
        } else {
            alert('문의 채널이 아직 등록되지 않았습니다.');
        }
    } catch (err) {
        console.error('문의 링크 로드 실패:', err);
        alert('문의 채널을 불러올 수 없습니다.');
    }
}

// ──────────────────────────────────────────
// 5. 관리자 패널 모달
// ──────────────────────────────────────────
function openAdminModal() {
    if (!window.currentUserIsAdmin) return;
    const modal = document.getElementById('adminModal');
    if (!modal) return;
    modal.classList.add('active');
    loadAdminSettings();
}

function closeAdminModal() {
    const modal = document.getElementById('adminModal');
    if (modal) modal.classList.remove('active');
}

async function loadAdminSettings() {
    try {
        const { data, error } = await supabase
            .from('site_settings')
            .select('setting_key, setting_value');

        if (error) throw error;

        data.forEach(row => {
            if (row.setting_key === 'notice_content') {
                const el = document.getElementById('adminNoticeContent');
                if (el) el.value = row.setting_value || '';
            }
            if (row.setting_key === 'kakao_link') {
                const el = document.getElementById('adminKakaoLink');
                if (el) el.value = row.setting_value || '';
            }
        });
    } catch (err) {
        console.error('관리자 설정 로드 실패:', err);
    }
}

async function saveAdminSettings() {
    if (!window.currentUserIsAdmin) return;

    const noticeContent = document.getElementById('adminNoticeContent')?.value || '';
    const kakaoLink = document.getElementById('adminKakaoLink')?.value || '';
    const saveBtn = document.getElementById('adminSaveBtn');

    if (saveBtn) {
        saveBtn.textContent = '저장 중...';
        saveBtn.disabled = true;
    }

    try {
        // notice_content upsert
        const { error: e1 } = await supabase
            .from('site_settings')
            .upsert({ setting_key: 'notice_content', setting_value: noticeContent });
        if (e1) throw e1;

        // kakao_link upsert
        const { error: e2 } = await supabase
            .from('site_settings')
            .upsert({ setting_key: 'kakao_link', setting_value: kakaoLink });
        if (e2) throw e2;

        if (saveBtn) saveBtn.textContent = '✅ 저장 완료!';
        setTimeout(() => {
            if (saveBtn) {
                saveBtn.textContent = '저장하기';
                saveBtn.disabled = false;
            }
        }, 2000);
    } catch (err) {
        console.error('저장 실패:', err);
        alert('저장에 실패했습니다. 다시 시도해 주세요.');
        if (saveBtn) {
            saveBtn.textContent = '저장하기';
            saveBtn.disabled = false;
        }
    }
}
