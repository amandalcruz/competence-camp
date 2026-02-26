let people = [];
let skills = [];
let groups = [];
let skillPlans = [];
let evaluations = {};
let groupTargets = {};
let selectedPeopleForGroup = [];
let currentChart = null;

// --- INICIALIZAÇÃO ---
window.onload = () => {
    const savedId = localStorage.getItem('competence_bin_id');
    if (savedId) {
        document.getElementById('cloudIdInput').value = savedId;
        loadFromCloud(savedId);
    }
    updateAllSelects();
};

// ATENÇÃO: Substitua pelos seus dados do JSONbin.io
const MASTER_KEY = '$2a$10$SEU_API_KEY_AQUI'; // Pegue no site JSONbin

async function saveToCloud() {
    const binId = document.getElementById('cloudIdInput').value.trim();
    if (!binId) return alert("Por favor, insira o Bin ID!");

    const data = { people, skills, groups, skillPlans, evaluations, groupTargets };

    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': MASTER_KEY
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            localStorage.setItem('competence_bin_id', binId);
            alert("✅ Sincronizado com sucesso!");
        } else {
            alert("Erro no servidor. Verifique o ID e a Master Key.");
        }
    } catch (e) {
        console.error(e);
        alert("Falha total na conexão. Tente desativar extensões de bloqueio de anúncios ou use um servidor local.");
    }
}

async function loadFromCloud(idInput) {
    const binId = idInput || document.getElementById('cloudIdInput').value.trim();
    if (!binId) return;

    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
            method: 'GET',
            headers: {
                'X-Master-Key': MASTER_KEY
            }
        });
        
        const result = await response.json();
        const data = result.record; // O JSONbin coloca os dados dentro de 'record'
        
        people = data.people || [];
        skills = data.skills || [];
        groups = data.groups || [];
        skillPlans = data.skillPlans || [];
        evaluations = data.evaluations || {};
        groupTargets = data.groupTargets || {};

        renderPeople();
        renderSkills();
        renderGroups();
        renderSkillPlansTable();
        updateAllSelects();
        
        localStorage.setItem('competence_bin_id', binId);
        if(!idInput) alert("✅ Dados carregados!");
    } catch (e) {
        alert("Erro ao carregar dados da nuvem.");
    }
}

// --- NAVEGAÇÃO ---
function openMainTab(evt, tabName) {
    document.querySelectorAll(".main-content").forEach(c => c.classList.remove("active"));
    document.querySelectorAll(".main-tab").forEach(t => t.classList.remove("active"));
    document.getElementById(tabName).classList.add("active");
    evt.currentTarget.classList.add("active");
    updateAllSelects();
    if(tabName === 'desenvolvimento') renderPDIRadar();
    if(tabName === 'matriz') renderMatrix();
}

function openSubTab(evt, subName) {
    const parent = evt.currentTarget.closest('.main-content');
    parent.querySelectorAll(".sub-content").forEach(c => c.classList.remove("active"));
    parent.querySelectorAll(".sub-tab").forEach(t => t.classList.remove("active"));
    document.getElementById(subName).classList.add("active");
    evt.currentTarget.classList.add("active");
    if (subName === 'cad-grupos') renderGroupDropdown();
    if (subName === 'comp-plano') renderSkillPlansTable();
}

// --- FUNÇÕES DE REGRAS DE EVOLUÇÃO (CORREÇÃO 1) ---
function saveSkillPlan() {
    const skillName = document.getElementById('skillPlanSelect').value;
    const from = document.getElementById('planFrom').value;
    const to = document.getElementById('planTo').value;
    const action = document.getElementById('planAction').value.trim();

    if (!skillName || from === "" || to === "" || !action) return alert("Preencha todos os campos.");

    skillPlans.push({ id: Date.now(), skillName, from: parseInt(from), to: parseInt(to), action });
    
    document.getElementById('planFrom').value = "";
    document.getElementById('planTo').value = "";
    document.getElementById('planAction').value = "";
    renderSkillPlansTable();
}

function renderSkillPlansTable() {
    const list = document.getElementById('skillPlansList');
    if (!list) return;
    list.innerHTML = skillPlans.map(p => `
        <tr>
            <td>${p.skillName}</td>
            <td><span class="badge">${p.from} ➔ ${p.to}</span></td>
            <td>${p.action}</td>
            <td><button class="btn-delete" onclick="deletePlan(${p.id})"><i class="fas fa-trash"></i></button></td>
        </tr>
    `).join('');
}

function deletePlan(id) {
    skillPlans = skillPlans.filter(p => p.id !== id);
    renderSkillPlansTable();
}

// --- EXPECTATIVA POR GRUPO (CORREÇÃO 2) ---
function renderGroupEvalTable() {
    const groupName = document.getElementById('evalGroupSelect').value;
    const body = document.getElementById('groupEvalBody');
    if (!groupName) { body.innerHTML = ""; return; }

    body.innerHTML = skills.map(s => {
        const target = (groupTargets[groupName] && groupTargets[groupName][s.name]) || 0;
        return `<tr><td>${s.name}</td><td><input type="number" class="group-targ-input" data-skill="${s.name}" value="${target}" min="0" max="5"></td></tr>`;
    }).join('');
}

function saveGroupTargets() {
    const groupName = document.getElementById('evalGroupSelect').value;
    if (!groupName) return;
    if (!groupTargets[groupName]) groupTargets[groupName] = {};

    document.querySelectorAll('#groupEvalBody tr').forEach(row => {
        const input = row.querySelector('.group-targ-input');
        groupTargets[groupName][input.dataset.skill] = parseInt(input.value) || 0;
    });
    alert("Targets do grupo salvos!");
}

// --- UTILS & SELECTS ---
function updateAllSelects() {
    const pOptions = '<option value="">Selecione...</option>' + people.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
    const sOptions = '<option value="">Selecione...</option>' + skills.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
    const gOptions = '<option value="">Selecione...</option>' + groups.map(g => `<option value="${g.name}">${g.name}</option>`).join('');

    ['evalPersonSelect', 'pdiPersonSelect', 'personSelectField'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerHTML = pOptions; });
    ['skillPlanSelect'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerHTML = sOptions; });
    ['evalGroupSelect'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerHTML = gOptions; });
}

// --- PESSOAS & COMPETENCIAS (CRUD BÁSICO) ---
function addPerson() {
    const name = document.getElementById('personName').value;
    if(!name) return;
    people.push({ id: Date.now(), name, role: document.getElementById('personRole').value, manager: document.getElementById('personManager').value });
    renderPeople(); updateAllSelects();
}

function renderPeople() {
    document.getElementById('peopleList').innerHTML = people.map(p => `<tr><td>${p.name}</td><td>${p.role}</td><td>${p.manager}</td><td><button class="btn-delete" onclick="deletePerson(${p.id})"><i class="fas fa-trash"></i></button></td></tr>`).join('');
}

function deletePerson(id) { people = people.filter(p => p.id !== id); renderPeople(); updateAllSelects(); }

function addSkill() {
    const name = document.getElementById('skillName').value;
    if(!name) return;
    skills.push({ id: Date.now(), name, type: document.getElementById('skillType').value });
    renderSkills(); updateAllSelects();
}

function renderSkills() {
    document.getElementById('skillsList').innerHTML = skills.map(s => `<tr><td>${s.name}</td><td>${s.type}</td><td><button class="btn-delete" onclick="deleteSkill(${s.id})"><i class="fas fa-trash"></i></button></td></tr>`).join('');
}

function deleteSkill(id) { skills = skills.filter(s => s.id !== id); renderSkills(); updateAllSelects(); }

// --- GRUPOS ---
function handleSelectPerson(el) { if(!el.value) return; selectedPeopleForGroup.push(el.value); renderTags(); renderGroupDropdown(); el.value = ""; }
function renderTags() { document.getElementById('selectedTagsContainer').innerHTML = selectedPeopleForGroup.map(n => `<span class="tag-chip">${n} <i class="fas fa-times" onclick="removeTag('${n}')"></i></span>`).join(''); }
function removeTag(n) { selectedPeopleForGroup = selectedPeopleForGroup.filter(x => x !== n); renderTags(); renderGroupDropdown(); }
function renderGroupDropdown() { document.getElementById('personSelectField').innerHTML = '<option value="">+ Integrante</option>' + people.filter(p => !selectedPeopleForGroup.includes(p.name)).map(p => `<option value="${p.name}">${p.name}</option>`).join(''); }
function saveGroup() { const name = document.getElementById('groupName').value; if(!name) return; groups.push({ id: Date.now(), name, members: [...selectedPeopleForGroup] }); selectedPeopleForGroup = []; renderGroups(); renderTags(); }
function renderGroups() { document.getElementById('groupTable').innerHTML = groups.map(g => `<tr><td>${g.name}</td><td>${g.members.join(', ')}</td><td><button class="btn-delete" onclick="deleteGroup(${g.id})"><i class="fas fa-trash"></i></button></td></tr>`).join(''); }
function deleteGroup(id) { groups = groups.filter(g => g.id !== id); renderGroups(); }

// --- AVALIAÇÃO INDIVIDUAL ---
function renderIndividualEvalTable() {
    const person = document.getElementById('evalPersonSelect').value;
    if(!person) return;
    document.getElementById('individualEvalBody').innerHTML = skills.map(s => {
        const val = (evaluations[person] && evaluations[person][s.name]) || { current: 0, target: 0 };
        return `<tr><td>${s.name}</td><td><input type="number" class="eval-curr" data-skill="${s.name}" value="${val.current}"></td><td><input type="number" class="eval-targ" data-skill="${s.name}" value="${val.target}"></td></tr>`;
    }).join('');
}

function saveIndividualEvaluations() {
    const person = document.getElementById('evalPersonSelect').value;
    if(!person) return;
    if(!evaluations[person]) evaluations[person] = {};
    document.querySelectorAll('#individualEvalBody tr').forEach(row => {
        const skill = row.querySelector('.eval-curr').dataset.skill;
        evaluations[person][skill] = { current: parseInt(row.querySelector('.eval-curr').value) || 0, target: parseInt(row.querySelector('.eval-targ').value) || 0 };
    });
    alert("Notas salvas!");
}

// --- RADAR & PDI ---
function getEffectiveTarget(personName, skillName) {
    const personal = (evaluations[personName] && evaluations[personName][skillName]?.target) || 0;
    let maxGroup = 0;
    groups.filter(g => g.members.includes(personName)).forEach(g => {
        const t = (groupTargets[g.name] && groupTargets[g.name][skillName]) || 0;
        if(t > maxGroup) maxGroup = t;
    });
    return Math.max(personal, maxGroup);
}

function renderPDIRadar() {
    const person = document.getElementById('pdiPersonSelect').value;
    if(!person || skills.length === 0) return;
    const labels = skills.map(s => s.name);
    const actual = skills.map(s => (evaluations[person] && evaluations[person][s.name]?.current) || 0);
    const target = skills.map(s => getEffectiveTarget(person, s.name));

    if(currentChart) currentChart.destroy();
    currentChart = new Chart(document.getElementById('radarChart'), {
        type: 'radar',
        data: { labels, datasets: [{ label: 'Atual', data: actual, backgroundColor: 'rgba(37, 99, 235, 0.2)', borderColor: '#2563eb' }, { label: 'Meta', data: target, borderColor: '#10b981', borderDash: [5, 5] }] },
        options: { scales: { r: { min: 0, max: 5 } } }
    });

    // PDI Action Plan
    let html = "<h3>Plano de Ação</h3>";
    skills.forEach(s => {
        const curr = (evaluations[person] && evaluations[person][s.name]?.current) || 0;
        const targ = getEffectiveTarget(person, s.name);
        if(curr < targ) {
            const plan = skillPlans.find(p => p.skillName === s.name && p.from <= curr && p.to > curr);
            html += `<div class="pdi-item"><strong>${s.name}:</strong> ${plan ? plan.action : 'Defina uma regra de evolução para este nível.'}</div>`;
        }
    });
    document.getElementById('pdiActionPlan').innerHTML = html;
}

// --- MATRIZ ---
function renderMatrix() {
    let html = "";
    people.forEach(p => {
        skills.forEach(s => {
            const curr = (evaluations[p.name] && evaluations[p.name][s.name]?.current) || 0;
            const targ = getEffectiveTarget(p.name, s.name);
            const status = curr >= targ ? '<span class="status-tag status-ok">OK</span>' : '<span class="status-tag status-gap">GAP</span>';
            html += `<tr><td>${p.name}</td><td>${s.name}</td><td>${curr}</td><td>${targ}</td><td>${status}</td></tr>`;
        });
    });
    document.getElementById('matrixBody').innerHTML = html;
}

function exportPDIToExcel() { alert("Exportando dados do PDI..."); }