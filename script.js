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

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let people = [];
let skills = [];
let groups = [];
let skillPlans = {}; // Mudado para objeto indexado por skillName
let evaluations = {};
let groupTargets = {};
let selectedPeopleForGroup = [];
let currentChart = null;

// --- SINCRONIZAÇÃO EM TEMPO REAL ---
window.onload = () => {
    db.ref('pdi_data').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            people = data.people || [];
            skills = data.skills || [];
            groups = data.groups || [];
            skillPlans = data.skillPlans || {};
            evaluations = data.evaluations || {};
            groupTargets = data.groupTargets || {};
            
            renderPeople();
            renderSkills();
            renderGroups();
            updateAllSelects();
        }
    });
};

function syncToFirebase() {
    db.ref('pdi_data').set({ people, skills, groups, skillPlans, evaluations, groupTargets });
}

// --- NAVEGAÇÃO ---
function openMainTab(evt, tabName) {
    document.querySelectorAll(".main-content").forEach(c => c.classList.remove("active"));
    document.querySelectorAll(".main-tab").forEach(t => t.classList.remove("active"));
    document.getElementById(tabName).classList.add("active");
    evt.currentTarget.classList.add("active");
    if(tabName === 'desenvolvimento') renderPDIRadar();
    if(tabName === 'matriz') renderMatrix();
    updateAllSelects();
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

// --- PESSOAS ---
function addPerson() {
    const name = document.getElementById('personName').value;
    const role = document.getElementById('personRole').value;
    const manager = document.getElementById('personManager').value;
    const editId = document.getElementById('editPersonId').value;

    if(!name) return;

    if(editId) {
        const idx = people.findIndex(p => p.id == editId);
        people[idx] = { ...people[idx], name, role, manager };
        resetPersonForm();
    } else {
        people.push({ id: Date.now(), name, role, manager });
    }
    
    document.getElementById('personName').value = "";
    document.getElementById('personRole').value = "";
    document.getElementById('personManager').value = "";
    syncToFirebase();
}

function editPerson(id) {
    const p = people.find(p => p.id == id);
    document.getElementById('personName').value = p.name;
    document.getElementById('personRole').value = p.role;
    document.getElementById('personManager').value = p.manager;
    document.getElementById('editPersonId').value = p.id;
    document.getElementById('personFormTitle').innerText = "Editar Pessoa";
    document.getElementById('btnSavePerson').innerText = "Atualizar Dados";
}

function resetPersonForm() {
    document.getElementById('editPersonId').value = "";
    document.getElementById('personFormTitle').innerText = "Gerenciar Pessoa";
    document.getElementById('btnSavePerson').innerText = "Salvar Dados";
}

function renderPeople() {
    document.getElementById('peopleList').innerHTML = people.map(p => `
        <tr>
            <td>${p.name}</td>
            <td>${p.role}</td>
            <td>${p.manager}</td>
            <td class="actions">
                <button class="btn-edit" onclick="editPerson(${p.id})"><i class="fas fa-edit"></i></button>
                <button class="btn-delete" onclick="deletePerson(${p.id})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`).join('');
}

function deletePerson(id) {
    if(confirm("Deseja excluir esta pessoa?")) {
        people = people.filter(p => p.id !== id);
        syncToFirebase();
    }
}

// --- COMPETÊNCIAS ---
function addSkill() {
    const name = document.getElementById('skillName').value;
    if(!name) return;
    skills.push({ id: Date.now(), name, type: document.getElementById('skillType').value });
    document.getElementById('skillName').value = "";
    syncToFirebase();
}

function renderSkills() {
    document.getElementById('skillsList').innerHTML = skills.map(s => `
        <tr>
            <td>${s.name}</td>
            <td>${s.type}</td>
            <td><button class="btn-delete" onclick="deleteSkill(${s.id})"><i class="fas fa-trash"></i></button></td>
        </tr>`).join('');
}

function deleteSkill(id) {
    skills = skills.filter(s => s.id !== id);
    syncToFirebase();
}

// --- REGRAS DE EVOLUÇÃO (3, 6, 9) ---
function renderSkillPlansTable() {
    const body = document.getElementById('skillPlansTableBody');
    body.innerHTML = skills.map(s => {
        const plan = skillPlans[s.name] || { n3: '', n6: '', n9: '' };
        return `
            <tr>
                <td><strong>${s.name}</strong></td>
                <td><textarea onchange="updateSkillPlan('${s.name}', 'n3', this.value)" placeholder="Ações para Nível 3">${plan.n3 || ''}</textarea></td>
                <td><textarea onchange="updateSkillPlan('${s.name}', 'n6', this.value)" placeholder="Ações para Nível 6">${plan.n6 || ''}</textarea></td>
                <td><textarea onchange="updateSkillPlan('${s.name}', 'n9', this.value)" placeholder="Ações para Nível 9">${plan.n9 || ''}</textarea></td>
                <td><button class="btn-primary" onclick="syncToFirebase()">OK</button></td>
            </tr>
        `;
    }).join('');
}

function updateSkillPlan(skillName, level, value) {
    if(!skillPlans[skillName]) skillPlans[skillName] = { n3: '', n6: '', n9: '' };
    skillPlans[skillName][level] = value;
}

// --- GRUPOS ---
function handleSelectPerson(el) { if(!el.value) return; selectedPeopleForGroup.push(el.value); renderTags(); renderGroupDropdown(); el.value=""; }
function renderTags() { document.getElementById('selectedTagsContainer').innerHTML = selectedPeopleForGroup.map(n => `<span class="tag-chip">${n} <i class="fas fa-times" onclick="removeTag('${n}')"></i></span>`).join(''); }
function removeTag(n) { selectedPeopleForGroup = selectedPeopleForGroup.filter(x => x !== n); renderTags(); renderGroupDropdown(); }
function renderGroupDropdown() { document.getElementById('personSelectField').innerHTML = '<option value="">+ Integrante</option>' + people.filter(p => !selectedPeopleForGroup.includes(p.name)).map(p => `<option value="${p.name}">${p.name}</option>`).join(''); }

function saveGroup() { 
    const name = document.getElementById('groupName').value; 
    const editId = document.getElementById('editGroupId').value;
    if(!name || selectedPeopleForGroup.length==0) return;

    if(editId) {
        const idx = groups.findIndex(g => g.id == editId);
        groups[idx] = { ...groups[idx], name, members: [...selectedPeopleForGroup] };
        resetGroupForm();
    } else {
        groups.push({ id: Date.now(), name, members: [...selectedPeopleForGroup] });
    }

    selectedPeopleForGroup = []; 
    document.getElementById('groupName').value = "";
    renderTags();
    syncToFirebase();
}

function editGroup(id) {
    const g = groups.find(g => g.id == id);
    document.getElementById('groupName').value = g.name;
    selectedPeopleForGroup = [...g.members];
    document.getElementById('editGroupId').value = g.id;
    document.getElementById('groupFormTitle').innerText = "Editar Grupo";
    document.getElementById('btnSaveGroup').innerText = "Atualizar Grupo";
    renderTags();
}

function resetGroupForm() {
    document.getElementById('editGroupId').value = "";
    document.getElementById('groupFormTitle').innerText = "Novo Grupo";
    document.getElementById('btnSaveGroup').innerText = "Registrar Grupo";
}

function renderGroups() { 
    document.getElementById('groupTable').innerHTML = groups.map(g => `
        <tr>
            <td>${g.name}</td>
            <td>${g.members.join(', ')}</td>
            <td class="actions">
                <button class="btn-edit" onclick="editGroup(${g.id})"><i class="fas fa-edit"></i></button>
                <button class="btn-delete" onclick="deleteGroup(${g.id})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`).join(''); 
}

function deleteGroup(id) { if(confirm("Excluir grupo?")) { groups = groups.filter(x => x.id !== id); syncToFirebase(); } }

// --- AVALIAÇÃO ---
function renderIndividualEvalTable() {
    const p = document.getElementById('evalPersonSelect').value;
    if(!p) return;
    document.getElementById('individualEvalBody').innerHTML = skills.map(s => {
        const val = (evaluations[p] && evaluations[p][s.name]) || { current: 3, target: 3 };
        return `<tr><td>${s.name}</td>
                <td><select class="eval-curr" data-skill="${s.name}">
                    <option value="3" ${val.current == 3 ? 'selected' : ''}>3</option>
                    <option value="6" ${val.current == 6 ? 'selected' : ''}>6</option>
                    <option value="9" ${val.current == 9 ? 'selected' : ''}>9</option>
                </select></td>
                <td><select class="eval-targ" data-skill="${s.name}">
                    <option value="3" ${val.target == 3 ? 'selected' : ''}>3</option>
                    <option value="6" ${val.target == 6 ? 'selected' : ''}>6</option>
                    <option value="9" ${val.target == 9 ? 'selected' : ''}>9</option>
                </select></td></tr>`;
    }).join('');
}

function saveIndividualEvaluations() {
    const p = document.getElementById('evalPersonSelect').value;
    if(!p) return;
    if(!evaluations[p]) evaluations[p] = {};
    document.querySelectorAll('#individualEvalBody tr').forEach(row => {
        const sk = row.querySelector('.eval-curr').dataset.skill;
        evaluations[p][sk] = { 
            current: parseInt(row.querySelector('.eval-curr').value), 
            target: parseInt(row.querySelector('.eval-targ').value) 
        };
    });
    syncToFirebase();
    alert("Avaliações salvas!");
}

function renderGroupEvalTable() {
    const g = document.getElementById('evalGroupSelect').value;
    if(!g) return;
    document.getElementById('groupEvalBody').innerHTML = skills.map(s => {
        const t = (groupTargets[g] && groupTargets[g][s.name]) || 3;
        return `<tr><td>${s.name}</td><td><select class="group-targ-input" data-skill="${s.name}">
            <option value="3" ${t == 3 ? 'selected' : ''}>3</option>
            <option value="6" ${t == 6 ? 'selected' : ''}>6</option>
            <option value="9" ${t == 9 ? 'selected' : ''}>9</option>
        </select></td></tr>`;
    }).join('');
}

function saveGroupTargets() {
    const g = document.getElementById('evalGroupSelect').value;
    if(!g) return;
    if(!groupTargets[g]) groupTargets[g] = {};
    document.querySelectorAll('#groupEvalBody tr').forEach(row => {
        const sel = row.querySelector('.group-targ-input');
        groupTargets[g][sel.dataset.skill] = parseInt(sel.value);
    });
    syncToFirebase();
}

// --- RADAR & PDI ---
function getEffTarget(pName, sName) {
    const personal = (evaluations[pName] && evaluations[pName][sName]?.target) || 3;
    let groupMax = 0;
    groups.filter(g => g.members.includes(pName)).forEach(g => {
        const t = (groupTargets[g.name] && groupTargets[g.name][sName]) || 3;
        if(t > groupMax) groupMax = t;
    });
    return Math.max(personal, groupMax);
}

function renderPDIRadar() {
    const p = document.getElementById('pdiPersonSelect').value;
    if(!p || skills.length === 0) return;
    const labels = skills.map(s => s.name);
    const actual = skills.map(s => (evaluations[p] && evaluations[p][s.name]?.current) || 0);
    const target = skills.map(s => getEffTarget(p, s.name));

    if(currentChart) currentChart.destroy();
    currentChart = new Chart(document.getElementById('radarChart'), {
        type: 'radar',
        data: { labels, datasets: [{ label: 'Atual', data: actual, backgroundColor: 'rgba(37,99,235,0.2)', borderColor: '#2563eb' }, { label: 'Meta', data: target, borderColor: '#10b981', borderDash: [5,5] }] },
        options: { scales: { r: { min: 0, max: 10 } } }
    });

    let html = "<h3>Plano de Desenvolvimento</h3>";
    skills.forEach(s => {
        const c = (evaluations[p] && evaluations[p][s.name]?.current) || 0;
        const t = getEffTarget(p, s.name);
        if(c < t) {
            const plan = skillPlans[s.name];
            let action = "Ação não definida para este nível.";
            if(plan) {
                if(t <= 3) action = plan.n3;
                else if(t <= 6) action = plan.n6;
                else action = plan.n9;
            }
            html += `<div class="pdi-item"><strong>${s.name} (Meta ${t}):</strong><br>${action || 'Ação não definida.'}</div>`;
        }
    });
    document.getElementById('pdiActionPlan').innerHTML = html;
}

function renderMatrix() {
    let html = "";
    people.forEach(p => {
        skills.forEach(s => {
            const c = (evaluations[p.name] && evaluations[p.name][s.name]?.current) || 0;
            const t = getEffTarget(p.name, s.name);
            const st = c >= t ? '<span style="color:#16a34a">OK</span>' : '<span style="color:#dc2626">GAP</span>';
            html += `<tr><td>${p.name}</td><td>${s.name}</td><td>${c}</td><td>${t}</td><td>${st}</td></tr>`;
        });
    });
    document.getElementById('matrixBody').innerHTML = html;
}

function updateAllSelects() {
    const pOpt = '<option value="">Selecione...</option>' + people.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
    const sOpt = '<option value="">Selecione...</option>' + skills.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
    const gOpt = '<option value="">Selecione...</option>' + groups.map(g => `<option value="${g.name}">${g.name}</option>`).join('');
    ['evalPersonSelect', 'pdiPersonSelect', 'personSelectField'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerHTML = pOpt; });
    ['evalGroupSelect'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerHTML = gOpt; });
}