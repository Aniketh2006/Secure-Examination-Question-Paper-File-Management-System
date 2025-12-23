import { supabase, logActivity } from './supabase/service.js';

let currentPath = [];
let user = null;

document.addEventListener('DOMContentLoaded', initApp);

// Initialize app
async function initApp() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        user = session.user;
        document.getElementById('loginModal').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        document.getElementById('userEmail').textContent = user.email;
        loadFiles();
    }
    
    setupEventListeners();
}

function setupEventListeners() {
    // Login
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            alert('Login failed: ' + error.message);
        } else {
            user = data.user;
            document.getElementById('loginModal').style.display = 'none';
            document.getElementById('mainApp').style.display = 'block';
            document.getElementById('userEmail').textContent = user.email;
            loadFiles();
        }
    });

    // Signup toggle
    document.getElementById('signupLink').onclick = () => {
        document.getElementById('loginForm').innerHTML = `
            <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Student Sign Up</h2>
            <form id="signupForm">
                <div class="mb-4"><input type="email" id="signupEmail" placeholder="Student Email" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required></div>
                <div class="mb-6"><input type="password" id="signupPassword" placeholder="Password" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required></div>
                <button type="submit" class="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700">Sign Up</button>
                <p class="text-center mt-4 text-sm text-gray-600">Have account? <a href="#" id="loginLink" class="text-blue-600 font-semibold">Login</a></p>
            </form>
        `;
        setupEventListeners(); // Re-attach listeners
    };

    // Logout
    document.getElementById('logoutBtn').onclick = async () => {
        await supabase.auth.signOut();
        location.reload();
    };

    // Upload
    document.getElementById('uploadBtn').onclick = () => document.getElementById('fileInput').click();
    document.getElementById('fileInput').onchange = handleUpload;

    // New Folder
    document.getElementById('newFolderBtn').onclick = () => {
        document.getElementById('folderForm').classList.toggle('hidden');
    };

    document.getElementById('createFolderBtn').onclick = createFolder;
    document.getElementById('cancelFolderBtn').onclick = () => {
        document.getElementById('folderForm').classList.add('hidden');
    };

    // Back button
    document.getElementById('backBtn').onclick = () => {
        if (currentPath.length > 0) {
            currentPath.pop();
            loadFiles();
        }
    };
}

async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const path = [...currentPath, file.name].join('/');
    const { data, error } = await supabase.storage
        .from('question-papers')
        .upload(path, file, { upsert: true });

    if (error) {
        alert('Upload failed: ' + error.message);
    } else {
        await logActivity(user.id, 'upload', path);
        loadFiles();
        e.target.value = '';
        alert('File uploaded successfully!');
    }
}

async function createFolder() {
    const year = document.getElementById('yearSelect').value;
    const sem = document.getElementById('semSelect').value;
    const branch = document.getElementById('branchSelect').value;
    const subject = document.getElementById('subjectInput').value;
    const title = `${year} ${sem} ${branch} ${subject}`;

    if (!year || !sem || !branch || !subject) {
        alert('Please fill all fields');
        return;
    }

    // Create folder RECORD in database (not storage folder)
    const { data: folder, error } = await createQuestionFolder(
        user.id, year, sem, branch, subject, title
    );

    if (error) {
        alert('Folder creation failed: ' + error.message);
    } else {
        await logActivity(user.id, 'create_folder', folder.id);
        loadFolders();  // Load from database now
        document.getElementById('folderForm').classList.add('hidden');
        document.querySelectorAll('#folderForm input, #folderForm select').forEach(el => el.value = '');
        alert('Folder created in database!');
    }
}


async function loadFiles() {
    updateBreadcrumb();
    
    const { data, error } = await supabase.storage
        .from('question-papers')
        .list(currentPath.join('/'), { limit: 100 });

    if (error) {
        console.error(error);
        return;
    }

    const filesContainer = document.getElementById('filesContainer');
    filesContainer.innerHTML = '';

    data.forEach(item => {
        const isFolder = item.name.endsWith('/') || item.name.endsWith('.keep');
        const div = document.createElement('div');
        div.className = 'group bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 border hover:border-blue-200 cursor-pointer h-48 flex flex-col items-center justify-center text-center';
        div.innerHTML = `
            <i class="fas ${isFolder ? 'fa-folder' : 'fa-file-pdf'} text-4xl mb-4 text-${isFolder ? 'yellow' : 'red'}-500 group-hover:scale-110 transition-transform"></i>
            <div class="font-semibold text-gray-800 mb-2 truncate w-full px-2">${item.name.replace('.keep', '')}</div>
            <div class="text-xs text-gray-500">${formatSize(item.metadata?.size || 0)}</div>
        `;

        if (isFolder) {
            div.onclick = () => {
                currentPath.push(item.name.replace('/', '').replace('.keep', ''));
                loadFiles();
            };
        } else {
            div.onclick = () => downloadFile(item.name);
        }

        filesContainer.appendChild(div);
    });
}

function updateBreadcrumb() {
    const breadcrumb = document.getElementById('breadcrumb');
    breadcrumb.innerHTML = '<i class="fas fa-home text-blue-600 mr-2"></i>';
    
    currentPath.forEach((part, index) => {
        const span = document.createElement('span');
        span.innerHTML = part.replace('.keep', '') + ' <i class="fas fa-chevron-right mx-1 text-gray-400"></i>';
        span.onclick = () => {
            currentPath = currentPath.slice(0, index + 1);
            loadFiles();
        };
        span.style.cursor = 'pointer';
        span.className = 'hover:text-blue-600 transition-colors';
        breadcrumb.appendChild(span);
    });
}

async function downloadFile(filename) {
    const { data: { signedURL } } = await supabase.storage
        .from('question-papers')
        .createSignedUrl(currentPath.join('/') + '/' + filename, 60);

    if (signedURL) {
        const a = document.createElement('a');
        a.href = signedURL;
        a.download = filename;
        a.click();
        await logActivity(user.id, 'download', currentPath.join('/') + '/' + filename);
    }
}

function formatSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

