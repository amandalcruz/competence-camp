// CONFIGURAÇÃO FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyBrvXWUSsA9H8vKm6-FGwUihB1WhAofpx0",
    authDomain: "competence-camp.firebaseapp.com",
    databaseURL: "https://competence-camp-default-rtdb.firebaseio.com",
    projectId: "competence-camp",
    storageBucket: "competence-camp.firebasestorage.app",
    messagingSenderId: "396090192687",
    appId: "1:396090192687:web:b549b72dab7b40adede7da",
	measurementId: "G-TZKM3B55K6"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.database();

let people = [], skills = [], groups = [], skillPlans = {}, evaluations = {}, groupTargets = {}, customActionPlans = {};
let selectedMembers = [];
let radarChart = null;

window.onload = () => {
    db.ref('pdi_data').on('value', (snapshot) => {
        const data = snapshot.val() || {};
        people = data.people || [];
        skills = data.skills || [];
        groups = data.groups || [];
        skillPlans = data.skillPlans || {};
        evaluations = data.evaluations || {};
        groupTargets = data.groupTargets || {};
        customActionPlans = data.customActionPlans || {};
        renderAll();
    });
};

function sync() {
    db.ref('pdi_data').set({ people, skills, groups, skillPlans, evaluations, groupTargets, customActionPlans });
}

// NAVEGAÇÃO
function openMainTab(evt, tabId) {
    document.querySelectorAll(".main-content").forEach(c => c.classList.remove("active"));
    document.querySelectorAll(".main-tab").forEach(t => t.classList.remove("active"));
    document.getElementById(tabId).classList.add("active");
    evt.currentTarget.classList.add("active");
    
    if(tabId === 'plano_acao') renderActionPlanTable();
    if(tabId === 'desenvolvimento') renderPDIRadar();
    if(tabId === 'matriz') renderMatrix();
}

function openSubTab(evt, subTabId) {
    const parent = evt.currentTarget.closest('.main-content');
    parent.querySelectorAll(".sub-content").forEach(c => c.classList.remove("active"));
    parent.querySelectorAll(".sub-tab").forEach(t => t.classList.remove("active"));
    document.getElementById(subTabId).classList.add("active");
    evt.currentTarget.classList.add("active");
}

// CADASTROS
function addPerson() {
    const name = document.getElementById('personName').value.trim();
    if(!name) return alert("Nome obrigatório");
    people.push({ name, role: document.getElementById('personRole').value, manager: document.getElementById('personManager').value });
    sync();
    document.getElementById('personName').value = "";
}

function addSkill() {
    const name = document.getElementById('skillName').value.trim();
    if(!name) return alert("Nome obrigatório");
    skills.push({ name, description: document.getElementById('skillDescription').value, type: document.getElementById('skillType').value });
    sync();
    document.getElementById('skillName').value = "";
}

function addMemberToGroup(select) {
    const name = select.value;
    if(name && !selectedMembers.includes(name)) {
        selectedMembers.push(name);
        renderTags();
    }
    select.value = "";
}

function renderTags() {
    const container = document.getElementById('selectedTagsContainer');
    container.innerHTML = selectedMembers.map(m => `<span class="tag-chip">${m} <i class="fas fa-times tag-close" onclick="removeTag('${m}')"></i></span>`).join('');
}

function removeTag(name) {
    selectedMembers = selectedMembers.filter(m => m !== name);
    renderTags();
}

function saveGroup() {
    const name = document.getElementById('groupName').value.trim();
    if(!name || selectedMembers.length === 0) return alert("Preencha nome e membros");
    groups.push({ name, members: [...selectedMembers] });
    selectedMembers = [];
    document.getElementById('groupName').value = "";
    renderTags();
    sync();
}

function loadSkillPlanForm() {
    const skill = document.getElementById('skillPlanSelect').value;
    const form = document.getElementById('skillPlanForm');
    if(!skill) { form.style.display = 'none'; return; }
    form.style.display = 'block';
    const plan = skillPlans[skill] || { n3: '', n6: '', n9: '' };
    document.getElementById('planN3').value = plan.n3;
    document.getElementById('planN6').value = plan.n6;
    document.getElementById('planN9').value = plan.n9;
}

function saveSkillPlan() {
    const skill = document.getElementById('skillPlanSelect').value;
    skillPlans[skill] = {
        n3: document.getElementById('planN3').value,
        n6: document.getElementById('planN6').value,
        n9: document.getElementById('planN9').value
    };
    sync();
    alert("Regras salvas!");
}

// --- ATUALIZAÇÃO 1: DESCRIÇÃO EM TEMPO REAL ---
function updateEvalRealTime(person, skill, field, value) {
    const val = parseInt(value) || 0;
    if (!evaluations[person]) evaluations[person] = {};
    if (!evaluations[person][skill]) evaluations[person][skill] = { current: 0, target: 0 };
    evaluations[person][skill][field] = val;

    const plan = skillPlans[skill] || {};
    let desc = "";
    if (val <= 3) desc = plan.n3 || "";
    else if (val <= 6) desc = plan.n6 || "";
    else desc = plan.n9 || "";

    const cellId = field === 'current' ? `desc-curr-${skill.replace(/\s+/g, '')}` : `desc-targ-${skill.replace(/\s+/g, '')}`;
    const cell = document.getElementById(cellId);
    if (cell) cell.innerText = desc;
}

function renderIndividualEvalTable() {
    const person = document.getElementById('evalPersonSelect').value;
    const body = document.getElementById('individualEvalBody');
    if (!person) { body.innerHTML = ""; return; }

    body.innerHTML = skills.map(s => {
        const ev = (evaluations[person] && evaluations[person][s.name]) || { current: 0, target: 0 };
        const getDesc = (lvl) => {
            const plan = skillPlans[s.name] || {};
            if (lvl <= 3) return plan.n3 || "";
            if (lvl <= 6) return plan.n6 || "";
            return plan.n9 || "";
        };
        return `
            <tr>
                <td><strong>${s.name}</strong></td>
                <td><input type="number" min="0" max="9" class="eval-curr" value="${ev.current}" oninput="updateEvalRealTime('${person}','${s.name}','current',this.value)"></td>
                <td id="desc-curr-${s.name.replace(/\s+/g, '')}">${getDesc(ev.current)}</td>
                <td><input type="number" min="0" max="9" class="eval-targ" value="${ev.target}" oninput="updateEvalRealTime('${person}','${s.name}','target',this.value)"></td>
                <td id="desc-targ-${s.name.replace(/\s+/g, '')}">${getDesc(ev.target)}</td>
            </tr>
        `;
    }).join('');
}

function saveIndividualEvaluations() { sync(); alert("Avaliação Salva!"); }

// --- ATUALIZAÇÃO 2: EXPECTATIVA GRUPO CORRIGIDA ---
function renderGroupEvalTable() {
    const groupName = document.getElementById('evalGroupSelect').value;
    const body = document.getElementById('groupEvalBody');
    if (!groupName) { body.innerHTML = ""; return; }

    body.innerHTML = skills.map(s => {
        const target = (groupTargets[groupName] && groupTargets[groupName][s.name]) || 0;
        return `
            <tr>
                <td>${s.name}</td>
                <td><input type="number" class="group-targ-input" value="${target}" onchange="updateGroupTarget('${groupName}','${s.name}',this.value)"></td>
            </tr>
        `;
    }).join('');
}

function updateGroupTarget(group, skill, value) {
    if (!groupTargets[group]) groupTargets[group] = {};
    groupTargets[group][skill] = parseInt(value) || 0;
}

function saveGroupTargets() { sync(); alert("Alvos do grupo salvos!"); }

// --- ATUALIZAÇÃO 3: PDI LÓGICA NÍVEL ACIMA ---
function renderPDIRadar() {
    const person = document.getElementById('pdiPersonSelect').value;
    const container = document.getElementById('pdiActionPlan');
    if (!person) return;

    const data = skills.map(s => (evaluations[person] && evaluations[person][s.name]) || { current: 0, target: 0 });
    const ctx = document.getElementById('radarChart').getContext('2d');
    if (radarChart) radarChart.destroy();
    radarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: skills.map(s => s.name),
            datasets: [
                { label: 'Atual', data: data.map(d => d.current), backgroundColor: 'rgba(37, 99, 235, 0.2)', borderColor: '#2563eb' },
                { label: 'Alvo', data: data.map(d => d.target), backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: '#10b981' }
            ]
        },
        options: { scales: { r: { min: 0, max: 10 } } }
    });

    let html = "<h3>Próximos Passos de Desenvolvimento</h3>";
    skills.forEach(s => {
        const ev = (evaluations[person] && evaluations[person][s.name]) || { current: 0, target: 0 };
        if (ev.current < ev.target) {
            const plan = skillPlans[s.name] || {};
            const nextLevel = ev.current + 1;
            let nextAction = nextLevel <= 3 ? plan.n3 : (nextLevel <= 6 ? plan.n6 : plan.n9);
            html += `
                <div class="pdi-item">
                    <strong>${s.name}</strong> <span class="gap-badge">Meta: Nível ${nextLevel}</span>
                    <p style="margin-top:5px;">${nextAction || "Defina regras para esta competência."}</p>
                </div>
            `;
        }
    });
    container.innerHTML = html;
}

// --- ATUALIZAÇÃO 4: MATRIZ COM STATUS E PRIORIDADE ---
function renderMatrix() {
    const body = document.getElementById('matrixBody');
    let html = "";
    people.forEach(p => {
        skills.forEach(s => {
            const ev = (evaluations[p.name] && evaluations[p.name][s.name]) || { current: 0, target: 0 };
            const status = ev.current >= ev.target ? '<span class="status-tag status-ok">OK</span>' : '<span class="status-tag status-gap">GAP</span>';
            const prioKey = `${p.name}_${s.name}`;
            const currentPrio = (customActionPlans[prioKey] && customActionPlans[prioKey].priority) || "Média";
            html += `
                <tr>
                    <td>${p.name}</td><td>${s.name}</td><td>${ev.current}</td><td>${ev.target}</td><td>${status}</td>
                    <td>
                        <select onchange="updatePriority('${p.name}','${s.name}',this.value)">
                            <option value="Baixa" ${currentPrio === 'Baixa' ? 'selected' : ''}>Baixa</option>
                            <option value="Média" ${currentPrio === 'Média' ? 'selected' : ''}>Média</option>
                            <option value="Alta" ${currentPrio === 'Alta' ? 'selected' : ''}>Alta</option>
                        </select>
                    </td>
                </tr>
            `;
        });
    });
    body.innerHTML = html;
}

function updatePriority(person, skill, priority) {
    const prioKey = `${person}_${skill}`;
    if (!customActionPlans[prioKey]) customActionPlans[prioKey] = {};
    customActionPlans[prioKey].priority = priority;
    sync();
}

function renderActionPlanTable() {
    const person = document.getElementById('filterActionPlanPerson').value;
    const body = document.getElementById('actionPlanTableBody');
    if (!person) { body.innerHTML = ""; return; }
    body.innerHTML = skills.filter(s => (evaluations[person] && evaluations[person][s.name] && evaluations[person][s.name].current < evaluations[person][s.name].target)).map(s => {
        const prioKey = `${person}_${s.name}`;
        const p = (customActionPlans[prioKey] && customActionPlans[prioKey].priority) || "Média";
        return `<tr><td>${s.name}</td><td>Regras do próximo nível...</td><td>${p}</td></tr>`;
    }).join('');
}

// RENDERIZADORES BÁSICOS
function renderAll() {
    renderPeople(); renderSkills(); renderGroups(); renderSkillPlansTable(); updateAllSelects();
}

function renderPeople() {
    document.getElementById('peopleList').innerHTML = people.map((p, i) => `<tr><td>${p.name}</td><td>${p.role}</td><td>${p.manager}</td><td><button onclick="deleteItem('people',${i})" class="btn-delete"><i class="fas fa-trash"></i></button></td></tr>`).join('');
}

function renderSkills() {
    document.getElementById('skillsList').innerHTML = skills.map((s, i) => `<tr><td>${s.name}</td><td>${s.type}</td><td><button onclick="deleteItem('skills',${i})" class="btn-delete"><i class="fas fa-trash"></i></button></td></tr>`).join('');
}

function renderGroups() {
    document.getElementById('groupTable').innerHTML = groups.map((g, i) => `<tr><td>${g.name}</td><td>${g.members.join(', ')}</td><td><button onclick="deleteItem('groups',${i})" class="btn-delete"><i class="fas fa-trash"></i></button></td></tr>`).join('');
}

function renderSkillPlansTable() {
    document.getElementById('skillPlansTableBody').innerHTML = Object.keys(skillPlans).map(k => `<tr><td>${k}</td><td>${skillPlans[k].n3}</td><td>${skillPlans[k].n6}</td><td>${skillPlans[k].n9}</td></tr>`).join('');
}

function updateAllSelects() {
    const pOpt = '<option value="">Selecione...</option>' + people.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
    const sOpt = '<option value="">Selecione...</option>' + skills.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
    const gOpt = '<option value="">Selecione...</option>' + groups.map(g => `<option value="${g.name}">${g.name}</option>`).join('');
    ['personSelectField', 'evalPersonSelect', 'pdiPersonSelect', 'filterActionPlanPerson'].forEach(id => {
        const el = document.getElementById(id); if(el) el.innerHTML = pOpt;
    });
    const sp = document.getElementById('skillPlanSelect'); if(sp) sp.innerHTML = sOpt;
    const eg = document.getElementById('evalGroupSelect'); if(eg) eg.innerHTML = gOpt;
}

function deleteItem(type, index) {
    if(!confirm("Excluir?")) return;
    if(type === 'people') people.splice(index, 1);
    if(type === 'skills') skills.splice(index, 1);
    if(type === 'groups') groups.splice(index, 1);
    sync();
}