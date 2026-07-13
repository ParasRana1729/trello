// ===== STATE =====
const state = {
    token: localStorage.getItem("token") || null,
    orgs: [],
    boards: [],
    users: [],
    currentOrgId: null,
    currentBoardId: null
};

// ===== API =====
async function api(path, method = "GET", body = null) {
    const h = { "Content-Type": "application/json" };
    if (state.token) h.token = state.token;
    const opts = { method, headers: h };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
        if (res.status === 401 || res.status === 403) logout();
        throw new Error(data.message || "Request failed");
    }
    return data;
}

// ===== TOAST =====
function toast(msg, type = "success") {
    const c = document.getElementById("toast-container");
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-dot"></span><span>${esc(msg)}</span>`;
    c.appendChild(el);
    setTimeout(() => {
        el.style.opacity = "0";
        setTimeout(() => el.remove(), 200);
    }, 3500);
}

// ===== UTIL =====
function esc(s) {
    if (!s) return "";
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
}

function getUsername(uid) {
    const u = state.users.find(x => x.userId === uid);
    return u ? u.username : `User ${uid}`;
}

// ===== AUTH TOGGLE =====
document.getElementById("show-signup").addEventListener("click", e => {
    e.preventDefault();
    document.getElementById("login-form").classList.add("hidden");
    document.getElementById("signup-form").classList.remove("hidden");
});
document.getElementById("show-login").addEventListener("click", e => {
    e.preventDefault();
    document.getElementById("signup-form").classList.add("hidden");
    document.getElementById("login-form").classList.remove("hidden");
});

// ===== AUTH =====
document.getElementById("login-form").addEventListener("submit", async e => {
    e.preventDefault();
    const u = document.getElementById("login-username").value.trim();
    const p = document.getElementById("login-password").value;
    if (!u || !p) return;
    try {
        const r = await api("/signin", "POST", { username: u, password: p });
        state.token = r.token;
        localStorage.setItem("token", r.token);
        localStorage.setItem("username", u);
        toast("Signed in");
        initApp();
    } catch (err) { toast(err.message, "error"); }
});

document.getElementById("signup-form").addEventListener("submit", async e => {
    e.preventDefault();
    const u = document.getElementById("signup-username").value.trim();
    const p = document.getElementById("signup-password").value;
    if (!u || !p) return;
    try {
        await api("/signup", "POST", { username: u, password: p });
        toast("Account created — sign in now");
        document.getElementById("signup-form").classList.add("hidden");
        document.getElementById("login-form").classList.remove("hidden");
        document.getElementById("login-username").value = u;
        document.getElementById("login-password").value = p;
    } catch (err) { toast(err.message, "error"); }
});

document.getElementById("btn-logout").addEventListener("click", logout);

function logout() {
    localStorage.clear();
    Object.assign(state, { token: null, currentOrgId: null, currentBoardId: null, orgs: [], boards: [], users: [] });
    document.getElementById("auth-screen").classList.remove("hidden");
    document.getElementById("app-screen").classList.add("hidden");
    document.getElementById("login-form").reset();
    document.getElementById("signup-form").reset();
}

// ===== INIT =====
async function initApp() {
    if (!state.token) return logout();
    document.getElementById("auth-screen").classList.add("hidden");
    document.getElementById("app-screen").classList.remove("hidden");
    const uname = localStorage.getItem("username") || "User";
    document.getElementById("user-display-name").textContent = uname;
    document.getElementById("user-avatar").textContent = uname.substring(0, 2).toUpperCase();
    await reload();
}

async function reload() {
    try {
        const [u, o, b] = await Promise.all([api("/users"), api("/orgs"), api("/boards")]);
        state.users = u.users || [];
        state.orgs = o.orgs || [];
        state.boards = b.boards || [];
        renderOrgs();
        if (state.orgs.length) {
            const saved = parseInt(localStorage.getItem("currentOrgId"));
            const match = state.orgs.find(x => x.orgId === saved);
            selectOrg(match ? saved : state.orgs[0].orgId);
        } else {
            clearBoard();
        }
    } catch (err) { console.error(err); }
}

function clearBoard() {
    state.currentOrgId = null;
    state.currentBoardId = null;
    localStorage.removeItem("currentOrgId");
    localStorage.removeItem("currentBoardId");
    document.getElementById("current-org-name").textContent = "—";
    document.getElementById("current-board-name").textContent = "No board";
    document.getElementById("btn-open-create-board").classList.add("hidden");
    document.getElementById("org-members-section").classList.add("hidden");
    document.getElementById("board-options-section").classList.add("hidden");
    document.getElementById("empty-workspace-message").classList.remove("hidden");
    document.getElementById("kanban-lanes").classList.add("hidden");
    document.getElementById("org-list").innerHTML = '<span class="nav-empty">No organizations yet</span>';
    document.getElementById("board-list").innerHTML = '<span class="nav-empty">Pick an organization first</span>';
}

// ===== ORGANIZATIONS =====
function renderOrgs() {
    const el = document.getElementById("org-list");
    el.innerHTML = "";
    if (!state.orgs.length) {
        el.innerHTML = '<span class="nav-empty">No organizations yet</span>';
        return;
    }
    state.orgs.forEach(o => {
        const item = document.createElement("div");
        item.className = `nav-item${state.currentOrgId === o.orgId ? " active" : ""}`;
        item.innerHTML = `<span class="nav-item-icon"></span><span>${esc(o.title)}</span>`;
        item.onclick = () => selectOrg(o.orgId);
        el.appendChild(item);
    });
}

function selectOrg(id) {
    state.currentOrgId = id;
    localStorage.setItem("currentOrgId", id);
    const org = state.orgs.find(o => o.orgId === id);
    if (!org) return clearBoard();
    document.getElementById("current-org-name").textContent = org.title;
    document.getElementById("btn-open-create-board").classList.remove("hidden");
    document.getElementById("org-members-section").classList.remove("hidden");
    renderMemberAvatars(org);
    renderOrgs();
    renderBoards();
    const orgBoards = state.boards.filter(b => b.orgId === id);
    if (orgBoards.length) {
        const saved = parseInt(localStorage.getItem("currentBoardId"));
        const match = orgBoards.find(b => b.boardId === saved);
        selectBoard(match ? saved : orgBoards[0].boardId);
    } else {
        selectBoard(null);
    }
}

function renderMemberAvatars(org) {
    const c = document.getElementById("org-members-avatars");
    c.innerHTML = "";
    if (!org) return;
    const adminName = getUsername(org.admin);
    const a = document.createElement("span");
    a.className = "avatar-stack-item admin";
    a.textContent = adminName.substring(0, 2).toUpperCase();
    a.title = adminName + " (admin)";
    c.appendChild(a);
    org.members.forEach(m => {
        const s = document.createElement("span");
        s.className = "avatar-stack-item";
        s.textContent = m.username.substring(0, 2).toUpperCase();
        s.title = m.username;
        c.appendChild(s);
    });
}

document.getElementById("form-create-org").addEventListener("submit", async e => {
    e.preventDefault();
    const t = document.getElementById("org-title-input").value.trim();
    if (!t) return;
    try {
        const r = await api("/create-org", "POST", { title: t });
        toast("Organization created");
        closeModal("modal-create-org");
        e.target.reset();
        await reload();
        if (r.orgId) selectOrg(r.orgId);
    } catch (err) { toast(err.message, "error"); }
});

document.getElementById("btn-delete-org").addEventListener("click", async () => {
    if (!state.currentOrgId) return;
    const org = state.orgs.find(o => o.orgId === state.currentOrgId);
    if (!org || !confirm(`Delete "${org.title}"? This can't be undone.`)) return;
    try {
        await api("/org", "DELETE", { orgId: state.currentOrgId });
        toast("Organization deleted");
        state.currentOrgId = null;
        localStorage.removeItem("currentOrgId");
        await reload();
    } catch (err) { toast(err.message, "error"); }
});

// ===== MEMBERS =====
function openMemberModal() {
    const org = state.orgs.find(o => o.orgId === state.currentOrgId);
    if (!org) return;
    api("/users").then(d => {
        state.users = d.users || [];
        const sel = document.getElementById("member-select");
        sel.innerHTML = '<option value="" disabled selected>Select user…</option>';
        const taken = [org.admin, ...org.members.map(m => m.userId)];
        const avail = state.users.filter(u => !taken.includes(u.userId));
        if (!avail.length) {
            sel.innerHTML += '<option disabled>No users available</option>';
        } else {
            avail.forEach(u => {
                const o = document.createElement("option");
                o.value = u.userId;
                o.textContent = u.username;
                sel.appendChild(o);
            });
        }
        renderMemberList(org);
        openModal("modal-add-member");
    });
}

function renderMemberList(org) {
    const ul = document.getElementById("modal-current-members-list");
    ul.innerHTML = "";
    const adminName = getUsername(org.admin);
    ul.innerHTML += `
        <li class="member-row">
            <div class="member-info">
                <span class="mini-avatar">${adminName.substring(0,2).toUpperCase()}</span>
                <span>${esc(adminName)}</span>
            </div>
            <span class="member-role">Admin</span>
        </li>`;
    org.members.forEach(m => {
        const li = document.createElement("li");
        li.className = "member-row";
        li.innerHTML = `
            <div class="member-info">
                <span class="mini-avatar">${m.username.substring(0,2).toUpperCase()}</span>
                <span>${esc(m.username)}</span>
            </div>
            <button class="btn-remove" onclick="removeMember(${m.userId})">Remove</button>`;
        ul.appendChild(li);
    });
}

async function removeMember(mid) {
    if (!confirm("Remove this member?")) return;
    try {
        await api("/members", "PUT", { orgId: state.currentOrgId, memberId: mid });
        toast("Member removed");
        await reload();
        const org = state.orgs.find(o => o.orgId === state.currentOrgId);
        if (org) { renderMemberList(org); renderMemberAvatars(org); }
    } catch (err) { toast(err.message, "error"); }
}

document.getElementById("form-add-member").addEventListener("submit", async e => {
    e.preventDefault();
    const mid = parseInt(document.getElementById("member-select").value);
    if (!mid || !state.currentOrgId) return;
    try {
        await api("/add-member-to-org", "POST", { orgId: state.currentOrgId, memberId: mid });
        toast("Member added");
        await reload();
        const org = state.orgs.find(o => o.orgId === state.currentOrgId);
        if (org) { renderMemberList(org); renderMemberAvatars(org); }
        document.getElementById("member-select").value = "";
    } catch (err) { toast(err.message, "error"); }
});

// ===== BOARDS =====
function renderBoards() {
    const el = document.getElementById("board-list");
    el.innerHTML = "";
    if (!state.currentOrgId) {
        el.innerHTML = '<span class="nav-empty">Pick an organization first</span>';
        return;
    }
    const list = state.boards.filter(b => b.orgId === state.currentOrgId);
    if (!list.length) {
        el.innerHTML = '<span class="nav-empty">No boards yet</span>';
        return;
    }
    list.forEach(b => {
        const item = document.createElement("div");
        item.className = `nav-item${state.currentBoardId === b.boardId ? " active" : ""}`;
        item.innerHTML = `<span class="nav-item-icon"></span><span>${esc(b.title)}</span>`;
        item.onclick = () => selectBoard(b.boardId);
        el.appendChild(item);
    });
}

function selectBoard(id) {
    state.currentBoardId = id;
    localStorage.setItem("currentBoardId", id);
    renderBoards();
    if (!id) {
        document.getElementById("current-board-name").textContent = "No board";
        document.getElementById("board-options-section").classList.add("hidden");
        document.getElementById("empty-workspace-message").classList.remove("hidden");
        document.getElementById("kanban-lanes").classList.add("hidden");
        return;
    }
    const board = state.boards.find(b => b.boardId === id);
    if (!board) return selectBoard(null);
    document.getElementById("current-board-name").textContent = board.title;
    document.getElementById("board-options-section").classList.remove("hidden");
    document.getElementById("empty-workspace-message").classList.add("hidden");
    document.getElementById("kanban-lanes").classList.remove("hidden");
    renderCards(board);
}

document.getElementById("form-create-board").addEventListener("submit", async e => {
    e.preventDefault();
    const t = document.getElementById("board-title-input").value.trim();
    if (!t || !state.currentOrgId) return;
    try {
        const r = await api("/board", "POST", { orgId: state.currentOrgId, title: t });
        toast("Board created");
        closeModal("modal-create-board");
        e.target.reset();
        await reload();
        if (r.boardId) selectBoard(r.boardId);
    } catch (err) { toast(err.message, "error"); }
});

document.getElementById("btn-delete-board").addEventListener("click", async () => {
    if (!state.currentBoardId) return;
    const board = state.boards.find(b => b.boardId === state.currentBoardId);
    if (!board || !confirm(`Delete board "${board.title}"?`)) return;
    try {
        await api("/board", "DELETE", { boardId: state.currentBoardId });
        toast("Board deleted");
        state.currentBoardId = null;
        localStorage.removeItem("currentBoardId");
        await reload();
    } catch (err) { toast(err.message, "error"); }
});

// ===== CARDS / ISSUES =====
function renderCards(board) {
    const cols = {
        todo: document.getElementById("cards-todo"),
        in_progress: document.getElementById("cards-in_progress"),
        done: document.getElementById("cards-done")
    };
    Object.values(cols).forEach(c => c.innerHTML = "");
    const counts = { todo: 0, in_progress: 0, done: 0 };
    board.issues.forEach(issue => {
        const status = issue.status || "todo";
        const col = cols[status] || cols.todo;
        counts[status]++;
        const card = document.createElement("div");
        card.className = "card";
        card.draggable = true;
        card.dataset.issueId = issue.issueId;
        card.addEventListener("dragstart", onDragStart);
        card.addEventListener("dragend", onDragEnd);
        card.addEventListener("click", () => openIssueModal(issue));
        card.innerHTML = `
            <div class="card-title">${esc(issue.title)}</div>
            ${issue.description ? `<div class="card-desc">${esc(issue.description)}</div>` : ""}
            <div class="card-meta">
                <span class="card-status status-${status}">${status.replace("_", " ")}</span>
                <span class="card-id">#${issue.issueId}</span>
            </div>`;
        col.appendChild(card);
    });
    document.getElementById("count-todo").textContent = counts.todo;
    document.getElementById("count-in_progress").textContent = counts.in_progress;
    document.getElementById("count-done").textContent = counts.done;
}

function openIssueModal(issue = null, defaultStatus = "todo") {
    const badge = document.getElementById("modal-issue-badge");
    const title = document.getElementById("issue-title-input");
    const desc = document.getElementById("issue-description-input");
    const stat = document.getElementById("issue-status-select");
    const idIn = document.getElementById("modal-issue-id");
    const del = document.getElementById("btn-delete-issue");
    if (issue) {
        badge.textContent = `#${issue.issueId}`;
        title.value = issue.title;
        desc.value = issue.description || "";
        stat.value = issue.status || "todo";
        idIn.value = issue.issueId;
        del.classList.remove("hidden");
    } else {
        badge.textContent = "New";
        title.value = "";
        desc.value = "";
        stat.value = defaultStatus;
        idIn.value = "";
        del.classList.add("hidden");
    }
    openModal("modal-issue");
}

document.getElementById("form-issue").addEventListener("submit", async e => {
    e.preventDefault();
    const id = document.getElementById("modal-issue-id").value;
    const title = document.getElementById("issue-title-input").value.trim();
    const desc = document.getElementById("issue-description-input").value.trim();
    const status = document.getElementById("issue-status-select").value;
    if (!title || !state.currentBoardId) return;
    try {
        if (id) {
            await api("/issue", "PUT", { issueId: parseInt(id), title, description: desc, status });
            toast("Card updated");
        } else {
            await api("/issue", "POST", { boardId: state.currentBoardId, title, description: desc, status });
            toast("Card created");
        }
        closeModal("modal-issue");
        await reload();
        selectBoard(state.currentBoardId);
    } catch (err) { toast(err.message, "error"); }
});

document.getElementById("btn-delete-issue").addEventListener("click", async () => {
    const id = document.getElementById("modal-issue-id").value;
    if (!id || !confirm("Delete this card?")) return;
    try {
        await api("/issue", "DELETE", { issueId: parseInt(id) });
        toast("Card deleted");
        closeModal("modal-issue");
        await reload();
        selectBoard(state.currentBoardId);
    } catch (err) { toast(err.message, "error"); }
});

// ===== DRAG & DROP =====
let dragId = null;

function onDragStart(e) {
    dragId = this.dataset.issueId;
    this.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
}

function onDragEnd() {
    this.classList.remove("dragging");
    document.querySelectorAll(".lane-cards").forEach(c => c.classList.remove("drag-over"));
}

document.querySelectorAll(".lane-cards").forEach(lane => {
    lane.addEventListener("dragover", e => { e.preventDefault(); lane.classList.add("drag-over"); });
    lane.addEventListener("dragleave", () => lane.classList.remove("drag-over"));
    lane.addEventListener("drop", async e => {
        e.preventDefault();
        lane.classList.remove("drag-over");
        if (!dragId) return;
        const newStatus = lane.dataset.status;
        const board = state.boards.find(b => b.boardId === state.currentBoardId);
        const issue = board?.issues.find(i => i.issueId == dragId);
        if (!issue || issue.status === newStatus) return;
        issue.status = newStatus;
        renderCards(board);
        try {
            await api("/issue", "PUT", { issueId: parseInt(dragId), status: newStatus });
            toast(`Moved to ${newStatus.replace("_", " ")}`);
        } catch { await reload(); }
    });
});

// ===== MODALS =====
function openModal(id) { document.getElementById(id).classList.add("active"); }
function closeModal(id) { document.getElementById(id).classList.remove("active"); }

document.querySelectorAll(".btn-close-modal, .btn-close-modal-btn").forEach(b => {
    b.addEventListener("click", () => {
        const m = b.closest(".modal-backdrop");
        if (m) m.classList.remove("active");
    });
});

document.querySelectorAll(".modal-backdrop").forEach(b => {
    b.addEventListener("click", e => { if (e.target === b) b.classList.remove("active"); });
});

document.getElementById("btn-open-create-org").addEventListener("click", () => openModal("modal-create-org"));
document.getElementById("btn-open-create-board").addEventListener("click", () => openModal("modal-create-board"));
document.getElementById("btn-open-add-member").addEventListener("click", openMemberModal);
document.querySelectorAll(".btn-new-card").forEach(b => {
    b.addEventListener("click", () => openIssueModal(null, b.dataset.status));
});

// ===== BOOT =====
document.addEventListener("DOMContentLoaded", initApp);
