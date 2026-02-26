// ... (Configuração Firebase e variáveis permanecem iguais)
let customActionPlans = {}; // Nova variável para planos personalizados

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
            customActionPlans = data.customActionPlans || {}; // Carrega planos customizados
            
            renderPeople();
            renderSkills();
            renderGroups();
            updateAllSelects();
        }
    });
};

function syncToFirebase() {
    db.ref('pdi_data').set({ 
        people, skills, groups, skillPlans, evaluations, groupTargets, customActionPlans 
    });
}

// --- Alteração 1: Funções para Layout de Regras de Evolução ---
function loadSkillPlanForm() {
    const skillName = document.getElementById('skillPlanSelect').value;
    const form = document.getElementById('skillPlanForm');
    if(!skillName) { form.style.display = 'none'; return; }
    
    form.style.display = 'block';
    const plan = skillPlans[skillName] || { n3: '', n6: '', n9: '' };
    document.getElementById('planN3').value = plan.n3 || '';
    document.getElementById('planN6').value = plan.n6 || '';
    document.getElementById('planN9').value = plan.n9 || '';
}

function saveSkillPlan() {
    const skillName = document.getElementById('skillPlanSelect').value;
    skillPlans[skillName] = {
        n3: document.getElementById('planN3').value,
        n6: document.getElementById('planN6').value,
        n9: document.getElementById('planN9').value
    };
    syncToFirebase();
    renderSkillPlansTable();
    alert("Regras salvas!");
}

function renderSkillPlansTable() {
    const body = document.getElementById('skillPlansTableBody');
    body.innerHTML = Object.keys(skillPlans).map(name => `
        <tr>
            <td><strong>${name}</strong></td>
            <td><small>${skillPlans[name].n3.substring(0,20)}...</small></td>
            <td><small>${skillPlans[name].n6.substring(0,20)}...</small></td>
            <td><small>${skillPlans[name].n9.substring(0,20)}...</small></td>
        </tr>
    `).join('');
}

// --- Alteração 2: Avaliação Individual com Descrições ---
function renderIndividualEvalTable() {
    const p = document.getElementById('evalPersonSelect').value;
    if(!p) return;
    
    document.getElementById('individualEvalBody').innerHTML = skills.map(s => {
        const val = (evaluations[p] && evaluations[p][s.name]) || { current: 3, target: 3 };
        
        // Busca a descrição da competência original
        const skillData = skills.find(sk => sk.name === s.name);
        const descBase = skillData ? skillData.description : "Sem descrição";

        return `<tr>
            <td><strong>${s.name}</strong></td>
            <td>
                <select class="eval-curr" data-skill="${s.name}" onchange="updateRowDesc(this, 'curr')">
                    <option value="3" ${val.current == 3 ? 'selected' : ''}>3</option>
                    <option value="6" ${val.current == 6 ? 'selected' : ''}>6</option>
                    <option value="9" ${val.current == 9 ? 'selected' : ''}>9</option>
                </select>
            </td>
            <td id="desc-curr-${s.name.replace(/\s+/g, '')}">${descBase}</td>
            <td>
                <select class="eval-targ" data-skill="${s.name}" onchange="updateRowDesc(this, 'targ')">
                    <option value="3" ${val.target == 3 ? 'selected' : ''}>3</option>
                    <option value="6" ${val.target == 6 ? 'selected' : ''}>6</option>
                    <option value="9" ${val.target == 9 ? 'selected' : ''}>9</option>
                </select>
            </td>
            <td id="desc-targ-${s.name.replace(/\s+/g, '')}">${descBase}</td>
        </tr>`;
    }).join('');
}

// Função para atualizar a descrição baseada no nível (simples exemplo de gatilho)
function updateRowDesc(selectEl, type) {
    // Aqui você pode customizar para mostrar textos diferentes por nível se quiser
    // Por enquanto, ele valida que o nível foi selecionado.
}

// --- Alteração 3: Plano de Ação Personalizado ---
function renderActionPlanTable() {
    const filterPerson = document.getElementById('filterActionPlanPerson').value;
    const body = document.getElementById('actionPlanTableBody');
    let html = "";

    const peopleToRender = filterPerson ? people.filter(p => p.name === filterPerson) : people;

    peopleToRender.forEach(p => {
        skills.forEach(s => {
            const current = (evaluations[p.name] && evaluations[p.name][s.name]?.current) || 0;
            const target = getEffTarget(p.name, s.name);

            if (current < target) {
                const key = `${p.name}_${s.name}`;
                const custom = customActionPlans[key] || { 
                    action: (skillPlans[s.name] ? (target <= 3 ? skillPlans[s.name].n3 : target <= 6 ? skillPlans[s.name].n6 : skillPlans[s.name].n9) : ""), 
                    priority: "Média" 
                };

                html += `
                    <tr>
                        <td>${p.name}</td>
                        <td>${s.name} (Nível ${target})</td>
                        <td><textarea id="customAction_${key}">${custom.action}</textarea></td>
                        <td>
                            <select id="customPriority_${key}">
                                <option value="Alta" ${custom.priority === 'Alta' ? 'selected' : ''}>Alta</option>
                                <option value="Média" ${custom.priority === 'Média' ? 'selected' : ''}>Média</option>
                                <option value="Baixa" ${custom.priority === 'Baixa' ? 'selected' : ''}>Baixa</option>
                            </select>
                        </td>
                        <td><button class="btn-primary" onclick="saveCustomAction('${p.name}', '${s.name}')">Salvar</button></td>
                    </tr>
                `;
            }
        });
    });
    body.innerHTML = html || "<tr><td colspan='5'>Nenhum GAP identificado ou selecione uma pessoa.</td></tr>";
}

function saveCustomAction(pName, sName) {
    const key = `${pName}_${sName}`;
    customActionPlans[key] = {
        action: document.getElementById(`customAction_${key}`).value,
        priority: document.getElementById(`customPriority_${key}`).value
    };
    syncToFirebase();
    alert("Plano individual salvo!");
}

// Atualiza os selects, incluindo os novos filtros
function updateAllSelects() {
    const pOpt = '<option value="">Selecione...</option>' + people.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
    const sOpt = '<option value="">Selecione...</option>' + skills.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
    const gOpt = '<option value="">Selecione...</option>' + groups.map(g => `<option value="${g.name}">${g.name}</option>`).join('');
    
    if(document.getElementById('evalPersonSelect')) document.getElementById('evalPersonSelect').innerHTML = pOpt;
    if(document.getElementById('pdiPersonSelect')) document.getElementById('pdiPersonSelect').innerHTML = pOpt;
    if(document.getElementById('filterActionPlanPerson')) document.getElementById('filterActionPlanPerson').innerHTML = pOpt;
    if(document.getElementById('personSelectField')) document.getElementById('personSelectField').innerHTML = pOpt;
    if(document.getElementById('evalGroupSelect')) document.getElementById('evalGroupSelect').innerHTML = gOpt;
    if(document.getElementById('skillPlanSelect')) document.getElementById('skillPlanSelect').innerHTML = sOpt;
}

// Navegação ajustada para carregar as tabelas ao abrir
function openMainTab(evt, tabName) {
    document.querySelectorAll(".main-content").forEach(c => c.classList.remove("active"));
    document.querySelectorAll(".main-tab").forEach(t => t.classList.remove("active"));
    document.getElementById(tabName).classList.add("active");
    evt.currentTarget.classList.add("active");
    
    if(tabName === 'desenvolvimento') renderPDIRadar();
    if(tabName === 'matriz') renderMatrix();
    if(tabName === 'plano_acao') renderActionPlanTable();
    updateAllSelects();
}