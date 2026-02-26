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
let editingInfo = { type: null, index: null };

// INICIALIZAÇÃO
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

function getEffectiveTarget(personName, skillName) {
    let maxTarget = (evaluations[personName] && evaluations[personName][skillName]?.target) || 0;
    groups.forEach(group => {
        if (group.members.includes(personName)) {
            const groupTarg = (groupTargets[group.name] && groupTargets[group.name][skillName]) || 0;
            if (groupTarg > maxTarget) maxTarget = groupTarg;
        }
    });
    return maxTarget;
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

// CADASTROS COM EDIÇÃO
function addPerson() {
    const name = document.getElementById('personName').value.trim();
    const role = document.getElementById('personRole').value;
    const manager = document.getElementById('personManager').value;
    if(!name) return alert("Nome obrigatório");
    if (editingInfo.type === 'people') {
        people[editingInfo.index] = { name, role, manager };
        editingInfo = { type: null, index: null };
        document.getElementById('personFormTitle').innerText = "Gerenciar Pessoa";
    } else {
        people.push({ name, role, manager });
    }
    sync();
    document.getElementById('personName').value = "";
    document.getElementById('personRole').value = "";
    document.getElementById('personManager').value = "";
}

function addSkill() {
    const name = document.getElementById('skillName').value.trim();
    const description = document.getElementById('skillDescription').value;
    const type = document.getElementById('skillType').value;
    if(!name) return alert("Nome obrigatório");
    if (editingInfo.type === 'skills') {
        skills[editingInfo.index] = { name, description, type };
        editingInfo = { type: null, index: null };
        document.getElementById('skillFormTitle').innerText = "Competência";
    } else {
        skills.push({ name, description, type });
    }
    sync();
    document.getElementById('skillName').value = "";
    document.getElementById('skillDescription').value = "";
}

function editItem(type, index) {
    editingInfo = { type, index };
    if (type === 'people') {
        const p = people[index];
        document.getElementById('personName').value = p.name;
        document.getElementById('personRole').value = p.role;
        document.getElementById('personManager').value = p.manager;
        document.getElementById('personFormTitle').innerText = "Editando: " + p.name;
        openSubTab({currentTarget: document.querySelector('[onclick*="cad-pessoas"]')}, 'cad-pessoas');
    } else if (type === 'skills') {
        const s = skills[index];
        document.getElementById('skillName').value = s.name;
        document.getElementById('skillDescription').value = s.description;
        document.getElementById('skillType').value = s.type;
        document.getElementById('skillFormTitle').innerText = "Editando: " + s.name;
    } else if (type === 'groups') {
        const g = groups[index];
        document.getElementById('groupName').value = g.name;
        selectedMembers = [...g.members];
        renderTags();
        document.getElementById('groupFormTitle').innerText = "Editando Grupo: " + g.name;
    }
}

// MATRIZ (Item 5: Plano de Ação Sim/Não)
function renderMatrix() {
    const body = document.getElementById('matrixBody');
    let html = "";
    people.forEach(p => {
        skills.forEach(s => {
            const ev = (evaluations[p.name] && evaluations[p.name][s.name]) || { current: 0, target: 0 };
            const effectiveTarget = getEffectiveTarget(p.name, s.name);
            const status = ev.current >= effectiveTarget ? '<span class="status-tag status-ok">OK</span>' : '<span class="status-tag status-gap">GAP</span>';
            const key = `${p.name}_${s.name}`;
            const pData = customActionPlans[key] || { hasPlan: 'Não' };

            html += `<tr>
                <td>${p.name}</td>
                <td>${s.name}</td>
                <td>${ev.current}</td>
                <td><input type="number" step="3" min="0" max="9" value="${ev.target}" onchange="updateEvalRealTime('${p.name}','${s.name}','target',this.value); renderMatrix()"></td>
                <td>${status}</td>
                <td>
                    <select onchange="updateActionData('${p.name}','${s.name}','hasPlan',this.value); renderMatrix()">
                        <option value="Não" ${pData.hasPlan === 'Não' ? 'selected' : ''}>Não</option>
                        <option value="Sim" ${pData.hasPlan === 'Sim' ? 'selected' : ''}>Sim</option>
                    </select>
                </td>
            </tr>`;
        });
    });
    body.innerHTML = html;
}

function renderActionPlanTable() {
    const person = document.getElementById('filterActionPlanPerson').value;
    const body = document.getElementById('actionPlanTableBody');
    if (!person) { body.innerHTML = ""; return; }

    body.innerHTML = skills.filter(s => {
        const key = `${person}_${s.name}`;
        return customActionPlans[key] && customActionPlans[key].hasPlan === 'Sim';
    }).map(s => {
        const key = `${person}_${s.name}`;
        const pData = customActionPlans[key] || { customAction: '', deadline: '', priority: 'Média' };
        return `
            <tr>
                <td><strong>${s.name}</strong><br><small>Alvo: ${getEffectiveTarget(person, s.name)}</small></td>
                <td><textarea onchange="updateActionData('${person}','${s.name}','customAction',this.value)">${pData.customAction || ''}</textarea></td>
                <td><input type="date" value="${pData.deadline || ''}" onchange="updateActionData('${person}','${s.name}','deadline',this.value)"></td>
                <td>
                    <select onchange="updateActionData('${person}','${s.name}','priority',this.value)">
                        <option value="Baixa" ${pData.priority === 'Baixa' ? 'selected' : ''}>Baixa</option>
                        <option value="Média" ${pData.priority === 'Média' ? 'selected' : ''}>Média</option>
                        <option value="Alta" ${pData.priority === 'Alta' ? 'selected' : ''}>Alta</option>
                    </select>
                </td>
            </tr>
        `;
    }).join('');
}

function getDescriptionForLevel(skillName, level) {
    if (!level || level == 0) return "";
    const plan = skillPlans[skillName];
    if (!plan) return "-";
    if (level <= 3) return plan.n3 || "-";
    if (level <= 6) return plan.n6 || "-";
    return plan.n9 || "-";
}

function validateScore(val) {
    const allowed = [0, 3, 6, 9];
    let num = parseInt(val) || 0;
    if (!allowed.includes(num)) {
        if (num < 3) return 0;
        if (num < 6) return 3;
        if (num < 9) return 6;
        return 9;
    }
    return num;
}

function updateEvalRealTime(person, skill, field, value) {
    let val = validateScore(value);
    if (!evaluations[person]) evaluations[person] = {};
    if (!evaluations[person][skill]) evaluations[person][skill] = { current: 0, target: 0 };
    evaluations[person][skill][field] = val;
    const rowId = `row_${person.replace(/\s/g, '')}_${skill.replace(/\s/g, '')}`;
    const descId = field === 'current' ? `desc_curr_${rowId}` : `desc_targ_${rowId}`;
    const descEl = document.getElementById(descId);
    if (descEl) descEl.innerText = getDescriptionForLevel(skill, val);
}

function renderIndividualEvalTable() {
    const person = document.getElementById('evalPersonSelect').value;
    const body = document.getElementById('individualEvalBody');
    if (!person) { body.innerHTML = ""; return; }
    body.innerHTML = skills.map(s => {
        const ev = (evaluations[person] && evaluations[person][s.name]) || { current: 0, target: 0 };
        const rowId = `row_${person.replace(/\s/g, '')}_${s.name.replace(/\s/g, '')}`;
        return `<tr>
            <td>${s.name}</td>
            <td><input type="number" min="0" max="9" step="3" value="${ev.current}" oninput="updateEvalRealTime('${person}','${s.name}','current',this.value)"></td>
            <td id="desc_curr_${rowId}" class="desc-cell">${getDescriptionForLevel(s.name, ev.current)}</td>
            <td><input type="number" min="0" max="9" step="3" value="${ev.target}" oninput="updateEvalRealTime('${person}','${s.name}','target',this.value)"></td>
            <td id="desc_targ_${rowId}" class="desc-cell">${getDescriptionForLevel(s.name, ev.target)}</td>
        </tr>`;
    }).join('');
}

function renderGroupEvalTable() {
    const groupName = document.getElementById('evalGroupSelect').value;
    const container = document.getElementById('groupEvalContainer');
    const body = document.getElementById('groupEvalBody');
    
    if (!groupName) { 
        container.style.display = "none";
        return; 
    }
    
    container.style.display = "block";
    body.innerHTML = skills.map(s => {
        const target = (groupTargets[groupName] && groupTargets[groupName][s.name]) || 0;
        const rowId = `group_${groupName.replace(/\s/g, '')}_${s.name.replace(/\s/g, '')}`;
        return `<tr>
            <td>${s.name}</td>
            <td><input type="number" step="3" min="0" max="9" value="${target}" oninput="updateGroupTarget('${groupName}','${s.name}',this.value)"></td>
            <td id="desc_group_${rowId}" class="desc-cell">${getDescriptionForLevel(s.name, target)}</td>
        </tr>`;
    }).join('');
}

function updateGroupTarget(group, skill, value) {
    let val = validateScore(value);
    if (!groupTargets[group]) groupTargets[group] = {};
    groupTargets[group][skill] = val;
    const descId = `desc_group_group_${group.replace(/\s/g, '')}_${skill.replace(/\s/g, '')}`;
    const descEl = document.getElementById(descId);
    if (descEl) descEl.innerText = getDescriptionForLevel(skill, val);
}

// DESENVOLVIMENTO (Item 4: Removido filtro de grupo)
function renderPDIRadar() {
    const person = document.getElementById('pdiPersonSelect').value;
    const container = document.getElementById('pdiActionPlan');
    if (!person) { if(radarChart) radarChart.destroy(); container.innerHTML = ""; return; }

    const data = skills.map(s => ({
        current: (evaluations[person] && evaluations[person][s.name]?.current) || 0,
        target: getEffectiveTarget(person, s.name)
    }));

    const ctx = document.getElementById('radarChart').getContext('2d');
    if (radarChart) radarChart.destroy();
    radarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: skills.map(s => s.name),
            datasets: [
                { label: 'Atual', data: data.map(d => d.current), backgroundColor: 'rgba(37, 99, 235, 0.2)', borderColor: '#2563eb', pointRadius: 4 },
                { label: 'Alvo', data: data.map(d => d.target), backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: '#10b981', pointRadius: 4 }
            ]
        },
        options: { 
            responsive: true,
            maintainAspectRatio: false,
            scales: { r: { min: 0, max: 9, ticks: { stepSize: 3 } } },
            plugins: { legend: { position: 'bottom' } }
        }
    });

    let html = "<h3>Plano de Desenvolvimento</h3>";
    skills.forEach(s => {
        const ev = (evaluations[person] && evaluations[person][s.name]?.current) || 0;
        const target = getEffectiveTarget(person, s.name);
        if (ev < target) {
            const plan = skillPlans[s.name] || {};
            let action = target <= 3 ? plan.n3 : (target <= 6 ? plan.n6 : plan.n9);
            html += `<div class="pdi-item"><strong>${s.name}</strong> <span class="gap-badge">Alvo: ${target}</span><p>${action || "Sem regra definida."}</p></div>`;
        }
    });
    container.innerHTML = html;
}

function updateActionData(person, skill, field, value) {
    const key = `${person}_${skill}`;
    if (!customActionPlans[key]) customActionPlans[key] = {};
    customActionPlans[key][field] = value;
    sync();
}

function exportToExcel() {
    const person = document.getElementById('filterActionPlanPerson').value;
    if(!person) return alert("Selecione uma pessoa.");
    const data = skills.filter(s => {
        const key = `${person}_${s.name}`;
        return customActionPlans[key] && customActionPlans[key].hasPlan === 'Sim';
    }).map(s => {
        const key = `${person}_${s.name}`;
        return {
            "Competência": s.name,
            "Alvo": getEffectiveTarget(person, s.name),
            "Ação": customActionPlans[key].customAction,
            "Data Limite": customActionPlans[key].deadline,
            "Prioridade": customActionPlans[key].priority
        };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PDI");
    XLSX.writeFile(wb, `PDI_${person}.xlsx`);
}

function addMemberToGroup(select) {
    const name = select.value;
    if(name && !selectedMembers.includes(name)) { selectedMembers.push(name); renderTags(); }
    select.value = "";
}
function renderTags() { document.getElementById('selectedTagsContainer').innerHTML = selectedMembers.map(m => `<span class="tag-chip">${m} <i class="fas fa-times tag-close" onclick="removeTag('${m}')"></i></span>`).join(''); }
function removeTag(name) { selectedMembers = selectedMembers.filter(m => m !== name); renderTags(); }

function saveGroup() {
    const name = document.getElementById('groupName').value.trim();
    if(!name || selectedMembers.length === 0) return alert("Preencha o nome e adicione membros.");
    
    if (editingInfo.type === 'groups') {
        groups[editingInfo.index] = { name, members: [...selectedMembers] };
        editingInfo = { type: null, index: null };
        document.getElementById('groupFormTitle').innerText = "Novo Grupo";
    } else {
        groups.push({ name, members: [...selectedMembers] });
    }
    
    selectedMembers = []; 
    document.getElementById('groupName').value = ""; 
    renderTags();
    sync();
}

function saveIndividualEvaluations() { sync(); alert("Avaliações salvas!"); }

// Item 3: Ocultar competências e resetar filtro
function saveGroupTargets() { 
    sync(); 
    alert("Alvos do grupo salvos!"); 
    document.getElementById('evalGroupSelect').value = "";
    document.getElementById('groupEvalContainer').style.display = "none";
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
    skillPlans[skill] = { n3: document.getElementById('planN3').value, n6: document.getElementById('planN6').value, n9: document.getElementById('planN9').value };
    sync(); alert("Salvo!");
}
function renderAll() { renderPeople(); renderSkills(); renderGroups(); renderSkillPlansTable(); updateAllSelects(); }
function renderPeople() { document.getElementById('peopleList').innerHTML = people.map((p, i) => `<tr><td>${p.name}</td><td>${p.role}</td><td>${p.manager}</td><td class="actions"><button onclick="editItem('people',${i})" class="btn-edit"><i class="fas fa-edit"></i></button><button onclick="deleteItem('people',${i})" class="btn-delete"><i class="fas fa-trash"></i></button></td></tr>`).join(''); }
function renderSkills() { document.getElementById('skillsList').innerHTML = skills.map((s, i) => `<tr><td>${s.name}</td><td>${s.type}</td><td>${s.description || '-'}</td><td class="actions"><button onclick="editItem('skills',${i})" class="btn-edit"><i class="fas fa-edit"></i></button><button onclick="deleteItem('skills',${i})" class="btn-delete"><i class="fas fa-trash"></i></button></td></tr>`).join(''); }

// Item 1: Botão editar em grupos
function renderGroups() { document.getElementById('groupTable').innerHTML = groups.map((g, i) => `<tr><td>${g.name}</td><td>${g.members.join(', ')}</td><td><button onclick="editItem('groups',${i})" class="btn-edit"><i class="fas fa-edit"></i></button><button onclick="deleteItem('groups',${i})" class="btn-delete"><i class="fas fa-trash"></i></button></td></tr>`).join(''); }

function renderSkillPlansTable() { document.getElementById('skillPlansTableBody').innerHTML = Object.keys(skillPlans).map(k => `<tr><td>${k}</td><td>${skillPlans[k].n3}</td><td>${skillPlans[k].n6}</td><td>${skillPlans[k].n9}</td></tr>`).join(''); }
function updateAllSelects() {
    const pOpt = '<option value="">Selecione...</option>' + people.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
    const sOpt = '<option value="">Selecione...</option>' + skills.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
    const gOpt = '<option value="">Selecione...</option>' + groups.map(g => `<option value="${g.name}">${g.name}</option>`).join('');
    ['personSelectField', 'evalPersonSelect', 'pdiPersonSelect', 'filterActionPlanPerson'].forEach(id => { const el = document.getElementById(id); if(el) el.innerHTML = pOpt; });
    const sp = document.getElementById('skillPlanSelect'); if(sp) sp.innerHTML = sOpt;
    const eg = document.getElementById('evalGroupSelect'); if(eg) eg.innerHTML = gOpt;
}
function deleteItem(type, index) { if(confirm("Excluir definitivamente?")) { if(type==='people') people.splice(index,1); if(type==='skills') skills.splice(index,1); if(type==='groups') groups.splice(index,1); sync(); } }