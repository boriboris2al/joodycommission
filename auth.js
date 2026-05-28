// auth.js
// 🔴 수정: 최상단에서 즉시 할당하지 않고 함수로 감쌈 (타이밍 문제 해결)
const getSupabase = () => window.supabaseClient;

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

// 이메일 로그인/가입 처리
async function handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const username = document.getElementById('authUsername').value;
    const contact = document.getElementById('authContact').value;
    const role = document.getElementById('authRole').value;

    const isSignUp = !document.getElementById('authUsernameContainer').classList.contains('hidden');

    try {
        if (isSignUp) {
            if (!username.trim()) return alert("인게임 닉네임을 입력해주세요!");

            const { data: authData, error: authError } = await getSupabase().auth.signUp({ email, password });
            if (authError) throw authError;

            if (authData.user) {
                const { error: profError } = await getSupabase().from('profiles').insert([
                    { id: authData.user.id, username, role, contact_info: contact }
                ]);
                if (profError) throw profError;

                alert("가입 성공! 가입하신 정보로 로그인을 진행해주세요.");
                toggleAuthMode();
            }
        } else {
            const { error } = await getSupabase().auth.signInWithPassword({ email, password });
            if (error) throw error;

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

function toggleAuthMode() {
    const usernameContainer = document.getElementById('authUsernameContainer');
    const submitBtn = document.getElementById('authSubmitBtn');
    const toggleText = document.getElementById('authToggleText');

    if (usernameContainer.classList.contains('hidden')) {
        usernameContainer.classList.remove('hidden');
        submitBtn.innerText = "회원가입하기";
        toggleText.innerText = "이미 계정이 있으신가요? 로그인";
    } else {
        usernameContainer.classList.add('hidden');
        submitBtn.innerText = "로그인하기";
        toggleText.innerText = "처음이신가요? 인게임 닉네임으로 가입하기";
    }
}
