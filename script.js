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

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// VARIÁVEIS GLOBAIS
let people = [], skills = [], groups = [], skillPlans = {}, evaluations = {}, groupTargets = {}, customActionPlans = {};
let selectedMembers = []; // Para criação de grupos
let radarChart = null;

// CARREGAMENTO INICIAL
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
            customActionPlans = data.customActionPlans || {};
            
            renderAll();
        }
    });
};

function syncToFirebase() {
    db.ref('pdi_data').set({
        people, skills, groups, skillPlans, evaluations, groupTargets, customActionPlans
    }).then(() => console.log("Dados sincronizados")).catch(e => alert("Erro ao salvar: " + e.message));
}

function renderAll() {
    renderPeople();
    renderSkills();
    renderGroups();
    renderSkillPlansTable();
    updateAllSelects();
}

// --- CADASTRO PESSOAS ---
function addPerson() {
    const name = document.getElementById('personName').value;
    const role = document.getElementById('personRole').value;
    const manager = document.getElementById('personManager').value;
    
    if(!name) return alert("Nome é obrigatório!");
    
    people.push({ name, role, manager });
    syncToFirebase();
    
    document.getElementById('personName').value = '';
    document.getElementById('personRole').value = '';
    document.getElementById('personManager').value = '';
}

function renderPeople() {
    const list = document.getElementById('peopleList');
    list.innerHTML = people.map((p, i) => `
        <tr>
            <td>${p.name}</td>
            <td>${p.role}</td>
            <td>${p.manager}</td>
            <td><button class="btn-delete" onclick="deleteItem('people', ${i})"><i class="fas fa-trash"></i></button></td>
        </tr>
    `).join('');
}

// --- CADASTRO GRUPOS ---
function addMemberToGroup(select) {
    if(!select.value) return;
    if(!selectedMembers.includes(select.value)) {
        selectedMembers.push(select.value);
        renderTags();
    }
    select.value = "";
}

function renderTags() {
    const cont = document.getElementById('selectedTagsContainer');
    cont.innerHTML = selectedMembers.map(m => `<span class="tag-chip">${m} <i class="fas fa-times tag-close" onclick="removeTag('${m}')"></i></span>`).join('');
}

function removeTag(name) {
    selectedMembers = selectedMembers.filter(m => m !== name);
    renderTags();
}

function saveGroup() {
    const name = document.getElementById('groupName').value;
    if(!name || selectedMembers.length === 0) return alert("Preencha nome e integrantes");
    groups.push({ name, members: [...selectedMembers] });
    selectedMembers = [];
    document.getElementById('groupName').value = "";
    renderTags();
    syncToFirebase();
}

function renderGroups() {
    const body = document.getElementById('groupTable');
    body.innerHTML = groups.map((g, i) => `
        <tr>
            <td>${g.name}</td>
            <td>${g.members.join(', ')}</td>
            <td><button class="btn-delete" onclick="deleteItem('groups', ${i})">Excluir</button></td>
        </tr>
    `).join('');
}

// --- COMPETÊNCIAS ---
function addSkill() {
    const name = document.getElementById('skillName').value;
    const desc = document.getElementById('skillDescription').value;
    const type = document.getElementById('skillType').value;
    if(!name) return;
    skills.push({ name, description: desc, type });
    syncToFirebase();
    document.getElementById('skillName').value = "";
}

function renderSkills() {
    const list = document.getElementById('skillsList');
    list.innerHTML = skills.map((s, i) => `<tr><td>${s.name}</td><td>${s.type}</td><td><button class="btn-delete" onclick="deleteItem('skills', ${i})">Excluir</button></td></tr>`).join('');
}

// --- REGRAS DE EVOLUÇÃO ---
function loadSkillPlanForm() {
    const name = document.getElementById('skillPlanSelect').value;
    const form = document.getElementById('skillPlanForm');
    if(!name) { form.style.display = 'none'; return; }
    form.style.display = 'block';
    const p = skillPlans[name] || { n3: '', n6: '', n9: '' };
    document.getElementById('planN3').value = p.n3;
    document.getElementById('planN6').value = p.n6;
    document.getElementById('planN9').value = p.n9;
}

function saveSkillPlan() {
    const name = document.getElementById('skillPlanSelect').value;
    skillPlans[name] = {
        n3: document.getElementById('planN3').value,
        n6: document.getElementById('planN6').value,
        n9: document.getElementById('planN9').value
    };
    syncToFirebase();
    alert("Regra salva!");
}

function renderSkillPlansTable() {
    const body = document.getElementById('skillPlansTableBody');
    body.innerHTML = Object.keys(skillPlans).map(name => `
        <tr>
            <td><strong>${name}</strong></td>
            <td><div class="read-only-box">${skillPlans[name].n3.substring(0,30)}...</div></td>
            <td><div class="read-only-box">${skillPlans[name].n6.substring(0,30)}...</div></td>
            <td><div class="read-only-box">${skillPlans[name].n9.substring(0,30)}...</div></td>
        </tr>
    `).join('');
}

// --- AVALIAÇÃO ---
function renderIndividualEvalTable() {
    const p = document.getElementById('evalPersonSelect').value;
    if(!p) return;
    const body = document.getElementById('individualEvalBody');
    body.innerHTML = skills.map(s => {
        const val = (evaluations[p] && evaluations[p][s.name]) || { current: 3, target: 3 };
        return `
            <tr>
                <td>${s.name}</td>
                <td>
                    <select class="eval-curr" data-skill="${s.name}">
                        <option value="0" ${val.current == 0 ? 'selected' : ''}>0</option>
                        <option value="3" ${val.current == 3 ? 'selected' : ''}>3</option>
                        <option value="6" ${val.current == 6 ? 'selected' : ''}>6</option>
                        <option value="9" ${val.current == 9 ? 'selected' : ''}>9</option>
                    </select>
                </td>
                <td><small>${s.description}</small></td>
                <td>
                    <select class="eval-targ" data-skill="${s.name}">
                        <option value="3" ${val.target == 3 ? 'selected' : ''}>3</option>
                        <option value="6" ${val.target == 6 ? 'selected' : ''}>6</option>
                        <option value="9" ${val.target == 9 ? 'selected' : ''}>9</option>
                    </select>
                </td>
                <td><small>Target Nível ${val.target}</small></td>
            </tr>
        `;
    }).join('');
}

function saveIndividualEvaluations() {
    const p = document.getElementById('evalPersonSelect').value;
    if(!p) return;
    if(!evaluations[p]) evaluations[p] = {};
    
    document.querySelectorAll('.eval-curr').forEach(sel => {
        const s = sel.dataset.skill;
        if(!evaluations[p][s]) evaluations[p][s] = {};
        evaluations[p][s].current = parseInt(sel.value);
    });
    document.querySelectorAll('.eval-targ').forEach(sel => {
        const s = sel.dataset.skill;
        evaluations[p][s].target = parseInt(sel.value);
    });
    syncToFirebase();
    alert("Avaliação salva!");
}

// --- LÓGICA DE GAPS ---
function getEffTarget(pName, sName) {
    if(evaluations[pName] && evaluations[pName][sName]?.target) return parseInt(evaluations[pName][sName].target);
    const g = groups.find(x => x.members.includes(pName));
    if(g && groupTargets[g.name] && groupTargets[g.name][sName]) return parseInt(groupTargets[g.name][sName]);
    return 3;
}

// --- PLANO DE AÇÃO ---
function renderActionPlanTable() {
    const filter = document.getElementById('filterActionPlanPerson').value;
    const body = document.getElementById('actionPlanTableBody');
    let html = "";
    const list = filter ? people.filter(p => p.name === filter) : people;

    list.forEach(p => {
        skills.forEach(s => {
            const curr = (evaluations[p.name] && evaluations[p.name][s.name]?.current) || 0;
            const targ = getEffTarget(p.name, s.name);
            if(curr < targ) {
                const key = `${p.name}_${s.name}`;
                const plan = customActionPlans[key] || { 
                    action: (skillPlans[s.name] ? (targ <= 3 ? skillPlans[s.name].n3 : targ <= 6 ? skillPlans[s.name].n6 : skillPlans[s.name].n9) : ""),
                    priority: "Média"
                };
                html += `
                    <tr>
                        <td>${p.name}</td>
                        <td>${s.name} (GAP: ${curr}➔${targ})</td>
                        <td><textarea id="act_${key}">${plan.action}</textarea></td>
                        <td>
                            <select id="prio_${key}">
                                <option value="Alta" ${plan.priority==='Alta'?'selected':''}>Alta</option>
                                <option value="Média" ${plan.priority==='Média'?'selected':''}>Média</option>
                                <option value="Baixa" ${plan.priority==='Baixa'?'selected':''}>Baixa</option>
                            </select>
                        </td>
                        <td><button onclick="saveAct('${p.name}','${s.name}')">Salvar</button></td>
                    </tr>
                `;
            }
        });
    });
    body.innerHTML = html || "<tr><td colspan='5'>Sem GAPs identificados.</td></tr>";
}

function saveAct(p, s) {
    const key = `${p}_${s}`;
    customActionPlans[key] = {
        action: document.getElementById(`act_${key}`).value,
        priority: document.getElementById(`prio_${key}`).value
    };
    syncToFirebase();
}

// --- RADAR ---
function renderPDIRadar() {
    const p = document.getElementById('pdiPersonSelect').value;
    if(!p) return;
    const labels = skills.map(s => s.name);
    const curr = labels.map(n => (evaluations[p] && evaluations[p][n]?.current) || 0);
    const targ = labels.map(n => getEffTarget(p, n));

    if(radarChart) radarChart.destroy();
    radarChart = new Chart(document.getElementById('radarChart'), {
        type: 'radar',
        data: {
            labels,
            datasets: [
                { label: 'Atual', data: curr, borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.2)' },
                { label: 'Alvo', data: targ, borderColor: '#10b981', borderDash: [5,5] }
            ]
        },
        options: { scales: { r: { beginAtZero: true, max: 9 } } }
    });
}

// --- UTILS ---
function updateAllSelects() {
    const pOpt = '<option value="">Selecione...</option>' + people.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
    const sOpt = '<option value="">Selecione...</option>' + skills.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
    const gOpt = '<option value="">Selecione...</option>' + groups.map(g => `<option value="${g.name}">${g.name}</option>`).join('');

    ['evalPersonSelect', 'pdiPersonSelect', 'filterActionPlanPerson', 'personSelectField'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerHTML = pOpt;
    });
    if(document.getElementById('skillPlanSelect')) document.getElementById('skillPlanSelect').innerHTML = sOpt;
    if(document.getElementById('evalGroupSelect')) document.getElementById('evalGroupSelect').innerHTML = gOpt;
}

function deleteItem(type, index) {
    if(!confirm("Deseja excluir?")) return;
    if(type === 'people') people.splice(index, 1);
    if(type === 'skills') skills.splice(index, 1);
    if(type === 'groups') groups.splice(index, 1);
    syncToFirebase();
}

function openMainTab(evt, name) {
    document.querySelectorAll('.main-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(name).classList.add('active');
    evt.currentTarget.classList.add('active');
    if(name === 'plano_acao') renderActionPlanTable();
}

function openSubTab(evt, name) {
    const parent = evt.currentTarget.parentElement.parentElement;
    parent.querySelectorAll('.sub-content').forEach(c => c.classList.remove('active'));
    parent.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(name).classList.add('active');
    evt.currentTarget.classList.add('active');
}