
import { auth, database } from "./base.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, signOut, reload } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, set, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

document.addEventListener('DOMContentLoaded', () => {
    setupAuthForms();
    setupPasswordValidation();
    setupFormAnimations();
    setupEmailVerificationHelper();
});

function setupAuthForms() {

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }

    const verifyBtn = document.getElementById('sendVerificationBtn');
    if (verifyBtn) {
        verifyBtn.addEventListener('click', async () => {
            if (!pendingVerificationUser) {
                showToast('Primero completa el registro para enviar la verificación.', 'warning');
                return;
            }
            await sendVerificationEmailFlow(pendingVerificationUser, { manual: true });
        });
    }
}

function setupEmailVerificationHelper() {
    const verifyBtn = document.getElementById('verifyEmailBtn');
    if (!verifyBtn) return;

    verifyBtn.addEventListener('click', handleVerifyEmail);
}

async function handleVerifyEmail() {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const statusEl = document.getElementById('verifyStatus');
    const spinnerEl = document.getElementById('verifySpinner');

    const email = emailInput?.value?.trim();
    const password = passwordInput?.value || '';

    if (!email || !password) {
        showToast('Ingresa tu correo y contraseña para verificar.', 'warning');
        return;
    }

    setVerifyState('Enviando verificación...', 'info', true);

    try {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        const user = credential.user;

        if (user.emailVerified) {
            setVerifyState('Tu correo ya está verificado. Puedes iniciar sesión.', 'success', false);
            await signOut(auth);
            return;
        }

        try {
            await sendEmailVerification(user);
            setVerifyState('Enviamos el correo de verificación. Revisa bandeja y spam.', 'success', true);
        } catch (err) {
            console.error('sendEmailVerification error:', err);
            setVerifyState('No pudimos enviar el correo. Intenta de nuevo más tarde.', 'error', false);
            await signOut(auth);
            return;
        }

        let attempts = 0;
        const maxAttempts = 8; // ~32s if interval is 4s
        const intervalMs = 4000;

        const pollInterval = setInterval(async () => {
            attempts++;
            await user.reload();
            if (user.emailVerified) {
                clearInterval(pollInterval);
                setVerifyState('Se verificó tu correo exitosamente.', 'success', false);
                await signOut(auth);
            } else if (attempts >= maxAttempts) {
                clearInterval(pollInterval);
                setVerifyState('Aún no se verifica. Revisa tu correo/spam o reenvía más tarde.', 'warning', false);
                await signOut(auth);
            }
        }, intervalMs);
    } catch (error) {
        console.error('Verification helper error:', error);
        handleAuthError(error);
        setVerifyState('', 'info', false);
    }

    function setVerifyState(message, type, loading) {
        const status = document.getElementById('verifyStatus');
        const spinner = document.getElementById('verifySpinner');
        if (status) {
            status.textContent = message;
            status.className = `verify-status ${type}`;
        }
        if (spinner) spinner.style.display = loading ? 'inline-block' : 'none';
    }
}

async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const remember = document.getElementById('remember')?.checked;
    
    if (!email || !password) {
        showToast('Por favor completa todos los campos', 'error');
        return;
    }
    
    showLoader();
    
    try {

        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (!user.emailVerified) {
            try {
                await sendEmailVerification(user);
                showToast('Te enviamos un enlace para verificar tu correo. Revisa tu bandeja y spam.', 'warning');
            } catch (err) {
                console.error('Verification email error:', err);
                showToast('Necesitas verificar tu correo. Si no ves el enlace, reenvíalo desde tu correo.', 'warning');
            }
            await signOut(auth);
            return;
        }

        showToast('¡Bienvenido de vuelta! <i class="fas fa-sign-in-alt"></i>', 'success');

        await updateUserLastLogin(user.uid);

        setTimeout(() => {
            if (window.ADDUXSHOP.isAdmin) {
                window.location.href = '/panel';
            } else {
                window.location.href = '/';
            }
        }, 1500);
        
    } catch (error) {
        console.error('Login error:', error);
        handleAuthError(error);
    } finally {
        hideLoader();
    }
}

async function handleRegister(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const phone = document.getElementById('phone').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const terms = document.getElementById('terms')?.checked;
    const newsletter = document.getElementById('newsletter')?.checked;

    if (!username || !phone || !email || !password || !confirmPassword) {
        showToast('Por favor completa todos los campos', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showToast('Las contraseñas no coinciden', 'error');
        return;
    }
    
    if (password.length < 6) {
        showToast('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }
    
    if (!terms) {
        showToast('Debes aceptar los términos y condiciones', 'error');
        return;
    }
    
    showLoader();
    
    try {

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        const userData = {
            username: username,
            email: email,
            phone: phone,
            coins: 0,
            role: 'user',
            lastLogin: new Date().toISOString(),
            newsletter: newsletter || false,
            status: 'pending_verification'
        };

        await set(ref(database, `users/${user.uid}`), userData);

        pendingVerificationUser = user;
        enableVerificationControls(true);
        await sendVerificationEmailFlow(user, { manual: false });
    
    } catch (error) {
        console.error('Registration error:', error);
        handleAuthError(error);
    } finally {
        hideLoader();
    }
}

function handleAuthError(error) {
    let message = 'Error de autenticación';
    
    switch (error.code) {
        case 'auth/user-not-found':
            message = 'Usuario no encontrado';
            break;
        case 'auth/wrong-password':
            message = 'Correo o contraseña incorrecto';
            break;
        case 'auth/invalid-credential':
            message = 'Correo o contraseña incorrecto';
            break;
        case 'auth/email-already-in-use':
            message = 'El correo ya está en uso';
            break;
        case 'auth/weak-password':
            message = 'La contraseña es muy débil';
            break;
        case 'auth/invalid-email':
            message = 'Correo electrónico inválido';
            break;
        case 'auth/too-many-requests':
            message = 'Demasiados intentos. Intenta más tarde';
            break;
        case 'auth/network-request-failed':
            message = 'Error de conexión. Verifica tu internet';
            break;
        default:
            message = error.message || 'Error desconocido';
    }
    
    showToast(message, 'error');
}

async function updateUserLastLogin(userId) {
    try {
        await update(ref(database, `users/${userId}`), {
            lastLogin: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error updating last login:', error);
    }
}

function togglePassword(inputId = 'password') {
    const passwordInput = document.getElementById(inputId);
    const toggleButton = passwordInput.nextElementSibling;
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleButton.innerHTML = '<i class="fas fa-eye-slash"></i>';
    } else {
        passwordInput.type = 'password';
        toggleButton.innerHTML = '<i class="fas fa-eye"></i>';
    }
}

function socialLogin(provider) {
    showToast(`Inicio de sesión con ${provider} próximamente`, 'warning');
}

function socialRegister(provider) {
    showToast(`Registro con ${provider} próximamente`, 'warning');
}

function setupPasswordValidation() {
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    
    if (passwordInput) {
        passwordInput.addEventListener('input', validatePassword);
    }
    
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', validatePasswordMatch);
    }
}

let verificationPoll = null;
let pendingVerificationUser = null;

function enableVerificationControls(enabled) {
    const btn = document.getElementById('sendVerificationBtn');
    if (btn) btn.disabled = !enabled;
}

function setVerificationStatus(text, variant = 'info') {
    const status = document.getElementById('verificationStatus');
    if (status) {
        status.textContent = text;
        status.dataset.variant = variant;
    }
}

function toggleVerificationSpinner(show) {
    const spinner = document.getElementById('verificationSpinner');
    if (spinner) spinner.style.display = show ? 'inline-block' : 'none';
}

async function sendVerificationEmailFlow(user, { manual = false } = {}) {
    if (!user) return;
    try {
        toggleVerificationSpinner(true);
        enableVerificationControls(false);
        setVerificationStatus(manual ? 'Reenviando correo de verificación...' : 'Enviando correo de verificación...', 'info');
        await sendEmailVerification(user);
        setVerificationStatus('Correo enviado. Revisa bandeja y spam para confirmar tu cuenta.', 'success');
        startVerificationPolling(user);
    } catch (err) {
        console.error('Error sending verification email:', err);
        setVerificationStatus('No se pudo enviar el correo. Intenta nuevamente.', 'error');
        enableVerificationControls(true);
    } finally {
        toggleVerificationSpinner(false);
    }
}

function startVerificationPolling(user) {
    if (!user) return;
    if (verificationPoll) clearInterval(verificationPoll);
    verificationPoll = setInterval(async () => {
        try {
            await reload(user);
            if (user.emailVerified) {
                clearInterval(verificationPoll);
                verificationPoll = null;
                setVerificationStatus('Correo verificado correctamente. Redirigiendo...', 'success');
                try {
                    await update(ref(database, `users/${user.uid}`), { status: 'active', lastLogin: new Date().toISOString() });
                } catch (err) {
                    console.error('Error updating status after verification:', err);
                }
                showToast('Correo verificado. Inicia sesión para continuar.', 'success');
                setTimeout(async () => {
                    await signOut(auth);
                    window.location.href = '/login';
                }, 1600);
            }
        } catch (err) {
            console.error('Polling verification error:', err);
        }
    }, 4000);
}

function validatePassword(event) {
    const password = event.target.value;
    const strengthBar = document.getElementById('passwordStrengthBar');
    const strengthText = document.getElementById('passwordStrengthText');
    
    if (!strengthBar || !strengthText) return;
    
    let strength = 0;
    let strengthLabel = '';
    
    if (password.length >= 8) strength++;
    if (password.match(/[a-z]/)) strength++;
    if (password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;
    
    strengthBar.className = 'password-strength-bar';
    
    if (strength <= 2) {
        strengthBar.classList.add('weak');
        strengthLabel = 'Débil';
        strengthBar.style.width = '33%';
    } else if (strength <= 3) {
        strengthBar.classList.add('medium');
        strengthLabel = 'Media';
        strengthBar.style.width = '66%';
    } else {
        strengthBar.classList.add('strong');
        strengthLabel = 'Fuerte';
        strengthBar.style.width = '100%';
    }
    
    strengthText.textContent = strengthLabel;
}

function validatePasswordMatch(event) {
    const password = document.getElementById('password')?.value;
    const confirmPassword = event.target.value;
    
    if (confirmPassword && password !== confirmPassword) {
        event.target.classList.add('error');
        event.target.classList.remove('success');
        showFormMessage(event.target, 'Las contraseñas no coinciden', 'error');
    } else if (confirmPassword && password === confirmPassword) {
        event.target.classList.remove('error');
        event.target.classList.add('success');
        showFormMessage(event.target, 'Contraseñas coinciden', 'success');
    } else {
        event.target.classList.remove('error', 'success');
        hideFormMessage(event.target);
    }
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePhone(phone) {
    const re = /^[\+]?[1-9][\d]{0,15}$/;
    return re.test(phone.replace(/[\s\-\(\)]/g, ''));
}

function validateUsername(username) {
    const re = /^[a-zA-Z0-9_]{3,20}$/;
    return re.test(username);
}

function showFormMessage(input, message, type) {
    const existingMessage = input.parentNode.querySelector('.form-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    const messageElement = document.createElement('div');
    messageElement.className = `form-message ${type}`;
    messageElement.textContent = message;
    input.parentNode.appendChild(messageElement);
}

function hideFormMessage(input) {
    const existingMessage = input.parentNode.querySelector('.form-message');
    if (existingMessage) {
        existingMessage.remove();
    }
}

function setupFormAnimations() {
    const inputs = document.querySelectorAll('.form-input');
    
    inputs.forEach((input, index) => {
        input.style.animationDelay = `${index * 0.1}s`;
        input.classList.add('fade-in-up');
    });
    
    const buttons = document.querySelectorAll('.auth-btn, .social-btn');
    buttons.forEach((button, index) => {
        button.style.animationDelay = `${(inputs.length + index) * 0.1}s`;
        button.classList.add('fade-in-up');
    });
}

function setupRealTimeValidation() {
    const emailInput = document.getElementById('email');
    const usernameInput = document.getElementById('username');
    const phoneInput = document.getElementById('phone');
    
    if (emailInput) {
        emailInput.addEventListener('blur', () => {
            if (emailInput.value && !validateEmail(emailInput.value)) {
                emailInput.classList.add('error');
                showFormMessage(emailInput, 'Correo electrónico inválido', 'error');
            } else if (emailInput.value) {
                emailInput.classList.remove('error');
                emailInput.classList.add('success');
                hideFormMessage(emailInput);
            }
        });
    }
    
    if (usernameInput) {
        usernameInput.addEventListener('blur', () => {
            if (usernameInput.value && !validateUsername(usernameInput.value)) {
                usernameInput.classList.add('error');
                showFormMessage(usernameInput, 'Usuario debe tener 3-20 caracteres (letras, números, _)', 'error');
            } else if (usernameInput.value) {
                usernameInput.classList.remove('error');
                usernameInput.classList.add('success');
                hideFormMessage(usernameInput);
            }
        });
    }
    
    if (phoneInput) {
        phoneInput.addEventListener('blur', () => {
            if (phoneInput.value && !validatePhone(phoneInput.value)) {
                phoneInput.classList.add('error');
                showFormMessage(phoneInput, 'Número de teléfono inválido', 'error');
            } else if (phoneInput.value) {
                phoneInput.classList.remove('error');
                phoneInput.classList.add('success');
                hideFormMessage(phoneInput);
            }
        });
    }
}

async function checkUsernameAvailability(username) {
    if (!username) return false;
    
    try {
        const snapshot = await window.firebaseDatabase.ref('users')
            .orderByChild('username')
            .equalTo(username)
            .once('value');
        
        return !snapshot.exists();
    } catch (error) {
        console.error('Error checking username:', error);
        return false;
    }
}

function forgotPassword() {
    const email = prompt('Ingresa tu correo electrónico para restablecer la contraseña:');
    
    if (email && validateEmail(email)) {
        window.firebaseAuth.sendPasswordResetEmail(email)
            .then(() => {
                showToast('Correo de restablecimiento enviado', 'success');
            })
            .catch((error) => {
                console.error('Password reset error:', error);
                showToast('Error al enviar correo de restablecimiento', 'error');
            });
    } else {
        showToast('Correo electrónico inválido', 'error');
    }
}

window.togglePassword = togglePassword;
window.socialLogin = socialLogin;
window.socialRegister = socialRegister;
window.forgotPassword = forgotPassword;

document.addEventListener('DOMContentLoaded', () => {
    setupRealTimeValidation();
});




