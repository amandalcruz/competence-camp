// CONFIGURAÇÃO DO SEU PROJETO (COLE AS SUAS CHAVES AQUI)
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
let skillPlans = [];
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
            skillPlans = data.skillPlans || [];
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
    const data = { people, skills, groups, skillPlans, evaluations, groupTargets };
    db.ref('pdi_data').set(data);
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

// --- FUNÇÕES DE CADASTRO ---
function addPerson() {
    const name = document.getElementById('personName').value;
    if(!name) return;
    people.push({ id: Date.now(), name, role: document.getElementById('personRole').value, manager: document.getElementById('personManager').value });
    document.getElementById('personName').value = "";
    syncToFirebase();
}

function renderPeople() {
    document.getElementById('peopleList').innerHTML = people.map(p => `<tr><td>${p.name}</td><td>${p.role}</td><td><button class="btn-delete" onclick="deletePerson(${p.id})"><i class="fas fa-trash"></i></button></td></tr>`).join('');
}

function deletePerson(id) {
    people = people.filter(p => p.id !== id);
    syncToFirebase();
}

function addSkill() {
    const name = document.getElementById('skillName').value;
    if(!name) return;
    skills.push({ id: Date.now(), name, type: document.getElementById('skillType').value });
    document.getElementById('skillName').value = "";
    syncToFirebase();
}

function renderSkills() {
    document.getElementById('skillsList').innerHTML = skills.map(s => `<tr><td>${s.name}</td><td>${s.type}</td><td><button class="btn-delete" onclick="deleteSkill(${s.id})"><i class="fas fa-trash"></i></button></td></tr>`).join('');
}

function deleteSkill(id) {
    skills = skills.filter(s => s.id !== id);
    syncToFirebase();
}

// --- REGRAS PDI ---
function saveSkillPlan() {
    const skillName = document.getElementById('skillPlanSelect').value;
    const from = document.getElementById('planFrom').value;
    const to = document.getElementById('planTo').value;
    const action = document.getElementById('planAction').value;
    if(!skillName || from==="" || to==="" || !action) return;
    skillPlans.push({ id: Date.now(), skillName, from: parseInt(from), to: parseInt(to), action });
    syncToFirebase();
}

function renderSkillPlansTable() {
    document.getElementById('skillPlansList').innerHTML = skillPlans.map(p => `<tr><td>${p.skillName}</td><td>${p.from}➔${p.to}</td><td>${p.action}</td></tr>`).join('');
}

// --- GRUPOS ---
function handleSelectPerson(el) { if(!el.value) return; selectedPeopleForGroup.push(el.value); renderTags(); renderGroupDropdown(); el.value=""; }
function renderTags() { document.getElementById('selectedTagsContainer').innerHTML = selectedPeopleForGroup.map(n => `<span class="tag-chip">${n} <i class="fas fa-times" onclick="removeTag('${n}')"></i></span>`).join(''); }
function removeTag(n) { selectedPeopleForGroup = selectedPeopleForGroup.filter(x => x !== n); renderTags(); renderGroupDropdown(); }
function renderGroupDropdown() { document.getElementById('personSelectField').innerHTML = '<option value="">+ Integrante</option>' + people.filter(p => !selectedPeopleForGroup.includes(p.name)).map(p => `<option value="${p.name}">${p.name}</option>`).join(''); }
function saveGroup() { 
    const name = document.getElementById('groupName').value; 
    if(!name || selectedPeopleForGroup.length==0) return;
    groups.push({ id: Date.now(), name, members: [...selectedPeopleForGroup] });
    selectedPeopleForGroup = []; document.getElementById('groupName').value = "";
    syncToFirebase();
}
function renderGroups() { document.getElementById('groupTable').innerHTML = groups.map(g => `<tr><td>${g.name}</td><td>${g.members.length} membros</td><td><button class="btn-delete" onclick="deleteGroup(${g.id})"><i class="fas fa-trash"></i></button></td></tr>`).join(''); }
function deleteGroup(id) { groups = groups.filter(x => x.id !== id); syncToFirebase(); }

// --- AVALIAÇÃO ---
function renderIndividualEvalTable() {
    const p = document.getElementById('evalPersonSelect').value;
    if(!p) return;
    document.getElementById('individualEvalBody').innerHTML = skills.map(s => {
        const val = (evaluations[p] && evaluations[p][s.name]) || { current: 0, target: 0 };
        return `<tr><td>${s.name}</td><td><input type="number" class="eval-curr" data-skill="${s.name}" value="${val.current}"></td><td><input type="number" class="eval-targ" data-skill="${s.name}" value="${val.target}"></td></tr>`;
    }).join('');
}

function saveIndividualEvaluations() {
    const p = document.getElementById('evalPersonSelect').value;
    if(!p) return;
    if(!evaluations[p]) evaluations[p] = {};
    document.querySelectorAll('#individualEvalBody tr').forEach(row => {
        const sk = row.querySelector('.eval-curr').dataset.skill;
        evaluations[p][sk] = { current: parseInt(row.querySelector('.eval-curr').value)||0, target: parseInt(row.querySelector('.eval-targ').value)||0 };
    });
    syncToFirebase();
    alert("Dados enviados para o Google Firebase!");
}

function renderGroupEvalTable() {
    const g = document.getElementById('evalGroupSelect').value;
    if(!g) return;
    document.getElementById('groupEvalBody').innerHTML = skills.map(s => {
        const t = (groupTargets[g] && groupTargets[g][s.name]) || 0;
        return `<tr><td>${s.name}</td><td><input type="number" class="group-targ-input" data-skill="${s.name}" value="${t}"></td></tr>`;
    }).join('');
}

function saveGroupTargets() {
    const g = document.getElementById('evalGroupSelect').value;
    if(!g) return;
    if(!groupTargets[g]) groupTargets[g] = {};
    document.querySelectorAll('#groupEvalBody tr').forEach(row => {
        const input = row.querySelector('.group-targ-input');
        groupTargets[g][input.dataset.skill] = parseInt(input.value) || 0;
    });
    syncToFirebase();
}

// --- RADAR & PDI ---
function getEffTarget(pName, sName) {
    const personal = (evaluations[pName] && evaluations[pName][sName]?.target) || 0;
    let groupMax = 0;
    groups.filter(g => g.members.includes(pName)).forEach(g => {
        const t = (groupTargets[g.name] && groupTargets[g.name][sName]) || 0;
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
        options: { scales: { r: { min: 0, max: 5 } } }
    });

    let html = "<h3>Sugestões de Desenvolvimento</h3>";
    skills.forEach(s => {
        const c = (evaluations[p] && evaluations[p][s.name]?.current) || 0;
        const t = getEffTarget(p, s.name);
        if(c < t) {
            const plan = skillPlans.find(pl => pl.skillName === s.name && pl.from <= c && pl.to > c);
            html += `<div style="background:#f8fafc; padding:10px; margin-bottom:5px; border-left:4px solid #2563eb;"><strong>${s.name}:</strong> ${plan ? plan.action : 'Sem regra definida.'}</div>`;
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
    const pOpt = '<option value="">Selecione Pessoa...</option>' + people.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
    const sOpt = '<option value="">Selecione Competência...</option>' + skills.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
    const gOpt = '<option value="">Selecione Grupo...</option>' + groups.map(g => `<option value="${g.name}">${g.name}</option>`).join('');
    ['evalPersonSelect', 'pdiPersonSelect', 'personSelectField'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerHTML = pOpt; });
    ['skillPlanSelect'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerHTML = sOpt; });
    ['evalGroupSelect'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerHTML = gOpt; });
}