// auth.js
const supabase = window.supabaseClient;

// 현재 로그인한 유저 확인 및 UI 변경
async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    const loginBtn = document.getElementById('loginBtn');
    
    if (user) {
        // 프로필 정보(닉네임) 가져오기
        const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .single();
            
        loginBtn.innerText = profile ? `👤 ${profile.username}` : "👤 프로필 미설정";
        loginBtn.onclick = () => {
            if(confirm("로그아웃 하시겠습니까?")) handleLogout();
        };
    } else {
        loginBtn.innerText = "로그인/가입";
        loginBtn.onclick = () => openModal('authModal');
    }
}

// 이메일 로그인/가입 진행
async function handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const username = document.getElementById('authUsername').value;
    const role = document.getElementById('authRole').value;
    const isSignUp = !document.getElementById('authUsernameContainer').classList.contains('hidden');

    try {
        if (isSignUp) {
            // 1. 회원가입
            const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
            if (authError) throw authError;

            if (authData.user) {
                // 2. profiles 테이블에 인게임 닉네임 추가
                const { error: profError } = await supabase.from('profiles').insert([
                    { id: authData.user.id, username, role, contact_info: '' }
                ]);
                if (profError) throw profError;
                alert("가입 성공! 이메일 인증을 확인하거나 바로 로그인해보세요.");
            }
        } else {
            // 로그인
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            alert("로그인 성공!");
            closeModal('authModal');
            checkUser();
            fetchCommissions(); // 목록 새로고침
        }
    } catch (error) {
        alert(error.message);
    }
}

async function handleLogout() {
    await supabase.auth.signOut();
    alert("로그아웃 되었습니다.");
    location.reload();
}

// 로그인/회원가입 모드 전환 토글
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
