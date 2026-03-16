import express from "express";
import { config } from "dotenv";

config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ========== TIPOS ==========
type StatusProject = 'active' | 'finished';
type StatusTask = 'todo' | 'doing' | 'done';
type PriorityTask = 'low' | 'medium' | 'high';

// ========== BANCO DE DADOS EM MEMÓRIA ==========
let projetos: Array<{
    id: string;
    name: string;
    description: string;
    status: StatusProject;
    createdAt: string;
    tasks: Array<{
        id: string;
        title: string;
        description: string;
        status: StatusTask;
        priority: PriorityTask;
        createdAt: string;
    }>
}> = [];

// ========== ROTAS DE PROJETO ==========

// 1. Criar projeto (com ou sem tasks)
app.post('/projects', (req, res) => {
    const { name, description, tasks } = req.body;

    if (!name || !description) {
        return res.status(400).json({ erro: "Nome e descrição são obrigatórios" });
    }

    // Cria as tasks se vieram no body
    const novasTasks = tasks ? tasks.map((task: any) => ({
         id: Date.now().toString() + Math.random(),
        title: task.title,
        description: task.description || "",
        status: task.status || 'todo',
        priority: task.priority || 'medium',
        createdAt: new Date().toISOString()
    })) : [];

    const novoProjeto = {
        id: Date.now().toString(),
        name,
        description,
        status: 'active' as StatusProject,
        createdAt: new Date().toISOString(),
        tasks: novasTasks
    };

    projetos.push(novoProjeto);
    res.status(201).json(novoProjeto);
});

// 2. Listar todos os projetos (com filtro opcional)
app.get('/projects', (req, res) => {
    const { status } = req.query;
    
    if (status && (status === 'active' || status === 'finished')) {
        const filtrados = projetos.filter(p => p.status === status);
        return res.json(filtrados);
    }
    
    res.json(projetos);
});


// 3. Buscar projeto por ID (já vem com as tasks)
app.get('/projects/:id', (req, res) => {
    const { id } = req.params;
    const projeto = projetos.find(p => p.id === id);

    if (!projeto) {
        return res.status(404).json({ erro: "Projeto não encontrado" });
    }

    res.json(projeto);
});

// 4. Atualizar projeto
app.put('/projects/:id', (req, res) => {
    const { id } = req.params;
    const { name, description, status } = req.body;
    
    const projeto = projetos.find(p => p.id === id);
    
    if (!projeto) {
        return res.status(404).json({ erro: "Projeto não encontrado" });
    }

    if (name) projeto.name = name;
    if (description) projeto.description = description;
    if (status && (status === 'active' || status === 'finished')) {
        projeto.status = status;
    }

    res.json(projeto);
});

// Deletar projeto
app.delete('/projects/:id', (req, res) => {
    const { id } = req.params;
    
    const index = projetos.findIndex(p => p.id === id);
    
    if (index === -1) {
        return res.status(404).json({ erro: "Projeto não encontrado" });
    }

    // PEGA O PROJETO e já verifica na mesma linha
    const projeto = projetos[index];
    
    // Verifica se tem tarefa não concluída (com segurança)
    const temPendente = projeto?.tasks?.some(t => t.status !== 'done') || false;
    
    if (temPendente) {
        return res.status(400).json({ 
            erro: "Não pode deletar projeto com tarefas pendentes" 
        });
    }

    projetos.splice(index, 1);
    res.status(204).send();
});

// ========== ROTAS DE TAREFA ==========

// 6. Adicionar tarefa em um projeto
app.post('/projects/:projectId/tasks', (req, res) => {
    const { projectId } = req.params;
    const { title, description, priority } = req.body;

    if (!title) {
        return res.status(400).json({ erro: "Título da tarefa é obrigatório" });
    }

    const projeto = projetos.find(p => p.id === projectId);
    
    if (!projeto) {
        return res.status(404).json({ erro: "Projeto não encontrado" });
    }

    // Garante que tasks existe
    if (!projeto.tasks) {
        projeto.tasks = [];
    }

    const novaTask = {
        id: Date.now().toString(),
        title,
        description: description || "",
        status: 'todo' as StatusTask,
        priority: (priority as PriorityTask) || 'medium',
        createdAt: new Date().toISOString()
    };

    projeto.tasks.push(novaTask);
    res.status(201).json(novaTask);
});

// 7. Listar todas as tarefas (com filtros)
app.get('/tasks', (req, res) => {
    const { status, priority, projectId } = req.query;
    
    // Pega todas as tarefas de todos os projetos
    let todasTasks: any[] = [];
    
    projetos.forEach(projeto => {
        if (!projectId || projeto.id === projectId) {
            if (projeto.tasks) {
                todasTasks = [...todasTasks, ...projeto.tasks];
            }
        }
    });

    let resultado = todasTasks;

    // Filtros
    if (status && ['todo', 'doing', 'done'].includes(status as string)) {
        resultado = resultado.filter(t => t.status === status);
    }

    if (priority && ['low', 'medium', 'high'].includes(priority as string)) {
        resultado = resultado.filter(t => t.priority === priority);
    }

    res.json(resultado);
});

// 8. Atualizar tarefa
app.patch('/tasks/:id', (req, res) => {
    const { id } = req.params;
    const { title, description, status, priority } = req.body;
    
    // Procura a tarefa em todos os projetos
    for (const projeto of projetos) {
        if (projeto.tasks) {
            const task = projeto.tasks.find(t => t.id === id);
            if (task) {
                if (title) task.title = title;
                if (description) task.description = description;
                if (status && ['todo', 'doing', 'done'].includes(status)) {
                    task.status = status as StatusTask;
                }
                if (priority && ['low', 'medium', 'high'].includes(priority)) {
                    task.priority = priority as PriorityTask;
                }
                return res.json(task);
            }
        }
    }
    
    res.status(404).json({ erro: "Tarefa não encontrada" });
});

// 9. Deletar tarefa
app.delete('/tasks/:id', (req, res) => {
    const { id } = req.params;
    
    // Procura e remove a tarefa
    for (const projeto of projetos) {
        if (projeto.tasks) {
            const index = projeto.tasks.findIndex(t => t.id === id);
            if (index !== -1) {
                projeto.tasks.splice(index, 1);
                return res.status(204).send();
            }
        }
    }
    
    res.status(404).json({ erro: "Tarefa não encontrada" });
});

// 10. Rota de teste
app.get('/', (req, res) => {
    res.json({ message: "API de Projetos e Tarefas funcionando!" });
});

// ========== INICIAR SERVIDOR ==========
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📝 Teste: http://localhost:${PORT}`);
});