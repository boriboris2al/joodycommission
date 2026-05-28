// auth.js
const getSupabase = () => window.supabaseClient;

// 닉네임 → hex 이메일 변환 (기존 클로드 원본 로직 완벽 복구)
function makeEmail(username) {
    if (!username) return '';
    const hex = Array.from(new TextEncoder().encode(username.trim()))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    return hex + '@joody.com';
}

// 현재 로그인한 유저 확인 및 UI 변경 (★안전 장치 대폭 강화 버전)
async function checkUser() {
    try {
        const { data: { user } } = await getSupabase().auth.getUser();
        const loginBtn = document.getElementById('loginBtn');

        if (user) {
            // 1. profiles 테이블에서 내 유저 정보 조회
            const { data: profile, error } = await getSupabase()
                .from('profiles')
                .select('username, role')
                .eq('id', user.id)
                .maybeSingle();

            if (profile && profile.username) {
                // 정상적으로 내 프로필을 찾은 경우
                loginBtn.innerText = `👤 ${profile.username}`;
                window.currentUserRole = profile.role || 'commissioner'; // 기본값 설정
                window.currentUserId = user.id;
                window.currentUsername = profile.username;
            }

            // 프로필 버튼 클릭 → 계정 메뉴 팝업 열기
            loginBtn.onclick = () => openProfileMenu();
        } else {
            // 로그인이 안 된 상태
            loginBtn.innerText = "로그인/가입";
            window.currentUserRole = null;
            window.currentUserId = null;
            window.currentUsername = null;
            loginBtn.onclick = () => openModal('authModal');
        }
    } catch (e) {
        console.error("유저 확인 오류:", e);
    }
}

// 프로필 메뉴 열기 (역할에 따라 메뉴 구성)
function openProfileMenu() {
    const isCommissioner = window.currentUserRole === 'commissioner' || window.currentUserRole === 'both';
    const menuBtn = document.getElementById('menuMyTypes');
    if (menuBtn) {
        menuBtn.style.display = isCommissioner ? 'block' : 'none';
    }
    openModal('profileMenuModal');
}

// 로그인/가입 처리
async function handleAuth(e) {
    e.preventDefault();
    
    const usernameInput = document.getElementById('authUsername');
    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = document.getElementById('authPassword').value;
    
    const isSignUp = !document.getElementById('authExtraContainer').classList.contains('hidden');

    if (!username) return alert("주디 인게임 닉네임을 입력해주세요!");
    if (!password) return alert("비밀번호를 입력해주세요!");

    const email = makeEmail(username);

    try {
        if (isSignUp) {
            const contact = document.getElementById('authContact').value;
            const role = document.getElementById('authRole').value;

            // 닉네임 중복 체크
            const { data: existing } = await getSupabase()
                .from('profiles').select('id').eq('username', username).maybeSingle();
            if (existing) return alert("이미 사용 중인 닉네임입니다!");

            // Supabase 가입
            const { data: authData, error: authError } = await getSupabase().auth.signUp({ email, password });
            if (authError) throw authError;

            if (authData.user) {
                // profiles 테이블에 유저 정보 연동
                const { error: profError } = await getSupabase().from('profiles').insert([
                    { id: authData.user.id, username, role, contact_info: contact }
                ]);
                if (profError) throw profError;
                
                alert(`가입 성공! 이제 [${username}] 닉네임으로 로그인을 진행해주세요.`);
                toggleAuthMode(); 
            }
        } else {
            // 로그인 처리
            const { error } = await getSupabase().auth.signInWithPassword({ email, password });
            if (error) throw new Error("닉네임 또는 비밀번호가 올바르지 않습니다.");

            alert("로그인되었습니다! 🎀");
            closeModal('authModal');
            document.getElementById('authForm').reset();
            
            // 전역 세션 강제 갱신 후 새로고침급 정렬
            await checkUser();
            if (typeof fetchCommissions === 'function') {
                fetchCommissions();
            }
        }
    } catch (error) {
        alert("인증 실패: " + error.message);
    }
}

async function handleLogout() {
    await getSupabase().auth.signOut();
    alert("로그아웃 되었습니다.");
    location.reload();
}

function toggleAuthMode() {
    const extraContainer = document.getElementById('authExtraContainer');
    const submitBtn = document.getElementById('authSubmitBtn');
    const toggleText = document.getElementById('authToggleText');
    const title = document.getElementById('authModalTitle');

    if (extraContainer.classList.contains('hidden')) {
        extraContainer.classList.remove('hidden');
        submitBtn.innerText = "회원가입하기";
        toggleText.innerText = "이미 계정이 있으신가요? 로그인";
        title.innerText = "회원가입";
    } else {
        extraContainer.classList.add('hidden');
        submitBtn.innerText = "로그인하기";
        toggleText.innerText = "처음이신가요? 회원가입";
        title.innerText = "로그인";
    }
}

// 내 타입 목록 열기
async function openMyTypes() {
    closeModal('profileMenuModal');
    const container = document.getElementById('myTypesList');
    if (!container) return;
    
    container.innerHTML = "<p class='text-xs text-gray-400 text-center py-4'>불러오는 중...</p>";
    openModal('myTypesModal');

    try {
        const { data, error } = await getSupabase()
            .from('commissions')
            .select('id, title, price, slot_type, is_closed')
            .eq('user_id', window.currentUserId)
            .order('created_at', { ascending: false });
        if (error) throw error;

        if (data.length === 0) {
            container.innerHTML = "<p class='text-xs text-gray-400 py-6 text-center'>등록한 커미션 타입이 없습니다.</p>";
            return;
        }

        container.innerHTML = data.map(item => {
            const slotText = item.slot_type === 'always' ? '상시' : `슬롯 ${item.slot_type}개`;
            const closedBadge = item.is_closed
                ? `<span class="text-[10px] bg-gray-300 text-gray-600 px-2 py-0.5 rounded-full font-bold">마감</span>`
                : `<span class="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-bold">모집중</span>`;
            return `
                <div class="bg-gray-50 rounded-xl p-3 flex justify-between items-center border border-gray-100">
                    <div>
                        <p class="text-sm font-bold text-gray-800">${item.title}</p>
                        <p class="text-xs text-gray-400 mt-0.5">${item.price} 가치 · ${slotText}</p>
                    </div>
                    <div class="flex flex-col gap-1 items-end">
                        ${closedBadge}
                        <button onclick="toggleClosedStatus(${item.id}, ${item.is_closed})" class="text-[10px] text-gray-400 underline hover:text-pink-500">
                            ${item.is_closed ? '마감 해제' : '슬롯 마감'}
                        </button>
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
        const { error } = await getSupabase()
            .from('commissions')
            .update({ is_closed: !currentStatus })
            .eq('id', id)
            .eq('user_id', window.currentUserId);
        if (error) throw error;
        
        await openMyTypes();
        if (typeof fetchCommissions === 'function') fetchCommissions();
    } catch (err) {
        alert("상태 변경 실패: " + err.message);
    }
}

// 정보 수정 모달 열기
async function openEditProfile() {
    closeModal('profileMenuModal');
    try {
        const { data: profile } = await getSupabase()
            .from('profiles').select('username, contact_info').eq('id', window.currentUserId).maybeSingle();
        if (profile) {
            document.getElementById('editUsername').value = profile.username || '';
            document.getElementById('editContact').value = profile.contact_info || '';
        }
        document.getElementById('editPassword').value = '';
        openModal('editProfileModal');
    } catch (e) {
        alert("프로필 정보를 가져오지 못했습니다.");
    }
}

// 정보 수정 저장
async function handleEditProfile(e) {
    e.preventDefault();
    const newUsername = document.getElementById('editUsername').value.trim();
    const newContact = document.getElementById('editContact').value.trim();
    const newPassword = document.getElementById('editPassword').value;

    try {
        if (newUsername !== window.currentUsername) {
            const { data: existing } = await getSupabase()
                .from('profiles').select('id').eq('username', newUsername).maybeSingle();
            if (existing) return alert("이미 다른 유저가 사용 중인 닉네임입니다!");
        }

        const { error: profError } = await getSupabase()
            .from('profiles')
            .update({ username: newUsername, contact_info: newContact })
            .eq('id', window.currentUserId);
        if (profError) throw profError;

        if (newPassword.trim() || newUsername !== window.currentUsername) {
            const newEmail = makeEmail(newUsername);
            const updateData = { email: newEmail };
            if (newPassword.trim()) updateData.password = newPassword;

            const { error: pwError } = await getSupabase().auth.updateUser(updateData);
            if (pwError) throw pwError;
        }

        alert("회원 정보가 성공적으로 수정되었습니다! ✨");
        closeModal('editProfileModal');
        await checkUser();
        if (typeof fetchCommissions === 'function') fetchCommissions();
    } catch (err) {
        alert("수정 실패: " + err.message);
    }
}
