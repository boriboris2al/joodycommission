// auth.js
const getSupabase = () => window.supabaseClient;

// 닉네임으로 가짜 이메일 생성 (Supabase Auth용)
function makeEmail(username) {
    return `${username.trim().toLowerCase().replace(/\s+/g, '_')}@joody.com`;
}

// 현재 로그인한 유저 확인 및 UI 변경
async function checkUser() {
    try {
        const { data: { user } } = await getSupabase().auth.getUser();
        const loginBtn = document.getElementById('loginBtn');

        if (user) {
            const { data: profile } = await getSupabase()
                .from('profiles')
                .select('username, role')
                .eq('id', user.id)
                .maybeSingle();

            if (profile) {
                loginBtn.innerText = `👤 ${profile.username}`;
                window.currentUserRole = profile.role;
            } else {
                loginBtn.innerText = "👤 프로필 미설정";
                window.currentUserRole = null;
            }

            loginBtn.onclick = () => {
                if (confirm("로그아웃 하시겠습니까?")) handleLogout();
            };
        } else {
            loginBtn.innerText = "로그인/가입";
            window.currentUserRole = null;
            loginBtn.onclick = () => openModal('authModal');
        }
    } catch (e) {
        console.error("유저 확인 오류:", e);
    }
}

// 닉네임+비밀번호 로그인/가입 처리
async function handleAuth(e) {
    e.preventDefault();
    const username = document.getElementById('authUsername').value.trim();
    const password = document.getElementById('authPassword').value;
    const isSignUp = !document.getElementById('authExtraContainer').classList.contains('hidden');

    if (!username) return alert("인게임 닉네임을 입력해주세요!");
    if (!password) return alert("비밀번호를 입력해주세요!");

    // 닉네임 → 가짜 이메일 변환 (Supabase Auth 내부용)
    const email = makeEmail(username);

    try {
        if (isSignUp) {
            const contact = document.getElementById('authContact').value;
            const role = document.getElementById('authRole').value;

            // 닉네임 중복 체크
            const { data: existing } = await getSupabase()
                .from('profiles')
                .select('id')
                .eq('username', username)
                .maybeSingle();
            if (existing) return alert("이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해주세요!");

            const { data: authData, error: authError } = await getSupabase().auth.signUp({ email, password });
            if (authError) throw authError;

            if (authData.user) {
                const { error: profError } = await getSupabase().from('profiles').insert([
                    { id: authData.user.id, username, role, contact_info: contact }
                ]);
                if (profError) throw profError;

                alert("가입 성공! 닉네임과 비밀번호로 로그인해주세요.");
                toggleAuthMode();
            }
        } else {
            const { error } = await getSupabase().auth.signInWithPassword({ email, password });
            if (error) {
                // 로그인 실패 시 친절한 메시지
                if (error.message.includes('Invalid login')) {
                    throw new Error("닉네임 또는 비밀번호가 올바르지 않습니다.");
                }
                throw error;
            }

            alert("로그인되었습니다!");
            closeModal('authModal');
            document.getElementById('authForm').reset();
            await checkUser();
            fetchCommissions();
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

// 로그인 ↔ 회원가입 토글
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
