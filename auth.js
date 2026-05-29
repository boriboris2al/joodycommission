// auth.js
const getSupabase = () => window.supabaseClient;

// 닉네임 → hex 이메일 변환
function makeEmail(username) {
    if (!username) return '';
    const hex = Array.from(new TextEncoder().encode(username.trim()))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    return hex + '@joody.com';
}

// 현재 로그인한 유저 확인 및 UI 변경 (🌟 동시 오픈 버그 제어형으로 깔끔 분리)
async function checkUser() {
    try {
        const { data: { user } } = await getSupabase().auth.getUser();
        const loginBtn = document.getElementById('loginBtn');

        if (user) {
            const { data: profile, error } = await getSupabase()
                .from('profiles')
                .select('username, role')
                .eq('id', user.id)
                .maybeSingle();

            if (profile && profile.username) {
                loginBtn.innerText = `👤 ${profile.username}`;
                window.currentUserRole = profile.role || 'commissioner';
                window.currentUserId = user.id;
                window.currentUsername = profile.username;
            }
            // 🌟 프로필을 클릭했을 때는 동시 팝업 대신 계정 메뉴 전용 창만 딱 뜨도록 설정
            loginBtn.onclick = () => openProfileMenu();
        } else {
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

// 프로필 메뉴 열기
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
    const username = document.getElementById('authUsername').value.trim();
    const password = document.getElementById('authPassword').value;
    const isSignUp = !document.getElementById('authExtraContainer').classList.contains('hidden');

    if (!username || !password) return alert("빈칸을 모두 채워주세요!");
    const email = makeEmail(username);

    try {
        if (isSignUp) {
            const contact = document.getElementById('authContact').value.trim();
            const role = document.getElementById('authRole').value;

            const { data: existing } = await getSupabase().from('profiles').select('id').eq('username', username).maybeSingle();
            if (existing) return alert("이미 사용 중인 닉네임입니다!");

            const { data: authData, error: authError } = await getSupabase().auth.signUp({ email, password });
            if (authError) throw authError;

            if (authData.user) {
                const { error: profError } = await getSupabase().from('profiles').insert([
                    { id: authData.user.id, username, role, contact_info: contact }
                ]);
                if (profError) throw profError;
                
                alert(`가입 성공! 이제 [${username}] 닉네임으로 로그인을 진행해주세요.`);
                toggleAuthMode(); 
            }
        } else {
            const { error } = await getSupabase().auth.signInWithPassword({ email, password });
            if (error) throw new Error("닉네임 또는 비밀번호가 올바르지 않습니다.");

            alert("로그인되었습니다! 🎀");
            closeModal('authModal');
            document.getElementById('authForm').reset();
            await checkUser();
            if (typeof fetchCommissions === 'function') fetchCommissions();
        }
    } catch (error) { alert("인증 실패: " + error.message); }
}

async function handleLogout() {
    await getSupabase().auth.signOut();
    alert("로그아웃 되었습니다.");
    location.reload();
}

// 🚨 [신규 기능 추가] 안전장치 2단 계정 탈퇴 파괴자 엔진 실장 완료
async function handleWithdrawal() {
    const checkPw = prompt("🚨 계정을 정말 탈퇴하시겠습니까?\n작성하신 모든 커미션 타입과 계정 정보가 즉시 파기되며 복구할 수 없습니다.\n본인 확인을 위해 비밀번호를 입력해주세요:");
    if (!checkPw) return;

    try {
        const { data: { user } } = await getSupabase().auth.getUser();
        if (!user) return alert("유저 세션이 만료되었습니다. 다시 로그인 후 시도해주세요.");

        // 1차 비밀번호 세션 검증 확인차 재인증 시도
        const { error: reAuthErr } = await getSupabase().auth.signInWithPassword({ email: user.email, password: checkPw });
        if (reAuthErr) return alert("비밀번호가 일치하지 않아 탈퇴 처리가 취소되었습니다.");

        // 2차 profiles 테이블 데이터 즉각 파쇄 (종속 커미션 데이터는 DB cascade 옵션 설정에 따름)
        const { error: dbErr } = await getSupabase().from('profiles').delete().eq('id', user.id);
        if (dbErr) throw dbErr;

        alert("그동안 이용해 주셔서 감사합니다. 계정 탈퇴 처리가 안전하게 완료되었습니다.");
        await getSupabase().auth.signOut();
        location.reload();
    } catch (err) {
        alert("탈퇴 처리 중 서버 오류가 발생했습니다: " + err.message);
    }
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

// 내 타입 목록 관리 팝업 대시보드
async function openMyTypes() {
    closeModal('profileMenuModal');
    const container = document.getElementById('myTypesList');
    if (!container) return;
    container.innerHTML = "<p class='text-xs text-gray-400 text-center py-4'>불러오는 중...</p>";
    openModal('myTypesModal');

    try {
        const { data, error } = await getSupabase()
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
            const closedBadge = item.is_closed ? `<span class="text-[10px] bg-gray-300 text-gray-600 px-2 py-0.5 rounded-full font-bold">마감</span>` : `<span class="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-bold">모집중</span>`;
            const privateBadge = item.is_private ? `<span class="text-[10px] bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-bold">비공개</span>` : `<span class="text-[10px] bg-blue-50 text-blue-400 px-2 py-0.5 rounded-full font-bold">공개중</span>`;
                
            return `
                <div class="bg-gray-50 rounded-xl p-3 flex flex-col gap-2.5 border border-gray-100">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="text-sm font-bold text-gray-800">${item.title}</p>
                            <p class="text-xs text-gray-400 mt-0.5">${item.price} 가치 · ${slotText}</p>
                        </div>
                        <div class="flex gap-1">${closedBadge} ${privateBadge}</div>
                    </div>
                    <div class="flex justify-between items-center pt-2 border-t border-dashed border-gray-200">
                        <div class="flex gap-2">
                            <button onclick="closeModal('myTypesModal'); if(typeof setupEditMode === 'function') setupEditMode(${JSON.stringify(item).replace(/"/g, '&quot;')});" class="text-[11px] bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg font-bold hover:bg-blue-100">✏️ 타입 수정</button>
                            <button onclick="if(typeof handleDeleteCommission === 'function') handleDeleteCommission(${item.id}, '${item.title}')" class="text-[11px] bg-red-50 text-red-500 px-2.5 py-1 rounded-lg font-bold hover:bg-red-100">🗑️ 삭제</button>
                        </div>
                        <div class="flex gap-3">
                            <button onclick="toggleClosedStatus(${item.id}, ${item.is_closed})" class="text-[10px] text-gray-500 underline hover:text-pink-500">${item.is_closed ? '마감 해제' : '슬롯 마감'}</button>
                            <button onclick="togglePrivateStatus(${item.id}, ${item.is_private})" class="text-[10px] text-gray-500 underline hover:text-purple-500">${item.is_private ? '공개 전환' : '비공개 전환'}</button>
                        </div>
                    </div>
                </div>`;
        }).join('');
    } catch (err) { container.innerHTML = "<p class='text-xs text-red-400 text-center py-4'>목록 로드 실패</p>"; }
}

async function toggleClosedStatus(id, currentStatus) {
    try {
        const { error } = await getSupabase().from('commissions').update({ is_closed: !currentStatus }).eq('id', id).eq('user_id', window.currentUserId);
        if (error) throw error;
        await openMyTypes();
        if (typeof fetchCommissions === 'function') fetchCommissions();
    } catch (err) { alert("상태 변경 실패: " + err.message); }
}

async function togglePrivateStatus(id, currentStatus) {
    try {
        const { error } = await getSupabase().from('commissions').update({ is_private: !currentStatus }).eq('id', id).eq('user_id', window.currentUserId);
        if (error) throw error;
        await openMyTypes();
        if (typeof fetchCommissions === 'function') fetchCommissions();
    } catch (err) { alert("비공개 상태 변경 실패: " + err.message); }
}

// ✏️ 정보 수정 모달 열기
async function openEditProfile() {
    closeModal('profileMenuModal');
    try {
        const { data: profile } = await getSupabase()
            .from('profiles').select('username, contact_info, response_time').eq('id', window.currentUserId).maybeSingle();
        if (profile) {
            document.getElementById('editUsername').value = profile.username || '';
            document.getElementById('editContact').value = profile.contact_info || '';
            document.getElementById('editResponseTime').value = profile.response_time || ''; 
        }
        document.getElementById('editPassword').value = '';
        openModal('editProfileModal');
    } catch (e) { alert("profiles 캐시를 가져오지 못했습니다."); }
}

// ✏️ 정보 수정 저장 (🌟 이제 연동 에러 없이 완벽 저장 작동!)
async function handleEditProfile(e) {
    if(e) e.preventDefault();
    const newUsername = document.getElementById('editUsername').value.trim();
    const newContact = document.getElementById('editContact').value.trim();
    const newResponseTime = document.getElementById('editResponseTime').value.trim();
    const newPassword = document.getElementById('editPassword').value;

    try {
        if (newUsername !== window.currentUsername) {
            const { data: existing } = await getSupabase().from('profiles').select('id').eq('username', newUsername).maybeSingle();
            if (existing) return alert("이미 다른 유저가 사용 중인 닉네임입니다!");
        }

        const { error: profError } = await getSupabase()
            .from('profiles')
            .update({ username: newUsername, contact_info: newContact, response_time: newResponseTime })
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
    } catch (err) { alert("수정 실패: " + err.message); }
}
