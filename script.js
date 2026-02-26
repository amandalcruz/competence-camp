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

O problema de não conseguir cadastrar ou alternar entre subabas geralmente ocorre por um erro de "referência" no JavaScript (quando o código tenta ler algo que ainda não carregou) ou porque o Firebase está bloqueando a escrita.

Abaixo, apresento o código completamente revisado, com foco em estabilidade máxima. Removi redundâncias e adicionei proteções para que as funções funcionem mesmo se o banco demorar a responder.

1. script.js (A versão mais estável)
Substitua todo o seu arquivo por este. Note as funções de navegação corrigidas.

JavaScript
// CONFIGURAÇÃO FIREBASE - Verifique se estes dados batem com seu console Firebase
const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    databaseURL: "https://SEU_PROJETO-default-rtdb.firebaseio.com",
    projectId: "SEU_PROJETO",
    storageBucket: "SEU_PROJETO.appspot.com",
    messagingSenderId: "0000000000",
    appId: "1:000000000:web:000000"
};

// Inicialização segura
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// Variáveis de Estado
let people = [], skills = [], groups = [], skillPlans = {}, evaluations = {}, groupTargets = {}, customActionPlans = {};
let selectedMembers = [];
let radarChart = null;

// Carregamento de dados (Real-time)
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
        }
        renderAll();
    }, (error) => {
        console.error("Erro ao ler Firebase:", error);
    });
};

// Sincronização
function syncToFirebase() {
    db.ref('pdi_data').set({
        people, skills, groups, skillPlans, evaluations, groupTargets, customActionPlans
    }).catch(e => alert("Erro ao salvar no banco: " + e.message));
}

// --- NAVEGAÇÃO (CORRIGIDA) ---
function openMainTab(evt, tabId) {
    // Esconde todos os conteúdos principais
    document.querySelectorAll(".main-content").forEach(c => c.style.display = "none");
    document.querySelectorAll(".main-tab").forEach(t => t.classList.remove("active"));
    
    // Mostra o selecionado
    const target = document.getElementById(tabId);
    if(target) target.style.display = "block";
    evt.currentTarget.classList.add("active");

    // Gatilhos de renderização específica
    if(tabId === 'plano_acao') renderActionPlanTable();
    if(tabId === 'desenvolvimento') renderPDIRadar();
}

function openSubTab(evt, subTabId) {
    const parent = evt.currentTarget.closest('.main-content');
    // Esconde sub-conteúdos apenas deste bloco
    parent.querySelectorAll(".sub-content").forEach(c => c.style.display = "none");
    parent.querySelectorAll(".sub-tab").forEach(t => t.classList.remove("active"));
    
    const target = document.getElementById(subTabId);
    if(target) target.style.display = "block";
    evt.currentTarget.classList.add("active");
}

// --- CADASTROS ---
function addPerson() {
    const name = document.getElementById('personName').value.trim();
    if(!name) return alert("Digite o nome");

    people.push({
        name: name,
        role: document.getElementById('personRole').value || "-",
        manager: document.getElementById('personManager').value || "-"
    });

    syncToFirebase();
    document.getElementById('personName').value = "";
}

function addSkill() {
    const name = document.getElementById('skillName').value.trim();
    if(!name) return alert("Digite o título da competência");

    skills.push({
        name: name,
        description: document.getElementById('skillDescription').value || "",
        type: document.getElementById('skillType').value
    });

    syncToFirebase();
    document.getElementById('skillName').value = "";
    document.getElementById('skillDescription').value = "";
}

// --- RENDERIZAÇÃO ---
function renderAll() {
    renderPeople();
    renderSkills();
    renderGroups();
    renderSkillPlansTable();
    updateAllSelects();
}

function renderPeople() {
    const list = document.getElementById('peopleList');
    if(!list) return;
    list.innerHTML = people.map((p, i) => `
        <tr>
            <td>${p.name}</td>
            <td>${p.role}</td>
            <td>${p.manager}</td>
            <td><button class="btn-delete" onclick="deleteItem('people', ${i})"><i class="fas fa-trash"></i></button></td>
        </tr>
    `).join('');
}

function renderSkills() {
    const list = document.getElementById('skillsList');
    if(!list) return;
    list.innerHTML = skills.map((s, i) => `
        <tr>
            <td>${s.name}</td>
            <td>${s.type}</td>
            <td><button class="btn-delete" onclick="deleteItem('skills', ${i})"><i class="fas fa-trash"></i></button></td>
        </tr>
    `).join('');
}

function deleteItem(type, index) {
    if(!confirm("Excluir permanentemente?")) return;
    if(type === 'people') people.splice(index, 1);
    if(type === 'skills') skills.splice(index, 1);
    syncToFirebase();
}

function updateAllSelects() {
    const pOpt = '<option value="">Selecione...</option>' + people.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
    const sOpt = '<option value="">Selecione...</option>' + skills.map(s => `<option value="${s.name}">${s.name}</option>`).join('');

    const ids = ['personSelectField', 'evalPersonSelect', 'pdiPersonSelect', 'filterActionPlanPerson', 'skillPlanSelect'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerHTML = (id === 'skillPlanSelect') ? sOpt : pOpt;
    });
}